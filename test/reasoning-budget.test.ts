import test from "node:test";
import assert from "node:assert/strict";
import { BUDGET_GROWTH } from "../src/providers/responses-compatible.js";

test("a model that reasons gets a budget several times the one that suits a model that does not", () => {
  // Measured live on one question with web search on:
  //   gpt-5-mini at 2000  ->  incomplete, reason max_output_tokens,
  //                           1536 of 1920 output tokens spent reasoning
  //   gpt-5-mini at 8000  ->  completed, 2700 characters
  //   gpt-4o     at 2000  ->  completed, 0 reasoning tokens
  assert.ok(BUDGET_GROWTH >= 3, "two thousand to four thousand did not clear it either");
  assert.equal(2000 * BUDGET_GROWTH, 8000);
});
