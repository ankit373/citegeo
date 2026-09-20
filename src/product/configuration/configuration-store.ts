import type { ProductProjectFileStore } from "../projects/project-store.js";
import { getJson, listJson, putJson } from "../storage/object-store.js";
import type { ProductBaseline } from "./baseline-schema.js";
import type { ProductModelSelection } from "./model-selection-schema.js";

export class ProductConfigurationFileStore {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private selectionsKey(projectId: string): string {
    return this.projects.keyFor(projectId, "model-selections.json");
  }

  private baselinePrefix(projectId: string): string {
    return this.projects.keyFor(projectId, "baselines");
  }

  private baselineKey(projectId: string, baselineId: string): string {
    return `${this.baselinePrefix(projectId)}/${baselineId}.json`;
  }

  async readModelSelections(projectId: string): Promise<ProductModelSelection[]> {
    const selections = await getJson<ProductModelSelection[]>(this.projects.objects, this.selectionsKey(projectId));
    return Array.isArray(selections) ? selections : [];
  }

  async saveModelSelections(projectId: string, selections: ProductModelSelection[]): Promise<void> {
    await putJson(this.projects.objects, this.selectionsKey(projectId), selections);
  }

  async listBaselines(projectId: string): Promise<ProductBaseline[]> {
    const rows = await listJson<ProductBaseline>(this.projects.objects, this.baselinePrefix(projectId));
    return rows.sort((left, right) => left.version - right.version);
  }

  async readBaseline(projectId: string, baselineId: string): Promise<ProductBaseline | null> {
    return getJson<ProductBaseline>(this.projects.objects, this.baselineKey(projectId, baselineId));
  }

  async saveBaseline(baseline: ProductBaseline): Promise<void> {
    await putJson(this.projects.objects, this.baselineKey(baseline.projectId, baseline.id), baseline);
  }
}
