import test from "node:test";
import assert from "node:assert/strict";
import { exploreConversations, questionIntent } from "../src/product/demand/conversation-explorer.js";
import { explorationId } from "../src/product/demand/exploration-store.js";
import { meaningfulTerms, type IndexedCorpus } from "../src/product/demand/corpus-ingest.js";
import type { Prompt } from "../src/product/topics/topic-schema.js";

function corpusOf(questions: string[]): IndexedCorpus {
  const postings = new Map<string, number[]>();
  questions.forEach((question, row) => {
    for (const term of meaningfulTerms(question)) {
      postings.set(term, [...(postings.get(term) || []), row]);
    }
  });
  return {
    index: { sourceId: "wildchat", questions: questions.length, vocabulary: postings.size, from: null, to: null, builtAt: "2026-01-01T00:00:00.000Z" },
    postings,
    questions,
  };
}

function prompt(id: string, text: string): Prompt {
  return { id, topicId: "t", text, intent: "research", measuresVisibility: true, status: "active" } as unknown as Prompt;
}

test("intent is read from the shape of the question", () => {
  assert.equal(questionIntent("how do I export a watchlist"), "how_to");
  assert.equal(questionIntent("what is a stock screener"), "definition");
  assert.equal(questionIntent("is Tradomate reliable"), "verification");
  assert.equal(questionIntent("best stock screener for India"), "comparison");
  assert.equal(questionIntent("Tradomate vs Screener"), "comparison");
  assert.equal(questionIntent("how much does a screener cost"), "purchase");
});

test("a question fitting none of them is unknown, not the nearest guess", () => {
  assert.equal(questionIntent("stock screener"), "unknown");
  assert.equal(questionIntent(""), "unknown");
  assert.equal(questionIntent("please help me"), "unknown");
});

test("comparison is decided before purchase, so a priced comparison is a comparison", () => {
  assert.equal(questionIntent("best screener by price"), "comparison");
  assert.equal(questionIntent("cheapest screener"), "purchase");
});

test("matched counts questions carrying every word, related counts most of them", () => {
  const corpus = corpusOf([
    "best stock screener for indian markets",
    "best stock screener",
    "how do I pick a screener",
    "what is the weather",
  ]);
  const report = exploreConversations({ corpus, query: "best stock screener", prompts: [] });
  assert.equal(report.matched, 2);
  assert.ok(report.related >= report.matched, "related is the looser and larger figure");
});

test("a question a tracked prompt already measures is named as covered", () => {
  const corpus = corpusOf(["best stock screener for indian markets", "how do I export a watchlist"]);
  const report = exploreConversations({
    corpus,
    query: "screener",
    prompts: [prompt("p1", "best stock screener for indian markets")],
  });
  const covered = report.questions.filter((row) => row.coveredBy);
  assert.equal(covered.length, 1);
  assert.equal(covered[0]?.coveredBy, "p1");
});

test("what nothing tracks is counted and sorted to the top", () => {
  const corpus = corpusOf([
    "best stock screener for indian markets",
    "screener with backtesting",
    "screener api access",
  ]);
  const report = exploreConversations({
    corpus,
    query: "screener",
    prompts: [prompt("p1", "best stock screener for indian markets")],
  });
  assert.equal(report.matched, 3);
  assert.equal(report.uncovered, 2, "two of the three are measured by nothing");
  assert.equal(report.questions[0]?.coveredBy, null, "the reason to open this is what is missing");
});

test("with no prompts tracked at all, every matching question is uncovered", () => {
  const corpus = corpusOf(["screener api access", "screener with backtesting"]);
  const report = exploreConversations({ corpus, query: "screener", prompts: [] });
  assert.equal(report.uncovered, 2);
  assert.ok(report.questions.every((row) => row.coveredBy === null));
});

test("an empty corpus reports a null share rather than zero demand", () => {
  const report = exploreConversations({ corpus: corpusOf([]), query: "screener", prompts: [] });
  assert.equal(report.matched, 0);
  assert.equal(report.shareOfCorpus, null, "zero over zero is not zero demand");
  assert.deepEqual(report.questions, []);
});

test("share is measured against the whole corpus, not against the matches", () => {
  const corpus = corpusOf(["screener one", "screener two", "unrelated", "also unrelated"]);
  const report = exploreConversations({ corpus, query: "screener", prompts: [] });
  assert.equal(report.matched, 2);
  assert.equal(report.shareOfCorpus, 0.5);
});

test("the intent breakdown covers every question returned and no more", () => {
  const corpus = corpusOf(["how do I use a screener", "best screener", "what is a screener"]);
  const report = exploreConversations({ corpus, query: "screener", prompts: [] });
  const counted = report.byIntent.reduce((sum, row) => sum + row.questions, 0);
  assert.equal(counted, report.questions.length);
  assert.ok(report.byIntent.every((row) => row.share > 0 && row.share <= 1));
});

test("the corpus caveat travels with the numbers", () => {
  const report = exploreConversations({ corpus: corpusOf(["screener"]), query: "screener", prompts: [] });
  assert.ok(report.caveat.length > 20, "a figure from a corpus without its caveat is a figure that misleads");
});

test("the same query explored twice replaces the older answer", () => {
  assert.equal(explorationId("Best Stock Screener "), explorationId("best stock screener"));
  assert.notEqual(explorationId("a"), explorationId("b"));
});

test("a request for more questions than exist returns what there is", () => {
  const corpus = corpusOf(["screener one", "screener two"]);
  assert.equal(exploreConversations({ corpus, query: "screener", prompts: [], limit: 500 }).questions.length, 2);
});
