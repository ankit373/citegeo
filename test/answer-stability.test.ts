import test from "node:test";
import assert from "node:assert/strict";
import { buildStabilityReport, jaccard, STABILITY_CAVEAT } from "../src/product/topics/answer-stability.js";
import type { AnswerMention, PromptAnswer } from "../src/product/topics/prompt-run-schema.js";

const TARGET: AnswerMention = {
  name: "Tradomate", domain: null, recommendation: "positive", mentionQuote: null,
  firstMentionOffset: 0, firstMentionState: "unique", isTarget: true,
};

function answer(over: Partial<PromptAnswer> = {}): PromptAnswer {
  return {
    id: String(Math.random()), projectId: "p", runId: "r", promptId: "q1", topicId: "t",
    promptText: "best screener", intent: "discovery", providerId: "perplexity", modelId: "sonar",
    modelDisplayName: "M", regionId: "global", languageId: "en", status: "completed", text: "",
    mentions: [], citationUrls: [], errorCode: null, errorMessage: null, latencyMs: 1, createdAt: "",
    ...over,
  };
}

test("two sets sharing nothing overlap not at all, and identical ones fully", () => {
  assert.equal(jaccard(new Set(["a"]), new Set(["b"])), 0);
  assert.equal(jaccard(new Set(["a", "b"]), new Set(["a", "b"])), 1);
  assert.equal(jaccard(new Set(["a", "b"]), new Set(["b", "c"])), 1 / 3);
});

test("two empty sets are unmeasurable, not identical", () => {
  assert.equal(jaccard(new Set(), new Set()), null, "calling them a perfect match would invent stability");
});

test("a question asked once says nothing about stability", () => {
  const report = buildStabilityReport([answer({ citationUrls: ["https://a.test/x"] })]);
  assert.equal(report.measured, 0);
  assert.equal(report.askedOnce, 1);
  assert.equal(report.sourceOverlap, null, "one pass has nothing to compare against");
});

test("the same question asked twice is compared on the sources it cited", () => {
  const report = buildStabilityReport([
    answer({ repetition: 1, citationUrls: ["https://a.test/x", "https://b.test/y"] }),
    answer({ repetition: 2, citationUrls: ["https://b.test/y", "https://c.test/z"] }),
  ]);
  assert.equal(report.measured, 1);
  assert.equal(report.questions[0]?.passes, 2);
  assert.equal(report.questions[0]?.sourceOverlap, 1 / 3, "one source of three survived both passes");
  assert.equal(report.questions[0]?.sourcesAlways, 1);
  assert.equal(report.questions[0]?.sourcesEver, 3);
});

test("the same page spelled two ways is the same source between passes", () => {
  const report = buildStabilityReport([
    answer({ repetition: 1, citationUrls: ["https://a.test/x?utm_source=chatgpt.com"] }),
    answer({ repetition: 2, citationUrls: ["https://www.a.test/x/"] }),
  ]);
  assert.equal(report.questions[0]?.sourceOverlap, 1, "counted raw this read as a total change of sources");
});

test("passes disagreeing about whether you appear is the finding", () => {
  const report = buildStabilityReport([
    answer({ repetition: 1, mentions: [TARGET] }),
    answer({ repetition: 2, mentions: [] }),
  ]);
  assert.equal(report.questions[0]?.named, 1);
  assert.equal(report.questions[0]?.namingAgreed, false);
  assert.equal(report.namingUnstable, 1);
});

test("passes that always agree are stable whether or not you appear", () => {
  const never = buildStabilityReport([answer({ repetition: 1 }), answer({ repetition: 2 })]);
  assert.equal(never.questions[0]?.namingAgreed, true, "never named twice is agreement, not instability");
  const always = buildStabilityReport([
    answer({ repetition: 1, mentions: [TARGET] }),
    answer({ repetition: 2, mentions: [TARGET] }),
  ]);
  assert.equal(always.questions[0]?.namingAgreed, true);
  assert.equal(always.namingUnstable, 0);
});

