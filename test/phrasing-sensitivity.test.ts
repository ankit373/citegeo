import test from "node:test";
import assert from "node:assert/strict";
import { buildPhrasingReport, PHRASING_CAVEAT, rootOf } from "../src/product/topics/phrasing-sensitivity.js";
import type { AnswerMention, PromptAnswer } from "../src/product/topics/prompt-run-schema.js";
import type { Prompt, TopicSet } from "../src/product/topics/topic-schema.js";

const TARGET: AnswerMention = {
  name: "Tradomate", domain: null, recommendation: "positive", mentionQuote: null,
  firstMentionOffset: 0, firstMentionState: "unique", isTarget: true,
};

function prompt(id: string, text: string, variantOf?: string, measuresVisibility = true): Prompt {
  return {
    id, projectId: "p", topicId: "t", text, normalizedText: text, intent: "discovery",
    variantOf: variantOf || null, source: "generated", measuresVisibility,
    visibilityExclusionReason: measuresVisibility ? null : "names_the_brand",
    status: "active", createdAt: "", activatedAt: null,
  };
}

function set(prompts: Prompt[]): TopicSet {
  return {
    projectId: "p", generatedAt: "", updatedAt: "",
    topics: [{ id: "t", projectId: "p", name: "T", description: "", source: "generated", status: "active", createdAt: "" }],
    prompts,
  };
}

function answer(promptId: string, over: Partial<PromptAnswer> = {}): PromptAnswer {
  return {
    id: String(Math.random()), projectId: "p", runId: "r", promptId, topicId: "t",
    promptText: promptId, intent: "discovery", providerId: "openai", modelId: "gpt-4o",
    modelDisplayName: "M", regionId: "global", languageId: "en", status: "completed", text: "",
    mentions: [], citationUrls: [], errorCode: null, errorMessage: null, latencyMs: 1, createdAt: "",
    ...over,
  };
}

test("a prompt that rewords nothing is its own question", () => {
  assert.equal(rootOf(prompt("a", "best screener")), "a");
  assert.equal(rootOf(prompt("b", "top screener", "a")), "a");
});

test("one wording says nothing about phrasing", () => {
  const report = buildPhrasingReport([answer("a", { mentions: [TARGET] })], set([prompt("a", "best screener")]));
  assert.equal(report.measured, 0);
  assert.equal(report.oneWording, 1);
  assert.equal(report.spread, null, "a question asked one way cannot disagree with itself");
});

test("wordings that disagree about whether you appear are the finding", () => {
  const report = buildPhrasingReport(
    [answer("a", { mentions: [TARGET] }), answer("b")],
    set([prompt("a", "best screener"), prompt("b", "top screener", "a")]),
  );
  assert.equal(report.measured, 1);
  assert.equal(report.unstable, 1);
  assert.equal(report.questions[0]?.agreed, false);
  assert.equal(report.questions[0]?.spread, 1, "named in every answer to one wording and none to the other");
});

test("wordings that agree are stable whether or not you appear", () => {
  const never = buildPhrasingReport([answer("a"), answer("b")], set([prompt("a", "x"), prompt("b", "y", "a")]));
  assert.equal(never.questions[0]?.agreed, true, "never named either way is agreement");
  assert.equal(never.unstable, 0);
  const always = buildPhrasingReport(
    [answer("a", { mentions: [TARGET] }), answer("b", { mentions: [TARGET] })],
    set([prompt("a", "x"), prompt("b", "y", "a")]),
  );
  assert.equal(always.questions[0]?.agreed, true);
  assert.equal(always.questions[0]?.spread, 0);
});

test("a different model is a different comparison, not another wording", () => {
  const report = buildPhrasingReport(
    [answer("a", { modelId: "gpt-4o" }), answer("b", { modelId: "sonar" })],
    set([prompt("a", "x"), prompt("b", "y", "a")]),
  );
  assert.equal(report.measured, 0, "comparing two models would report their difference as the wording's");
  assert.equal(report.oneWording, 2);
});

test("a market or a persona changing is also a different comparison", () => {
  const byMarket = buildPhrasingReport(
    [answer("a", { regionId: "in" }), answer("b", { regionId: "global" })],
    set([prompt("a", "x"), prompt("b", "y", "a")]),
  );
  assert.equal(byMarket.measured, 0);
  const byPersona = buildPhrasingReport(
    [answer("a", { personaId: "one" }), answer("b", { personaId: "two" })],
    set([prompt("a", "x"), prompt("b", "y", "a")]),
  );
  assert.equal(byPersona.measured, 0);
});

test("repetitions of one wording average inside it rather than counting as wordings", () => {
  const report = buildPhrasingReport(
    [answer("a", { mentions: [TARGET] }), answer("a"), answer("b", { mentions: [TARGET] })],
    set([prompt("a", "x"), prompt("b", "y", "a")]),
  );
  assert.equal(report.questions[0]?.wordings.length, 2, "three answers, two wordings");
  assert.equal(report.questions[0]?.spread, 0.5, "named in half of one wording's answers and all of the other's");
});

test("an answer that never completed is not a wording", () => {
  const report = buildPhrasingReport(
    [answer("a"), answer("b", { status: "provider_failed" })],
    set([prompt("a", "x"), prompt("b", "y", "a")]),
  );
  assert.equal(report.measured, 0);
});

test("an answer to a prompt nobody has is left out rather than guessed at", () => {
  const report = buildPhrasingReport([answer("gone"), answer("a")], set([prompt("a", "x")]));
  assert.equal(report.measured, 0);
  assert.equal(report.oneWording, 1, "only the prompt that exists is counted");
});

test("the loudest disagreement comes first, because its figure depends most on the words", () => {
  const steady = [prompt("s1", "steady one"), prompt("s2", "steady two", "s1")];
  const loud = [prompt("l1", "loud one"), prompt("l2", "loud two", "l1")];
  const report = buildPhrasingReport(
    [
      answer("s1", { mentions: [TARGET] }), answer("s2", { mentions: [TARGET] }),
      answer("l1", { mentions: [TARGET] }), answer("l2"),
    ],
    set([...steady, ...loud]),
  );
  assert.equal(report.questions[0]?.spread, 1);
  assert.equal(report.questions[1]?.spread, 0);
  assert.equal(report.spread, 0.5);
});

test("a wording that names the brand is not a wording of the same question", () => {
  // The model discusses a brand the question names whatever it thinks, so the
  // gap would be the name rather than the words.
  const report = buildPhrasingReport(
    [answer("a"), answer("b", { mentions: [TARGET] })],
    set([prompt("a", "best screener"), prompt("b", "is Tradomate the best screener", "a", false)]),
  );
  assert.equal(report.measured, 0, "one usable wording is one wording");
  assert.equal(report.namesTheBrand, 1);
  assert.equal(report.unstable, 0, "it must never read as the words deciding it");
});

test("the caveat says what was held still and what it does not cover", () => {
  assert.ok(PHRASING_CAVEAT.includes("what moved is the words"));
  assert.ok(PHRASING_CAVEAT.includes("how much the answer moves"), "it is read beside repetition, not instead of it");
  assert.ok(PHRASING_CAVEAT.includes("names the brand is left out"));
  assert.equal(buildPhrasingReport([], set([])).caveat, PHRASING_CAVEAT);
});
