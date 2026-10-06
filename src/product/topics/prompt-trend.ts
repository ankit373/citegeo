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

/** One brand's share across the runs, so several can be drawn on one axis.
 * Share rather than score: a rival has no score, only a presence. */
export interface RivalSeries {
  name: string;
  isTarget: boolean;
  /** Null at a run where the brand was not named, which is a zero share and
   * not a gap, so the line is drawn through it. The answer count travels with
   * each share because a run of one answer can only report nought or one, and
   * a line drawn through those is a picture of run size. */
  points: Array<{ runId: string; at: string; share: number; answers: number; readable: boolean }>;
}

export interface PromptTrend {
  points: TrendPoint[];
  /** Score at the latest readable point less the score at the earliest, where
   * there are two. Null where there are not: a run of one answer is not a
   * reading, and the difference between two of them is not a change. */
  change: number | null;
  /** The run the change is measured from. */
  since: string | null;
  /** Points too thin to read, so a chart can mark them rather than drawing a
   * line through them. */
  thinPoints: number;
  /** Points a figure can be read off. The change rests on these. */
  readablePoints: number;
  /** The brands named most often overall, each across every run. Absent
   * when the caller did not ask for them. */
  rivals?: RivalSeries[];
}

export function buildPromptTrend(input: {
  runs: PromptRun[];
  answers: PromptAnswer[];
  rankOf: (answers: PromptAnswer[]) => number | null;
  /** Optional, because a caller that only wants the target's line pays nothing. */
  sharesOf?: (answers: PromptAnswer[]) => Array<{ name: string; isTarget: boolean; shareOfAnswers: number | null }>;
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

  // A point whose interval is too wide to read is not an endpoint a change can
  // be measured from. Taking the first and last readable ones rather than the
  // first and last of all reports a real move where there is one, instead of
  // the difference between two runs that each said nothing.
  const readable = points.filter(isReadable);
  const first = readable[0];
  const last = readable[readable.length - 1];
  const comparable = readable.length > 1 && first && last;
  return {
    points,
    change: comparable ? Math.round(((last.score.score as number) - (first.score.score as number)) * 10) / 10 : null,
    since: comparable ? first.at : null,
    thinPoints: points.length - readable.length,
    readablePoints: readable.length,
    rivals: input.sharesOf ? rivalSeries(points, byRun, input.sharesOf) : [],
  };
}

/** A point carrying a score off enough answers to mean something. */
export type ReadablePoint = TrendPoint & { score: VisibilityScore & { score: number } };

/** The flag is the score's own, so this never invents a second threshold. */
export function isReadable(point: TrendPoint): point is ReadablePoint {
  return point.score.score !== null && !point.score.tooFewAnswers;
}

/** The brands worth drawing, and their share at every run. Chosen by total
 * appearances so the lines stay the same set as the run count grows. */
function rivalSeries(
  points: TrendPoint[],
  byRun: Map<string, PromptAnswer[]>,
  sharesOf: (answers: PromptAnswer[]) => Array<{ name: string; isTarget: boolean; shareOfAnswers: number | null }>,
  limit = 5,
): RivalSeries[] {
  const totals = new Map<string, { name: string; isTarget: boolean; total: number }>();
  for (const point of points) {
    for (const row of sharesOf(byRun.get(point.runId) || [])) {
      const held = totals.get(row.name) || { name: row.name, isTarget: row.isTarget, total: 0 };
      held.total += row.shareOfAnswers || 0;
      totals.set(row.name, held);
    }
  }
  // The target is always drawn, even at zero, because its absence is the point.
  const ranked = [...totals.values()].sort((left, right) => Number(right.isTarget) - Number(left.isTarget) || right.total - left.total);
  return ranked.slice(0, limit).map((entry) => ({
    name: entry.name,
    isTarget: entry.isTarget,
    points: points.map((point) => {
      const row = sharesOf(byRun.get(point.runId) || []).find((item) => item.name === entry.name);
      return {
        runId: point.runId,
        at: point.at,
        share: row ? row.shareOfAnswers || 0 : 0,
        answers: point.score.answers,
        readable: isReadable(point),
      };
    }),
  }));
}
