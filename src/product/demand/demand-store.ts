import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProductProjectFileStore } from "../projects/project-store.js";
import type { DemandReport } from "./corpus-schema.js";

function notFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

/** The report, not the index. A million-question index is hundreds of megabytes
 * and goes stale the moment the prompt set changes. */
export class DemandReportFileStore {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private path(projectId: string): string {
    return join(this.projects.projectDir(projectId), "prompt-demand.json");
  }

  async load(projectId: string): Promise<DemandReport | null> {
    try {
      return JSON.parse(await readFile(this.path(projectId), "utf8")) as DemandReport;
    } catch (error) {
      if (notFound(error)) return null;
      throw error;
    }
  }

  async save(projectId: string, report: DemandReport): Promise<void> {
    await mkdir(this.projects.projectDir(projectId), { recursive: true });
    const path = this.path(projectId);
    const temporary = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await rename(temporary, path);
  }
}
