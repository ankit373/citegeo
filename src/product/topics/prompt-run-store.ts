import { AnswerIndexService, type AnswerIndexDifference } from "../index/answer-index-service.js";
import type { ProductProjectFileStore } from "../projects/project-store.js";
import { listJson, putJson, readJsonEntries } from "../storage/object-store.js";
import type { PromptAnswer, PromptRun } from "./prompt-run-schema.js";

/** Runs and their answers, one collection per project. */
export class PromptRunFileStore {
  constructor(
    private readonly projects: ProductProjectFileStore,
    private readonly index: AnswerIndexService = new AnswerIndexService(),
  ) {}

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
    const prefix = this.answersPrefix(answer.projectId);
    const key = `${prefix}/${answer.id}.json`;
    // The store is the record and the index only a cache of it, so the write
    // lands first. A crash between the two is repaired by the next read.
    await putJson(this.projects.objects, key, answer);
    await this.index.record(prefix, key, answer);
  }

  /** Newest first. */
  async listRuns(projectId: string): Promise<PromptRun[]> {
    const rows = await listJson<PromptRun>(this.projects.objects, this.runsPrefix(projectId));
    return rows.sort((left, right) => right.startedAt.localeCompare(left.startedAt));
  }

  async listAnswers(projectId: string, runId?: string): Promise<PromptAnswer[]> {
    const store = this.projects.objects;
    const plan = await this.index.plan(store, this.answersPrefix(projectId), runId);
    const entries = await readJsonEntries<PromptAnswer>(store, plan.keys);
    await this.index.observe(plan, entries);
    // The answer's own runId decides, so an index that has gone stale can
    // narrow a read but can never put a row into an answer set.
    const scoped = runId ? entries.filter((entry) => entry.value.runId === runId) : entries;
    return scoped.map((entry) => entry.value).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  /** Repopulates the index for this project by scanning what is stored. */
  async rebuildAnswerIndex(projectId: string): Promise<number | null> {
    return this.index.rebuild(this.projects.objects, this.answersPrefix(projectId));
  }

  /** Reports where the index and the stored answers disagree, changing neither. */
  async verifyAnswerIndex(projectId: string): Promise<AnswerIndexDifference | null> {
    return this.index.verify(this.projects.objects, this.answersPrefix(projectId));
  }
}
