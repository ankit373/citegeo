import type { TopicInsights } from "../topics/topic-insights.js";

// What is worth telling someone without being asked. A rule only fires on a
// comparison where both sides were measurable: null to zero is a measurement
// starting, not a fall.

export type AlertKind =
  | "score_dropped"
  | "rank_lost"
  | "rival_overtook"
  | "topic_lost"
  | "citations_lost"
  | "answers_failing";

export type AlertSeverity = "critical" | "warning" | "info";

export interface Alert {
  kind: AlertKind;
  severity: AlertSeverity;
  headline: string;
  /** The observation behind it, named. */
  detail: string;
}

export interface AlertThresholds {
  /** Points of score. Below this, movement is noise rather than news. */
  scoreDrop: number;
  /** Share of a run's answers that may fail before it is worth saying. */
  failureRate: number;
}

export const DEFAULT_THRESHOLDS: AlertThresholds = { scoreDrop: 5, failureRate: 0.25 };

function pct(value: number | null): string {
  return value === null ? "not measurable" : `${Math.round(value * 100)}%`;
}

export function evaluateAlerts(insights: TopicInsights, thresholds: AlertThresholds = DEFAULT_THRESHOLDS): Alert[] {
  const alerts: Alert[] = [];
  const points = insights.trend.points;
  const latest = points[points.length - 1];
  const previous = points[points.length - 2];

  if (latest && previous && latest.score.score !== null && previous.score.score !== null) {
    const change = latest.score.score - previous.score.score;
    if (change <= -thresholds.scoreDrop) {
      alerts.push({
        kind: "score_dropped",
        severity: change <= -thresholds.scoreDrop * 3 ? "critical" : "warning",
        headline: `Score fell ${Math.abs(Math.round(change * 10) / 10)} points`,
        detail: `${previous.score.score} to ${latest.score.score} between the run on ${previous.at.slice(0, 10)} and the one on ${latest.at.slice(0, 10)}.`,
      });
    }
    if (previous.rank !== null && latest.rank !== null && latest.rank > previous.rank) {
      alerts.push({
        kind: "rank_lost",
        severity: "warning",
        headline: `Dropped from #${previous.rank} to #${latest.rank}`,
        detail: `Among the ${insights.leaderboard.length} organisations the models named.`,
      });
    }
    // Being named and then not being named is the one that matters most.
    if (previous.score.appearances > 0 && latest.score.appearances === 0) {
      alerts.push({
        kind: "topic_lost",
        severity: "critical",
        headline: "No answer named you in the latest run",
        detail: `The previous run named you in ${previous.score.appearances} of ${previous.score.answers} answers.`,
      });
    }
  }

  const rank = insights.rank;
  if (rank !== null && rank > 1) {
    const ahead = insights.leaderboard.slice(0, rank - 1).filter((row) => !row.isTarget);
    const leader = ahead[0];
    if (leader && leader.appearances >= Math.max(2, insights.answers / 2)) {
      alerts.push({
        kind: "rival_overtook",
        severity: rank > 5 ? "warning" : "info",
        headline: `${leader.name} is named in ${pct(leader.shareOfAnswers)} of answers`,
        detail: `You are #${rank} of ${insights.leaderboard.length}. ${ahead.length} organisation(s) are named more often than you.`,
      });
    }
  }

  if (insights.answers > 0 && insights.citationsUnavailable) {
    alerts.push({
      kind: "citations_lost",
      severity: "info",
      headline: "No answer carried a citation",
      detail: "The citation gap cannot be built from this run. A provider with web search would produce sources.",
    });
  }

  const attempted = insights.answers + insights.answersFailed;
  if (attempted > 0 && insights.answersFailed / attempted >= thresholds.failureRate) {
    alerts.push({
      kind: "answers_failing",
      severity: insights.answers === 0 ? "critical" : "warning",
      headline: `${insights.answersFailed} of ${attempted} answers failed`,
      detail: "A failed answer is excluded rather than counted as an absence, so the figures are built on fewer answers than were asked for.",
    });
  }

  const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((left, right) => order[left.severity] - order[right.severity]);
}
