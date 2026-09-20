import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { tokenize } from "../topics/prompt-identity.js";
import type { CorpusIndex } from "./corpus-schema.js";

// Words that appear in almost every question carry no signal and would make
// every prompt look like every other one.
const STOP_WORDS = new Set([
  "a","an","and","are","as","at","be","but","by","can","do","does","for","from","get","how","i","if","in","is","it",
  "me","my","of","on","or","our","so","that","the","there","they","this","to","up","us","was","we","what","when",
  "where","which","who","will","with","would","you","your","am","any","best","good","help","just","like","need",
  "should","some","tell","want","way","ways","make","give","about",
]);

export function meaningfulTerms(text: string): string[] {
  return [...new Set(tokenize(text).filter((token) => token.length > 2 && !STOP_WORDS.has(token)))];
}

export interface IndexedCorpus {
  index: CorpusIndex;
  /** term -> the question rows containing it. */
  postings: Map<string, number[]>;
  questions: string[];
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** The opening user turn, which is the question. Later turns are follow-ups to
 * an answer, not demand. */
export function openingQuestion(row: unknown): string | null {
  const record = asObject(row);
  if (!record) return null;
  const turns = Array.isArray(record.conversation) ? record.conversation : Array.isArray(record.messages) ? record.messages : [];
  for (const turn of turns) {
    const entry = asObject(turn);
    if (entry?.role !== "user") continue;
    const content = typeof entry.content === "string" ? entry.content.trim() : "";
    // A pasted document is not a question, and it would dominate the index.
    return content && content.length <= 300 ? content : null;
  }
  return null;
}

function dateOf(row: unknown): string | null {
  const record = asObject(row);
  for (const key of ["timestamp", "tstamp", "created_at"]) {
    const value = record?.[key];
    if (typeof value === "string" && value.length >= 10) return value.slice(0, 10);
    if (typeof value === "number" && value > 0) return new Date(value * 1000).toISOString().slice(0, 10);
  }
  return null;
}

/** Reads a JSON Lines export line by line, so a multi-gigabyte corpus never
 * has to fit in memory as one string. */
export async function indexCorpus(input: { sourceId: string; path: string; limit?: number }): Promise<IndexedCorpus> {
  const postings = new Map<string, number[]>();
  const questions: string[] = [];
  let from: string | null = null;
  let to: string | null = null;

  const reader = createInterface({ input: createReadStream(input.path, "utf8"), crlfDelay: Infinity });
  for await (const line of reader) {
    if (input.limit && questions.length >= input.limit) break;
    const trimmed = line.trim();
    if (!trimmed) continue;
    let row: unknown;
    try {
      row = JSON.parse(trimmed);
    } catch {
      // One bad line is not a bad corpus.
      continue;
    }
    const question = openingQuestion(row);
    if (!question) continue;
    const at = questions.length;
    questions.push(question);
    for (const term of meaningfulTerms(question)) {
      const rows = postings.get(term);
      if (rows) rows.push(at);
      else postings.set(term, [at]);
    }
    const day = dateOf(row);
    if (day) {
      if (!from || day < from) from = day;
      if (!to || day > to) to = day;
    }
  }
  reader.close();

  return {
    index: {
      sourceId: input.sourceId,
      questions: questions.length,
      vocabulary: postings.size,
      from,
      to,
      builtAt: new Date().toISOString(),
    },
    postings,
    questions,
  };
}
