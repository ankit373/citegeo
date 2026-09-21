import test from "node:test";
import assert from "node:assert/strict";
import { buildRankingPlan } from "../src/product/topics/ranking-plan.js";
import type { EntityStanding, ModelStanding, PromptStanding, TopicInsights } from "../src/product/topics/topic-insights.js";
import type { Prompt, PromptIntent, TopicSet } from "../src/product/topics/topic-schema.js";
import type { VisibilityScore } from "../src/product/topics/visibility-score.js";

const WEIGHTS = { prominenceFloor: 0.6, sentimentFloor: 0.5 };

function score(overrides: Partial<VisibilityScore> = {}): VisibilityScore {
  return { answers: 10, appearances: 0, presenceRate: 0, prominence: null, sentiment: null, score: 0, weights: WEIGHTS, ...overrides };
}

function entity(name: string, overrides: Partial<EntityStanding> = {}): EntityStanding {
  return { name, domain: null, isTarget: false, appearances: 5, shareOfAnswers: 0.5, prominence: 0.5, positive: 0, negative: 0, ...overrides };
}

function model(modelId: string, overrides: Partial<VisibilityScore> = {}): ModelStanding {
  return { providerId: "anthropic", modelId, displayName: modelId, score: score(overrides) };
}

function prompt(id: string, overrides: Partial<Prompt> = {}): Prompt {
  return {
    id, projectId: "p", topicId: "t", text: `question ${id}`, normalizedText: id,
    intent: "discovery" as PromptIntent, source: "authored", measuresVisibility: true,
    visibilityExclusionReason: null, status: "active", createdAt: "", activatedAt: null, ...overrides,
  };
}

function set(prompts: Prompt[]): TopicSet {
  return {
    projectId: "p",
    topics: [{ id: "t", projectId: "p", name: "Choosing a tool", description: "", source: "authored", status: "active", createdAt: "" }],
    prompts,
    generatedAt: null,
    updatedAt: "",
  };
}

function insights(overrides: Partial<TopicInsights> = {}): TopicInsights {
  return {
    projectId: "p", answers: 10, answersFailed: 0, overall: score(), rank: null, weights: WEIGHTS,
    leaderboard: [], topics: [], byModel: [], absentFrom: [], citationsUnavailable: false,
    trend: { points: [], change: null, since: null }, byRegion: [], byLanguage: [],
    regionCaveat: "", identityCaveat: null, trackedRivals: [], ...overrides,
  };
}

function ids(plan: { moves: Array<{ id: string }> }): string[] {
  return plan.moves.map((move) => move.id);
}

test("nothing answered is no standing, not a bad one, so the plan does not advise on a score", () => {
  const plan = buildRankingPlan({ insights: insights({ answers: 0, overall: score({ answers: 0, score: null }) }), set: set([prompt("a")]) });
  assert.equal(plan.rank, null);
  assert.equal(plan.score, null);
  assert.ok(plan.verdict.includes("not a rank of zero"));
  assert.deepEqual(ids(plan), ["run-the-set"]);
});

test("with nothing tracked the first move is to track, not to run", () => {
  const plan = buildRankingPlan({ insights: insights({ answers: 0 }), set: set([prompt("a", { status: "proposed" })]) });
  assert.deepEqual(ids(plan), ["track-questions"]);
});

test("a brand named nowhere is told who the models answer with, not to chase the weakest name", () => {
  const plan = buildRankingPlan({
    insights: insights({
      rank: null,
      leaderboard: [entity("Screener.in", { appearances: 9 }), entity("Sensibull", { appearances: 1 })],
    }),
    set: set([prompt("a")]),
  });
  assert.ok(ids(plan).includes("not-on-the-board"));
  assert.equal(ids(plan).includes("nearest-rival"), false);
  const move = plan.moves.find((row) => row.id === "not-on-the-board");
  assert.ok(move?.title.includes("Screener.in"), move?.title);
});

test("once named, the gap is stated against the rival directly ahead and counted in answers", () => {
  const plan = buildRankingPlan({
    insights: insights({
      rank: 3,
      leaderboard: [entity("Screener.in", { appearances: 9 }), entity("Chartink", { appearances: 6 }), entity("You", { isTarget: true, appearances: 4, prominence: 0.8 })],
    }),
    set: set([prompt("a")]),
  });
  const move = plan.moves.find((row) => row.id === "nearest-rival");
  assert.ok(move?.title.includes("Chartink"), move?.title);
  assert.equal(move?.answers, 2);
  assert.ok(move?.evidence.includes("2 more answer(s)"));
});

test("a model that never names you is only a finding when another one does", () => {
  const blindOnly = buildRankingPlan({
    insights: insights({ byModel: [model("a"), model("b")] }),
    set: set([prompt("a")]),
  });
  assert.equal(ids(blindOnly).includes("blind-models"), false, "every model blind is the overall score, not a per-model gap");

  const mixed = buildRankingPlan({
    insights: insights({ byModel: [model("a"), model("b", { appearances: 4, presenceRate: 0.4 })] }),
    set: set([prompt("a")]),
  });
  assert.ok(ids(mixed).includes("blind-models"));
});

test("moves that raise the score come before moves that only widen what is measured", () => {
  const plan = buildRankingPlan({
    insights: insights({
      leaderboard: [entity("Screener.in", { appearances: 9 })],
      absentFrom: [{ promptId: "a", topicId: "t", text: "q", intent: "discovery", measuresVisibility: true, score: score(), rank: null, entitiesNamed: 1, byModel: [], ahead: [entity("Screener.in")] } as PromptStanding],
    }),
    set: set([prompt("a"), prompt("b", { intent: "brand", measuresVisibility: false, visibilityExclusionReason: "names_the_brand" })]),
  });
  const effects = plan.moves.map((move) => move.effect);
  const lastRaise = effects.lastIndexOf("raises_visibility");
  const firstWiden = effects.indexOf("widens_measurement");
  assert.ok(lastRaise < firstWiden, effects.join(","));
});

test("the plan says outright that tracking more questions does not raise the score", () => {
  const plan = buildRankingPlan({ insights: insights(), set: set([prompt("a")]) });
  assert.ok(plan.promptsNote.includes("does not raise the score"));
});

test("no citation anywhere is reported as a property of the models, not as nobody citing you", () => {
  const plan = buildRankingPlan({ insights: insights({ citationsUnavailable: true }), set: set([prompt("a")]) });
  const move = plan.moves.find((row) => row.id === "no-sources");
  assert.equal(move?.effect, "unblocks_measurement");
  assert.ok(move?.evidence.includes("not evidence that nobody cites you"));
});
