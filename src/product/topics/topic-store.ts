import type { ProductProjectFileStore } from "../projects/project-store.js";
import { getJson, putJson } from "../storage/object-store.js";
import { emptyTopicSet, type TopicSet } from "./topic-schema.js";

/** One document per project: a topic and its prompts are edited together, and
 * half a set is not a valid state to read back. */
export class TopicFileStore {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private key(projectId: string): string {
    return this.projects.keyFor(projectId, "topics.json");
  }

  async load(projectId: string): Promise<TopicSet> {
    const parsed = await getJson<TopicSet>(this.projects.objects, this.key(projectId));
    // A project that has never had a set reads as empty, not as an error.
    if (!parsed) return emptyTopicSet(projectId);
    return { ...emptyTopicSet(projectId), ...parsed, projectId };
  }

  async save(set: TopicSet): Promise<void> {
    await putJson(this.projects.objects, this.key(set.projectId), { ...set, updatedAt: new Date().toISOString() });
  }
}
