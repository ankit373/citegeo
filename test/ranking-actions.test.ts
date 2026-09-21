import test from "node:test";
import assert from "node:assert/strict";
import { effectOf, isActionState, snapshotOf, type TakenAction } from "../src/product/topics/action-log.js";
import type { TopicInsights } from "../src/product/topics/topic-insights.js";
import type { VisibilityScore } from "../src/product/topics/visibility-score.js";

const WEIGHTS = { prominenceFloor: 0.6, sentimentFloor: 0.5 };

function score(overrides: Partial<VisibilityScore> = {}): VisibilityScore {
  return { answers: 10, appearances: 2, presenceRate: 0.2, prominence: 0.5, sentiment: 0.5, score: 20, weights: WEIGHTS, ...overrides };
}

function insights(overrides: Partial<TopicInsights> = {}): TopicInsights {
  return {
    projectId: "p", answers: 10, answersFailed: 0, overall: score(), rank: 4, weights: WEIGHTS,
    leaderboard: [], topics: [], byModel: [], absentFrom: [], citationsUnavailable: false,
    trend: { points: [], change: null, since: null }, byRegion: [], byLanguage: [],
    regionCaveat: "", identityCaveat: null, trackedRivals: [], ...overrides,
  };
}

function taken(overrides: Partial<TakenAction> = {}): TakenAction {
  return {
    id: "m", projectId: "p", moveId: "m", promptId: null, state: "doing", note: "",
    startedFrom: snapshotOf(insights(), "2026-01-01T00:00:00.000Z"),
    createdAt: "", updatedAt: "", ...overrides,
  };
}

test("a move nobody took up has no effect to report, which is not an effect of zero", () => {
  assert.equal(effectOf(taken({ startedFrom: null }), insights()), null);
});

test("no answer since means nothing can have moved, and the effect says so", () => {
  const effect = effectOf(taken(), insights());
  assert.equal(effect?.answersAdded, 0);
  assert.equal(effect?.nothingRunSince, true);
  assert.equal(effect?.scoreChange, 0);
});

test("the effect is the change in the standing since the move was taken up", () => {
  const effect = effectOf(taken(), insights({
    answers: 24,
    rank: 2,
    overall: score({ answers: 24, appearances: 9, score: 46 }),
  }));
  assert.equal(effect?.answersAdded, 14);
  assert.equal(effect?.scoreChange, 26);
  assert.equal(effect?.rankThen, 4);
  assert.equal(effect?.rankNow, 2);
  assert.equal(effect?.appearancesAdded, 7);
  assert.equal(effect?.nothingRunSince, false);
});

test("a score that could not be measured at either end gives no change, never a zero", () => {
  const fromNull = effectOf(
    taken({ startedFrom: { at: "", score: null, rank: null, answers: 0, appearances: 0 } }),
    insights({ answers: 10 }),
  );
  assert.equal(fromNull?.scoreChange, null);
  assert.equal(fromNull?.scoreNow, 20);

  const toNull = effectOf(taken(), insights({ answers: 20, overall: score({ answers: 20, score: null }) }));
  assert.equal(toNull?.scoreChange, null);
});

test("only the four states are accepted, so a typo cannot become a state", () => {
  for (const value of ["open", "doing", "done", "dismissed"]) assert.equal(isActionState(value), true, value);
  for (const value of ["Done", "complete", "", null, 3]) assert.equal(isActionState(value), false, String(value));
});

test("the snapshot records the standing, not a summary of it", () => {
  const shot = snapshotOf(insights({ answers: 7, rank: null, overall: score({ answers: 7, appearances: 0, score: 0 }) }), "2026-02-02T00:00:00.000Z");
  assert.deepEqual(shot, { at: "2026-02-02T00:00:00.000Z", score: 0, rank: null, answers: 7, appearances: 0 });
});
