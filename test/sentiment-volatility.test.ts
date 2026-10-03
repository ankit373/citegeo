import test from "node:test";
import assert from "node:assert/strict";
import { buildSentimentVolatility, PUBLISHED_FLIP_RATIO, SENTIMENT_CAVEAT } from "../src/product/topics/sentiment-volatility.js";
import type { AnswerMention, PromptAnswer } from "../src/product/topics/prompt-run-schema.js";
import type { DiscoveryRecommendation } from "../src/product/measurements/measurement-schema.js";

function target(recommendation: DiscoveryRecommendation): AnswerMention {
  return { name: "Tradomate", domain: null, recommendation, mentionQuote: null, firstMentionOffset: 0, firstMentionState: "unique", isTarget: true };
}

function answer(mentions: AnswerMention[], over: Partial<PromptAnswer> = {}): PromptAnswer {
  return {
    id: String(Math.random()), projectId: "p", runId: "r", promptId: "q1", topicId: "t",
    promptText: "best screener", intent: "discovery", providerId: "openai", modelId: "gpt-4o",
    modelDisplayName: "M", regionId: "global", languageId: "en", status: "completed", text: "",
    mentions, citationUrls: [], errorCode: null, errorMessage: null, latencyMs: 1, createdAt: "", ...over,
  };
}

test("one pass cannot show framing moving", () => {
  const report = buildSentimentVolatility([answer([target("positive")])]);
  assert.equal(report.measured, 0);
  assert.equal(report.flipRate, null, "nothing measured is not perfect steadiness");
});

test("the same framing twice is steady", () => {
  const report = buildSentimentVolatility([answer([target("positive")]), answer([target("positive")])]);
  assert.equal(report.measured, 1);
  assert.equal(report.flipped, 0);
  assert.equal(report.questions[0]?.steady, true);
});

test("framing that changes between passes is the finding", () => {
  const report = buildSentimentVolatility([answer([target("positive")]), answer([target("negative")])]);
  assert.equal(report.flipped, 1);
  assert.equal(report.flipRate, 1);
  assert.deepEqual(report.questions[0]?.framings, ["negative", "positive"]);
});

test("a pass that never named the brand did not frame it badly", () => {
  // Counting the absence as a framing makes a brand that vanished look like
  // one that was described badly, which is a different finding entirely.
  const report = buildSentimentVolatility([answer([target("positive")]), answer([])]);
  assert.equal(report.measured, 0, "one pass named it, so framing cannot be compared");
  assert.equal(report.namingFlipped, 1, "the naming did flip, and that is counted");
});

test("naming and framing are counted apart, and the ratio compares them", () => {
  const steady = { promptId: "steady", promptText: "steady" };
  const report = buildSentimentVolatility([
    // Framing flips, naming does not.
    answer([target("positive")]), answer([target("negative")]),
    // Naming flips.
    answer([target("positive")], steady), answer([], steady),
  ]);
  assert.equal(report.flipRate, 1, "every question that could be measured flipped its framing");
  assert.equal(report.namingFlipRate, 0.5);
  assert.equal(report.ratio, 2);
});

test("naming that never flipped gives no ratio rather than a huge one", () => {
  const report = buildSentimentVolatility([answer([target("positive")]), answer([target("negative")])]);
  assert.equal(report.namingFlipRate, 0);
  assert.equal(report.ratio, null, "dividing by nought is not a very large ratio");
});

test("a different model is a different question, not another pass", () => {
  const report = buildSentimentVolatility([
    answer([target("positive")]),
    answer([target("negative")], { modelId: "sonar" }),
  ]);
  assert.equal(report.measured, 0, "comparing two models reports their difference as a flip");
});

test("a failed answer framed nothing", () => {
  const report = buildSentimentVolatility([answer([target("positive")]), answer([target("negative")], { status: "provider_failed" })]);
  assert.equal(report.measured, 0);
});

test("the published ratio travels, so a project can see if it behaves like the population", () => {
  assert.equal(buildSentimentVolatility([]).publishedRatio, PUBLISHED_FLIP_RATIO);
  assert.ok(PUBLISHED_FLIP_RATIO > 1);
});

test("the caveat says framing is the model's word and only steadiness is checked", () => {
  assert.ok(SENTIMENT_CAVEAT.includes("nothing here can check whether it is fair"));
  assert.equal(buildSentimentVolatility([]).caveat, SENTIMENT_CAVEAT);
});
