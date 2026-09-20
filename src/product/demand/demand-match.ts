import { meaningfulTerms, type IndexedCorpus } from "./corpus-ingest.js";
import { CORPUS_SOURCES, type DemandMatch, type DemandReport, type PromptDemand } from "./corpus-schema.js";
import type { Prompt } from "../topics/topic-schema.js";

/** Rows containing every term, and rows containing most of them. Two numbers
 * because one of them is always the wrong one to quote. */
function matchRows(corpus: IndexedCorpus, terms: string[]): { exact: number[]; related: number[] } {
  if (!terms.length) return { exact: [], related: [] };
  const counts = new Map<number, number>();
  for (const term of terms) {
    for (const row of corpus.postings.get(term) || []) {
      counts.set(row, (counts.get(row) || 0) + 1);
    }
  }
  const needed = Math.max(1, Math.ceil(terms.length * 0.6));
  const exact: number[] = [];
  const related: number[] = [];
  for (const [row, hits] of counts) {
    if (hits === terms.length) exact.push(row);
    if (hits >= needed) related.push(row);
  }
  return { exact, related };
}

function matchFor(corpus: IndexedCorpus, text: string): DemandMatch {
  const { exact, related } = matchRows(corpus, meaningfulTerms(text));
  const examples = (exact.length ? exact : related).slice(0, 5).map((row) => corpus.questions[row] || "");
  return { exactTerms: exact.length, relatedTerms: related.length, examples: examples.filter(Boolean) };
}

/** Frequent corpus terms no tracked prompt covers, which is where a topic set
 * is blind rather than where it is wrong. */
function uncovered(corpus: IndexedCorpus, prompts: Prompt[], take: number): Array<{ term: string; questions: number }> {
  const covered = new Set(prompts.flatMap((prompt) => meaningfulTerms(prompt.text)));
  const rows: Array<{ term: string; questions: number }> = [];
  for (const [term, hits] of corpus.postings) {
    if (covered.has(term)) continue;
    rows.push({ term, questions: hits.length });
  }
  return rows.sort((left, right) => right.questions - left.questions).slice(0, take);
}

export function buildDemandReport(input: {
  corpus: IndexedCorpus;
  prompts: Prompt[];
  uncoveredCount?: number;
}): DemandReport {
  const source = CORPUS_SOURCES.find((row) => row.id === input.corpus.index.sourceId);
  const total = input.corpus.index.questions;
  const prompts: PromptDemand[] = input.prompts.map((prompt) => {
    const match = matchFor(input.corpus, prompt.text);
    return {
      promptId: prompt.id,
      text: prompt.text,
      match,
      // Null on an empty corpus, because zero over zero is not zero demand.
      shareOfCorpus: total > 0 ? match.exactTerms / total : null,
    };
  });
  return {
    sourceId: input.corpus.index.sourceId,
    index: input.corpus.index,
    caveat: source?.caveat || "This corpus is a historical sample, not a measure of current demand.",
    prompts: prompts.sort((left, right) => right.match.exactTerms - left.match.exactTerms),
    uncoveredTerms: uncovered(input.corpus, input.prompts, input.uncoveredCount || 20),
  };
}
