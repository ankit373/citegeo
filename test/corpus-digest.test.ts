import test from "node:test";
import assert from "node:assert/strict";
import { corpusDigest, LONGEST_QUESTION } from "../src/product/demand/corpus-digest.js";
import { mergeDemand, fromSearchRows, demandLines } from "../src/product/topics/observed-demand.js";
import { meaningfulTerms, type IndexedCorpus } from "../src/product/demand/corpus-ingest.js";
import type { SearchRow } from "../src/product/search-console/search-console-client.js";

/** The index a command builds, made here from a handful of questions. */
function corpus(questions: string[]): IndexedCorpus {
  const postings = new Map<string, number[]>();
  questions.forEach((question, row) => {
    for (const term of meaningfulTerms(question)) {
      postings.set(term, [...(postings.get(term) || []), row]);
    }
  });
  return {
    index: { sourceId: "wildchat", questions: questions.length, vocabulary: postings.size, from: null, to: null, builtAt: "2026-10-01T00:00:00.000Z" },
    postings,
    questions,
  };
}

const CAVEAT = "A historical sample, not current demand.";

test("the questions people actually asked about the subject come back, commonest first", () => {
  const digest = corpusDigest({
    corpus: corpus([
      "best stock screener for india",
      "best stock screener for india",
      "what is a good stock screener for india",
      "how do i bake sourdough bread",
    ]),
    subject: "stock screener india",
    caveat: CAVEAT,
  });
  assert.equal(digest.questions[0]?.text, "best stock screener for india");
  assert.equal(digest.questions[0]?.weight, 2, "two people asked it, which is an observation");
  assert.equal(digest.questions[0]?.source, "conversations");
  assert.ok(!digest.questions.some((row) => row.text.includes("sourdough")));
});

test("a subject nobody asked about returns nothing rather than the nearest thing", () => {
  const digest = corpusDigest({ corpus: corpus(["how do i bake sourdough bread"]), subject: "orbital mechanics telemetry", caveat: CAVEAT });
  assert.deepEqual(digest.questions, []);
  assert.equal(digest.matched, 0);
});

test("a subject with no meaningful words is not a subject", () => {
  const digest = corpusDigest({ corpus: corpus(["anything at all"]), subject: "the a of", caveat: CAVEAT });
  assert.deepEqual(digest.questions, []);
  assert.equal(digest.corpusQuestions, 0);
});

test("somebody pasting their work is not a question a buyer typed", () => {
  const long = `best stock screener india ${"x".repeat(LONGEST_QUESTION)}`;
  const digest = corpusDigest({ corpus: corpus([long, "best stock screener india"]), subject: "stock screener india", caveat: CAVEAT });
  assert.deepEqual(digest.questions.map((row) => row.text), ["best stock screener india"]);
});

test("the corpus caveat travels with the digest", () => {
  const digest = corpusDigest({ corpus: corpus(["best stock screener india"]), subject: "stock screener india", caveat: CAVEAT });
  assert.equal(digest.caveat, CAVEAT);
  assert.equal(digest.sourceId, "wildchat");
});

test("search and conversations keep their own units when they ground one proposal", () => {
  const search = fromSearchRows([{ query: "stock screener india", clicks: 0, impressions: 900, ctr: 0, position: 4 } as SearchRow], []);
  const conversations = corpusDigest({
    corpus: corpus(["how do i screen nifty stocks", "how do i screen nifty stocks"]),
    subject: "screen nifty stocks", caveat: CAVEAT,
  });
  const merged = mergeDemand(search, conversations);
  const lines = demandLines(merged);
  assert.ok(lines?.[0]?.includes("900 search impressions"));
  assert.ok(lines?.[1]?.includes("2 people asked it"));
  assert.equal(merged.searchQueries, 1);
  assert.equal(merged.corpusQuestions, 2);
});
