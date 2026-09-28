import test from "node:test";
import assert from "node:assert/strict";
import { DECAY_DAYS, ageOf, freshnessOf, freshnessReport, statedDate } from "../src/product/citations/freshness.js";

const NOW = new Date("2026-09-29T00:00:00.000Z");

function page(html: string) {
  return ageOf({ url: "https://e.com/a", host: "e.com", html, now: NOW });
}

test("a date the page states about itself is read, newest source first", () => {
  assert.equal(statedDate('{"datePublished":"2026-09-01T00:00:00Z"}').source, "json_ld");
  assert.equal(statedDate('<meta property="article:published_time" content="2026-09-01T00:00:00Z">').source, "meta");
  assert.equal(statedDate('<time datetime="2026-09-01T00:00:00Z">Sept</time>').source, "time_element");
});

test("a page stating no date is undated, which is not the same as new", () => {
  const row = page("<html><body>No date anywhere.</body></html>");
  assert.equal(row.statedAt, null);
  assert.equal(row.ageDays, null);
  assert.equal(row.freshness, "undated", "calling it fresh would invent a date it never gave");
  assert.equal(row.source, null);
});

test("age is counted in days from the date the page gave", () => {
  assert.equal(page('{"datePublished":"2026-09-19T00:00:00Z"}').ageDays, 10);
  assert.equal(page('{"datePublished":"2025-09-29T00:00:00Z"}').ageDays, 365);
});

test("ninety days is where a page starts losing retrieval priority", () => {
  assert.equal(freshnessOf(0), "fresh");
  assert.equal(freshnessOf(DECAY_DAYS), "fresh");
  assert.equal(freshnessOf(DECAY_DAYS + 1), "ageing");
  assert.equal(freshnessOf(365), "ageing");
  assert.equal(freshnessOf(366), "stale");
  assert.equal(freshnessOf(null), "undated");
});

test("a date that cannot be parsed is no date at all", () => {
  assert.equal(page('{"datePublished":"last Tuesday"}').freshness, "undated");
  assert.equal(page('{"datePublished":""}').freshness, "undated");
});

test("a date before the web or in the future is a parse gone wrong", () => {
  assert.equal(page('{"datePublished":"1970-01-01T00:00:00Z"}').freshness, "undated");
  assert.equal(page('{"datePublished":"2030-01-01T00:00:00Z"}').freshness, "undated", "a page is not minus days old");
});

test("a report counts each state and never averages over nothing", () => {
  const report = freshnessReport([
    page('{"datePublished":"2026-09-19T00:00:00Z"}'),
    page('{"datePublished":"2026-01-01T00:00:00Z"}'),
    page("<html>nothing</html>"),
  ]);
  assert.equal(report.fresh, 1);
  assert.equal(report.ageing, 1);
  assert.equal(report.undated, 1);
  assert.equal(report.medianAgeDays, 271, "the undated page is not counted as zero days old");
  assert.equal(freshnessReport([page("<html>nothing</html>")]).medianAgeDays, null);
});

test("the oldest page sorts first, because that is the one at risk", () => {
  const report = freshnessReport([
    page('{"datePublished":"2026-09-19T00:00:00Z"}'),
    page('{"datePublished":"2024-01-01T00:00:00Z"}'),
  ]);
  assert.equal(report.pages[0]?.ageDays, 1002);
});

test("the ninety day mark travels with the figures as a judgement", () => {
  assert.ok(freshnessReport([]).caveat.includes("judgement, not a measurement"));
  assert.ok(freshnessReport([]).caveat.includes("undated, not new"));
});
