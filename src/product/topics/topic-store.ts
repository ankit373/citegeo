import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProductProjectFileStore } from "../projects/project-store.js";
import { emptyTopicSet, type TopicSet } from "./topic-schema.js";

function notFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

// Temp file then rename, as every other store here does, because the worker
// writes while the server reads the same volume.
async function writeJson(path: string, value: unknown): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

/** One file per project: a topic and its prompts are edited together, and half
 * a set is not a valid state to read back. */
export class TopicFileStore {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private path(projectId: string): string {
    return join(this.projects.projectDir(projectId), "topics.json");
  }

  async load(projectId: string): Promise<TopicSet> {
    try {
      const raw = await readFile(this.path(projectId), "utf8");
      const parsed = JSON.parse(raw) as TopicSet;
      // A project that has never had a set reads as empty, not as an error.
      return { ...emptyTopicSet(projectId), ...parsed, projectId };
    } catch (error) {
      if (notFound(error)) return emptyTopicSet(projectId);
      throw error;
    }
  }

  async save(set: TopicSet): Promise<void> {
    await mkdir(this.projects.projectDir(set.projectId), { recursive: true });
    await writeJson(this.path(set.projectId), { ...set, updatedAt: new Date().toISOString() });
  }
}
