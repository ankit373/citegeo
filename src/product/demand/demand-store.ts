import type { ProductProjectFileStore } from "../projects/project-store.js";
import { getJson, putJson } from "../storage/object-store.js";
import type { DemandReport } from "./corpus-schema.js";

/** The report, not the index. A million-question index is hundreds of megabytes
 * and goes stale the moment the prompt set changes. */
export class DemandReportFileStore {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private key(projectId: string): string {
    return this.projects.keyFor(projectId, "prompt-demand.json");
  }

  async load(projectId: string): Promise<DemandReport | null> {
    return getJson<DemandReport>(this.projects.objects, this.key(projectId));
  }

  async save(projectId: string, report: DemandReport): Promise<void> {
    await putJson(this.projects.objects, this.key(projectId), report);
  }
}
