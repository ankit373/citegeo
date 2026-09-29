import test from "node:test";
import assert from "node:assert/strict";
import { INTERVAL_CAVEAT, UNINFORMATIVE_WIDTH, tooWideToRead, wilsonInterval } from "../src/product/topics/proportion-interval.js";
import { scoreAnswers } from "../src/product/topics/visibility-score.js";
import type { PromptAnswer } from "../src/product/topics/prompt-run-schema.js";

const round = (value: number | null) => (value === null ? null : Math.round(value * 1000) / 1000);

test("nothing measured is no range rather than a range of zero", () => {
  const none = wilsonInterval(0, 0);
  assert.equal(none.rate, null);
  assert.equal(none.low, null);
  assert.equal(none.high, null);
  assert.equal(none.trials, 0);
});

test("never named out of a handful rules out very little", () => {
  const band = wilsonInterval(0, 13);
  assert.equal(band.rate, 0);
  assert.equal(band.low, 0, "a rate cannot be below zero, which the normal interval forgets");
  assert.ok((band.high || 0) > 0.2 && (band.high || 0) < 0.3, `13 answers leave room up to ${band.high}`);
});

test("always named out of a handful is not certainty either", () => {
  const band = wilsonInterval(12, 12);
  assert.equal(band.rate, 1);
  assert.equal(band.high, 1);
  assert.ok((band.low || 0) < 0.8, `12 answers do not pin it above ${band.low}`);
});

test("more answers narrow the range on the same rate", () => {
  const few = wilsonInterval(5, 10);
  const many = wilsonInterval(500, 1000);
  assert.equal(few.rate, many.rate);
  assert.ok(((many.high || 0) - (many.low || 0)) < ((few.high || 0) - (few.low || 0)) / 5, "ten answers and a thousand are not the same claim");
});

test("the range stays inside nought and one", () => {
  for (const trials of [1, 3, 7, 40]) {
    for (let hits = 0; hits <= trials; hits += 1) {
      const band = wilsonInterval(hits, trials);
      assert.ok((band.low || 0) >= 0 && (band.high || 0) <= 1, `${hits}/${trials}`);
    }
  }
});

test("a range wider than the judgement is called out as deciding nothing", () => {
  assert.equal(tooWideToRead(wilsonInterval(1, 8)), true);
  assert.equal(tooWideToRead(wilsonInterval(300, 1000)), false);
  assert.ok(UNINFORMATIVE_WIDTH > 0 && UNINFORMATIVE_WIDTH < 1);
});

function answer(named: boolean): PromptAnswer {
  return {
    id: String(Math.random()), projectId: "p", runId: "r", promptId: "q", topicId: "t",
    promptText: "best screener", intent: "discovery", providerId: "openrouter", modelId: "m",
    modelDisplayName: "M", regionId: "global", languageId: "en", status: "completed", text: "",
    mentions: named
      ? [{ name: "You", domain: null, recommendation: "positive", mentionQuote: null, firstMentionOffset: 0, firstMentionState: "unique", isTarget: true }]
      : [],
    citationUrls: [], errorCode: null, errorMessage: null, latencyMs: 1, createdAt: "",
  };
}

test("the score carries the range its presence rate came from", () => {
  const score = scoreAnswers([answer(true), answer(false), answer(false), answer(false)]);
  assert.equal(score.presenceRate, 0.25);
  assert.equal(round(score.presenceInterval.rate), 0.25);
  assert.equal(score.presenceInterval.trials, 4);
  assert.equal(score.tooFewAnswers, true, "four answers decide nothing");
});

test("never named still reports how far from zero four answers can rule out", () => {
  const score = scoreAnswers([answer(false), answer(false), answer(false), answer(false)]);
  assert.equal(score.presenceRate, 0, "measured, and the answer is none");
  assert.equal(score.presenceInterval.low, 0);
  assert.ok((score.presenceInterval.high || 0) > 0.4, "zero out of four does not mean zero");
});

test("nothing answered carries no range, and is not called too few", () => {
  const score = scoreAnswers([]);
  assert.equal(score.presenceInterval.low, null);
  assert.equal(score.tooFewAnswers, false);
});

test("the caveat says what the range does not cover", () => {
  assert.ok(INTERVAL_CAVEAT.includes("covers the sampling, not the drift"));
  assert.equal(wilsonInterval(1, 2).caveat, INTERVAL_CAVEAT);
});
