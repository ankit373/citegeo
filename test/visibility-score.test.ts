import test from "node:test";
import assert from "node:assert/strict";
import { positionWeight, scoreAnswers, SCORE_WEIGHTS } from "../src/product/topics/visibility-score.js";
import { buildTopicInsights } from "../src/product/topics/topic-insights.js";
import type { AnswerMention, PromptAnswer } from "../src/product/topics/prompt-run-schema.js";
import type { TopicSet } from "../src/product/topics/topic-schema.js";

function mention(overrides: Partial<AnswerMention> & { name: string }): AnswerMention {
  return {
    domain: null,
    recommendation: "mentioned",
    mentionQuote: null,
    firstMentionOffset: null,
    firstMentionState: "unresolved",
    isTarget: false,
    ...overrides,
  };
}

function answer(overrides: Partial<PromptAnswer> = {}): PromptAnswer {
  return {
    id: `a-${Math.random()}`,
    projectId: "p",
    runId: "r",
    promptId: "prompt-1",
    topicId: "topic-1",
    promptText: "best stock screener",
    intent: "discovery",
    providerId: "openrouter",
    modelId: "gpt-x",
    modelDisplayName: "GPT X",
    status: "completed",
    text: "...",
    mentions: [],
    citationUrls: [],
    errorCode: null,
    errorMessage: null,
    latencyMs: 10,
    regionId: "global",
    createdAt: "2026-09-20T00:00:00.000Z",
    ...overrides,
  };
}

test("nothing answered is not a zero score", () => {
  const score = scoreAnswers([]);
  assert.equal(score.score, null);
  assert.equal(score.presenceRate, null);
  assert.equal(score.answers, 0);
});

test("a failed answer is not counted as an answer that did not name the brand", () => {
  const score = scoreAnswers([answer({ status: "provider_failed" }), answer({ status: "analysis_failed" })]);
  assert.equal(score.answers, 0);
  assert.equal(score.score, null, "two failures must not read as 0% visibility");
});

test("answered but never named is a real zero, because it was measured", () => {
  const score = scoreAnswers([answer({ mentions: [mention({ name: "Rival" })] })]);
  assert.equal(score.answers, 1);
  assert.equal(score.appearances, 0);
  assert.equal(score.score, 0);
  assert.equal(score.presenceRate, 0);
});

test("named first and recommended everywhere scores 100", () => {
  const score = scoreAnswers([
    answer({ mentions: [mention({ name: "Us", isTarget: true, recommendation: "positive", firstMentionOffset: 10 }), mention({ name: "Rival", firstMentionOffset: 200 })] }),
  ]);
  assert.equal(score.presenceRate, 1);
  assert.equal(score.prominence, 1);
  assert.equal(score.sentiment, 1);
  assert.equal(score.score, 100);
});

test("named last and rejected still beats not being named at all", () => {
  const late = scoreAnswers([
    answer({ mentions: [mention({ name: "Rival", firstMentionOffset: 10 }), mention({ name: "Us", isTarget: true, recommendation: "negative", firstMentionOffset: 500 })] }),
  ]);
  const absent = scoreAnswers([answer({ mentions: [mention({ name: "Rival" })] })]);
  assert.ok((late.score || 0) > (absent.score || 0));
  assert.equal(late.sentiment, 0);
});

test("the weights used are reported with the score, so it can be recomputed by hand", () => {
  const score = scoreAnswers([answer({ mentions: [mention({ name: "Us", isTarget: true })] })]);
  assert.deepEqual(score.weights, SCORE_WEIGHTS);
  assert.ok(SCORE_WEIGHTS.prominenceFloor > 0 && SCORE_WEIGHTS.prominenceFloor < 1);
});

test("position is ranked within the answer, not read off a raw character offset", () => {
  const first = positionWeight([
    mention({ name: "Us", isTarget: true, firstMentionOffset: 400 }),
    mention({ name: "Rival", firstMentionOffset: 900 }),
  ]);
  assert.equal(first, 1, "400 is early in a long answer");
  const last = positionWeight([
    mention({ name: "Rival", firstMentionOffset: 5 }),
    mention({ name: "Us", isTarget: true, firstMentionOffset: 20 }),
  ]);
  assert.equal(last, 0.5);
});

test("an unresolvable position is excluded rather than scored as middling", () => {
  assert.equal(positionWeight([mention({ name: "Us", isTarget: true })]), null);
  assert.equal(positionWeight([mention({ name: "Us", isTarget: true, firstMentionState: "unique" })]), 1);
});

