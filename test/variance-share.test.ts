import test from "node:test";
import assert from "node:assert/strict";
import { buildVarianceReport, MIN_ANSWERS, VARIANCE_CAVEAT, varianceShare } from "../src/product/topics/variance-share.js";
import type { AnswerMention, PromptAnswer } from "../src/product/topics/prompt-run-schema.js";

const TARGET: AnswerMention = {
  name: "Tradomate", domain: null, recommendation: "positive", mentionQuote: null,
  firstMentionOffset: 0, firstMentionState: "unique", isTarget: true,
};

function answer(named: boolean, over: Partial<PromptAnswer> = {}): PromptAnswer {
  return {
    id: String(Math.random()), projectId: "p", runId: "r1", promptId: "q1", topicId: "t",
    promptText: "best screener", intent: "discovery", providerId: "openai", modelId: "gpt-4o",
    modelDisplayName: "M", regionId: "global", languageId: "en", status: "completed", text: "",
    mentions: named ? [TARGET] : [], citationUrls: [], errorCode: null, errorMessage: null,
    latencyMs: 1, createdAt: "", ...over,
  };
}

test("a factor that splits the outcome perfectly takes all of it", () => {
  assert.equal(varianceShare([[1, 1, 1], [0, 0, 0]]), 1);
});

test("a factor that splits it not at all takes none of it", () => {
  assert.equal(varianceShare([[1, 0, 1, 0], [1, 0, 1, 0]]), 0);
});

test("an outcome that never varied cannot be explained by anything", () => {
  assert.equal(varianceShare([[1, 1], [1, 1]]), null, "nothing varied, so nothing explains it");
  assert.equal(varianceShare([[0, 0, 0]]), null, "one group is not a comparison");
});

test("the model explains it when only the model differs", () => {
  const report = buildVarianceReport([
    ...Array.from({ length: 5 }, () => answer(true, { modelId: "a" })),
    ...Array.from({ length: 5 }, () => answer(false, { modelId: "b" })),
  ]);
  const model = report.factors.find((row) => row.factor === "model");
  assert.equal(model?.share, 1);
  assert.equal(report.factors[0]?.factor, "model", "the loudest comes first");
  assert.equal(model?.best?.level, "a");
  assert.equal(model?.worst?.level, "b");
});

test("a factor with one value explains nothing, which is not a share of nought", () => {
  const report = buildVarianceReport([
    ...Array.from({ length: 5 }, () => answer(true, { modelId: "a" })),
    ...Array.from({ length: 5 }, () => answer(false, { modelId: "b" })),
  ]);
  const market = report.factors.find((row) => row.factor === "market");
  assert.equal(market?.levels, 1);
  assert.equal(market?.share, null, "nothing varied, so it is unknown rather than nought");
});

test("the question explains it when only the question differs", () => {
  const report = buildVarianceReport([
    ...Array.from({ length: 4 }, () => answer(true, { promptId: "q1", promptText: "one" })),
    ...Array.from({ length: 4 }, () => answer(false, { promptId: "q2", promptText: "two" })),
  ]);
  assert.equal(report.factors.find((row) => row.factor === "question")?.share, 1);
});

test("an outcome that is always the same is flat and says so", () => {
  const report = buildVarianceReport(Array.from({ length: 10 }, () => answer(false, { modelId: String(Math.random()) })));
  assert.equal(report.flat, true);
  assert.equal(report.rate, 0);
  for (const factor of report.factors) assert.equal(factor.share, null, `${factor.factor} cannot explain a flat outcome`);
});

test("a handful of answers is marked too few to read", () => {
  const few = buildVarianceReport([answer(true), answer(false)]);
  assert.equal(few.tooFew, true);
  const enough = buildVarianceReport(Array.from({ length: MIN_ANSWERS }, (_, i) => answer(i % 2 === 0)));
  assert.equal(enough.tooFew, false);
});

test("a failed answer is not an answer that did not name you", () => {
  const report = buildVarianceReport([answer(true), answer(false, { status: "provider_failed" })]);
  assert.equal(report.answers, 1);
  assert.equal(report.rate, 1);
});

test("with nothing answered the rate is unknown rather than nought", () => {
  const report = buildVarianceReport([]);
  assert.equal(report.rate, null);
  assert.equal(report.flat, false, "nothing answered is not an outcome that did not vary");
});

test("the caveat refuses to let the shares be read as a decomposition", () => {
  assert.ok(VARIANCE_CAVEAT.includes("do not add up"));
  assert.ok(VARIANCE_CAVEAT.includes("not independent"));
  assert.equal(buildVarianceReport([]).caveat, VARIANCE_CAVEAT);
});
