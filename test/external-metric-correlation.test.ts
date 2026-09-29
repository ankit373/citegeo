import assert from "node:assert/strict";
import test from "node:test";
import { correlate } from "../src/product/external-metrics/correlation.js";

function points(values: number[]) {
  return values.map((value, index) => ({ observedAt: new Date(Date.UTC(2026, 0, 1 + index * 7)).toISOString(), value }));
}

test("correlations require enough aligned evidence, never inventing a zero", () => {
  assert.equal(correlate({ left: points([1, 2]), right: points([1, 2]) }).coefficient, null);
});

test("correlations preserve their selected lead or lag and report association only", () => {
  const values = Array.from({ length: 14 }, (_, index) => index + 1);
  const result = correlate({ left: points(values), right: points(values), lagDays: 0, method: "spearman" });
  assert.equal(result.pairedObservations, 14);
  assert.equal(result.lagDays, 0);
  assert.equal(result.coefficient, 1);
});
