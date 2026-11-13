import test from "node:test";
import assert from "node:assert/strict";
import {
  OVERVIEW_ORDER, healthSentence, overviewBody, questionsYouLose, runHealth, scoreRange, shareTable,
  type OverviewData, type RunRecord,
} from "../src/ui/app/pages/overview-view.js";
import { headline } from "../src/ui/app/pages/dashboard-view.js";
import { rivalSlots, scoreSvg, shareSvg } from "../src/ui/app/pages/overview-charts.js";
import { dayLabel, timeScale, timeTicks } from "../src/ui/app/pages/time-chart.js";

// The architecture test bans regular expressions in tests too, so markup is read by hand.
function after(markup: string, marker: string, end: string): string[] {
  return markup.split(marker).slice(1).map((part) => part.slice(0, part.indexOf(end)));
}

function count(markup: string, needle: string): number {
  return markup.split(needle).length - 1;
}

function youPath(markup: string): string {
  return after(markup, 'class="ch-line s-you" d="', '"')[0] || "";
}

function run(id: string, startedAt: string, completed: number, failed: number): RunRecord {
  return { id, startedAt, status: failed ? "partial" : "completed", answersRequested: completed + failed, answersCompleted: completed, answersFailed: failed, modelIds: ["a", "b", "c"] };
}

function point(runId: string, at: string, score: number) {
  return {
    runId,
    at,
    rank: 2,
    score: { score, presenceRate: 0.5, presenceInterval: { low: 0.4, high: 0.6 }, prominence: 0.8, sentiment: 0.9, answers: 40, appearances: 20 },
  };
}

function overview(runs: RunRecord[]): OverviewData {
  return {
    domain: "brand.example",
    runs,
    insights: {
      overall: { score: 30, presenceRate: 0.5, prominence: 0.8, sentiment: 0.9, answers: 120, appearances: 60 },
      rank: 2,
      trend: {
        change: 10,
        since: "2026-09-01T09:00:00Z",
        points: [
          point("r1", "2026-09-01T09:00:00Z", 30),
          point("r2", "2026-09-15T09:00:00Z", 35),
          point("r3", "2026-10-01T09:00:00Z", 40),
        ],
      },
    },
    rivalTrend: [
      { name: "Brand", isTarget: true, points: [{ at: "2026-09-01T09:00:00Z", share: 0.2 }, { at: "2026-09-15T09:00:00Z", share: 0.25 }, { at: "2026-10-01T09:00:00Z", share: 0.3 }] },
      { name: "Rival", isTarget: false, points: [{ at: "2026-09-01T09:00:00Z", share: 0.5 }, { at: "2026-09-15T09:00:00Z", share: 0.45 }, { at: "2026-10-01T09:00:00Z", share: 0.4 }] },
    ],
    shareView: "chart",
    prompts: [],
    pages: [],
    citationsUnavailable: false,
  };
}

const healthy = [run("r1", "2026-09-01T09:00:00Z", 40, 0), run("r2", "2026-09-15T09:00:00Z", 40, 0), run("r3", "2026-10-01T09:00:00Z", 40, 0)];

test("the overview draws five panels in one fixed order, run health first", () => {
  const drawn = overviewBody({ status: "ready", value: overview(healthy) });
  const found = after(drawn, 'data-panel="', '"');
  assert.deepEqual(found, OVERVIEW_ORDER);
  assert.deepEqual(OVERVIEW_ORDER, ["health", "score", "share", "lose", "pages"]);
  assert.equal(drawn.includes("Arrange"), false, "there is no arranging");
});

test("a run where everything came back says so in one sentence", () => {
  const health = runHealth(healthy);
  assert.equal(health.state, "healthy");
  assert.equal(health.left.length, 0);
  assert.equal(healthSentence(health, null), "All 40 answers came back in the run of 1 Oct.");
});

