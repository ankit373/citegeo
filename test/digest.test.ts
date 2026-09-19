import test from "node:test";
import assert from "node:assert/strict";
import { buildDigest } from "../src/product/reporting/digest.js";
import type { DigestInput } from "../src/product/reporting/digest.js";
import type { BrandInsights } from "../src/product/insights/brand-insights.js";
import type { GeoAction } from "../src/product/actions/action-plan.js";

function insights(recognized: number, answered: number): BrandInsights {
  return {
    target: "example.com",
    answered,
    visibility: { recognized, answered, score: answered ? recognized / answered : null, byModel: [] },
    shareOfVoice: { target: { name: "Example", domain: "example.com", mentions: 0, share: null }, competitors: [] },
    citations: { answersWithCitations: 0, targetCitedIn: 0, domains: [] },
    categories: [],
  };
}

const action = (severity: GeoAction["severity"], id = severity): GeoAction => ({
  id, severity, title: id, why: "", fix: "", evidence: "",
});

function input(overrides: Partial<DigestInput> = {}): DigestInput {
  return {
    projectId: "p",
    domain: "example.com",
    insights: insights(0, 4),
    citationGap: [],
    actions: [],
    signalChanges: [],
    ...overrides,
  };
}

test("a first digest is newsworthy so the recipient knows what is watched", () => {
  const digest = buildDigest(input());
  assert.equal(digest.newsworthy, true);
  assert.ok(digest.reasons[0]?.includes("First digest"));
});

test("an unchanged project produces nothing to send", () => {
  const previous = { visibilityScore: 0, recognized: 0, answered: 4, criticalCount: 0, citationGapCount: 0 };
  const digest = buildDigest(input({ previous }));
  assert.equal(digest.newsworthy, false);
  assert.deepEqual(digest.reasons, [], "a digest that usually says nothing is one people stop opening");
});

test("visibility moving is reported with both figures", () => {
  const previous = { visibilityScore: 0, recognized: 0, answered: 4, criticalCount: 0, citationGapCount: 0 };
  const digest = buildDigest(input({ insights: insights(2, 4), previous }));
  assert.equal(digest.newsworthy, true);
  assert.ok(digest.reasons.some((reason) => reason.includes("0%") && reason.includes("50%")));
});

test("a site signal change is always newsworthy, improvement included", () => {
  const previous = { visibilityScore: 0, recognized: 0, answered: 4, criticalCount: 0, citationGapCount: 0 };
  const digest = buildDigest(input({
    previous,
    signalChanges: [{ field: "wikidata", direction: "improved", before: "absent", after: "Q42", detail: "Now resolves to Q42." }],
  }));
  assert.equal(digest.newsworthy, true);
  assert.equal(digest.signalChanges.length, 1);
});

test("a new critical finding is reported, and resolved ones do not raise a false alarm", () => {
  const previous = { visibilityScore: 0, recognized: 0, answered: 4, criticalCount: 0, citationGapCount: 0 };
  const worse = buildDigest(input({ previous, actions: [action("critical"), action("high")] }));
  assert.ok(worse.reasons.some((reason) => reason.includes("1 new critical")));
  assert.equal(worse.criticalActions.length, 1);

  const better = buildDigest(input({
    previous: { ...previous, criticalCount: 2 },
    actions: [action("high")],
  }));
  assert.equal(better.newsworthy, false, "fewer criticals is not an alarm");
});

test("new citation gaps are named, not just counted", () => {
  const previous = { visibilityScore: 0, recognized: 0, answered: 4, criticalCount: 0, citationGapCount: 1 };
  const digest = buildDigest(input({
    previous,
    citationGap: [
      { domain: "new-directory.com", answers: 2, competitors: ["Rival"], models: ["m"] },
      { domain: "known.com", answers: 1, competitors: ["Rival"], models: ["m"] },
    ],
  }));
  assert.deepEqual(digest.newCitationGaps, ["new-directory.com"]);
});

test("new answers alone are worth a digest", () => {
  const previous = { visibilityScore: 0, recognized: 0, answered: 2, criticalCount: 0, citationGapCount: 0 };
  const digest = buildDigest(input({ previous }));
  assert.ok(digest.reasons.some((reason) => reason.includes("2 new answer")));
});

test("a project with nothing measured and nothing to fix is not worth a first digest", () => {
  const digest = buildDigest(input({ insights: insights(0, 0) }));
  assert.equal(digest.newsworthy, false);
});

test("the headline reports not measurable rather than zero percent", () => {
  const digest = buildDigest(input({ insights: insights(0, 0), actions: [action("high")] }));
  assert.ok(digest.headline.includes("not measurable"));
});
