import type { BrandInsights, CitationGapEntry } from "../insights/brand-insights.js";
import type { GeoAction } from "../actions/action-plan.js";
import type { SignalChange } from "../actions/signal-diff.js";

// What is worth telling someone about without being asked. The rule is that a
// digest is only sent when something changed, because a scheduled message that
// usually says "nothing happened" is one people stop opening, and then the one
// that matters is missed too.

export interface DigestInput {
  projectId: string;
  domain: string;
  insights: BrandInsights;
  citationGap: CitationGapEntry[];
  actions: GeoAction[];
  signalChanges: SignalChange[];
  /** The previous digest's figures, so movement can be described. */
  previous?: DigestBaseline | undefined;
}

export interface DigestBaseline {
  visibilityScore: number | null;
  recognized: number;
  answered: number;
  criticalCount: number;
  citationGapCount: number;
}

export interface Digest {
  projectId: string;
  domain: string;
  builtAt: string;
  /** False when nothing moved, in which case nothing should be delivered. */
  newsworthy: boolean;
  reasons: string[];
  headline: string;
  baseline: DigestBaseline;
  signalChanges: SignalChange[];
  criticalActions: GeoAction[];
  newCitationGaps: string[];
}

function baselineOf(input: DigestInput): DigestBaseline {
  return {
    visibilityScore: input.insights.visibility.score,
    recognized: input.insights.visibility.recognized,
    answered: input.insights.visibility.answered,
    criticalCount: input.actions.filter((action) => action.severity === "critical").length,
    citationGapCount: input.citationGap.length,
  };
}

function percent(value: number | null): string {
  return value === null ? "not measurable" : `${Math.round(value * 100)}%`;
}

export function buildDigest(input: DigestInput, at = new Date()): Digest {
  const baseline = baselineOf(input);
  const previous = input.previous;
  const reasons: string[] = [];

  // A site signal moving is always worth saying, in either direction.
  for (const change of input.signalChanges) reasons.push(change.detail);

  if (previous) {
    if (previous.visibilityScore !== baseline.visibilityScore) {
      reasons.push(`Visibility moved from ${percent(previous.visibilityScore)} to ${percent(baseline.visibilityScore)}.`);
    }
    if (baseline.criticalCount > previous.criticalCount) {
      reasons.push(`${baseline.criticalCount - previous.criticalCount} new critical finding(s).`);
    }
    if (baseline.citationGapCount > previous.citationGapCount) {
      reasons.push(`${baseline.citationGapCount - previous.citationGapCount} new source(s) citing a competitor and not you.`);
    }
    if (baseline.answered > previous.answered) {
      reasons.push(`${baseline.answered - previous.answered} new answer(s) since the last digest.`);
    }
  } else if (baseline.answered > 0 || input.actions.length) {
    // The first digest is worth sending so the recipient knows what is being
    // watched, even though nothing has moved yet.
    reasons.push("First digest for this project.");
  }

  const criticalActions = input.actions.filter((action) => action.severity === "critical");
  const newCitationGaps = previous
    ? input.citationGap.slice(0, Math.max(0, baseline.citationGapCount - previous.citationGapCount)).map((row) => row.domain)
    : input.citationGap.map((row) => row.domain);

  return {
    projectId: input.projectId,
    domain: input.domain,
    builtAt: at.toISOString(),
    newsworthy: reasons.length > 0,
    reasons,
    headline: `${input.domain}: ${percent(baseline.visibilityScore)} visibility across ${baseline.answered} answer(s), ${baseline.criticalCount} critical finding(s).`,
    baseline,
    signalChanges: input.signalChanges,
    criticalActions,
    newCitationGaps,
  };
}
