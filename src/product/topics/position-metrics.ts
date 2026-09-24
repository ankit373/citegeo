import type { CitationAnalysis } from "./citation-analysis.js";
import type { PromptStanding } from "./topic-insights.js";

// Presence says whether you were named. Position says where. A brand named in
// every answer and named last every time reads as a win under presence alone.

export interface PositionReport {
  /** Mean place across prompts that named the brand. Null when none did. */
  averagePosition: number | null;
  /** Prompts that named the brand and resolved a place. */
  ranked: number;
  /** Prompts answered but never naming the brand. Excluded from the mean. */
  unranked: number;
  /** The best place reached, which is what a good day looks like. */
  best: number | null;
  /** The worst place reached, which is what the mean is hiding. */
  worst: number | null;
}

// Scoring an absence as last would invent a number that depends on how many
// rivals happened to be listed, which is a fact about the answer.
export function positionReport(prompts: PromptStanding[]): PositionReport {
  const places: number[] = [];
  let unranked = 0;
  for (const prompt of prompts) {
    if (!prompt.measuresVisibility) continue;
    if (typeof prompt.rank === "number" && prompt.rank > 0) places.push(prompt.rank);
    else unranked += 1;
  }
  if (places.length === 0) {
    return { averagePosition: null, ranked: 0, unranked, best: null, worst: null };
  }
  const total = places.reduce((sum, place) => sum + place, 0);
  return {
    averagePosition: Math.round((total / places.length) * 10) / 10,
    ranked: places.length,
    unranked,
    best: Math.min(...places),
    worst: Math.max(...places),
  };
}

export interface CitationStanding {
  /** Where the brand's own domain sits among cited domains. Null when uncited. */
  rank: number | null;
  /** The brand's cited answers over every domain's cited answers. */
  share: number | null;
  /** Cited domains ahead of the brand, strongest first. */
  ahead: Array<{ domain: string; answers: number }>;
  /** The domain cited most, whoever it is. */
  leader: { domain: string; answers: number } | null;
}

// Ties share a place and the next skips, so two domains level on second are
// both second and nobody is third.
export function citationStanding(analysis: CitationAnalysis): CitationStanding {
  const ordered = [...analysis.domains].sort((left, right) => right.answers - left.answers);
  const leader = ordered[0] ? { domain: ordered[0].domain, answers: ordered[0].answers } : null;
  const total = ordered.reduce((sum, row) => sum + row.answers, 0);
  const at = ordered.findIndex((row) => row.isTarget);
  if (at < 0) {
    return { rank: null, share: null, ahead: ordered.slice(0, 5).map(pick), leader };
  }
  const mine = ordered[at];
  if (!mine) return { rank: null, share: null, ahead: [], leader };
  let place = 1;
  for (const row of ordered) {
    if (row.answers > mine.answers) place += 1;
  }
  return {
    rank: place,
    share: total > 0 ? mine.answers / total : null,
    ahead: ordered.filter((row) => row.answers > mine.answers).map(pick),
    leader,
  };
}

function pick(row: { domain: string; answers: number }): { domain: string; answers: number } {
  return { domain: row.domain, answers: row.answers };
}
