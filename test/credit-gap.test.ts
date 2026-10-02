import test from "node:test";
import assert from "node:assert/strict";
import { AUTHORITY_FINDING, CREDIT_CAVEAT, creditGaps, RANK_GAP } from "../src/product/citations/credit-gap.js";
import type { PageUptake } from "../src/product/citations/answer-uptake.js";

function page(host: string, citedAt: number, uptake: number | null): PageUptake {
  return { url: `https://${host}/x`, host, uptake, shared: uptake, phrases: [], coverage: null, citedAt, detail: null };
}

test("one cited page has nothing to be ranked against", () => {
  const report = creditGaps([[page("a.test", 1, 0.5)]]);
  assert.equal(report.comparable, 0);
  assert.equal(report.meanGap, null, "nothing compared is not a gap of nought");
});

test("a page that could not be measured is left out rather than ranked last", () => {
  const report = creditGaps([[page("a.test", 1, null), page("b.test", 2, 0.5)]]);
  assert.equal(report.comparable, 0, "one measurable page is one page");
});

test("credit matching contribution leaves no gap", () => {
  const report = creditGaps([[page("a.test", 1, 0.9), page("b.test", 2, 0.5), page("c.test", 3, 0.1)]]);
  assert.deepEqual(report.overCredited, []);
  assert.deepEqual(report.underCredited, []);
  assert.equal(report.meanGap, 0);
});

test("cited first and barely used is credited above what it contributed", () => {
  const report = creditGaps([[page("loud.test", 1, 0.05), page("b.test", 2, 0.6), page("c.test", 3, 0.9)]]);
  const row = report.overCredited[0];
  assert.equal(row?.host, "loud.test");
  assert.equal(row?.citedAt, 1);
  assert.equal(row?.usedAt, 3);
  assert.equal(row?.gap, 2);
});

test("cited last and leaned on is used without the credit", () => {
  const report = creditGaps([[page("a.test", 1, 0.1), page("b.test", 2, 0.2), page("quiet.test", 3, 0.95)]]);
  const row = report.underCredited[0];
  assert.equal(row?.host, "quiet.test");
  assert.equal(row?.gap, -2);
});

test("a gap of one is noise in a short citation list", () => {
  const report = creditGaps([[page("a.test", 1, 0.5), page("b.test", 2, 0.6)]]);
  assert.deepEqual(report.overCredited, []);
  assert.deepEqual(report.underCredited, []);
  assert.ok(RANK_GAP > 1);
});

test("pages are only ranked against the answer that cited them", () => {
  // Two answers, each internally consistent. Pooling them would invent a gap.
  const report = creditGaps([
    [page("a.test", 1, 0.9), page("b.test", 2, 0.1)],
    [page("c.test", 1, 0.9), page("d.test", 2, 0.1)],
  ]);
  assert.equal(report.comparable, 2);
  assert.deepEqual(report.overCredited, []);
});

test("the widest gap comes first", () => {
  const report = creditGaps([[
    page("worst.test", 1, 0.01), page("mid.test", 2, 0.02), page("c.test", 3, 0.5), page("d.test", 4, 0.9),
  ]]);
  assert.equal(report.overCredited[0]?.host, "worst.test");
  assert.ok((report.overCredited[0]?.gap || 0) >= (report.overCredited[1]?.gap || 0));
});

test("the finding is stated as consistent with, never as evidence of", () => {
  assert.ok(AUTHORITY_FINDING.includes("is not evidence of it"));
  assert.ok(CREDIT_CAVEAT.includes("cannot say why they differ"));
  const empty = creditGaps([]);
  assert.equal(empty.finding, AUTHORITY_FINDING);
  assert.equal(empty.caveat, CREDIT_CAVEAT);
});
