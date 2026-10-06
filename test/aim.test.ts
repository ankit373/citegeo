import { wilsonInterval } from "../src/product/topics/proportion-interval.js";
import { SCORE_WEIGHTS } from "../src/product/topics/visibility-score.js";
import test from "node:test";
import assert from "node:assert/strict";
import { MATERIAL_CHANGE, causesFor, tasksFor, writeMemo } from "../src/product/aim/aim-watch.js";
import type { TopicInsights } from "../src/product/topics/topic-insights.js";
import type { SignalChange } from "../src/product/actions/signal-diff.js";

const SCORE = { answers: 0, appearances: 0, presenceInterval: wilsonInterval(0, 0), tooFewAnswers: false, presenceRate: null, prominence: null, sentiment: null, score: null, weights: SCORE_WEIGHTS };

function entity(name: string, appearances: number, isTarget = false): any {
  return { name, domain: null, isTarget, appearances, shareOfAnswers: null, prominence: null, positive: 0, negative: 0 };
}

function absent(text: string, answers: number): any {
  return { promptId: "q", topicId: "t", subtopic: null, text, intent: "research", measuresVisibility: true,
    score: { ...SCORE, answers }, rank: null, byModel: [], ahead: [], standing: [] };
}

function insights(over: Partial<TopicInsights> = {}): TopicInsights {
  return {
    projectId: "p", answers: 0, answersFailed: 0, overall: { ...SCORE, score: 0.4 } as any, rank: null,
    weights: SCORE_WEIGHTS, leaderboard: [], topics: [], byModel: [],
    absentFrom: [], citationsUnavailable: false, trend: { points: [], change: null, since: null, thinPoints: 0, readablePoints: 0 } as any,
    byRegion: [], byLanguage: [], byPersona: [], regionCaveat: "", identityCaveat: null, trackedRivals: [],
    ...over,
  } as TopicInsights;
}

function regressed(field: string): SignalChange {
  return { field, direction: "regressed", before: "allowed", after: "blocked", detail: "It stopped being reachable." };
}

test("a change smaller than the threshold is not a movement worth a memo", () => {
  const memo = writeMemo({ projectId: "p", insights: insights({ trend: { points: [], change: MATERIAL_CHANGE / 2, since: "r1" } as any }), signals: [] });
  assert.equal(memo.movement, null);
  assert.ok(memo.headline.includes("held steady"));
});

test("with fewer than two runs nothing is said to have moved", () => {
  const memo = writeMemo({ projectId: "p", insights: insights(), signals: [] });
  assert.equal(memo.movement, null);
  assert.ok(memo.headline.includes("Not enough runs"));
  assert.equal(memo.unexplained, null, "nothing moved, so nothing is unexplained");
});

test("a real drop is reported with where it came from and went to", () => {
  const memo = writeMemo({
    projectId: "p",
    insights: insights({ overall: { ...SCORE, score: 0.3 } as any, trend: { points: [], change: -0.2, since: "r1" } as any }),
    signals: [],
  });
  assert.equal(memo.movement?.direction, "down");
  assert.equal(memo.movement?.after, "30.0%");
  assert.equal(memo.movement?.before, "50.0%");
  assert.ok(memo.movement && memo.movement.size > 0, "size is always positive");
});

test("a movement nothing explains is called unexplained, not given a cause", () => {
  const memo = writeMemo({
    projectId: "p",
    insights: insights({ trend: { points: [], change: -0.2, since: "r1" } as any }),
    signals: [],
  });
  assert.deepEqual(memo.causes, []);
  assert.ok(memo.unexplained?.includes("nothing recorded here explains it"));
});

test("a movement with a cause in the evidence is not called unexplained", () => {
  const memo = writeMemo({
    projectId: "p",
    insights: insights({ trend: { points: [], change: -0.2, since: "r1" } as any }),
    signals: [regressed("GPTBot access")],
  });
  assert.equal(memo.unexplained, null);
  assert.equal(memo.causes.length, 1);
  assert.ok(memo.causes[0]?.evidence.includes("allowed to blocked") || memo.causes[0]?.evidence.includes("allowed"));
});

test("every cause carries the observation behind it", () => {
  const causes = causesFor(insights({
    leaderboard: [entity("Us", 1, true), entity("Them", 9)],
    absentFrom: [absent("a question", 5)],
    citationsUnavailable: true,
  }), [regressed("robots.txt")]);
  assert.equal(causes.length, 4);
  for (const cause of causes) {
    assert.ok(cause.statement.length > 0);
    assert.ok(cause.evidence.length > 0, `"${cause.statement}" has no evidence under it`);
  }
});

test("a rival behind the brand is not offered as a cause", () => {
  const causes = causesFor(insights({ leaderboard: [entity("Us", 9, true), entity("Them", 2)] }), []);
  assert.equal(causes.length, 0);
});

test("a signal that improved is not a cause of a drop", () => {
  const improved: SignalChange = { field: "llms.txt", direction: "improved", before: "absent", after: "present", detail: "" };
  assert.deepEqual(causesFor(insights(), [improved]), []);
});

test("each task names the workflow that would do it", () => {
  const tasks = tasksFor(insights({
    absentFrom: [absent("a question", 5)],
    leaderboard: [entity("Us", 1, true), entity("Them", 9)],
  }), []);
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0]?.workflow, "missing_answer");
  assert.equal(tasks[1]?.workflow, "competitor_brief");
});

test("a task no workflow can do names no workflow rather than the nearest one", () => {
  const tasks = tasksFor(insights(), [regressed("GPTBot access")]);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0]?.workflow, null, "a change to the site is not something a drafting workflow does");
  assert.ok(tasks[0]?.title.includes("Restore"));
});

test("a memo with nothing wrong proposes nothing", () => {
  const memo = writeMemo({ projectId: "p", insights: insights(), signals: [] });
  assert.deepEqual(memo.tasks, []);
  assert.deepEqual(memo.causes, []);
});