test("a partly failed run is counted, and says how many failed", () => {
  const health = runHealth([...healthy.slice(0, 2), run("r3", "2026-10-01T09:00:00Z", 36, 4)]);
  assert.equal(health.state, "partly");
  assert.equal(health.left.length, 0, "ten percent failing is not mostly failed");
  assert.ok(healthSentence(health, null).startsWith("36 of 40 answers came back in the run of 1 Oct. 4 failed"));
});

test("a mostly failed run is left out of the figure, its move and every chart", () => {
  const runs = [...healthy.slice(0, 2), run("r3", "2026-10-01T09:00:00Z", 10, 30)];
  const health = runHealth(runs);
  assert.equal(health.state, "mostly");
  assert.deepEqual(health.left.map((item) => item.id), ["r3"]);

  const data = overview(runs);
  const reading = headline(data.insights, new Set(["r3"]));
  assert.equal(reading.standing.score, 35, "the figure comes from the last run that did not mostly fail");
  assert.equal(reading.at, "2026-09-15T09:00:00Z");
  assert.equal(reading.change, 5, "and the move ends there too");
  assert.ok(healthSentence(health, reading.at).includes("The run of 1 Oct mostly failed: 10 of 40 answers came back."));
  assert.ok(healthSentence(health, reading.at).includes("The figures below are from the run of 15 Sep."));

  const drawn = overviewBody({ status: "ready", value: data });
  assert.ok(drawn.includes("&gt;35&lt;") || drawn.includes(">35<"), "the panel shows the earlier figure");
  assert.ok(drawn.includes("hatch-share"), "the share chart marks the run it left out");
});

test("an earlier mostly failed run is called out once, above the charts", () => {
  const runs = [healthy[0] as RunRecord, run("r2", "2026-09-15T09:00:00Z", 5, 35), healthy[2] as RunRecord];
  const drawn = overviewBody({ status: "ready", value: overview(runs) });
  assert.equal(count(drawn, "mostly failed"), 1);
  assert.ok(drawn.includes("The run of 15 Sep mostly failed: 5 of 40 answers came back."));
});

test("a run still going is not judged", () => {
  const live = { ...run("r4", "2026-10-02T09:00:00Z", 1, 39), status: "running" };
  assert.equal(runHealth([...healthy, live]).state, "healthy");
});

test("loading looks like loading, never like a finding", () => {
  const drawn = overviewBody({ status: "loading" });
  assert.ok(drawn.includes('role="status"'));
  assert.equal(drawn.includes("came back"), false);
});

test("runs sit at their real dates, so a long gap looks long", () => {
  const scale = timeScale([Date.UTC(2026, 8, 1), Date.UTC(2026, 8, 2), Date.UTC(2026, 9, 1)], 0, 1000);
  const first = scale.x(Date.UTC(2026, 8, 1));
  const second = scale.x(Date.UTC(2026, 8, 2));
  const third = scale.x(Date.UTC(2026, 9, 1));
  assert.ok(Math.abs((third - second) / (second - first) - 29) < 0.01, "29 days is 29 times one day");
});

test("a long span is labelled by month, a short one by day", () => {
  const months = timeTicks(Date.UTC(2026, 7, 10), Date.UTC(2026, 10, 10), 600).map((tick) => tick.label);
  assert.deepEqual(months, ["1 Sep", "1 Oct", "1 Nov"]);
  const days = timeTicks(Date.UTC(2026, 9, 1), Date.UTC(2026, 9, 29), 600).map((tick) => tick.label);
  assert.ok(days.every((label) => label.endsWith("Oct")));
  assert.equal(dayLabel("2026-11-03T22:00:00Z"), "3 Nov");
});