const SET: TopicSet = {
  projectId: "p",
  generatedAt: null,
  updatedAt: "",
  topics: [
    { id: "topic-1", projectId: "p", name: "Screening", description: "", source: "generated", status: "active", createdAt: "" },
    { id: "topic-2", projectId: "p", name: "Portfolio", description: "", source: "generated", status: "active", createdAt: "" },
  ],
  prompts: [
    { id: "prompt-1", projectId: "p", topicId: "topic-1", text: "best stock screener", normalizedText: "best stock screener", intent: "discovery", source: "generated", measuresVisibility: true, visibilityExclusionReason: null, status: "active", createdAt: "", activatedAt: null },
    { id: "prompt-2", projectId: "p", topicId: "topic-2", text: "best portfolio tracker", normalizedText: "best portfolio tracker", intent: "discovery", source: "generated", measuresVisibility: true, visibilityExclusionReason: null, status: "active", createdAt: "", activatedAt: null },
  ],
};

test("the leaderboard ranks the brand against everyone the models named", () => {
  const insights = buildTopicInsights({
    projectId: "p",
    set: SET,
    answers: [
      answer({ mentions: [mention({ name: "Rival", firstMentionOffset: 1 }), mention({ name: "Us", isTarget: true, firstMentionOffset: 2 })] }),
      answer({ mentions: [mention({ name: "Rival", firstMentionOffset: 1 })] }),
    ],
  });
  assert.equal(insights.rank, 2);
  assert.equal(insights.leaderboard[0]?.name, "Rival");
  assert.equal(insights.leaderboard[0]?.appearances, 2);
});

test("a brand named three times in one answer is one observation, not three", () => {
  const insights = buildTopicInsights({
    projectId: "p",
    set: SET,
    answers: [answer({ mentions: [mention({ name: "Us", isTarget: true }), mention({ name: "Us", isTarget: true }), mention({ name: "Us", isTarget: true })] })],
  });
  assert.equal(insights.leaderboard[0]?.appearances, 1);
});

test("topics are ordered worst first, because that is where the work is", () => {
  const insights = buildTopicInsights({
    projectId: "p",
    set: SET,
    answers: [
      answer({ promptId: "prompt-1", topicId: "topic-1", mentions: [mention({ name: "Us", isTarget: true, recommendation: "positive", firstMentionOffset: 1 })] }),
      answer({ promptId: "prompt-2", topicId: "topic-2", mentions: [mention({ name: "Rival" })] }),
    ],
  });
  assert.equal(insights.topics[0]?.name, "Portfolio");
  assert.equal(insights.topics[0]?.score.score, 0);
  assert.equal(insights.absentFrom[0]?.promptId, "prompt-2");
});

test("a prompt names who is ahead of the brand, which is the actionable part", () => {
  const insights = buildTopicInsights({
    projectId: "p",
    set: SET,
    answers: [
      answer({ mentions: [mention({ name: "First", firstMentionOffset: 1 }), mention({ name: "Second", firstMentionOffset: 2 }), mention({ name: "Us", isTarget: true, firstMentionOffset: 3 })] }),
    ],
  });
  const prompt = insights.topics.flatMap((topic) => topic.prompts).find((row) => row.promptId === "prompt-1");
  assert.equal(prompt?.rank, 3);
  assert.deepEqual(prompt?.ahead.map((row) => row.name), ["First", "Second"]);
});

test("no citations anywhere is stated rather than shown as an empty source table", () => {
  const insights = buildTopicInsights({ projectId: "p", set: SET, answers: [answer({})] });
  assert.equal(insights.citationsUnavailable, true);
  const withSource = buildTopicInsights({ projectId: "p", set: SET, answers: [answer({ citationUrls: ["https://x.test/a"] })] });
  assert.equal(withSource.citationsUnavailable, false);
});

test("a project that has never run does not report citations as unavailable", () => {
  // [].every() is true, so the empty case had to be excluded explicitly.
  const insights = buildTopicInsights({ projectId: "p", set: SET, answers: [] });
  assert.equal(insights.citationsUnavailable, false);
  assert.equal(insights.overall.score, null);
});

test("one product named with two different domains is one rival, not two", () => {
  // A model gave ChatGPT as openai.com in one answer and chatgpt.com in the
  // next, which ranked it twice and pushed everyone else down.
  const insights = buildTopicInsights({
    projectId: "p",
    set: SET,
    answers: [
      answer({ mentions: [mention({ name: "ChatGPT", domain: "openai.com" })] }),
      answer({ mentions: [mention({ name: "ChatGPT", domain: "chatgpt.com" })] }),
    ],
  });
  assert.equal(insights.leaderboard.length, 1);
  assert.equal(insights.leaderboard[0]?.appearances, 2);
});
