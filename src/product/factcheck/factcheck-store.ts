import type { ProductProjectFileStore } from "../projects/project-store.js";
import { getJson, putJson } from "../storage/object-store.js";
import type { FactCheckReport } from "./factcheck-schema.js";

export class FactCheckFileStore {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private key(projectId: string): string {
    return this.projects.keyFor(projectId, "factcheck.json");
  }

  async load(projectId: string): Promise<FactCheckReport | null> {
    return getJson<FactCheckReport>(this.projects.objects, this.key(projectId));
  }

  async save(report: FactCheckReport): Promise<void> {
    await putJson(this.projects.objects, this.key(report.projectId), report);
  }
}