test("every line is named at its end with its latest share, and labels are 12px text", () => {
  const drawn = shareSvg({ series: overview(healthy).rivalTrend, failed: [], labels: true }, 800);
  assert.ok(drawn.includes(">Brand 30%</text>"));
  assert.ok(drawn.includes(">Rival 40%</text>"));
  assert.ok(drawn.includes('class="ch-you-mark"'), "your brand is highlighted");
  assert.ok(drawn.includes('class="ch-line s-you"'));
  assert.ok(drawn.includes('width="800"'), "drawn at the width it was given, not scaled");
  const ticks = after(drawn, 'class="ch-tick"', "<").map((part) => part.slice(part.indexOf(">") + 1));
  assert.ok(ticks.includes("1 Sep") && ticks.includes("29 Sep"), "dates on the axis, not run numbers");
});

test("a failed run breaks the line rather than being bridged", () => {
  const series = overview(healthy).rivalTrend;
  const drawn = shareSvg({ series, failed: ["2026-09-20T09:00:00Z"], labels: true }, 800);
  assert.equal(count(youPath(drawn), "M"), 2, "two stretches either side of the failed run");
  assert.ok(drawn.includes("ch-failed"));
});

test("the score line breaks at a failed run and carries its range", () => {
  const drawn = scoreSvg({
    points: [
      { at: "2026-09-01T09:00:00Z", score: 30, low: 25, high: 35 },
      { at: "2026-09-08T09:00:00Z", score: 32, low: 27, high: 37 },
      { at: "2026-09-22T09:00:00Z", score: 34, low: 29, high: 39 },
      { at: "2026-09-29T09:00:00Z", score: 36, low: 31, high: 41 },
    ],
    failed: ["2026-09-15T09:00:00Z"],
  }, 400);
  assert.equal(count(youPath(drawn), "M"), 2);
  assert.equal(count(drawn, 'class="ch-range"'), 2);
});

test("a rival keeps its colour whatever its rank", () => {
  const one = rivalSlots([{ name: "You", isTarget: true, points: [] }, { name: "Zed", isTarget: false, points: [] }, { name: "Alto", isTarget: false, points: [] }]);
  const two = rivalSlots([{ name: "Alto", isTarget: false, points: [] }, { name: "Zed", isTarget: false, points: [] }]);
  assert.equal(one.get("Alto"), two.get("Alto"));
  assert.equal(one.get("Zed"), two.get("Zed"));
});

test("the range scales the score by the presence interval", () => {
  assert.deepEqual(scoreRange({ score: 40, presenceRate: 0.5, presenceInterval: { low: 0.4, high: 0.6 }, prominence: 1, sentiment: 1, answers: 40, appearances: 20 }), { low: 32, high: 48 });
  assert.equal(scoreRange({ score: null, presenceRate: null, prominence: null, sentiment: null, answers: 0, appearances: 0 }), null);
});

test("a question is lost where a rival is named more, widest gap first", () => {
  const lost = questionsYouLose([
    { text: "won", measuresVisibility: true, score: { answers: 10, appearances: 8 }, standing: [{ name: "R", isTarget: false, appearances: 3 }] },
    { text: "close", measuresVisibility: true, score: { answers: 10, appearances: 4 }, standing: [{ name: "R", isTarget: false, appearances: 5 }] },
    { text: "wide", measuresVisibility: true, score: { answers: 10, appearances: 0 }, standing: [{ name: "Q", isTarget: false, appearances: 9 }] },
    { text: "by name", measuresVisibility: false, score: { answers: 10, appearances: 0 }, standing: [{ name: "Q", isTarget: false, appearances: 9 }] },
  ]);
  assert.deepEqual(lost.map((row) => row.text), ["wide", "close"]);
  assert.equal(lost[0]?.winner.name, "Q");
});

test("the share table carries the chart's numbers and says which run was left out", () => {
  const data = overview(healthy);
  const table = shareTable(data.rivalTrend, ["2026-09-15T09:00:00Z"]);
  assert.ok(table.includes("<th class=\"num\">1 Sep</th>"));
  assert.ok(table.includes("<mark class=\"you\">Brand</mark>"));
  assert.ok(table.includes(">left out<"));
  assert.ok(table.includes(">40%<"));
});
