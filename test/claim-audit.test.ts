import test from "node:test";
import assert from "node:assert/strict";
import { buildClaimAudit, meaningfulWords } from "../src/product/insights/claim-audit.js";
import type { AnswerClaims } from "../src/product/insights/claim-audit.js";

function claims(overrides: Partial<AnswerClaims> = {}): AnswerClaims {
  return { modelId: "a", displayName: "A", values: {}, sourcedFields: [], ...overrides };
}

test("models describing the brand differently are reported as a disagreement", () => {
  const audit = buildClaimAudit({
    answers: [
      claims({ modelId: "a", values: { productCategory: "Stock screener" } }),
      claims({ modelId: "b", values: { productCategory: "Crypto exchange" } }),
      claims({ modelId: "c", values: { productCategory: "stock screener" } }),
    ],
  });
  const row = audit.disagreements.find((item) => item.field === "productCategory");
  assert.equal(row?.variants.length, 2);
  assert.deepEqual(row?.variants[0]?.models, ["a", "c"], "the majority reading sorts first");
});

test("agreement across models produces no disagreement", () => {
  const audit = buildClaimAudit({
    answers: [
      claims({ modelId: "a", values: { productCategory: "Stock screener" } }),
      claims({ modelId: "b", values: { productCategory: "STOCK SCREENER" } }),
    ],
  });
  assert.deepEqual(audit.disagreements, []);
});

test("an assertion with no citation behind it is named", () => {
  const audit = buildClaimAudit({
    answers: [
      claims({ modelId: "a", values: { businessDescription: "Runs payroll" }, sourcedFields: [] }),
      claims({ modelId: "b", values: { businessDescription: "Runs payroll" }, sourcedFields: ["businessDescription"] }),
    ],
  });
  const row = audit.unsourced.find((item) => item.field === "businessDescription");
  assert.deepEqual(row?.models, ["a"]);
  assert.equal(row?.count, 1);
});

test("an assertion sharing no meaningful word with the declared category is flagged", () => {
  const audit = buildClaimAudit({
    answers: [claims({ values: { productCategory: "Crypto exchange" } })],
    declared: { productCategory: "Equity research screener" },
  });
  assert.equal(audit.mismatches.length, 1);
  assert.equal(audit.mismatches[0]?.asserted, "Crypto exchange");
});

test("a paraphrase of the declared value is not flagged", () => {
  const audit = buildClaimAudit({
    answers: [claims({ values: { productCategory: "Screener for Indian equities" } })],
    declared: { productCategory: "Equity research screener" },
  });
  assert.deepEqual(audit.mismatches, [], "partial overlap is normal paraphrase, not an error");
});

test("filler words alone never count as agreement", () => {
  const audit = buildClaimAudit({
    answers: [claims({ values: { productCategory: "A platform for tools" } })],
    declared: { productCategory: "Equity screener" },
  });
  assert.equal(audit.mismatches.length, 1, "platform, tool and for are stop words");
});

test("stop words and short tokens are dropped from comparison", () => {
  const words = meaningfulWords("The best platform for an AI tool");
  assert.equal(words.has("the"), false);
  assert.equal(words.has("platform"), false);
  assert.equal(words.has("best"), true);
});

test("punctuation does not fuse two words together", () => {
  const words = meaningfulWords("screener/backtesting, charting");
  assert.equal(words.has("screener"), true);
  assert.equal(words.has("backtesting"), true);
  assert.equal(words.has("charting"), true);
});

test("an empty field is ignored rather than counted as an assertion", () => {
  const audit = buildClaimAudit({
    answers: [claims({ values: { productCategory: "   " } }), claims({ values: { productCategory: null } })],
  });
  assert.deepEqual(audit.disagreements, []);
  assert.deepEqual(audit.unsourced, []);
});

test("the same wrong assertion from two models is reported once with both named", () => {
  const audit = buildClaimAudit({
    answers: [
      claims({ modelId: "a", values: { productCategory: "Crypto exchange" } }),
      claims({ modelId: "b", values: { productCategory: "Crypto exchange" } }),
    ],
    declared: { productCategory: "Equity screener" },
  });
  assert.equal(audit.mismatches.length, 1);
  assert.deepEqual(audit.mismatches[0]?.models, ["a", "b"]);
});
