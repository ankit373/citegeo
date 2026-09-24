import test from "node:test";
import assert from "node:assert/strict";
import {
  delta, previousWindow, sliceByWindow, windowFor, withinWindow,
} from "../src/product/topics/period-window.js";

const NOW = new Date("2026-09-24T12:00:00.000Z");

test("a named range becomes a window ending now", () => {
  const window = windowFor("7d", NOW);
  assert.ok(window);
  assert.equal(window.to, "2026-09-24T12:00:00.000Z");
  assert.equal(window.from, "2026-09-17T12:00:00.000Z");
});

test("all has no window, so it has no comparison either", () => {
  assert.equal(windowFor("all", NOW), null);
  assert.equal(windowFor("", NOW), null);
});

test("the earlier window is the same length and never overlaps", () => {
  const window = windowFor("30d", NOW)!;
  const earlier = previousWindow(window);
  assert.equal(earlier.to, window.from);
  assert.equal(earlier.from, "2026-07-26T12:00:00.000Z");
  const span = Date.parse(window.to) - Date.parse(window.from);
  assert.equal(Date.parse(earlier.to) - Date.parse(earlier.from), span);
});

test("the boundary belongs to one window only", () => {
  const window = windowFor("7d", NOW)!;
  // from is inclusive and to is exclusive, so an answer on the seam is counted
  // once rather than in both periods.
  assert.equal(withinWindow(window.from, window), true);
  assert.equal(withinWindow(window.to, window), false);
  assert.equal(withinWindow(window.to, previousWindow(window)), false);
  assert.equal(withinWindow(window.from, previousWindow(window)), false);
});

test("an unparseable date is not silently counted as inside", () => {
  assert.equal(withinWindow("not a date", windowFor("7d", NOW)), false);
});

test("no window keeps every row rather than dropping them all", () => {
  const rows = [{ createdAt: "2020-01-01T00:00:00.000Z" }];
  assert.equal(sliceByWindow(rows, null).length, 1);
});

test("slicing keeps only the rows inside the window", () => {
  const window = windowFor("7d", NOW)!;
  const rows = [
    { createdAt: "2026-09-20T00:00:00.000Z" },
    { createdAt: "2026-09-01T00:00:00.000Z" },
    { createdAt: "2026-09-24T11:59:59.000Z" },
  ];
  assert.equal(sliceByWindow(rows, window).length, 2);
});

test("nothing in the earlier period is an absent comparison, not a rise from nought", () => {
  const result = delta(62, null, 0);
  assert.equal(result.change, null);
  assert.equal(result.reason, "no_earlier_period");
  assert.equal(result.previous, null);
});

test("a measurable pair reports the signed change", () => {
  assert.deepEqual(delta(62, 48, 30), { current: 62, previous: 48, change: 14, reason: "compared" });
  assert.equal(delta(41, 55, 12).change, -14);
});

test("an unmeasurable current figure reports why rather than nought", () => {
  const result = delta(null, 48, 30);
  assert.equal(result.change, null);
  assert.equal(result.reason, "not_measurable");
});
