import { canonicalUrl } from "./canonical-url.js";
import type { PromptAnswer } from "../topics/prompt-run-schema.js";

// Who supplies the answers in a category is a different question from whether
// you are in them. A category where a handful of domains account for most
// citations is one where getting onto those domains is the whole game, and one
// where the tail is long is one where a new page can still get in.
//
// Reported as a curve rather than a single number, because concentration has a
// shape and any one figure hides it.

/** Shares at these points, which is enough to see a curve without drawing one. */
export const AT_RANKS = [1, 3, 5, 10];

export const CONCENTRATION_CAVEAT = "Counted over the citations these questions produced, so it describes the sources behind your category as these models answered it, not the web. A domain cited once by every answer and one cited ten times by a single answer are different things, so a domain counts once per answer.";

export interface CitedHost {
  host: string;
  /** Answers citing this host at least once. Counted once per answer, so a
   * page cited ten times in one answer is one observation. */
  answers: number;
  share: number;
  /** True where the brand's own domain. */
  isYours: boolean;
}

export interface ConcentrationReport {
  /** Answers that cited anything, which is what a share is taken over. */
  answersWithCitations: number;
  hosts: CitedHost[];
  /** Share of all citations held by the top N domains, at AT_RANKS. */
  topShares: Array<{ rank: number; share: number }>;
  /** Domains holding half of all citations. Lower is more concentrated. */
  halfHeldBy: number | null;
  /** Gini, 0 where every domain is cited equally and approaching 1 where one
   * domain holds everything. Null with nothing cited. */
  gini: number | null;
  /** Where the brand's own domain sits, from one. Null when never cited. */
  yourRank: number | null;
  caveat: string;
}

function giniOf(counts: number[]): number | null {
  if (!counts.length) return null;
  const sorted = [...counts].sort((left, right) => left - right);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  if (!total) return null;
  let weighted = 0;
  for (let index = 0; index < sorted.length; index += 1) {
    weighted += (index + 1) * (sorted[index] as number);
  }
  return (2 * weighted) / (sorted.length * total) - (sorted.length + 1) / sorted.length;
}

export function buildConcentrationReport(input: { answers: PromptAnswer[]; domain?: string | undefined }): ConcentrationReport {
  const completed = input.answers.filter((answer) => answer.status === "completed");
  const yours = (input.domain || "").trim().toLocaleLowerCase();
  const counts = new Map<string, number>();
  let answersWithCitations = 0;

  for (const answer of completed) {
    const hosts = new Set<string>();
    for (const raw of answer.citationUrls) {
      const cited = canonicalUrl(raw);
      if (cited) hosts.add(cited.host);
    }
    if (!hosts.size) continue;
    answersWithCitations += 1;
    for (const host of hosts) counts.set(host, (counts.get(host) || 0) + 1);
  }

  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  const hosts: CitedHost[] = [...counts.entries()]
    .map(([host, answers]) => ({
      host,
      answers,
      share: total ? answers / total : 0,
      isYours: Boolean(yours) && (host === yours || host.endsWith("." + yours)),
    }))
    .sort((left, right) => right.answers - left.answers || left.host.localeCompare(right.host));

  const topShares = AT_RANKS.map((rank) => ({
    rank,
    share: total ? hosts.slice(0, rank).reduce((sum, row) => sum + row.answers, 0) / total : 0,
  }));

  let running = 0;
  let halfHeldBy: number | null = null;
  for (let index = 0; index < hosts.length; index += 1) {
    running += (hosts[index] as CitedHost).answers;
    if (total && running / total >= 0.5) { halfHeldBy = index + 1; break; }
  }

  const yourIndex = hosts.findIndex((row) => row.isYours);
  return {
    answersWithCitations,
    hosts,
    topShares,
    halfHeldBy: total ? halfHeldBy : null,
    gini: giniOf(hosts.map((row) => row.answers)),
    yourRank: yourIndex < 0 ? null : yourIndex + 1,
    caveat: CONCENTRATION_CAVEAT,
  };
}
