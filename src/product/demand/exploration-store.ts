import type { ProductProjectFileStore } from "../projects/project-store.js";
import { getJson, listJson, putJson } from "../storage/object-store.js";
import { sha256 } from "../../utils/hash.js";
import type { ExplorationReport } from "./conversation-explorer.js";

export interface StoredExploration extends ExplorationReport {
  id: string;
  projectId: string;
  sourceId: string;
  exploredAt: string;
}

/** Keyed by the query, so exploring the same thing twice replaces the older
 * answer rather than leaving two that disagree. */
export function explorationId(query: string): string {
  return sha256(query.trim().toLowerCase()).slice(0, 24);
}

export class ExplorationFileStore {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private key(projectId: string, id: string): string {
    return this.projects.keyFor(projectId, `conversations/${id}.json`);
  }

  async list(projectId: string): Promise<StoredExploration[]> {
    const rows = await listJson<StoredExploration>(this.projects.objects, this.projects.keyFor(projectId, "conversations/"));
    return rows.sort((left, right) => right.exploredAt.localeCompare(left.exploredAt));
  }

  async read(projectId: string, id: string): Promise<StoredExploration | null> {
    return getJson<StoredExploration>(this.projects.objects, this.key(projectId, id));
  }

  async save(row: StoredExploration): Promise<void> {
    await putJson(this.projects.objects, this.key(row.projectId, row.id), row);
  }
}
