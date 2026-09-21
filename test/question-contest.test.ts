import test from "node:test";
import assert from "node:assert/strict";
import { buildQuestionContest, OPEN_AGREEMENT, SETTLED_AGREEMENT } from "../src/product/topics/question-contest.js";
import type { AnswerMention, PromptAnswer } from "../src/product/topics/prompt-run-schema.js";
import type { Prompt } from "../src/product/topics/topic-schema.js";

const PROMPT: Prompt = {
  id: "q1", projectId: "p", topicId: "t", text: "best screener", normalizedText: "best screener",
  intent: "discovery", source: "authored", measuresVisibility: true, visibilityExclusionReason: null,
  status: "active", createdAt: "", activatedAt: null,
};

function mention(name: string, offset: number, isTarget = false): AnswerMention {
  return { name, domain: null, recommendation: "positive", mentionQuote: null, firstMentionOffset: offset, firstMentionState: "unique", isTarget };
}

function answer(mentions: AnswerMention[], status: PromptAnswer["status"] = "completed"): PromptAnswer {
  return {
    id: String(Math.random()), projectId: "p", runId: "r", promptId: "q1", topicId: "t",
    promptText: PROMPT.text, intent: "discovery", providerId: "anthropic", modelId: "m",
    modelDisplayName: "M", regionId: "global", languageId: "en", status, text: "",
    mentions, citationUrls: [], errorCode: null, errorMessage: null, latencyMs: 1, createdAt: "",
  };
}

test("one name first in most answers, against a short field, is a settled question", () => {
  const contest = buildQuestionContest({
    prompt: PROMPT,
    answers: [
      answer([mention("Screener.in", 0), mention("Chartink", 40)]),
      answer([mention("Screener.in", 0), mention("Chartink", 50)]),
      answer([mention("Screener.in", 0), mention("Tickertape", 30)]),
    ],
  });
  assert.equal(contest.state, "settled");
  assert.equal(contest.usualLeader, "Screener.in");
  assert.equal(contest.leaderAgreement, 1);
  assert.ok(contest.reason.includes("Screener.in"));
});

test("a long tail behind a reliable leader is still a settled question", () => {
  const contest = buildQuestionContest({
    prompt: PROMPT,
    answers: Array.from({ length: 7 }, (unused, index) => answer([
      mention("Screener.in", 0),
      mention(`One-off ${index}`, 30),
      mention(`One-off ${index}b`, 60),
    ])),
  });
  assert.equal(contest.named, 15, "the tail is long");
  assert.equal(contest.namedOnce, 14);
  assert.equal(contest.state, "settled", "who comes first is what ownership means, not how many are listed");
  assert.ok(contest.reason.includes("15 organisation(s) named in total"));
});

test("disagreement about who comes first is open even when the field is short", () => {
  const contest = buildQuestionContest({
    prompt: PROMPT,
    answers: [answer([mention("A", 0)]), answer([mention("B", 0)]), answer([mention("C", 0)])],
  });
  assert.equal(contest.leaderAgreement !== null && contest.leaderAgreement < OPEN_AGREEMENT, true);
  assert.equal(contest.state, "open");
  assert.ok(contest.reason.includes("No name leads"));
});

test("nothing answered reads as no reading, and never as a settled field", () => {
  const contest = buildQuestionContest({ prompt: PROMPT, answers: [answer([mention("A", 0)], "provider_failed")] });
  assert.equal(contest.answers, 0);
  assert.equal(contest.named, 0);
  assert.equal(contest.leaderAgreement, null);
  assert.ok(contest.reason.includes("Nothing has been answered"));
  assert.equal(contest.state, "unknown", "an unasked question has no field to read, which is not an open one");
});

test("an answer with no readable order contributes a name but not a leader", () => {
  const unordered = answer([{ ...mention("A", 0), firstMentionOffset: null, firstMentionState: "none" }]);
  const contest = buildQuestionContest({ prompt: PROMPT, answers: [unordered] });
  assert.equal(contest.named, 1);
  assert.equal(contest.leaderAgreement, null);
  assert.equal(contest.usualLeader, null);
  assert.ok(contest.reason.includes("nobody can be said to lead"));
});

test("the brand's own appearances are counted so an absence carries its context", () => {
  const contest = buildQuestionContest({
    prompt: PROMPT,
    answers: [answer([mention("A", 0), mention("You", 20, true)]), answer([mention("A", 0)])],
  });
  assert.equal(contest.youNamed, 1);
  assert.equal(SETTLED_AGREEMENT, 0.6);
});
