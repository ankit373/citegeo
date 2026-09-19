import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProductProjectFileStore } from "../projects/project-store.js";
import type { SiteSignals } from "./site-signals.js";
import type { SignalChange } from "./signal-diff.js";

export interface SiteSignalSnapshot {
  id: string;
  projectId: string;
  capturedAt: string;
  signals: SiteSignals;
  /** What moved since the previous snapshot. Empty on the first one. */
  changes: SignalChange[];
}

function notFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

// Temp file then rename, the same discipline the other stores use, so a reader
// never sees a half-written snapshot. This matters because the probe runs in
// the worker while the server is serving reads off the same volume.
async function writeJson(path: string, value: unknown): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

export class SiteSignalFileStore {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private root(projectId: string): string {
    return join(this.projects.projectDir(projectId), "signals");
  }

  async save(snapshot: SiteSignalSnapshot): Promise<void> {
    await mkdir(this.root(snapshot.projectId), { recursive: true });
    await writeJson(join(this.root(snapshot.projectId), `${snapshot.id}.json`), snapshot);
  }

  /** Newest first, because every caller wants the latest state. */
  async list(projectId: string): Promise<SiteSignalSnapshot[]> {
    try {
      const rows: SiteSignalSnapshot[] = [];
      for (const entry of await readdir(this.root(projectId), { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        try {
          rows.push(JSON.parse(await readFile(join(this.root(projectId), entry.name), "utf8")) as SiteSignalSnapshot);
        } catch {
          continue;
        }
      }
      return rows.sort((left, right) => right.capturedAt.localeCompare(left.capturedAt));
    } catch (error) {
      if (notFound(error)) return [];
      throw error;
    }
  }

  async latest(projectId: string): Promise<SiteSignalSnapshot | null> {
    return (await this.list(projectId))[0] || null;
  }
}
