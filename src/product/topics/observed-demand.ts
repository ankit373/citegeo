import { namesIdentity } from "./prompt-identity.js";
import type { SearchRow } from "../search-console/search-console-client.js";

// What somebody really typed, as opposed to what a model supposes a buyer
// would type. The product already collects both and has only ever used them to
// score questions after they were chosen, which is the wrong end of the work.

/** Observed questions a proposal is grounded in. Enough to steer the phrasing
 * and the subjects, not so many that the brief becomes the corpus. */
export const OBSERVED_KEPT = 40;

export type DemandSource = "search_console" | "conversations";

export interface ObservedQuestion {
  text: string;
  source: DemandSource;
  /** Impressions for a search query, matching conversations for the corpus.
   * The unit differs by source, so it is never summed across them. */
  weight: number;
}

export interface ObservedDemand {
  questions: ObservedQuestion[];
  searchQueries: number;
  corpusQuestions: number;
  /** Queries left out because they already name the brand. Somebody searching
   * for you by name has found you, so they say nothing about discovery. */
  navigational: number;
}

export function emptyDemand(): ObservedDemand {
  return { questions: [], searchQueries: 0, corpusQuestions: 0, navigational: 0 };
}

export function hasObserved(demand: ObservedDemand): boolean {
  return demand.questions.length > 0;
}

/** Search rows, least navigational first by impressions. Brand queries are
 * counted and dropped rather than silently filtered. */
export function fromSearchRows(rows: SearchRow[], identities: string[], keep = OBSERVED_KEPT): ObservedDemand {
  const demand = emptyDemand();
  const usable: SearchRow[] = [];
  for (const row of rows) {
    const query = row.query.trim();
    if (!query) continue;
    demand.searchQueries += 1;
    if (namesIdentity(query, identities)) {
      demand.navigational += 1;
      continue;
    }
    usable.push(row);
  }
  demand.questions = usable
    .sort((left, right) => right.impressions - left.impressions || left.query.localeCompare(right.query))
    .slice(0, Math.max(0, keep))
    .map((row): ObservedQuestion => ({ text: row.query.trim(), source: "search_console", weight: row.impressions }));
  return demand;
}

/** Two sources, kept apart. Impressions and conversation counts are different
 * units, so they interleave by rank rather than merge into one ordering. */
export function mergeDemand(left: ObservedDemand, right: ObservedDemand, keep = OBSERVED_KEPT): ObservedDemand {
  const questions: ObservedQuestion[] = [];
  const seen = new Set<string>();
  for (let at = 0; at < Math.max(left.questions.length, right.questions.length); at += 1) {
    for (const row of [left.questions[at], right.questions[at]]) {
      if (!row) continue;
      const key = row.text.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      questions.push(row);
    }
  }
  return {
    questions: questions.slice(0, Math.max(0, keep)),
    searchQueries: left.searchQueries + right.searchQueries,
    corpusQuestions: left.corpusQuestions + right.corpusQuestions,
    navigational: left.navigational + right.navigational,
  };
}

/** The lines a proposal is grounded in, or null when nothing was observed. A
 * proposal with no grounding is a guess and has to be labelled as one. */
export function demandLines(demand: ObservedDemand): string[] | null {
  if (!demand.questions.length) return null;
  return demand.questions.map((row) => {
    const unit = row.source === "search_console" ? "search impressions" : "people asked it";
    return `- ${row.text} (${row.weight} ${unit})`;
  });
}
