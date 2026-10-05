import test from "node:test";
import assert from "node:assert/strict";
import { MIN_APPEARANCES_FOR_RATE, scoreAnswers } from "../src/product/topics/visibility-score.js";
import type { AnswerMention, PromptAnswer } from "../src/product/topics/prompt-run-schema.js";

const TARGET: AnswerMention = {
  name: "Tradomate", domain: "tradomate.one", recommendation: "positive", mentionQuote: null,
  firstMentionOffset: 0, firstMentionState: "unique", isTarget: true,
};

function answer(named: boolean, index: number): PromptAnswer {
  return {
    id: "a" + index, projectId: "p", runId: "r", promptId: "q", topicId: "t", promptText: "q",
    intent: "discovery", providerId: "openai", modelId: "m", modelDisplayName: "M",
    regionId: "global", languageId: "en", status: "completed", text: "", mentions: named ? [TARGET] : [],
    citationUrls: [], errorCode: null, errorMessage: null, latencyMs: 1, createdAt: "2026-10-04T00:00:00.000Z",
  } as PromptAnswer;
}

function archive(named: number, total: number): PromptAnswer[] {
  return Array.from({ length: total }, (_, index) => answer(index < named, index));
}

test("prominence and framing carry how many appearances they are a mean over", () => {
  // They are means over the answers that named the brand, which is a different
  // and much smaller population than the answers presence is taken over.
  const score = scoreAnswers(archive(3, 169));
  assert.equal(score.answers, 169);
  assert.equal(score.appearances, 3);
  assert.equal(score.namedIn, 3);
});

test("three appearances are too few to read as a rate", () => {
  // Live: PROMINENCE 100% was printed beside AVERAGE POSITION: Not named,
  // both right over different populations, and the big number read as a win.
  const score = scoreAnswers(archive(3, 169));
  assert.equal(score.tooFewAppearances, true);
  assert.equal(score.prominence, 1, "the figure is still carried, it is just not a rate yet");
});

test("enough appearances and it is a rate again", () => {
  const score = scoreAnswers(archive(MIN_APPEARANCES_FOR_RATE, 169));
  assert.equal(score.tooFewAppearances, false);
  assert.equal(score.prominence, 1);
});

test("never named has nothing to be a mean over, which is not a rate of nought", () => {
  const score = scoreAnswers(archive(0, 169));
  assert.equal(score.namedIn, 0);
  assert.equal(score.tooFewAppearances, true);
  assert.equal(score.prominence, null);
  assert.equal(score.sentiment, null);
});

test("presence stays a rate at the same counts, because it is over every answer", () => {
  // 3 of 169 is a real rate with a real band. 3 of 3 is not.
  const score = scoreAnswers(archive(3, 169));
  assert.equal(score.tooFewAnswers, false);
  assert.ok((score.presenceRate || 0) > 0.01 && (score.presenceRate || 0) < 0.02);
});
