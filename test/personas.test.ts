import test from "node:test";
import assert from "node:assert/strict";
import { NO_PERSONA, personaFrom, personaInstruction, trackedPersonas, type PersonaSet } from "../src/product/topics/persona.js";
import { buildTopicInsights } from "../src/product/topics/topic-insights.js";
import type { AnswerMention, PromptAnswer } from "../src/product/topics/prompt-run-schema.js";
import type { TopicSet } from "../src/product/topics/topic-schema.js";

const SET: PersonaSet = {
  projectId: "p",
  personas: [
    { id: "persona-1", label: "Beginner", describedAs: "someone new to investing", tracked: true, addedAt: "" },
    { id: "persona-2", label: "Retired", describedAs: "a professional analyst", tracked: false, addedAt: "" },
  ],
  updatedAt: "",
};

test("nobody stated is a persona in its own right, and says nothing to the model", () => {
  assert.equal(personaInstruction(NO_PERSONA), "");
  assert.equal(personaFrom(SET, NO_PERSONA.id), NO_PERSONA);
  assert.equal(personaFrom(null, NO_PERSONA.id), NO_PERSONA);
});

test("a persona is told to the model in its own words", () => {
  const found = personaFrom(SET, "persona-1");
  assert.equal(personaInstruction(found!), "The person asking is someone new to investing. Answer for them.");
});

test("a retired persona still resolves, so past answers keep their label", () => {
  assert.equal(personaFrom(SET, "persona-2")?.label, "Retired");
  assert.deepEqual(trackedPersonas(SET).map((row) => row.id), ["persona-1"]);
});

const EMPTY_SET: TopicSet = { projectId: "p", topics: [], prompts: [], generatedAt: null, updatedAt: "" };

function mention(name: string, isTarget = false): AnswerMention {
  return { name, domain: null, recommendation: "positive", mentionQuote: null, firstMentionOffset: 0, firstMentionState: "unique", isTarget };
}

function answer(personaId: string, named: boolean): PromptAnswer {
  return {
    id: String(Math.random()), projectId: "p", runId: "r", promptId: "q", topicId: "t", promptText: "best tool",
    intent: "discovery", providerId: "anthropic", modelId: "m", modelDisplayName: "M",
    regionId: "global", languageId: "en", personaId, status: "completed", text: "an answer",
    mentions: named ? [mention("You", true)] : [mention("Rival")],
    citationUrls: [], errorCode: null, errorMessage: null, latencyMs: 1, createdAt: "",
  };
}

test("one audience is the overall figure under another name, so it is not reported as a split", () => {
  const insights = buildTopicInsights({ projectId: "p", set: EMPTY_SET, answers: [answer("anyone", true), answer("anyone", false)] });
  assert.deepEqual(insights.byPersona, []);
});

test("two audiences are scored apart, worst first, with the label the project gave", () => {
  const insights = buildTopicInsights({
    projectId: "p",
    set: EMPTY_SET,
    answers: [answer("persona-1", true), answer("persona-1", true), answer("anyone", false)],
    personaLabels: new Map([["persona-1", "Beginner"]]),
  });
  assert.deepEqual(insights.byPersona.map((row) => row.label), ["No stated persona", "Beginner"]);
  assert.equal(insights.byPersona[0]?.rank, null, "nobody named you when nobody was stated");
  assert.equal(insights.byPersona[1]?.rank, 1);
});

test("a persona with no label falls back to its id rather than to a blank row", () => {
  const insights = buildTopicInsights({
    projectId: "p", set: EMPTY_SET,
    answers: [answer("persona-gone", true), answer("anyone", false)],
  });
  assert.equal(insights.byPersona.some((row) => row.label === "persona-gone"), true);
});
