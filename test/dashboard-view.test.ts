import test from "node:test";
import assert from "node:assert/strict";
import {
  dashboardBody, heroStats, leaderboardBars, movesList, sourcesPanel, splitRows, summaryTiles,
  rivalChart,
  dashboardPanels,
  type DashboardData,
} from "../src/ui/app/pages/dashboard-view.js";

function data(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    domain: "example.com", score: 40, change: 3, rank: 2,
    overall: { score: 40, presenceRate: 0.5, prominence: 0.6, sentiment: 0.7, answers: 10, appearances: 5 },
    leaderboard: [
      { name: "Rival", isTarget: false, appearances: 9, shareOfAnswers: 0.9 },
      { name: "You", isTarget: true, appearances: 5, shareOfAnswers: 0.5 },
    ],
    byModel: [{ label: "GPT", score: 20, answers: 5, rank: 3 }],
    byRegion: [], byPersona: [],
    questions: 10, measurable: 8, absent: 3, assistants: 4, assistantsNaming: 2,
    moves: [{ title: "Win the 3 you are never named in", evidence: "7 answers named you zero times.", effect: "raises_visibility" }],
    citationsUnavailable: false, citedPages: 6, missingFrom: 4,
    spark: "", alerts: 2,
    ...overrides,
  };
}

test("the score is never shown without the three figures it is built from", () => {
  const stats = heroStats(data().overall);
  assert.ok(stats.includes("Presence"));
  assert.ok(stats.includes("Prominence"));
  assert.ok(stats.includes("Sentiment"));
  assert.ok(stats.includes("5 of 10 named you"));
});

test("an unmeasurable component reads as not measurable, not as nought percent", () => {
  const stats = heroStats({ score: null, presenceRate: null, prominence: null, sentiment: null, answers: 0, appearances: 0 });
  assert.equal(stats.includes("0%"), false);
  assert.equal(stats.split("Not measurable").length - 1, 3);
});

test("you are marked on the leaderboard and the bars are drawn against the strongest", () => {
  const bars = leaderboardBars(data().leaderboard);
  assert.ok(bars.includes("is-you"));
  assert.ok(bars.includes("width:100%"), "the strongest fills the track");
  assert.ok(bars.includes("width:56%"), "and the rest are drawn against it");
});

test("nobody named is said in words rather than drawn as an empty chart", () => {
  assert.ok(leaderboardBars([]).includes("No organisation has been named yet."));
  assert.ok(splitRows([], "Every answer was asked without a market stated.").includes("without a market stated"));
});

test("a split with no answers reads as not named rather than rank nought", () => {
  const rows = splitRows([{ label: "Claude", score: null, answers: 0, rank: null }], "none");
  assert.ok(rows.includes("Not measurable"));
  assert.ok(rows.includes("Not named"));
  assert.equal(rows.includes(">0<"), false);
});

test("no citation anywhere offers the fix instead of an empty panel", () => {
  const panel = sourcesPanel(data({ citationsUnavailable: true }));
  assert.ok(panel.includes("not evidence that nobody cites you"));
  assert.ok(panel.includes('data-page="models"'));
});

test("pages not read back yet are distinguished from no pages cited", () => {
  assert.ok(sourcesPanel(data({ citedPages: null })).includes("Reading the cited pages."));
  assert.ok(sourcesPanel(data({ citedPages: 0, missingFrom: 0 })).includes("Pages cited"));
});

test("only the moves that raise the score are offered, and the rest is one link", () => {
  const list = movesList(data().moves);
  assert.ok(list.includes("Win the 3 you are never named in"));
  assert.ok(list.includes("The whole plan"));
  assert.ok(movesList([]).includes("Nothing in the archived answers points at a move"));
});

test("the tiles carry their own denominator, so a count is never read alone", () => {
  const strip = summaryTiles(data());
  assert.ok(strip.includes("8 can measure visibility"));
  assert.ok(strip.includes("2 named you at least once"), "2 of the 4 assistants, not the 4");
});

test("loading draws the shape that is coming, and a failure says what failed", () => {
  const waiting = dashboardBody({ status: "loading" });
  assert.ok(waiting.includes("sk-tile"));
  assert.ok(waiting.includes('role="status"'));
  const broken = dashboardBody({ status: "error", error: "Could not read this project" });
  assert.ok(broken.includes("Could not read this project"));
  assert.equal(broken.includes("sk-tile"), false);
});

