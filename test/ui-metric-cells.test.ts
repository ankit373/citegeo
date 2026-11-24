import test from "node:test";
import assert from "node:assert/strict";
import {
  ageCell, armCell, bar, creditRows, experimentCard, outreachRow, overAppearances, renderLeaderboard,
  renderPersonaRows, searchDemandRow, shapeRow, stat, verdictButtons,
} from "../src/ui/app/pages/metric-cells.js";
import type { CreditRow } from "../src/product/citations/credit-gap.js";
import type { OutreachTarget } from "../src/product/citations/outreach.js";
import type { PromptSearchDemand } from "../src/product/search-console/search-demand.js";
import type { ExperimentReport } from "../src/product/experiments/experiment-service.js";
import type { ProportionInterval } from "../src/product/topics/proportion-interval.js";

const reading = (tooFewAppearances: boolean, namedIn = 0, appearances = 0) => ({ tooFewAppearances, namedIn, appearances });
const interval = (rate: number | null, trials: number): ProportionInterval => ({ rate, low: null, high: null, trials, caveat: "" });

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
  const few = overAppearances(reading(true, 2), 0.5, "w");
  assert.equal(few.value, "Too few");
  has(few.note, "2 appearance(s) cannot be read as a rate. w");
  assert.deepEqual(overAppearances(reading(false), 0.5, "w"), { value: "50%", note: "w", fraction: 0.5 });
  assert.equal(overAppearances(reading(false), null, "w").value, "Not measurable");
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

const credit: CreditRow = { host: "h", url: "u", creditedAt: 1, citedAt: 3, usedAt: 2, uptake: 0.5, gap: 2 };

test("a row that has no value shows a dash, and a gap shows its sign", () => {
  has(shapeRow("L", null, 2), "—", ">2<");
  has(shapeRow("L", 3, 2), "state-flag");
  has(creditRows([credit], "k"), "of 3 cited", "+2");
  assert.equal(creditRows([], "k"), "");
});

test("an age cell separates unread, undated and dated pages", () => {
  has(ageCell({ freshness: "unread", ageDays: null }), "Not read");
  has(ageCell({ freshness: "undated", ageDays: null }), "No date given");
  has(ageCell({ freshness: "fresh", ageDays: 3 }), "state-ok", "3 days");
  has(ageCell({ freshness: "stale", ageDays: 900 }), "state-bad");
});

test("outreach, search and verdict rows escape what they print", () => {
  const target: OutreachTarget = {
    url: "https://u.example/?a=1&b=2", title: null, host: "h<", owner: "independent", words: null, why: "w", prompts: ["a", "b", "c"],
    rivals: [], namesYou: false, citedBy: 2, citedWithoutYou: 2, reachable: true, freshness: "unread", ageDays: null, unread: "not read",
  };
  has(outreachRow(target), "a=1&amp;b=2", "h&lt;", "Nobody the answers named", "You are not", "Cited answering: a · b");
  const row: PromptSearchDemand = { promptId: "p", text: "t&", exact: [], related: [{ query: "q", clicks: 1, impressions: 4, position: 3 }], earnedInSearchAbsentInAnswers: true, impressions: 4, clicks: 1, position: 3.456 };
  has(searchDemandRow(row), "t&amp;", "Found in search", "#3.5");
  has(searchDemandRow({ ...row, position: null, related: [] }), "Not ranked", "No query in the window");
  has(verdictButtons({ id: "i&", recommendation: "positive", isTarget: true }), 'data-verdict-id="i&amp;"', "No, negative", "No, not you");
});

test("an experiment with no difference says nothing about a band", () => {
  const arm = { before: interval(0.5, 4), after: interval(0.5, 4), lift: 0 };
  const row: ExperimentReport = {
    id: "e", projectId: "p", name: "N", hypothesis: "h", changed: "", status: "stopped", createdAt: "2026-11-01T00:00:00Z", stoppedAt: null, draftId: null,
    changedAt: "2026-11-01T00:00:00Z", treatedPromptIds: ["a"], controlPromptIds: ["b", "c"],
    result: {
      verdict: "no_control", difference: null, low: null, high: null, detail: "d", caveat: "c", versionsChanged: [],
      treated: arm, control: { ...arm, after: interval(null, 0) },
    },
  };
  const card = experimentCard(row);
  has(card, "No control", "stopped", "1 treated, 2 control", "—");
  assert.equal(card.includes("points"), false);
  has(experimentCard({ ...row, status: "running", result: { ...row.result, verdict: "moved", difference: 0.2, low: 0.1, high: 0.3 } }), "+20 points", "10 to 30 points", "data-stop-experiment");
  assert.equal(armCell("a", interval(null, 1)).includes("—"), true);
});
