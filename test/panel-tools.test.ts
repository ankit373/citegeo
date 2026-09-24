import test from "node:test";
import assert from "node:assert/strict";
import { exportName, filterSummary, matchesQuery, panelCsv } from "../src/ui/app/components/panel-tools.js";

test("every word has to appear, and the order never decides a match", () => {
  assert.equal(matchesQuery("Screener.in", "screener in"), true);
  assert.equal(matchesQuery("Screener.in", "in screener"), true);
  assert.equal(matchesQuery("Screener.in", "screener tickertape"), false);
});

test("an empty query keeps everything rather than hiding it", () => {
  assert.equal(matchesQuery("anything", ""), true);
  assert.equal(matchesQuery("anything", "   "), true);
});

test("matching ignores case on both sides", () => {
  assert.equal(matchesQuery("MONEYCONTROL Pro", "moneycontrol"), true);
  assert.equal(matchesQuery("moneycontrol pro", "PRO"), true);
});

test("a filtered list says what it did, so a short list is never a mystery", () => {
  assert.equal(filterSummary({ shown: 3, hidden: 9 }, "grafana"), "3 of 12");
  assert.equal(filterSummary({ shown: 0, hidden: 12 }, "nothing"), "Nothing here matches nothing");
  assert.equal(filterSummary({ shown: 12, hidden: 0 }, "a"), "All 12 match");
  assert.equal(filterSummary({ shown: 12, hidden: 0 }, ""), "");
});

test("the export carries what was on screen, quoted to the standard", () => {
  const csv = panelCsv(["Brand", "Share"], [["Screener.in", "31%"], ["A, B", 'He said "no"']]);
  assert.equal(csv.startsWith("Brand,Share\r\n"), true);
  assert.ok(csv.includes('"A, B"'));
  assert.ok(csv.includes('"He said ""no"""'));
  assert.equal(csv.endsWith("\r\n"), true);
});

test("an empty panel still exports its header", () => {
  assert.equal(panelCsv(["Brand"], []), "Brand\r\n");
});

test("the file is named after the panel and the day, with nothing to rename", () => {
  assert.equal(exportName("Share of voice", "2026-09-24"), "share-of-voice-2026-09-24.csv");
  assert.equal(exportName("Topics by competitor", "2026-09-24"), "topics-by-competitor-2026-09-24.csv");
  // Punctuation collapses rather than surviving into the file name.
  assert.equal(exportName("Branded / unbranded!", "2026-09-24"), "branded-unbranded-2026-09-24.csv");
  assert.equal(exportName("...", "2026-09-24"), "panel-2026-09-24.csv");
});
