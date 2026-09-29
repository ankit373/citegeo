import test from "node:test";
import assert from "node:assert/strict";
import { checkAttempt, delayFor, recordFailure, recordSuccess, resetThrottle } from "../src/product/auth/login-throttle.js";
import { markStateUsed, resetUsedStates, stateWasUsed } from "../src/product/auth/oauth-state.js";

test("a few wrong tries cost nothing, because people mistype", () => {
  resetThrottle();
  for (let i = 1; i <= 5; i += 1) assert.equal(delayFor(i), 0, `attempt ${i} should be free`);
  assert.equal(delayFor(6), 1000);
  assert.equal(delayFor(7), 2000);
  assert.equal(delayFor(8), 4000);
});

test("the delay has a ceiling, so a lockout is never permanent", () => {
  assert.equal(delayFor(100), 5 * 60 * 1000);
});

test("guessing is slowed, and the caller is told how long to wait", () => {
  resetThrottle();
  const now = 1_000_000;
  for (let i = 0; i < 6; i += 1) recordFailure("here", now);
  const verdict = checkAttempt("here", now);
  assert.equal(verdict.allowed, false);
  assert.ok(verdict.retryAfterSeconds > 0);
  // Once the wait has passed the next try is allowed rather than refused again.
  assert.equal(checkAttempt("here", now + 2000).allowed, true);
});

test("the right password clears the doubt immediately", () => {
  resetThrottle();
  const now = 2_000_000;
  for (let i = 0; i < 8; i += 1) recordFailure("here", now);
  assert.equal(checkAttempt("here", now).allowed, false);
  recordSuccess("here");
  assert.equal(checkAttempt("here", now).allowed, true);
});

test("a quiet evening is forgotten, so yesterday does not lock out today", () => {
  resetThrottle();
  const now = 3_000_000;
  for (let i = 0; i < 8; i += 1) recordFailure("here", now);
  assert.equal(checkAttempt("here", now + 16 * 60 * 1000).allowed, true);
});

test("a state cannot be spent twice", () => {
  resetUsedStates();
  const now = 4_000_000;
  assert.equal(stateWasUsed("abc", now), false);
  markStateUsed("abc", now);
  // The callback url sits in browser history. Replaying it must do nothing.
  assert.equal(stateWasUsed("abc", now), true);
  assert.equal(stateWasUsed("other", now), false);
});

test("a remembered state is forgotten only after it could no longer be valid", () => {
  resetUsedStates();
  const now = 5_000_000;
  markStateUsed("abc", now);
  assert.equal(stateWasUsed("abc", now + 29 * 60 * 1000), true);
  assert.equal(stateWasUsed("abc", now + 31 * 60 * 1000), false);
});
