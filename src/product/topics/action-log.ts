import { getJson, listJson, putJson } from "../storage/object-store.js";
import type { ProductProjectFileStore } from "../projects/project-store.js";
import { sha256 } from "../../utils/hash.js";
import type { TopicInsights } from "./topic-insights.js";

// A plan nobody records is a plan nobody measures. Taking a move snapshots the
// standing at that moment, so the next run can say what changed since.

export type ActionState = "open" | "doing" | "done" | "dismissed";

export const ACTION_STATES: ActionState[] = ["open", "doing", "done", "dismissed"];

export function isActionState(value: unknown): value is ActionState {
  return typeof value === "string" && (ACTION_STATES as string[]).includes(value);
}

/** The standing when a move was taken up. Everything an effect is measured
 * against, recorded rather than remembered. */
export interface StandingSnapshot {
  at: string;
  score: number | null;
  rank: number | null;
  answers: number;
  appearances: number;
}

export interface TakenAction {
  id: string;
  projectId: string;
  moveId: string;
  /** Set when the move is about one question rather than the whole project. */
  promptId: string | null;
  state: ActionState;
  note: string;
  /** Null while the move is still open: nothing has been taken up to measure. */
  startedFrom: StandingSnapshot | null;
  createdAt: string;
  updatedAt: string;
}

/** What changed since a move was taken up. Null components stay null: a score
 * that could not be measured then cannot produce a delta now. */
export interface ActionEffect {
  since: string;
  answersAdded: number;
  scoreThen: number | null;
  scoreNow: number | null;
  scoreChange: number | null;
  rankThen: number | null;
  rankNow: number | null;
  appearancesAdded: number;
  /** True when no answer has been archived since, so nothing can have moved. */
  nothingRunSince: boolean;
}

export function snapshotOf(insights: TopicInsights, at = new Date().toISOString()): StandingSnapshot {
  return {
    at,
    score: insights.overall.score,
    rank: insights.rank,
    answers: insights.answers,
    appearances: insights.overall.appearances,
  };
}

export function effectOf(action: TakenAction, insights: TopicInsights): ActionEffect | null {
  const then = action.startedFrom;
  if (!then) return null;
  const answersAdded = insights.answers - then.answers;
  return {
    since: then.at,
    answersAdded,
    scoreThen: then.score,
    scoreNow: insights.overall.score,
    // A change needs both ends. One missing end is not a change of zero.
    scoreChange: then.score === null || insights.overall.score === null ? null : insights.overall.score - then.score,
    rankThen: then.rank,
    rankNow: insights.rank,
    appearancesAdded: insights.overall.appearances - then.appearances,
    nothingRunSince: answersAdded <= 0,
  };
}

export class ActionLogStore {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private key(projectId: string, id: string): string {
    return this.projects.keyFor(projectId, "actions", `${sha256(id)}.json`);
  }

  private prefix(projectId: string): string {
    return this.projects.keyFor(projectId, "actions");
  }

  static idFor(moveId: string, promptId: string | null): string {
    return promptId ? `${moveId}:${promptId}` : moveId;
  }

  async list(projectId: string): Promise<TakenAction[]> {
    const rows = await listJson<TakenAction>(this.projects.objects, this.prefix(projectId));
    return rows
      .filter((row) => row.projectId === projectId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async read(projectId: string, id: string): Promise<TakenAction | null> {
    const row = await getJson<TakenAction>(this.projects.objects, this.key(projectId, id));
    return row && row.projectId === projectId ? row : null;
  }

  async save(value: TakenAction): Promise<void> {
    await putJson(this.projects.objects, this.key(value.projectId, value.id), value);
  }
}

export class ActionLogService {
  constructor(private readonly store: ActionLogStore) {}

  list(projectId: string): Promise<TakenAction[]> {
    return this.store.list(projectId);
  }

  /** Taking a move up records where you started. Returning it to open clears
   * that, because a restarted move is measured from the restart. */
  async set(input: {
    projectId: string;
    moveId: string;
    promptId?: string | null | undefined;
    state: ActionState;
    note?: string | undefined;
    insights: TopicInsights;
  }): Promise<TakenAction> {
    const promptId = input.promptId || null;
    const id = ActionLogStore.idFor(input.moveId, promptId);
    const now = new Date().toISOString();
    const existing = await this.store.read(input.projectId, id);
    const keepFrom = input.state === "open" ? null : existing?.startedFrom || snapshotOf(input.insights, now);
    const value: TakenAction = {
      id,
      projectId: input.projectId,
      moveId: input.moveId,
      promptId,
      state: input.state,
      note: input.note === undefined ? existing?.note || "" : input.note,
      startedFrom: keepFrom,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    await this.store.save(value);
    return value;
  }
}
