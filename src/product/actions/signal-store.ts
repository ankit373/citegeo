import type { ProductProjectFileStore } from "../projects/project-store.js";
import { listJson, putJson } from "../storage/object-store.js";
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

export class SiteSignalFileStore {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private prefix(projectId: string): string {
    return this.projects.keyFor(projectId, "signals");
  }

  async save(snapshot: SiteSignalSnapshot): Promise<void> {
    await putJson(this.projects.objects, `${this.prefix(snapshot.projectId)}/${snapshot.id}.json`, snapshot);
  }

  /** Newest first, because every caller wants the latest state. */
  async list(projectId: string): Promise<SiteSignalSnapshot[]> {
    const rows = await listJson<SiteSignalSnapshot>(this.projects.objects, this.prefix(projectId));
    return rows.sort((left, right) => right.capturedAt.localeCompare(left.capturedAt));
  }

  async latest(projectId: string): Promise<SiteSignalSnapshot | null> {
    return (await this.list(projectId))[0] || null;
  }
}
