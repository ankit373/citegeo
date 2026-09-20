import type { Alert } from "./alert-rules.js";
import type { HomeSummary } from "./home-summary.js";

// A digest is only sent when something changed. A scheduled message that
// usually says "nothing happened" is one people stop opening, and then the one
// that matters is missed too.

export interface AnswerDigest {
  projectId: string;
  domain: string;
  builtAt: string;
  /** False when nothing moved, in which case nothing should be delivered. */
  newsworthy: boolean;
  headline: string;
  lines: string[];
  alerts: Alert[];
  /** What this digest measured, so the next one can compare against it. */
  baseline: DigestBaseline;
}

export interface DigestBaseline {
  score: number | null;
  rank: number | null;
  answers: number;
  alertCount: number;
}

function baselineOf(home: HomeSummary): DigestBaseline {
  return { score: home.score, rank: home.rank, answers: home.answers, alertCount: home.alerts.length };
}

function describeScore(now: number | null, before: number | null | undefined): string | null {
  if (now === null) return null;
  if (before === null || before === undefined) return `Score is ${now}.`;
  const change = Math.round((now - before) * 10) / 10;
  if (change === 0) return null;
  return `Score ${change > 0 ? "rose" : "fell"} ${Math.abs(change)} to ${now}.`;
}

export function buildAnswerDigest(input: {
  home: HomeSummary;
  previous?: DigestBaseline | undefined;
}, at = new Date()): AnswerDigest {
  const { home, previous } = input;
  const lines: string[] = [];

  const score = describeScore(home.score, previous?.score);
  if (score) lines.push(score);

  if (previous && home.rank !== null && previous.rank !== null && home.rank !== previous.rank) {
    lines.push(`Rank moved from #${previous.rank} to #${home.rank} of ${home.rivals + 1}.`);
  }

  // A critical alert is news even when the numbers did not move.
  for (const alert of home.alerts.filter((row) => row.severity === "critical")) {
    lines.push(`${alert.headline}. ${alert.detail}`);
  }

  if (home.absentFrom.length) {
    const first = home.absentFrom[0];
    if (first) {
      lines.push(
        `Still absent from ${home.absentFrom.length} question(s), including "${first.text}"` +
        (first.namedInstead.length ? `, where the models named ${first.namedInstead.slice(0, 3).join(", ")}.` : "."),
      );
    }
  }

  // Nothing measured is not news, however much is missing.
  const measured = home.answers > 0;
  const moved = Boolean(score) || lines.length > (score ? 1 : 0);
  const newsworthy = measured && moved;

  return {
    projectId: home.projectId,
    domain: home.domain,
    builtAt: at.toISOString(),
    newsworthy,
    headline: newsworthy
      ? `${home.domain}: ${home.score === null ? "not measurable" : `${home.score} of 100`}${home.rank === null ? ", not named" : `, #${home.rank}`}`
      : `${home.domain}: nothing moved`,
    lines,
    alerts: home.alerts,
    baseline: baselineOf(home),
  };
}
