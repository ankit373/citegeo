import type { PromptAnswer, PromptRun } from "./prompt-run-schema.js";
import { scoreAnswers, type VisibilityScore } from "./visibility-score.js";

// A score is a snapshot. The question anyone actually has is whether it is
// moving, so a run is the unit of time here: one point per run, in the order
// the runs happened.

export interface TrendPoint {
  runId: string;
  /** When the run started. Empty when a run predates the field, which is not a failure. */
  at: string;
  score: VisibilityScore;
  /** Rank against everyone named in that run, or null when never named. */
  rank: number | null;
  /** Markets asked in that run, so a change in coverage is not read as a change in score. */
  regionIds: string[];
}

export interface PromptTrend {
  points: TrendPoint[];
  /** Score now minus score at the first comparable point. Null with fewer than two. */
  change: number | null;
  /** The run the change is measured from. */
  since: string | null;
}

export function buildPromptTrend(input: {
  runs: PromptRun[];
  answers: PromptAnswer[];
  rankOf: (answers: PromptAnswer[]) => number | null;
}): PromptTrend {
  const byRun = new Map<string, PromptAnswer[]>();
  for (const answer of input.answers) {
    byRun.set(answer.runId, [...(byRun.get(answer.runId) || []), answer]);
  }

  const points: TrendPoint[] = [];
  // Oldest first, because a trend is read left to right.
  const ordered = [...input.runs].sort((left, right) => left.startedAt.localeCompare(right.startedAt));
  for (const run of ordered) {
    const mine = byRun.get(run.id) || [];
    // A run that produced nothing readable is left out rather than plotted at
    // zero: an outage is not a drop in visibility.
    if (!mine.some((answer) => answer.status === "completed")) continue;
    points.push({
      runId: run.id,
      at: run.startedAt || "",
      score: scoreAnswers(mine),
      rank: input.rankOf(mine),
      regionIds: run.regionIds || [],
    });
  }

  const first = points[0];
  const last = points[points.length - 1];
  const comparable = points.length > 1 && first && last && first.score.score !== null && last.score.score !== null;
  return {
    points,
    change: comparable ? Math.round(((last.score.score as number) - (first.score.score as number)) * 10) / 10 : null,
    since: comparable ? first.at : null,
  };
}