test("a different model is a different question, not another pass of the same one", () => {
  const report = buildStabilityReport([
    answer({ modelId: "sonar", citationUrls: ["https://a.test/x"] }),
    answer({ modelId: "gpt-4o", citationUrls: ["https://b.test/y"] }),
  ]);
  assert.equal(report.measured, 0, "comparing two models would report disagreement as instability");
  assert.equal(report.askedOnce, 2);
});

test("a market or a persona changing is also a different question", () => {
  const byMarket = buildStabilityReport([answer({ regionId: "global" }), answer({ regionId: "in" })]);
  assert.equal(byMarket.measured, 0);
  const byPersona = buildStabilityReport([answer({ personaId: "a" }), answer({ personaId: "b" })]);
  assert.equal(byPersona.measured, 0);
});

test("an answer that never completed is not a pass", () => {
  const report = buildStabilityReport([
    answer({ repetition: 1, citationUrls: ["https://a.test/x"] }),
    answer({ repetition: 2, status: "provider_failed" }),
  ]);
  assert.equal(report.measured, 0, "one usable pass is one pass");
  assert.equal(report.askedOnce, 1);
});

test("passes that cited nothing at all leave the overlap unmeasurable", () => {
  const report = buildStabilityReport([answer({ repetition: 1 }), answer({ repetition: 2 })]);
  assert.equal(report.questions[0]?.sourceOverlap, null, "no sources either time is not perfect agreement");
  assert.equal(report.sourceOverlap, null);
});

test("the least stable question comes first, because its number means least", () => {
  const steady = { promptId: "steady", promptText: "steady" };
  const report = buildStabilityReport([
    answer({ ...steady, repetition: 1, citationUrls: ["https://a.test/x"] }),
    answer({ ...steady, repetition: 2, citationUrls: ["https://a.test/x"] }),
    answer({ repetition: 1, citationUrls: ["https://b.test/y"] }),
    answer({ repetition: 2, citationUrls: ["https://c.test/z"] }),
  ]);
  assert.equal(report.questions[0]?.sourceOverlap, 0);
  assert.equal(report.questions[1]?.sourceOverlap, 1);
  assert.equal(report.sourceOverlap, 0.5);
});

test("the caveat says what the measurement does and does not cover", () => {
  assert.ok(STABILITY_CAVEAT.includes("under identical conditions"));
  assert.ok(STABILITY_CAVEAT.includes("minutes apart inside one run or weeks apart across several"));
  assert.ok(STABILITY_CAVEAT.includes("not the same claim"), "a figure over minutes and one over weeks differ");
  assert.equal(buildStabilityReport([]).caveat, STABILITY_CAVEAT);
});

test("the span between passes travels, because minutes and weeks are not one claim", () => {
  const report = buildStabilityReport([
    answer({ repetition: 1, createdAt: "2026-09-01T00:00:00.000Z", citationUrls: ["https://a.test/x"] }),
    answer({ repetition: 2, createdAt: "2026-09-08T00:00:00.000Z", citationUrls: ["https://a.test/x"] }),
  ]);
  assert.equal(report.questions[0]?.spanHours, 168, "seven days, not the minutes a single run takes");
});

test("a pass with no readable time leaves the span unknown, not nought", () => {
  const report = buildStabilityReport([
    answer({ repetition: 1, createdAt: "" }),
    answer({ repetition: 2, createdAt: "2026-09-08T00:00:00.000Z" }),
  ]);
  assert.equal(report.questions[0]?.spanHours, null);
});

test("passes from separate runs are still passes of the same question", () => {
  const report = buildStabilityReport([
    answer({ runId: "r1", citationUrls: ["https://a.test/x"] }),
    answer({ runId: "r2", citationUrls: ["https://b.test/y"] }),
  ]);
  assert.equal(report.measured, 1, "the conditions matched, so asking again later is another pass");
  assert.equal(report.questions[0]?.sourceOverlap, 0);
});
