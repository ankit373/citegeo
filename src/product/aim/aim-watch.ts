import type { TopicInsights } from "../topics/topic-insights.js";
import { isReadable } from "../topics/prompt-trend.js";
import type { SignalChange } from "../actions/signal-diff.js";
import type { TemplateId } from "../agents/agent-templates.js";

// What moved, what plausibly moved it, and what would act on it. Everything
// here is read off measurements already stored; nothing calls a model and
// nothing infers a cause that is not in the evidence.
//
// A movement with no cause in the evidence says so. Naming a wrong cause is
// worse than naming none, because the work then goes to the wrong place.

export type Direction = "up" | "down";

export interface Movement {
  field: string;
  direction: Direction;
  before: string;
  after: string;
  /** Percentage points, or absolute for a count. Always positive. */
  size: number;
}

export interface Cause {
  statement: string;
  /** The observation behind it, so a reader can disagree and still check. */
  evidence: string;
}

export interface AimTask {
  title: string;
  /** The workflow that would act on this, or null when none does. */
  workflow: TemplateId | null;
  detail: string;
}

export interface AimMemo {
  projectId: string;
  /** Null when there is not enough history to compare anything. */
  movement: Movement | null;
  headline: string;
  causes: Cause[];
  tasks: AimTask[];
  /** Said plainly when the memo could not establish why something moved. */
  unexplained: string | null;
  writtenAt: string;
}

/** Points on the hundred point score below which a change is noise between two
 * runs of the same thing. A judgement, like the two floors in the score. */
export const MATERIAL_CHANGE = 2;

/** The score is an index out of a hundred, not a proportion. Multiplying it by
 * a hundred reported a reading of 1.4 as 140%. */
function points(value: number): string {
  return value.toFixed(1);
}

function scoreMovement(insights: TopicInsights): Movement | null {
  const change = insights.trend.change;
  if (change === null || Math.abs(change) < MATERIAL_CHANGE) return null;
  // Read off the endpoints the change was taken between. Subtracting it from
  // the overall score mixed two different figures and produced scores below
  // nought, which no reading can be.
  const readable = insights.trend.points.filter(isReadable);
  const first = readable[0];
  const last = readable[readable.length - 1];
  if (!first || !last) return null;
  return {
    field: "visibility",
    direction: change > 0 ? "up" : "down",
    before: points(first.score.score),
    after: points(last.score.score),
    size: Math.abs(change),
  };
}

/** Causes drawn from what is already recorded. A regressed signal, a rival
 * gaining, a set of questions the brand is absent from. */
export function causesFor(insights: TopicInsights, signals: SignalChange[]): Cause[] {
  const causes: Cause[] = [];
  for (const change of signals.filter((row) => row.direction === "regressed")) {
    causes.push({
      statement: `${change.field} regressed, which decides what a model can reach.`,
      evidence: `${change.before} to ${change.after}. ${change.detail}`,
    });
  }
  const target = insights.leaderboard.find((row) => row.isTarget);
  const ahead = insights.leaderboard.filter((row) => !row.isTarget && row.appearances > (target?.appearances || 0));
  if (ahead.length) {
    const top = ahead[0];
    causes.push({
      statement: `${top?.name} is named more often than the brand.`,
      evidence: `${top?.appearances} answer(s) named it against the brand's ${target?.appearances || 0}.`,
    });
  }
  const absent = insights.absentFrom.filter((row) => row.measuresVisibility && row.score.answers > 0);
  if (absent.length) {
    causes.push({
      statement: `${absent.length} tracked question(s) never name the brand at all.`,
      evidence: `Worst: "${absent[0]?.text}", ${absent[0]?.score.answers} answer(s), never named.`,
    });
  }
  if (insights.citationsUnavailable) {
    causes.push({
      statement: "No answer carried a citation, so nothing can be traced to a source.",
      evidence: "Every model answering is offline, or none returned citations.",
    });
  }
  return causes;
}

/** Each task names the workflow that would do it, so the memo hands off rather
 * than ending at a description of the problem. */
export function tasksFor(insights: TopicInsights, signals: SignalChange[]): AimTask[] {
  const tasks: AimTask[] = [];
  const absent = insights.absentFrom.filter((row) => row.measuresVisibility && row.score.answers > 0);
  if (absent.length) {
    tasks.push({
      title: `Answer the ${absent.length} question(s) you are never named in`,
      workflow: "missing_answer",
      detail: "One page per question, drafted from the brief and held for review.",
    });
  }
  const target = insights.leaderboard.find((row) => row.isTarget);
  const ahead = insights.leaderboard.filter((row) => !row.isTarget && row.appearances > (target?.appearances || 0));
  if (ahead.length) {
    tasks.push({
      title: `Brief the team on ${ahead.length} rival(s) the answers prefer`,
      workflow: "competitor_brief",
      detail: `Named more often than the brand: ${ahead.slice(0, 3).map((row) => row.name).join(", ")}.`,
    });
  }
  for (const change of signals.filter((row) => row.direction === "regressed")) {
    tasks.push({
      title: `Restore ${change.field}`,
      // No workflow writes a page for this; it is a change to the site itself.
      workflow: null,
      detail: `${change.before} to ${change.after}. ${change.detail}`,
    });
  }
  return tasks;
}

export function writeMemo(input: {
  projectId: string;
  insights: TopicInsights;
  signals: SignalChange[];
  at?: Date;
}): AimMemo {
  const movement = scoreMovement(input.insights);
  const causes = causesFor(input.insights, input.signals);
  const tasks = tasksFor(input.insights, input.signals);

  const headline = movement
    ? `Visibility moved ${movement.direction} from ${movement.before} to ${movement.after} out of 100.`
    : input.insights.trend.change === null
      ? "Not enough runs to compare, so nothing can be said to have moved."
      : "Visibility held steady since the last comparable run.";

  // A movement nothing in the evidence explains is reported as unexplained.
  // Naming a wrong cause sends the work to the wrong place.
  const unexplained = movement && !causes.length
    ? `Visibility moved ${movement.direction} by ${points(movement.size)} point(s) and nothing recorded here explains it. Probe the site and run again before acting.`
    : null;

  return {
    projectId: input.projectId,
    movement,
    headline,
    causes,
    tasks,
    unexplained,
    writtenAt: (input.at || new Date()).toISOString(),
  };
}
