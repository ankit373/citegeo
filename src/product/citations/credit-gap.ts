import type { PageUptake } from "./answer-uptake.js";

// Models recommending papers were shown to favour prestige over content, and to
// deny doing it: debiasing instructions suppressed the mention of authority far
// faster than they changed the choices. Catching that properly needs controlled
// experiments nobody can run from outside.
//
// What is observable from here is its shadow. A page cited first that the answer
// took almost nothing from was credited for something other than its content,
// and a page cited last that the answer leaned on was used without the credit.

/** A gap in rank wider than this is worth naming rather than noise in a short
 * citation list. */
export const RANK_GAP = 2;

export const CREDIT_CAVEAT = "This compares where a page was cited against how much of the answer it accounts for, both measured from the same answer. It cannot say why they differ. A page can be cited first because it is the best source and still share little wording, and a page can share wording because it covers the same ground rather than because it was read.";

export const AUTHORITY_FINDING = "Models choosing what to recommend have been shown to weight prestige over content, and to report that they are not doing it: instructions to ignore authority stopped them mentioning it long before they stopped acting on it. A gap here is consistent with that and is not evidence of it.";

export interface CreditRow {
  url: string;
  host: string;
  /** Where it sat in the answer's citation list, from one. */
  citedAt: number;
  /** Where it ranks among the same answer's pages by how much of the answer it
   * accounts for, from one. */
  usedAt: number;
  uptake: number;
  /** Positive where it was credited above what it contributed. */
  gap: number;
}

export interface CreditReport {
  /** Answers with at least two cited pages that could both be measured. */
  comparable: number;
  /** Pages credited well above what they contributed. */
  overCredited: CreditRow[];
  /** Pages that contributed well above where they were credited. */
  underCredited: CreditRow[];
  /** Mean gap between credit and contribution, over every comparable page.
   * Null where nothing could be compared. */
  meanGap: number | null;
  finding: string;
  caveat: string;
}

/** Rows are one answer's cited pages. The caller groups them, because only
 * pages from the same answer share a citation list to be ranked within. */
export function creditGaps(perAnswer: Array<PageUptake[]>): CreditReport {
  const over: CreditRow[] = [];
  const under: CreditRow[] = [];
  const gaps: number[] = [];
  let comparable = 0;

  for (const pages of perAnswer) {
    const measured = pages.filter((page) => page.uptake !== null);
    if (measured.length < 2) continue;
    comparable += 1;
    const byUse = [...measured].sort((left, right) => (right.uptake as number) - (left.uptake as number));
    const usedRank = new Map(byUse.map((page, index) => [page.url, index + 1]));
    const byCite = [...measured].sort((left, right) => left.citedAt - right.citedAt);
    for (let index = 0; index < byCite.length; index += 1) {
      const page = byCite[index] as PageUptake;
      const citedAt = index + 1;
      const usedAt = usedRank.get(page.url) || citedAt;
      const gap = usedAt - citedAt;
      gaps.push(gap);
      const row: CreditRow = { url: page.url, host: page.host, citedAt, usedAt, uptake: page.uptake as number, gap };
      if (gap >= RANK_GAP) over.push(row);
      else if (gap <= -RANK_GAP) under.push(row);
    }
  }

  return {
    comparable,
    overCredited: over.sort((left, right) => right.gap - left.gap),
    underCredited: under.sort((left, right) => left.gap - right.gap),
    meanGap: gaps.length ? Math.round((gaps.reduce((sum, value) => sum + Math.abs(value), 0) / gaps.length) * 100) / 100 : null,
    finding: AUTHORITY_FINDING,
    caveat: CREDIT_CAVEAT,
  };
}
