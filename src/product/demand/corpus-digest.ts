import { matchRows } from "./demand-match.js";
import { meaningfulTerms, type IndexedCorpus } from "./corpus-ingest.js";
import { emptyDemand, type ObservedDemand, type ObservedQuestion } from "../topics/observed-demand.js";

// The index is hundreds of megabytes and is built by a command, so the server
// never holds it. What a proposal needs is a few dozen lines, so the command
// writes those and the corpus itself stays where it was read.

/** A conversation opener longer than this is somebody pasting their work, not
 * a question a buyer typed. */
export const LONGEST_QUESTION = 160;

export interface CorpusDigest extends ObservedDemand {
  sourceId: string;
  caveat: string;
  builtAt: string;
  /** Corpus rows matching the subject, before they were counted and capped. */
  matched: number;
}

function normalise(text: string): string {
  return text.split("\n").join(" ").split("\t").join(" ").split(" ").filter(Boolean).join(" ");
}

/** Real openers about this subject, commonest first. The count is how many
 * people asked that same question, which is an observation, not an estimate. */
export function corpusDigest(input: {
  corpus: IndexedCorpus;
  subject: string;
  caveat: string;
  keep?: number;
  at?: string;
}): CorpusDigest {
  const terms = meaningfulTerms(input.subject);
  const base: CorpusDigest = {
    ...emptyDemand(),
    sourceId: input.corpus.index.sourceId,
    caveat: input.caveat,
    builtAt: input.at || new Date().toISOString(),
    matched: 0,
  };
  if (!terms.length) return base;

  // Related, which already contains every exact row and collapses to exactly
  // those for a short subject. Requiring every term loses "indian" to "india".
  const rows = matchRows(input.corpus, terms).related;
  base.matched = rows.length;

  const counts = new Map<string, { text: string; asked: number }>();
  for (const row of rows) {
    const question = normalise(input.corpus.questions[row] || "");
    if (!question || question.length > LONGEST_QUESTION) continue;
    const key = question.toLocaleLowerCase();
    const held = counts.get(key);
    if (held) held.asked += 1;
    else counts.set(key, { text: question, asked: 1 });
  }

  base.corpusQuestions = rows.length;
  base.questions = [...counts.values()]
    .sort((left, right) => right.asked - left.asked || left.text.length - right.text.length)
    .slice(0, Math.max(0, input.keep ?? 40))
    .map((row): ObservedQuestion => ({ text: row.text, source: "conversations", weight: row.asked }));
  return base;
}
