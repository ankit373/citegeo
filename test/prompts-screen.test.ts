import test from "node:test";
import assert from "node:assert/strict";
import { buildHomeSummary } from "../src/product/alerts/home-summary.js";
import { renderProductPhase2AppHtml } from "../src/ui/product-phase2-app.js";
import { productAppSource } from "../src/ui/app-source.js";
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
    citationsUnavailable: false, trend: { points: [], change: null, since: null }, byRegion: [], byLanguage: [], byPersona: [],
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
  const html = productAppSource();

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
  const html = productAppSource();
  assert.equal(html.includes('return { value: "Unknown", note: "the saved model count has not loaded" };'), true);
  assert.equal(html.includes('return { value: "None", note: "no models are saved, so a run cannot ask anything" };'), true);
});

test("a question with no answer says so rather than scoring zero", () => {
  const html = productAppSource();
  assert.equal(html.includes('(answers ? scoreText(standing.score.score) : "Not asked yet")'), true);
});

test("a live run replaces the run button and opens a pane instead of offering a second run", () => {
  const html = productAppSource();
  assert.equal(html.includes('if (state.liveRun) return button({ label: "Watch the run", kind: "primary", on: { "data-open-run": state.liveRun.id } });'), true);
  for (const part of ["data-open-run", "renderRunPane", "runInFlightCard", "runFeedBody", "/prompt-answers?runId="]) {
    assert.equal(html.includes(part), true, part);
  }
  assert.equal(html.includes("Sent"), true);
  assert.equal(html.includes("Came back"), true);
  assert.equal(html.includes("Named, in order"), true);
});

test("the two lists on the scores page say which is a competitor and which is an assistant", () => {
  const html = productAppSource();
  assert.equal(html.includes("Competitors named in the answers"), true);
  assert.equal(html.includes("Not the assistants themselves"), true);
  assert.equal(html.includes("By AI assistant"), true);
  assert.equal(html.includes("not who you compete with"), true);
  assert.equal(html.includes("Rival you track"), true);
  assert.equal(html.includes("Named by the models"), true);
});

test("a selection the server will refuse can be cleared from the page", () => {
  const html = productAppSource();
  // The catalogue checkbox for an unavailable model is disabled, so without
  // this control the save stays rejected with no way to fix it.
  assert.equal(html.includes("function blockedSelection(row: any) { return !row.inCatalog || (row.model && row.model.available === false); }"), true);
  assert.equal(html.includes('"data-drop-selection": row.modelId'), true);
  assert.equal(html.includes("function dropSelection(modelId: any) { state.draftSelections.delete(modelId);"), true);
});

test("a failed request reports what the server said, not a category", () => {
  const html = productAppSource();
  // "Invalid configuration" does not say which model, and the server does.
  assert.equal(html.includes('requestError(typeof body.code === "string" ? body.code : "request_failed", typeof body.error === "string" ? body.error : undefined)'), true);
  assert.equal(html.includes("const error = new Error(detail || expectedErrorText[code]"), true);
});
