import { randomUUID } from "node:crypto";
import { listJson, putJson } from "../storage/object-store.js";
import type { ProductProjectFileStore } from "../projects/project-store.js";

/** A provider report is a point-in-time observation, never a mutable current
 * value. Scope and freshness travel with every point so later comparisons do
 * not accidentally join a US estimate to an India estimate, or partial days
 * to complete ones. */
export type ExternalMetricSource = "google_search_console" | "google_analytics" | "ahrefs" | "semrush";

export interface ExternalMetricSnapshot {
  id: string;
  projectId: string;
  source: ExternalMetricSource;
  metricDefinitionVersion: 1;
  sourceScope: Record<string, string>;
  observedAt: string;
  periodStart: string;
  periodEnd: string;
  dataFreshThrough: string;
  values: Record<string, number | null>;
  completeness: "complete" | "partial" | "unknown";
}

function keyPart(value: string): string {
  return [...value].filter((character) => (character >= "a" && character <= "z") || (character >= "A" && character <= "Z") || (character >= "0" && character <= "9")).join("").slice(0, 24) || "snapshot";
}

export class ExternalMetricSnapshotStore {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private prefix(projectId: string): string {
    return this.projects.keyFor(projectId, "external-metrics", "snapshots");
  }

  async append(input: Omit<ExternalMetricSnapshot, "id" | "metricDefinitionVersion">): Promise<ExternalMetricSnapshot> {
    const snapshot: ExternalMetricSnapshot = { ...input, id: randomUUID(), metricDefinitionVersion: 1 };
    const key = this.projects.keyFor(
      input.projectId,
      "external-metrics",
      "snapshots",
      `${snapshot.observedAt.split(":").join("-").split(".").join("-")}-${keyPart(snapshot.source)}-${snapshot.id}.json`,
    );
    await putJson(this.projects.objects, key, snapshot);
    return snapshot;
  }

  async list(projectId: string, source?: ExternalMetricSource): Promise<ExternalMetricSnapshot[]> {
    const snapshots = await listJson<ExternalMetricSnapshot>(this.projects.objects, this.prefix(projectId));
    return snapshots
      .filter((snapshot) => snapshot.projectId === projectId && (!source || snapshot.source === source))
      .sort((left, right) => right.observedAt.localeCompare(left.observedAt));
  }
}
