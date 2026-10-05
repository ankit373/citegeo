import test from "node:test";
import assert from "node:assert/strict";
import { buildVarianceReport, canIsolate } from "../src/product/topics/variance-share.js";
import type { AnswerMention, PromptAnswer } from "../src/product/topics/prompt-run-schema.js";

const TARGET: AnswerMention = {
  name: "Tradomate", domain: "tradomate.one", recommendation: "positive", mentionQuote: null,
  firstMentionOffset: 0, firstMentionState: "unique", isTarget: true,
};

function answer(promptId: string, named: boolean, index: number): PromptAnswer {
  return {
    id: "a" + index, projectId: "p", runId: "r", promptId, topicId: "t", promptText: promptId,
    intent: "discovery", providerId: "openai", modelId: "m", modelDisplayName: "M",
    regionId: "global", languageId: "en", status: "completed", text: "", mentions: named ? [TARGET] : [],
    citationUrls: [], errorCode: null, errorMessage: null, latencyMs: 1, createdAt: "2026-10-05T00:00:00.000Z",
  } as PromptAnswer;
}

/** `appeared` answers name the brand, spread across `questions` questions. */
function archive(appeared: number, total: number, questions: number): PromptAnswer[] {
  return Array.from({ length: total }, (_, i) => answer("q" + (i % questions), i < appeared, i));
}

test("a grouping with a level for every event explains everything by construction", () => {
  assert.equal(canIsolate(28, 3), true, "28 questions can separate 3 appearances however they fell");
  assert.equal(canIsolate(3, 28), false);
  assert.equal(canIsolate(1, 0), true, "with no events there is nothing to explain");
});

test("which question came out at 100% of three appearances, and that is the grouping", () => {
  // Live: 3 of 184 answers named the brand, across 28 questions, and the
  // question factor read 100%. It would read 100% wherever those three fell.
  const report = buildVarianceReport(archive(3, 184, 28));
  assert.equal(report.events, 3);
  const question = report.factors.find((row) => row.factor === "question");
  assert.equal(question?.share, null, "not nought: it cannot be measured at all here");
});

test("more events than levels and the share is measured", () => {
  const report = buildVarianceReport(archive(40, 184, 4));
  const question = report.factors.find((row) => row.factor === "question");
  assert.notEqual(question?.share, null);
  assert.ok((question?.share ?? -1) >= 0);
});

test("the rarer outcome is the one that counts, whichever side it is on", () => {
  assert.equal(buildVarianceReport(archive(181, 184, 28)).events, 3);
});

test("with no question written twice, the wording factor is the question factor", () => {
  const report = buildVarianceReport(archive(40, 184, 4));
  assert.equal(report.wordingIsTheQuestion, true);
  assert.equal(report.factors.filter((row) => row.factor === "wording").length, 0);
});
