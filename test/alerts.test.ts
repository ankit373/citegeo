import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_THRESHOLDS, evaluateAlerts } from "../src/product/alerts/alert-rules.js";
import { buildHomeSummary } from "../src/product/alerts/home-summary.js";
import type { TopicInsights } from "../src/product/topics/topic-insights.js";
import type { VisibilityScore } from "../src/product/topics/visibility-score.js";
import type { TopicSet } from "../src/product/topics/topic-schema.js";

function score(overrides: Partial<VisibilityScore> = {}): VisibilityScore {
  return {
    answers: 10, appearances: 5, presenceRate: 0.5, prominence: 0.5, sentiment: 0.5, score: 50,
    weights: { prominenceFloor: 0.6, sentimentFloor: 0.5 }, ...overrides,
  };
}

function insights(overrides: Partial<TopicInsights> = {}): TopicInsights {
  return {
    projectId: "p", domain: "example.com", answers: 10, answersFailed: 0,
    overall: score(), rank: 1, weights: { prominenceFloor: 0.6, sentimentFloor: 0.5 },
    leaderboard: [], topics: [], byModel: [], absentFrom: [],
    citationsUnavailable: false,
    trend: { points: [], change: null, since: null },
    byRegion: [], byLanguage: [], regionCaveat: "", identityCaveat: null,
    ...overrides,
  } as TopicInsights;
}

function point(at: string, value: number | null, rank: number | null, appearances = 5) {
  return { runId: at, at, score: score({ score: value, appearances }), rank, regionIds: ["global"] };
}

test("a fall smaller than the threshold is noise, not news", () => {
  const alerts = evaluateAlerts(insights({
    trend: { points: [point("2026-01-01", 50, 1), point("2026-01-08", 47, 1)], change: -3, since: "2026-01-01" },
  }));
  assert.equal(alerts.some((alert) => alert.kind === "score_dropped"), false);
});

test("a real fall is reported with both figures and both dates", () => {
  const alerts = evaluateAlerts(insights({
    trend: { points: [point("2026-01-01", 50, 1), point("2026-01-08", 30, 1)], change: -20, since: "2026-01-01" },
  }));
  const dropped = alerts.find((alert) => alert.kind === "score_dropped");
  assert.ok(dropped);
  assert.ok(dropped.detail.includes("50 to 30"));
  assert.ok(dropped.detail.includes("2026-01-08"));
});

test("a measurement starting is not a fall", () => {
  // null to a number is the first readable run, not a collapse.
  const alerts = evaluateAlerts(insights({
    trend: { points: [point("2026-01-01", null, null), point("2026-01-08", 10, 3)], change: null, since: null },
  }));
  assert.deepEqual(alerts.filter((alert) => alert.kind === "score_dropped"), []);
});

test("being named and then not being named is critical", () => {
  const alerts = evaluateAlerts(insights({
    trend: { points: [point("2026-01-01", 40, 2, 4), point("2026-01-08", 0, null, 0)], change: -40, since: "2026-01-01" },
  }));
  const lost = alerts.find((alert) => alert.kind === "topic_lost");
  assert.equal(lost?.severity, "critical");
  assert.ok(lost?.detail.includes("4 of 10"));
});

test("losing places is reported separately from losing score", () => {
  const alerts = evaluateAlerts(insights({
    trend: { points: [point("2026-01-01", 50, 2), point("2026-01-08", 49, 6)], change: -1, since: "2026-01-01" },
  }));
  assert.equal(alerts.some((alert) => alert.kind === "score_dropped"), false);
  assert.ok(alerts.find((alert) => alert.kind === "rank_lost")?.headline.includes("#2 to #6"));
});

