import test from "node:test";
import assert from "node:assert/strict";
import { baselineFor, compareToTier, TIER_BASELINES, TIER_CAVEAT } from "../src/product/topics/visibility-tier.js";

test("with no tier declared there is nothing to compare against", () => {
  // Inferring the tier from the brand's own visibility compares the figure
  // against itself, so it is declared or it is absent.
  const report = compareToTier({ tier: "unstated", appearances: 20, answers: 40 });
  assert.equal(report.baseline, null);
  assert.equal(report.typical, null);
  assert.equal(report.standing, null);
});

test("a niche brand at a niche rate is doing what its kind does", () => {
  const report = compareToTier({ tier: "niche", appearances: 11, answers: 100 });
  assert.equal(report.standing, "typical");
  assert.equal(report.typical, true);
});

test("the same rate is below par for a household name", () => {
  const report = compareToTier({ tier: "household", appearances: 11, answers: 100 });
  assert.equal(report.standing, "below");
});

test("clearly beating the baseline reads as above it", () => {
  const report = compareToTier({ tier: "niche", appearances: 80, answers: 100 });
  assert.equal(report.standing, "above");
});

test("a handful of answers that happen to beat the baseline have not beaten it", () => {
  // Three of four is 75%, over the household baseline, and the range runs
  // from about 30% to 95%. Reading the point would call that a win.
  const report = compareToTier({ tier: "household", appearances: 3, answers: 4 });
  assert.equal(report.standing, "typical", "the range still covers the baseline");
  assert.ok((report.presence.low || 1) < 0.73);
});

test("more answers turn the same rate into a verdict", () => {
  const few = compareToTier({ tier: "niche", appearances: 3, answers: 10 });
  const many = compareToTier({ tier: "niche", appearances: 300, answers: 1000 });
  assert.equal(few.standing, "typical", "30% of ten is consistent with 11%");
  assert.equal(many.standing, "above", "30% of a thousand is not");
});

test("with nothing answered there is no comparison rather than a nought", () => {
  const report = compareToTier({ tier: "niche", appearances: 0, answers: 0 });
  assert.equal(report.presence.rate, null);
  assert.equal(report.standing, null);
  assert.equal(report.typical, null);
});

test("every tier has a baseline and they fall in order", () => {
  assert.equal(TIER_BASELINES.length, 3);
  for (const row of TIER_BASELINES) assert.ok(baselineFor(row.tier)?.rate === row.rate);
  const rates = TIER_BASELINES.map((row) => row.rate);
  assert.deepEqual(rates, [...rates].sort((a, b) => b - a), "household down to niche");
  assert.equal(baselineFor("unstated"), null);
});

test("the caveat refuses to let a baseline read as a target", () => {
  assert.ok(TIER_CAVEAT.includes("still not a target"));
  assert.ok(TIER_CAVEAT.includes("not yours"));
  assert.equal(compareToTier({ tier: "niche", appearances: 1, answers: 2 }).caveat, TIER_CAVEAT);
});
