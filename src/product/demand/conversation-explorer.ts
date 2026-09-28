import { meaningfulTerms, type IndexedCorpus } from "./corpus-ingest.js";
import { matchRows } from "./demand-match.js";
import { CORPUS_SOURCES } from "./corpus-schema.js";
import type { Prompt } from "../topics/topic-schema.js";

// The demand report answers "how often is this tracked prompt asked". This
// answers the question before it: what is being asked at all, and which of it
// nothing here is measuring. A topic set can only be wrong about what it
// covers; it is blind about what it does not.

export type ConversationIntent = "comparison" | "purchase" | "how_to" | "definition" | "verification" | "unknown";

export const CONVERSATION_INTENTS: ConversationIntent[] = [
  "comparison", "purchase", "how_to", "definition", "verification", "unknown",
];

const COMPARISON_WORDS = [" vs ", " vs. ", " versus ", "alternative", "compare", "better than", "instead of"];
const COMPARISON_OPENERS = ["best", "top", "which"];
const PURCHASE_WORDS = ["price", "pricing", "cost", "cheapest", "discount", "free trial", "how much"];
const PURCHASE_OPENERS = ["buy", "where to buy"];
const VERIFICATION_OPENERS = ["is", "are", "was", "does", "do", "did", "can", "should", "will", "has"];
const DEFINITION_OPENERS = ["what", "who", "why", "when", "where"];

function words(text: string): string[] {
  return text.toLowerCase().split("\n").join(" ").split("\t").join(" ").split(" ").filter(Boolean);
}

/** Classified from the shape of the question, not by a model, so it costs
 * nothing and is the same every time. A question that fits none of these is
 * unknown, never the nearest guess. */
export function questionIntent(text: string): ConversationIntent {
  const lower = ` ${text.toLowerCase().split("?").join(" ").split(",").join(" ")} `;
  const tokens = words(text);
  const opener = tokens[0] || "";
  // Comparison first: "best X vs Y" and "which is cheaper" are comparisons
  // before they are anything else.
  if (COMPARISON_WORDS.some((word) => lower.includes(word))) return "comparison";
  if (COMPARISON_OPENERS.includes(opener)) return "comparison";
  if (PURCHASE_WORDS.some((word) => lower.includes(word))) return "purchase";
  if (PURCHASE_OPENERS.some((word) => lower.startsWith(` ${word}`))) return "purchase";
  if (opener === "how") return "how_to";
  if (DEFINITION_OPENERS.includes(opener)) return "definition";
  if (VERIFICATION_OPENERS.includes(opener)) return "verification";
  return "unknown";
}

export interface ExploredQuestion {
  text: string;
  intent: ConversationIntent;
  /** The tracked prompt already measuring this question, or null when none is. */
  coveredBy: string | null;
}

export interface IntentBreakdown {
  intent: ConversationIntent;
  questions: number;
  /** Share of the matched questions, not of the corpus. */
  share: number;
}

export interface ExplorationReport {
  query: string;
  /** Corpus questions carrying every meaningful word of the query. */
  matched: number;
  /** Corpus questions carrying most of them, which is the looser figure. */
  related: number;
  /** matched against the whole corpus. Null on an empty corpus. */
  shareOfCorpus: number | null;
  byIntent: IntentBreakdown[];
  questions: ExploredQuestion[];
  /** Matched questions no tracked prompt is measuring. Where the set is blind. */
  uncovered: number;
  caveat: string;
}

function coveredRows(corpus: IndexedCorpus, prompts: Prompt[]): Map<number, string> {
  const owner = new Map<number, string>();
  for (const prompt of prompts) {
    for (const row of matchRows(corpus, meaningfulTerms(prompt.text)).exact) {
      if (!owner.has(row)) owner.set(row, prompt.id);
    }
  }
  return owner;
}

function breakdown(questions: ExploredQuestion[]): IntentBreakdown[] {
  const counts = new Map<ConversationIntent, number>();
  for (const question of questions) {
    counts.set(question.intent, (counts.get(question.intent) || 0) + 1);
  }
  const total = questions.length;
  return [...counts.entries()]
    .map(([intent, count]) => ({ intent, questions: count, share: total ? count / total : 0 }))
    .sort((left, right) => right.questions - left.questions);
}

export function exploreConversations(input: {
  corpus: IndexedCorpus;
  query: string;
  prompts: Prompt[];
  limit?: number | undefined;
}): ExplorationReport {
  const source = CORPUS_SOURCES.find((row) => row.id === input.corpus.index.sourceId);
  const terms = meaningfulTerms(input.query);
  const { exact, related } = matchRows(input.corpus, terms);
  const owner = coveredRows(input.corpus, input.prompts);
  const total = input.corpus.index.questions;

  // Uncovered first, because the reason to open this is to find what nothing
  // here is measuring, and a long covered list would bury it.
  const ordered = [...exact].sort((left, right) => {
    const leftCovered = owner.has(left) ? 1 : 0;
    const rightCovered = owner.has(right) ? 1 : 0;
    return leftCovered - rightCovered;
  });
  const questions: ExploredQuestion[] = ordered
    .slice(0, input.limit && input.limit > 0 ? Math.min(input.limit, 200) : 25)
    .map((row) => {
      const text = input.corpus.questions[row] || "";
      return { text, intent: questionIntent(text), coveredBy: owner.get(row) || null };
    })
    .filter((row) => row.text.length > 0);

  return {
    query: input.query,
    matched: exact.length,
    related: related.length,
    // Null on an empty corpus, because zero over zero is not zero demand.
    shareOfCorpus: total > 0 ? exact.length / total : null,
    byIntent: breakdown(questions),
    questions,
    uncovered: exact.filter((row) => !owner.has(row)).length,
    caveat: source ? source.caveat : "This corpus states no caveat of its own.",
  };
}