test("a rival is only worth naming when it is named often", () => {
  const quiet = evaluateAlerts(insights({
    rank: 2,
    leaderboard: [{ name: "Rare", domain: null, isTarget: false, appearances: 1, shareOfAnswers: 0.1, prominence: 0.5, positive: 0, negative: 0 }],
  }));
  assert.equal(quiet.some((alert) => alert.kind === "rival_overtook"), false);

  const loud = evaluateAlerts(insights({
    rank: 2,
    leaderboard: [{ name: "Rival", domain: "rival.com", isTarget: false, appearances: 9, shareOfAnswers: 0.9, prominence: 0.8, positive: 5, negative: 0 }],
  }));
  assert.ok(loud.find((alert) => alert.kind === "rival_overtook")?.headline.includes("Rival"));
});

test("a run that mostly failed is reported, and every answer failing is critical", () => {
  const some = evaluateAlerts(insights({ answers: 6, answersFailed: 4 }));
  assert.equal(some.find((alert) => alert.kind === "answers_failing")?.severity, "warning");
  const none = evaluateAlerts(insights({ answers: 0, answersFailed: 8, overall: score({ answers: 0, score: null }) }));
  assert.equal(none.find((alert) => alert.kind === "answers_failing")?.severity, "critical");
});

test("the worst news is first", () => {
  const alerts = evaluateAlerts(insights({
    answers: 6, answersFailed: 4, citationsUnavailable: true,
    trend: { points: [point("2026-01-01", 40, 2, 4), point("2026-01-08", 0, null, 0)], change: -40, since: "2026-01-01" },
  }));
  assert.equal(alerts[0]?.severity, "critical");
  assert.equal(alerts[alerts.length - 1]?.severity, "info");
});

const EMPTY_SET: TopicSet = { projectId: "p", topics: [], prompts: [], generatedAt: null, updatedAt: "" };

test("a project with nothing set up shows what is missing, in order", () => {
  const home = buildHomeSummary({
    projectId: "p", domain: "example.com", set: EMPTY_SET,
    insights: insights({ answers: 0, overall: score({ answers: 0, score: null }) }),
    runs: [], modelCount: 0,
  });
  assert.equal(home.ready, false);
  assert.equal(home.showSetupOnly, true, "nothing measured, so the checklist is the page");
  assert.deepEqual(home.setup.map((step) => step.id), ["models", "prompts", "run"]);
  assert.deepEqual(home.setup.map((step) => step.done), [false, false, false]);
  assert.equal(home.score, null, "no answers is null, never zero");
});

test("a project that has run reports itself ready and says what it found", () => {
  const home = buildHomeSummary({
    projectId: "p", domain: "example.com",
    set: { ...EMPTY_SET, prompts: [{ id: "x", projectId: "p", topicId: "t", text: "q", normalizedText: "q", intent: "discovery", source: "authored", measuresVisibility: true, visibilityExclusionReason: null, status: "active", createdAt: "", activatedAt: null }] },
    insights: insights({ rank: 3, leaderboard: [{ name: "A", domain: null, isTarget: false, appearances: 9, shareOfAnswers: 0.9, prominence: 1, positive: 0, negative: 0 }] }),
    runs: [{ id: "r1", projectId: "p", status: "completed", promptIds: [], modelIds: [], regionIds: [], languageIds: [], answersRequested: 10, answersCompleted: 10, answersFailed: 0, startedAt: "2026-01-08T00:00:00.000Z", completedAt: null }],
    modelCount: 2,
  });
  assert.equal(home.ready, true);
  assert.equal(home.showSetupOnly, false);
  assert.equal(home.rank, 3);
  assert.equal(home.rivals, 1);
  assert.equal(home.lastRun?.completed, 10);
});

test("a project with answers shows them even while a step is undone", () => {
  // Burying real findings behind a checklist helps nobody.
  const home = buildHomeSummary({
    projectId: "p", domain: "example.com", set: EMPTY_SET,
    insights: insights({ answers: 12 }),
    runs: [], modelCount: 1,
  });
  assert.equal(home.ready, false, "no prompts are tracked");
  assert.equal(home.showSetupOnly, false, "but twelve answers are worth showing");
});
