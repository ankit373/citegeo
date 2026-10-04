import test from "node:test";
import assert from "node:assert/strict";
import { asDomain } from "../src/product/topics/prompt-identity.js";
import { buildTopicInsights } from "../src/product/topics/topic-insights.js";
import type { AnswerMention, PromptAnswer } from "../src/product/topics/prompt-run-schema.js";

test("a category offered as a domain is not a domain", () => {
  // Measured live: four unrelated brands all carried the domain "finance",
  // and two more carried "financial data platform".
  assert.equal(asDomain("finance"), null);
  assert.equal(asDomain("financial data platform"), null);
  assert.equal(asDomain(""), null);
  assert.equal(asDomain(null), null);
  assert.equal(asDomain("a stock screener"), null);
});

test("a domain offered any of the usual ways is read as the host", () => {
  assert.equal(asDomain("screener.in"), "screener.in");
  assert.equal(asDomain("https://www.screener.in/features/"), "screener.in");
  assert.equal(asDomain("  Screener.IN  "), "screener.in");
  assert.equal(asDomain("hello@screener.in"), "screener.in");
  assert.equal(asDomain("sub.screener.co.uk"), "sub.screener.co.uk");
});

test("a host that is not one is refused rather than half read", () => {
  assert.equal(asDomain("screener."), null);
  assert.equal(asDomain(".in"), null);
  assert.equal(asDomain("screener.i"), null);
  assert.equal(asDomain("screener.123"), null);
  assert.equal(asDomain("-bad.com"), null);
});

function mention(name: string, domain: string | null, offset = 0): AnswerMention {
  return { name, domain, recommendation: "positive", mentionQuote: null, firstMentionOffset: offset, firstMentionState: "unique", isTarget: false };
}

function answer(mentions: AnswerMention[], id: string): PromptAnswer {
  return {
    id, projectId: "p", runId: "r", promptId: "q1", topicId: "t", promptText: "best screener",
    intent: "discovery", providerId: "openai", modelId: "m", modelDisplayName: "M",
    regionId: "global", languageId: "en", status: "completed", text: "", mentions,
    citationUrls: [], errorCode: null, errorMessage: null, latencyMs: 1, createdAt: "2026-10-04T00:00:00.000Z",
  };
}

function board(answers: PromptAnswer[]) {
  return buildTopicInsights({
    projectId: "p",
    set: { projectId: "p", topics: [{ id: "t", projectId: "p", name: "T", description: "", source: "authored", status: "active", createdAt: "" }], prompts: [{ id: "q1", projectId: "p", topicId: "t", text: "best screener", normalizedText: "best screener", intent: "discovery", source: "authored", measuresVisibility: true, visibilityExclusionReason: null, status: "active", createdAt: "", activatedAt: "" }], generatedAt: null, updatedAt: "" },
    answers,
    runs: [],
    identityCaveat: null,
  }).leaderboard;
}

test("one site written two ways is one rival, not two half-sized ones", () => {
  // Live, before this: Tickertape and Ticker Tape were separate rows, as were
  // four spellings of the National Stock Exchange.
  const rows = board([
    answer([mention("Tickertape", "tickertape.in")], "a1"),
    answer([mention("Ticker Tape", "tickertape.in")], "a2"),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.appearances, 2);
  assert.equal(rows[0]?.name, "Ticker Tape", "the names tie, so the first alphabetically labels it");
  assert.deepEqual(rows[0]?.alsoKnownAs, ["Tickertape"], "a merge nobody can see is a merge nobody can check");
});

test("one name given two sites is still one rival", () => {
  // The case the old key was written for: a model gives ChatGPT as openai.com
  // in one answer and chatgpt.com in the next.
  const rows = board([
    answer([mention("ChatGPT", "openai.com")], "a1"),
    answer([mention("ChatGPT", "chatgpt.com")], "a2"),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.appearances, 2);
});

test("two rivals that share neither a name nor a site stay two", () => {
  const rows = board([
    answer([mention("Chartink", "finance"), mention("Trendlyne", "finance")], "a1"),
  ]);
  assert.equal(rows.length, 2, "a category they both carried is not a site they share");
});

test("the label is the name the answers used most", () => {
  const rows = board([
    answer([mention("NSE", "nseindia.com")], "a1"),
    answer([mention("NSE", "nseindia.com")], "a2"),
    answer([mention("National Stock Exchange", "nseindia.com")], "a3"),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.name, "NSE");
  assert.deepEqual(rows[0]?.alsoKnownAs, ["National Stock Exchange"]);
});
