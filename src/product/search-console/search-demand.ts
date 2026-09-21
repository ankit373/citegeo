import { tokenize } from "../topics/prompt-identity.js";
import type { SearchRow, SearchWindow } from "./search-console-client.js";
import type { TopicInsights } from "../topics/topic-insights.js";
import type { Prompt } from "../topics/topic-schema.js";

// What people actually type into a search box, against what this tool asks an
// assistant. It is not AI prompt volume and never claims to be, but it is real
// demand for the same subject, measured rather than estimated.

export interface MatchedQuery {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
}

export interface PromptSearchDemand {
  promptId: string;
  text: string;
  /** Queries sharing every meaningful word of the prompt. */
  exact: MatchedQuery[];
  /** Queries sharing most of them, the looser and larger figure. */
  related: MatchedQuery[];
  impressions: number;
  clicks: number;
  /** Mean position across the matched queries, weighted by impressions.
   * Null when nothing matched, which is not position zero. */
  position: number | null;
  /** True when the brand is absent from the AI answers for this prompt while
   * search is already sending impressions. The clearest gap there is. */
  earnedInSearchAbsentInAnswers: boolean;
}

export interface SearchDemandReport {
  siteUrl: string;
  window: SearchWindow;
  fetchedAt: string;
  /** Rows Search Console returned for the window. */
  queries: number;
  totalImpressions: number;
  prompts: PromptSearchDemand[];
}

/** Two thirds of the prompt's words, the same shape the corpus matcher uses,
 * so "related" means the same thing in both places. */
const RELATED_SHARE = 0.6;

function meaningful(text: string): string[] {
  const stop = new Set(["the", "a", "an", "for", "of", "in", "on", "to", "and", "or", "is", "are", "with", "what", "which", "best", "how", "do", "i", "my", "me", "can"]);
  return [...new Set(tokenize(text).filter((word) => word.length > 2 && !stop.has(word)))];
}

function matchedQuery(row: SearchRow): MatchedQuery {
  return { query: row.query, clicks: row.clicks, impressions: row.impressions, position: row.position };
}

export function buildSearchDemand(input: {
  siteUrl: string;
  window: SearchWindow;
  rows: SearchRow[];
  prompts: Prompt[];
  insights?: TopicInsights | undefined;
  fetchedAt?: string | undefined;
}): SearchDemandReport {
  const indexed = input.rows.map((row) => ({ row, words: new Set(tokenize(row.query)) }));
  const standing = new Map((input.insights?.topics || []).flatMap((topic) => topic.prompts.map((prompt) => [prompt.promptId, prompt])));

  const prompts: PromptSearchDemand[] = input.prompts.map((prompt) => {
    const words = meaningful(prompt.text);
    const need = Math.max(1, Math.ceil(words.length * RELATED_SHARE));
    const exact: MatchedQuery[] = [];
    const related: MatchedQuery[] = [];
    for (const { row, words: has } of indexed) {
      if (!words.length) continue;
      const hits = words.filter((word) => has.has(word)).length;
      if (hits === words.length) exact.push(matchedQuery(row));
      else if (hits >= need) related.push(matchedQuery(row));
    }
    const all = [...exact, ...related];
    const impressions = all.reduce((total, row) => total + row.impressions, 0);
    const clicks = all.reduce((total, row) => total + row.clicks, 0);
    const score = standing.get(prompt.id);
    return {
      promptId: prompt.id,
      text: prompt.text,
      exact: exact.sort((left, right) => right.impressions - left.impressions).slice(0, 8),
      related: related.sort((left, right) => right.impressions - left.impressions).slice(0, 8),
      impressions,
      clicks,
      // Weighted by impressions: an average over queries nobody saw is not an
      // average of where you sit.
      position: impressions ? all.reduce((total, row) => total + row.position * row.impressions, 0) / impressions : null,
      earnedInSearchAbsentInAnswers: impressions > 0 && score !== undefined && score.score.answers > 0 && score.score.appearances === 0,
    };
  });

  return {
    siteUrl: input.siteUrl,
    window: input.window,
    fetchedAt: input.fetchedAt || new Date().toISOString(),
    queries: input.rows.length,
    totalImpressions: input.rows.reduce((total, row) => total + row.impressions, 0),
    prompts: prompts.sort((left, right) => right.impressions - left.impressions),
  };
}
