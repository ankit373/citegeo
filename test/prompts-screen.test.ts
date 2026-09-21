import test from "node:test";
import assert from "node:assert/strict";
import { buildHomeSummary } from "../src/product/alerts/home-summary.js";
import { renderProductPhase2AppHtml } from "../src/ui/product-phase2-app.js";
import type { TopicInsights } from "../src/product/topics/topic-insights.js";
import type { TopicSet } from "../src/product/topics/topic-schema.js";
import type { VisibilityScore } from "../src/product/topics/visibility-score.js";

const EMPTY_SET: TopicSet = {
  projectId: "p", topics: [], prompts: [], generatedAt: null, updatedAt: "2026-01-01T00:00:00.000Z",
};

const SCORE: VisibilityScore = {
  answers: 0, appearances: 0, presenceRate: null, prominence: null, sentiment: null, score: null,
  weights: { prominenceFloor: 0.6, sentimentFloor: 0.5 },
};

function insights(): TopicInsights {
  return {
    projectId: "p", answers: 0, answersFailed: 0, overall: SCORE, rank: null,
    weights: SCORE.weights, leaderboard: [], topics: [], byModel: [], absentFrom: [],
    citationsUnavailable: false, trend: { points: [], change: null, since: null }, byRegion: [], byLanguage: [],
    regionCaveat: "", identityCaveat: null, trackedRivals: [],
  };
}

test("the saved model count travels with the summary, so a run can be forecast before it starts", () => {
  const home = buildHomeSummary({ projectId: "p", domain: "example.com", set: EMPTY_SET, insights: insights(), runs: [], modelCount: 7 });
  assert.equal(home.modelCount, 7);
  const none = buildHomeSummary({ projectId: "p", domain: "example.com", set: EMPTY_SET, insights: insights(), runs: [], modelCount: 0 });
  assert.equal(none.modelCount, 0);
});

test("the prompts screen can be read, filtered and acted on in bulk", () => {
  const html = renderProductPhase2AppHtml();

  for (const control of ['id="prompt-search"', 'data-prompt-filter="topicId"', 'data-prompt-filter="intent"', 'data-prompt-filter="status"', "data-prompt-select-all", "data-prompt-intent="]) {
    assert.equal(html.includes(control), true, control);
  }
  for (const action of ["data-prompt-checkbox=", "data-bulk-activate", "data-bulk-retire", "data-bulk-run", "data-bulk-clear", "data-prompt-review"]) {
    assert.equal(html.includes(action), true, action);
  }
  assert.equal(html.includes('id="bulk-prompt-form"'), true);
  assert.equal(html.includes("/prompts/bulk"), true);
  assert.equal(html.includes("Answers per run"), true);
  assert.equal(html.includes("Coverage"), true);
});

test("an unknown model count is reported as unknown, never as a forecast of zero answers", () => {
  const html = renderProductPhase2AppHtml();
  assert.equal(html.includes('return { value: "Unknown", note: "the saved model count has not loaded" };'), true);
  assert.equal(html.includes('return { value: "None", note: "no models are saved, so a run cannot ask anything" };'), true);
});

test("a question with no answer says so rather than scoring zero", () => {
  const html = renderProductPhase2AppHtml();
  assert.equal(html.includes('(answers ? scoreText(standing.score.score) : "Not asked yet")'), true);
});