test("every figure on the dashboard is escaped on its way out", () => {
  const nasty = dashboardBody({ status: "ready", value: data({ leaderboard: [{ name: '<img onerror="x">', isTarget: false, appearances: 1, shareOfAnswers: 1 }] }) });
  assert.equal(nasty.includes("<img onerror"), false);
  assert.ok(nasty.includes("&lt;img"));
});

test("a brand nobody named is drawn flat at zero, not left off the chart", () => {
  const series = [
    { name: "Rival", isTarget: false, points: [{ at: "2026-01-01", share: 0.5 }, { at: "2026-01-02", share: 1 }] },
  ];
  const html = rivalChart(series, "mine.example");
  // Absent from every answer is the finding, so the line has to be there,
  // named at its own end and marked as the reader's own brand.
  assert.equal(html.includes("mine.example"), true);
  assert.equal(html.includes("ch-name is-you"), true);
});

test("one run reports that it is one run rather than drawing a flat line", () => {
  const series = [{ name: "Rival", isTarget: false, points: [{ at: "2026-01-01", share: 0.5 }] }];
  assert.equal(rivalChart(series, "mine.example").includes("Run again"), true);
});

test("a brand named in no answer of a run is plotted at zero, not skipped", () => {
  const series = [
    { name: "Mine", isTarget: true, points: [{ at: "a", share: 0 }, { at: "b", share: 0.4 }] },
    { name: "Rival", isTarget: false, points: [{ at: "a", share: 1 }, { at: "b", share: 1 }] },
  ];
  const html = rivalChart(series, "mine.example");
  // Two points per line, so four circles, and no gap in either path.
  assert.equal(html.split("<circle").length - 1, 4);
});

test("the chart says when each run happened", () => {
  const series = [
    { name: "Mine", isTarget: true, points: [{ at: "2026-09-20T10:00:00Z", share: 0 }, { at: "2026-09-21T10:00:00Z", share: 0.4 }] },
  ];
  const html = rivalChart(series, "mine.example");
  // Six lines crossing with no time axis is a picture of nothing.
  assert.equal(html.includes("Sep"), true);
  assert.equal(html.includes("ch-axis"), true);
});

test("labels that would land on each other are pushed apart", () => {
  const series = [
    { name: "A", isTarget: false, points: [{ at: "a", share: 1 }, { at: "b", share: 0.5 }] },
    { name: "B", isTarget: false, points: [{ at: "a", share: 0 }, { at: "b", share: 0.5 }] },
  ];
  const html = rivalChart(series, "mine.example");
  const ys: number[] = [];
  let at = html.indexOf('<text class="ch-name');
  while (at >= 0) {
    const yAt = html.indexOf('y="', at);
    ys.push(Number(html.slice(yAt + 3, html.indexOf('"', yAt + 3))));
    at = html.indexOf('<text class="ch-name', at + 10);
  }
  assert.ok(ys.length >= 2, "expected a label per line");
  const sorted = [...ys].sort((left, right) => left - right);
  assert.ok((sorted[1] as number) - (sorted[0] as number) >= 14, "two labels overlap");
});

test("panels are named the way the market names them", () => {
  // Checked against search volume rather than taste: share of voice,
  // recommendations, competitors and alerts are what people already call
  // these, and an invented name makes a reader translate before they read.
  const titles = dashboardPanels(data()).map((panel) => panel.title);
  for (const expected of ["Share of voice", "Recommendations", "Brand mentions", "Sentiment by brand", "Cited sources"]) {
    assert.ok(titles.includes(expected), `${expected} is not a panel title`);
  }
});

test("every panel can be opened on its own", () => {
  const panels = dashboardPanels(data());
  assert.ok(panels.length >= 8);
  for (const panel of panels) {
    assert.ok(panel.id, "a panel has no id, so it cannot be reordered or expanded");
    assert.ok(panel.body.length > 0, `${panel.id} has no body`);
  }
  // Ids have to be unique or the order and the expand both pick the wrong one.
  const ids = panels.map((panel) => panel.id);
  assert.deepEqual(ids, [...new Set(ids)]);
});
