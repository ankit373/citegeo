import type { ProductProjectFileStore } from "../projects/project-store.js";
import { getJson, listJson, putJson } from "../storage/object-store.js";
import { withPublication, type AgentDraft } from "./agent-schema.js";

export class AgentDraftFileStore {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private prefix(projectId: string): string {
    return this.projects.keyFor(projectId, "drafts/");
  }

  private key(projectId: string, draftId: string): string {
    return this.projects.keyFor(projectId, `drafts/${draftId}.json`);
  }

  async list(projectId: string): Promise<AgentDraft[]> {
    const rows = await listJson<AgentDraft>(this.projects.objects, this.prefix(projectId));
    return rows.map(withPublication).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async read(projectId: string, draftId: string): Promise<AgentDraft | null> {
    const draft = await getJson<AgentDraft>(this.projects.objects, this.key(projectId, draftId));
    return draft ? withPublication(draft) : null;
  }

  async save(draft: AgentDraft): Promise<void> {
    await putJson(this.projects.objects, this.key(draft.projectId, draft.id), draft);
  }
}
