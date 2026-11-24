import test from "node:test";
import assert from "node:assert/strict";
import {
  renderConcentration, renderCredit, renderInterference, renderKinds, renderOutreach, renderReferrals, renderSearchDemand, renderShape,
} from "../src/ui/app/pages/source-sections.js";
import type { InterferenceReport } from "../src/product/citations/interference.js";
import type { ConcentrationReport } from "../src/product/citations/concentration.js";
import type { ShapeComparison, ShapeSummary } from "../src/product/citations/page-shape.js";
import type { CreditReport, CreditRow } from "../src/product/citations/credit-gap.js";
import type { PageKindReport } from "../src/product/citations/page-kind.js";
import type { OutreachPlan, OutreachTarget } from "../src/product/citations/outreach.js";
import type { ProportionInterval } from "../src/product/topics/proportion-interval.js";
import type { SearchConsoleStatus } from "../src/product/search-console/search-console-service.js";
import type { ReferralReport } from "../src/product/search-console/analytics-client.js";

function has(text: string, ...parts: string[]): void {
  for (const part of parts) assert.ok(text.includes(part), `${JSON.stringify(text)} lacks ${part}`);
}

const calls: string[] = [];
const actions = Object.fromEntries(["Interference", "Concentration", "Shape", "Credit", "Kinds", "Outreach", "SearchDemand", "Referrals"].map((name) => ["load" + name, () => { calls.push(name); }])) as {
  loadInterference(): void; loadConcentration(): void; loadShape(): void; loadCredit(): void; loadKinds(): void; loadOutreach(): void; loadSearchDemand(): void; loadReferrals(): void;
};

test("every section loads itself only while idle, and says what it is waiting for", () => {
  calls.length = 0;
  has(renderInterference("idle", null, actions), "Reading how the sources arrived.");
  has(renderConcentration("loading", null, actions), "Reading who supplies these answers.");
  has(renderShape("error", null, actions), "Could not read how these pages are laid out.");
  has(renderCredit("loading", undefined, actions), "Comparing where pages were cited");
  has(renderKinds("error", null, actions), "Could not read what kind of pages are cited.");
  has(renderOutreach("loading", null, false, actions), "Reading which pages the answers cited.");
  has(renderSearchDemand("error", null, false, actions), "Could not read the Search Console settings.");
  has(renderReferrals("loading", null, false, actions), "Checking for an Analytics property.");
  assert.deepEqual(calls, ["Interference"]);
  calls.length = 0;
  renderShape("idle", null, actions);
  renderKinds("idle", null, actions);
  assert.deepEqual(calls, ["Shape", "Kinds"]);
});

test("interference needs a second run and names what arrived at once", () => {
  const report: InterferenceReport = { runs: 1, arrivals: [], arrivedOnce: 0, shifts: [], caveat: "c" };
  has(renderInterference("ready", report, actions), "1 run(s) have cited anything");
  const two: InterferenceReport = {
    runs: 3, arrivedOnce: 4, caveat: "cv<", shifts: [],
    arrivals: [{ host: "h<", sudden: true, arrivedAt: "2026-11-02T00:00:00Z", questionsAtArrival: 5, questionsInRun: 9, breadth: 0.55 }],
  };
  has(renderInterference("ready", two, actions), "1 source(s) arrived across most", "h&lt;", "5 of 9", "55%", "No cited page has been read twice", "cv&lt;");
});

test("concentration says whose it is and whether yours is among them", () => {
  const report: ConcentrationReport = {
    hosts: [{ host: "a", isYours: true, answers: 3, share: 0.6, shareOfAnswers: 0.6 }, { host: "b", isYours: false, answers: 2, share: 0.4, shareOfAnswers: 0.4 }],
    halfHeldBy: 1, verdict: "concentrated", yourRank: 1, topShares: [{ share: 0.6, rank: 1 }], answersWithCitations: 5, gini: 0.456, caveat: "c",
  };
  has(renderConcentration("ready", report, actions), "1 of 2 domain(s) supply half", "own the category", "Yours is ranked 1 of 2", "yours", "0.46");
  has(renderConcentration("ready", { ...report, hosts: [], yourRank: null, gini: null }, actions), "nobody supplying them to count");
  has(renderConcentration("ready", { ...report, yourRank: null, gini: null }, actions), "Your own domain is not among them", "Not measurable");
});

test("shape withholds a verdict until both sides are read", () => {
  const side = (pages: number): ShapeSummary => ({ pages, headingsPerThousand: 3, listItemsPerThousand: 2, tablesPerThousand: null, withTable: null });
  const base: ShapeComparison = { theirs: side(5), yours: side(0), behindOnAll: null, minimum: 3, effect: "e", caveat: "c" };
  has(renderShape("ready", { ...base, theirs: side(0) }, actions), "nothing to compare a layout against");
  has(renderShape("ready", base, actions), "None of your own pages has been cited");
  has(renderShape("ready", { ...base, yours: side(1) }, actions), "Each side needs 3 pages", "1 of yours and 5 of theirs");
  has(renderShape("ready", { ...base, yours: side(4), behindOnAll: true }, actions), "more structure than yours on every count", "Headings");
});

