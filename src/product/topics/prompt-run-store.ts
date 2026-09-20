import type { ProductProjectFileStore } from "../projects/project-store.js";
import { getJson, putJson, type ObjectStore } from "../storage/object-store.js";
import type { PromptAnswer, PromptRun } from "./prompt-run-schema.js";

async function readAll<T>(store: ObjectStore, prefix: string): Promise<T[]> {
  const rows: T[] = [];
  for (const key of await store.list(prefix)) {
    if (!key.endsWith(".json")) continue;
    const row = await getJson<T>(store, key);
    // A document mid-write is not a corrupt store.
    if (row) rows.push(row);
  }
  return rows;
}

/** Runs and their answers, one collection per project. */
export class PromptRunFileStore {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private runsPrefix(projectId: string): string {
    return this.projects.keyFor(projectId, "prompt-runs");
  }

  private answersPrefix(projectId: string): string {
    return this.projects.keyFor(projectId, "prompt-answers");
  }

  async saveRun(run: PromptRun): Promise<void> {
    await putJson(this.projects.objects, `${this.runsPrefix(run.projectId)}/${run.id}.json`, run);
  }

  async saveAnswer(answer: PromptAnswer): Promise<void> {
    await putJson(this.projects.objects, `${this.answersPrefix(answer.projectId)}/${answer.id}.json`, answer);
  }

  /** Newest first. */
  async listRuns(projectId: string): Promise<PromptRun[]> {
    const rows = await readAll<PromptRun>(this.projects.objects, this.runsPrefix(projectId));
    return rows.sort((left, right) => right.startedAt.localeCompare(left.startedAt));
  }

  async listAnswers(projectId: string, runId?: string): Promise<PromptAnswer[]> {
    const rows = await readAll<PromptAnswer>(this.projects.objects, this.answersPrefix(projectId));
    const scoped = runId ? rows.filter((row) => row.runId === runId) : rows;
    return scoped.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }
}
