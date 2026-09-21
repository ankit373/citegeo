import test from "node:test";
import assert from "node:assert/strict";
import { buildPromptBrief } from "../src/product/topics/prompt-brief.js";
import type { AnswerMention, PromptAnswer } from "../src/product/topics/prompt-run-schema.js";
import type { Prompt } from "../src/product/topics/topic-schema.js";

const PROMPT: Prompt = {
  id: "q1", projectId: "p", topicId: "t", text: "best stock screener", normalizedText: "best stock screener",
  intent: "discovery", source: "authored", measuresVisibility: true, visibilityExclusionReason: null,
  status: "active", createdAt: "", activatedAt: null,
};

function mention(name: string, overrides: Partial<AnswerMention> = {}): AnswerMention {
  return { name, domain: null, recommendation: "positive", mentionQuote: null, firstMentionOffset: 0, firstMentionState: "unique", isTarget: false, ...overrides };
}

function answer(modelDisplayName: string, mentions: AnswerMention[], overrides: Partial<PromptAnswer> = {}): PromptAnswer {
  return {
    id: modelDisplayName + Math.random(), projectId: "p", runId: "r", promptId: "q1", topicId: "t",
    promptText: PROMPT.text, intent: "discovery", providerId: "anthropic", modelId: modelDisplayName,
    modelDisplayName, regionId: "global", languageId: "en", status: "completed", text: "an answer",
    mentions, citationUrls: [], errorCode: null, errorMessage: null, latencyMs: 100, createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("the brief carries the models' own words about each name, which is the standard to meet", () => {
  const brief = buildPromptBrief({
    prompt: PROMPT,
    answers: [
      answer("A", [mention("Screener.in", { mentionQuote: "best for fundamentals, 10-year financials" })]),
      answer("B", [mention("Screener.in", { mentionQuote: "clean custom query language" })]),
    ],
  });
  const winner = brief.voices[0];
  assert.equal(winner?.name, "Screener.in");
  assert.equal(winner?.answers, 2);
  assert.deepEqual(winner?.quotes.slice().sort(), ["best for fundamentals, 10-year financials", "clean custom query language"]);
});

test("the same sentence from two models is one quote, not two", () => {
  const brief = buildPromptBrief({
    prompt: PROMPT,
    answers: [
      answer("A", [mention("Screener.in", { mentionQuote: "Best for fundamentals." })]),
      answer("B", [mention("Screener.in", { mentionQuote: "best for fundamentals" })]),
    ],
  });
  assert.deepEqual(brief.voices[0]?.quotes, ["Best for fundamentals."]);
});

test("a question nobody answered is not a question you lost", () => {
  const brief = buildPromptBrief({ prompt: PROMPT, answers: [] });
  assert.equal(brief.answers, 0);
  assert.equal(brief.verdict, "Nothing has been asked here yet.");

  const failed = buildPromptBrief({
    prompt: PROMPT,
    answers: [answer("A", [], { status: "provider_failed", errorMessage: "402" })],
  });
  assert.equal(failed.answers, 0);
  assert.ok(failed.verdict.includes("not a zero"), failed.verdict);
});

test("absent here but named elsewhere is reported as a gap in the question, not the brand", () => {
  const brief = buildPromptBrief({
    prompt: PROMPT,
    answers: [answer("A", [mention("Screener.in")])],
    allAnswers: [
      answer("A", [mention("Screener.in")]),
      answer("A", [mention("You", { isTarget: true })], { promptId: "q2" }),
    ],
  });
  assert.deepEqual(brief.namesYouElsewhere, ["A"]);
  assert.ok(brief.verdict.includes("The gap is this question, not the brand."), brief.verdict);
});

test("named nowhere at all says so rather than implying the question is the problem", () => {
  const brief = buildPromptBrief({ prompt: PROMPT, answers: [answer("A", [mention("Screener.in")])], allAnswers: [] });
  assert.deepEqual(brief.namesYouElsewhere, []);
  assert.ok(brief.verdict.includes("none elsewhere in this project has either"), brief.verdict);
});

test("what was said about the brand is kept, including the unkind lines", () => {
  const brief = buildPromptBrief({
    prompt: PROMPT,
    answers: [answer("A", [mention("You", { isTarget: true, recommendation: "negative", mentionQuote: "thin data, would not rely on it" })])],
  });
  assert.equal(brief.appearances, 1);
  assert.deepEqual(brief.yourQuotes, ["thin data, would not rely on it"]);
  assert.equal(brief.voices[0]?.negative, 1);
});

test("each assistant is named on the side it landed, so one blind model is visible", () => {
  const brief = buildPromptBrief({
    prompt: PROMPT,
    answers: [
      answer("Sees you", [mention("You", { isTarget: true })]),
      answer("Blind", [mention("Screener.in")]),
    ],
  });
  assert.deepEqual(brief.namedBy, ["Sees you"]);
  assert.deepEqual(brief.missedBy, ["Blind"]);
});
