import { mkdir, open, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { sha256 } from "../../utils/hash.js";
import { getJson, LocalObjectStore, putJson, type ObjectStore } from "../storage/object-store.js";
import type { ProductProject, ProductProjectListOptions } from "./project-schema.js";

function safeSegment(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "." || trimmed === ".." || trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("\0")) {
    throw new Error(`Invalid ${label}.`);
  }
  return trimmed;
}

function isNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

function visibleInList(project: ProductProject, options: ProductProjectListOptions): boolean {
  if (project.status === "deleted") return options.includeDeleted === true;
  if (project.status === "archived") return options.includeArchived === true;
  return true;
}

export class ProductProjectFileStore {
  readonly objects: ObjectStore;

  constructor(private readonly rootDir: string, objects?: ObjectStore) {
    this.objects = objects || new LocalObjectStore(rootDir);
  }

  /** The key prefix every store hangs its own documents off. */
  projectKey(projectId: string): string {
    return `projects/${safeSegment(projectId, "project id")}`;
  }

  /** A document belonging to a project, by its path within that project. */
  keyFor(projectId: string, ...parts: string[]): string {
    return [this.projectKey(projectId), ...parts].join("/");
  }

  async read(projectId: string): Promise<ProductProject | null> {
    const project = await getJson<ProductProject>(this.objects, this.keyFor(projectId, "project.json"));
    if (!project) return null;
    if (project.id !== projectId) throw new Error(`Project file does not belong to ${projectId}.`);
    return project;
  }

  async list(options: ProductProjectListOptions = {}): Promise<ProductProject[]> {
    const projects: ProductProject[] = [];
    for (const key of await this.objects.list("projects")) {
      if (!key.endsWith("/project.json")) continue;
      const project = await getJson<ProductProject>(this.objects, key);
      if (project && visibleInList(project, options)) projects.push(project);
    }
    return projects.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async listAll(): Promise<ProductProject[]> {
    return this.list({ includeArchived: true, includeDeleted: true });
  }

  async save(project: ProductProject): Promise<void> {
    await putJson(this.objects, this.keyFor(project.id, "project.json"), project);
  }

  async purge(projectId: string): Promise<void> {
    const prefix = this.projectKey(projectId);
    const keys = await this.objects.list(prefix);
    if (!keys.length) throw new Error(`Project ${projectId} has nothing stored.`);
    for (const key of keys) await this.objects.delete(key);
  }

  /**
   * Stays on local disk whatever the backend is. It needs an atomic
   * create-if-absent, which object storage does not offer portably, and the
   * deployment is single-writer so a local lock is the right scope.
   */
  async withDomainLock<T>(normalizedDomain: string, operation: () => Promise<T>): Promise<T> {
    const locksDir = resolve(this.rootDir, "locks");
    await mkdir(locksDir, { recursive: true });
    const path = join(locksDir, `${sha256(normalizedDomain)}.lock`);
    let handle;
    try {
      handle = await open(path, "wx");
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
        throw new Error("A project change for this domain is already in progress.");
      }
      throw error;
    }
    try {
      return await operation();
    } finally {
      await handle.close();
      try {
        await unlink(path);
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
    }
  }
}