test("credit ranks the gap and says when nothing could be ranked", () => {
  const report: CreditReport = { comparable: 0, meanGap: null, rows: 0, tooFewRead: 0, overCredited: [], underCredited: [], finding: "f", caveat: "c" };
  has(renderCredit("ready", report, actions), "no citation list to rank within");
  const row: CreditRow = { host: "h", url: "https://u.example/x", creditedAt: 1, citedAt: 3, usedAt: 2, uptake: 0.5, gap: 2 };
  has(renderCredit("ready", { ...report, comparable: 4, meanGap: 1.5, rows: 9, tooFewRead: 2, overCredited: [row] }, actions), "Cited early, barely used", "2 more answer(s) cited something");
  has(renderCredit("ready", { ...report, comparable: 4 }, actions), "No page sits far from where its contribution would put it.");
});

test("kinds compares to the published share only when there are enough pages", () => {
  const interval = (low: number | null, high: number | null): ProportionInterval => ({ rate: null, low, high, trials: 10, caveat: "" });
  const report: PageKindReport = {
    pages: 10, cited: 30, listicleShare: 0.4, corporateShare: 0.2, ownedShare: 0.05, listicleInterval: interval(0.2, 0.6), corporateInterval: interval(null, null), ownedInterval: interval(0, 0.2),
    listicleBaseline: 0.3, corporateBaseline: 0.1, ownedBaselineLow: 0.02, ownedBaselineHigh: 0.1, tooFewToCompare: false,
    formats: [{ kind: "listicle", pages: 4, share: 0.4 }], sources: [{ kind: "yours", pages: 1, share: 0.1 }], caveat: "c",
  };
  has(renderKinds("ready", report, actions), "40% (20 to 60%)", "against 30% published", "inside the 2 to 10%", "Ranked best-of", "Your own site");
  has(renderKinds("ready", { ...report, pages: 0 }, actions), "nothing to say about what kind of page wins");
  has(renderKinds("ready", { ...report, tooFewToCompare: true, ownedShare: 0.5 }, actions), "too few for either share");
});

const target: OutreachTarget = {
  url: "https://t.example/?a=1&b=2", title: null, host: "h", owner: "independent", words: 90, why: "w", prompts: ["p"], rivals: [], namesYou: true,
  citedBy: 2, citedWithoutYou: 0, reachable: true, freshness: "fresh", ageDays: 4, unread: null,
};

test("outreach, search demand and referrals each offer one pull, and say what is empty", () => {
  const plan: OutreachPlan = {
    freshness: { pages: [], fresh: 1, ageing: 0, stale: 0, undated: 0, medianAgeDays: null, datedPages: 0, caveat: "ca" },
    cited: 9, answersWithCitations: 7, answersConsidered: 8, read: 5, targets: [target], reachable: 1, rivalOwned: 0, unavailable: false,
  };
  has(renderOutreach("ready", plan, false, actions), "9 page(s) cited across 7 of 8", "Read the cited pages", "a=1&amp;b=2", "None of them gave a date");
  has(renderOutreach("ready", plan, true, actions), "Reading…");
  has(renderOutreach("ready", { ...plan, unavailable: true }, false, actions), "no page to read");

  const demand: SearchConsoleStatus = { configured: true, siteUrl: "https://s.example", detail: "d<", report: null };
  has(renderSearchDemand("ready", demand, false, actions), "d&lt;", "Pull the last 90 days");
  has(renderSearchDemand("ready", { ...demand, configured: false }, false, actions), "Add the key in Setup");
  has(renderSearchDemand("ready", { ...demand, report: { siteUrl: "https://s.example", fetchedAt: "2026-11-24T00:00:00Z", queries: 5, totalImpressions: 100, window: { from: "a", to: "b" }, prompts: [] } }, true, actions), "5 query row(s)", "No question earns search impressions", "Reading…");

  const report = (over: Partial<ReferralReport>): ReferralReport => ({ propertyId: "1", from: "a", to: "b", fetchedAt: "c", assistants: [], totalSessions: 0, empty: false, ...over });
  const referrals = { configured: true, propertyId: "1" as string | null, detail: "d", report: report({ empty: true }) };
  has(renderReferrals("ready", referrals, false, actions), "reported no row at all");
  has(renderReferrals("ready", { ...referrals, report: report({ totalSessions: 9 }) }, false, actions), "9 session(s) in the window and none from an assistant");
  has(renderReferrals("ready", { ...referrals, report: report({ totalSessions: 40, assistants: [{ source: "chat<", engaged: null, sessions: 10 }] }) }, false, actions), "chat&lt;", "engagement not reported", "25%");
  has(renderReferrals("ready", { ...referrals, propertyId: null, report: null }, false, actions), "Add it in Setup");
});
