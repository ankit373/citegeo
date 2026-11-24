import test from "node:test";
import assert from "node:assert/strict";
import {
  ageCell, armCell, bar, creditRows, experimentCard, outreachRow, overAppearances, renderLeaderboard,
  renderPersonaRows, searchDemandRow, shapeRow, stat, verdictButtons,
  type ExperimentRow, type OutreachTarget,
} from "../src/ui/app/pages/metric-cells.js";

function has(text: string, ...parts: string[]): void {
  for (const part of parts) assert.ok(text.includes(part), `${JSON.stringify(text)} lacks ${part}`);
}

test("a bar and a stat draw nothing for an absent fraction", () => {
  assert.equal(bar(null), "");
  assert.equal(bar(undefined), "");
  assert.equal(bar(0.5), '<div class="bar"><i style="width:50%"></i></div>');
  assert.equal(stat("L", "v", "n").includes("class=\"bar\""), false);
  has(stat("A<", "7", "n&", 0.25), "A&lt;", "n&amp;", "width:25%");
});

test("too few appearances is not read as a rate", () => {
  assert.deepEqual(overAppearances(null, 0.5, "w"), { value: "Not measurable", note: "Nothing named, so nothing judged.", fraction: null });
  const few = overAppearances({ tooFewAppearances: true, namedIn: 2 }, 0.5, "w");
  assert.equal(few.value, "Too few");
  has(few.note, "2 appearance(s) cannot be read as a rate. w");
  assert.deepEqual(overAppearances({}, 0.5, "w"), { value: "50%", note: "w", fraction: 0.5 });
  assert.equal(overAppearances({}, null, "w").value, "Not measurable");
});

test("the leaderboard and persona rows say when there is nothing to show", () => {
  has(renderLeaderboard(null), "No organisation was named");
  has(renderPersonaRows([]), "One audience is the overall figure");
  const board = renderLeaderboard([
    { name: "Me", domain: null, isTarget: true, appearances: 4, shareOfAnswers: null, prominence: 0.5, positive: 0, negative: 0 },
    { name: "Them<", domain: "t.example", isTarget: false, isTracked: true, appearances: 2, shareOfAnswers: 0.25, prominence: null, positive: 0, negative: 0 },
  ]);
  has(board, "no domain given", "pill good", "Them&lt;", "Rival you track", "4 · Not measurable", "2 · 25%", "width:50%");
  has(renderPersonaRows([{ label: "P", score: { answers: 2, presenceRate: null, prominence: null, sentiment: null, score: null, appearances: 0 }, rank: null }]), "Not measurable", "Not named");
});

test("a row that has no value shows a dash, and a gap shows its sign", () => {
  has(shapeRow("L", null, 2), "—", ">2<");
  has(shapeRow("L", 3, 2), "state-flag");
  has(creditRows([{ host: "h", url: "u", creditedAt: 1, citedAt: 3, usedAt: 2, gap: 2 }], "k"), "of 3 cited", "+2");
  assert.equal(creditRows([], "k"), "");
});

test("an age cell separates unread, undated and dated pages", () => {
  has(ageCell({ freshness: "unread" }), "Not read");
  has(ageCell({ freshness: "undated" }), "No date given");
  has(ageCell({ freshness: "fresh", ageDays: 3 }), "state-ok", "3 days");
  has(ageCell({ freshness: "stale", ageDays: 900 }), "state-bad");
});

test("outreach, search and verdict rows escape what they print", () => {
  const target: OutreachTarget = {
    url: "https://u.example/?a=1&b=2", title: null, host: "h<", words: null, why: "w", prompts: ["a", "b", "c"],
    rivals: [], namesYou: false, citedBy: 2, freshness: "unread",
  };
  has(outreachRow(target), "a=1&amp;b=2", "h&lt;", "Nobody the answers named", "You are not", "Cited answering: a · b");
  const row = { text: "t&", exact: [], related: [{ query: "q" }], earnedInSearchAbsentInAnswers: true, impressions: 4, clicks: 1, position: 3.456 };
  has(searchDemandRow(row), "t&amp;", "Found in search", "#3.5");
  has(searchDemandRow({ ...row, position: null, related: [] }), "Not ranked", "No query in the window");
  has(verdictButtons({ id: "i&", recommendation: "positive", isTarget: true }), 'data-verdict-id="i&amp;"', "No, negative", "No, not you");
});

test("an experiment with no difference says nothing about a band", () => {
  const arm = { rate: 0.5, trials: 4 };
  const row: ExperimentRow = {
    id: "e", name: "N", status: "stopped", changedAt: "2026-11-01T00:00:00Z", treatedPromptIds: ["a"], controlPromptIds: ["b", "c"],
    result: { verdict: "no_control", difference: null, detail: "d", treated: { before: arm, after: arm }, control: { before: arm, after: { rate: null, trials: 0 } } },
  };
  const card = experimentCard(row);
  has(card, "No control", "stopped", "1 treated, 2 control", "—");
  assert.equal(card.includes("points"), false);
  has(experimentCard({ ...row, status: "running", result: { ...row.result, verdict: "moved", difference: 0.2, low: 0.1, high: 0.3 } }), "+20 points", "10 to 30 points", "data-stop-experiment");
  assert.equal(armCell("a", { rate: null, trials: 1 }).includes("—"), true);
});
