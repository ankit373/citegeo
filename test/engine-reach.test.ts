import test from "node:test";
import assert from "node:assert/strict";
import { REACH_CAVEAT, verdictFor } from "../src/product/engines/engine-reach.js";

function look(over: Partial<{ url: string; host: string; length: number; composer: number; signIn: string[] }> = {}) {
  return { url: "https://a.test/", host: "a.test", length: 3000, composer: 1, signIn: [], ...over };
}

test("a page with somewhere to type is drivable, and says that is not an answer", () => {
  const verdict = verdictFor("https://a.test/", look());
  assert.equal(verdict.reach, "drivable");
  assert.ok(verdict.detail.includes("only known once one is asked"));
});

test("being sent to another host is a block, whatever the notice says", () => {
  // The region notice is in the surface's own language, which cannot be read
  // from a word list. Being moved somewhere else can.
  const verdict = verdictFor("https://www.doubao.com/chat/", look({ host: "www.doubao.com", url: "https://www.doubao.com/security/region", length: 41, composer: 0 }));
  assert.equal(verdict.reach, "unreachable", "same host, so it is not a block by this rule");
  const moved = verdictFor("https://www.doubao.com/chat/", look({ host: "elsewhere.test", url: "https://elsewhere.test/notice" }));
  assert.equal(moved.reach, "blocked");
  assert.ok(moved.detail.includes("elsewhere.test"));
});

test("a short page asking to sign in is a wall, not an empty surface", () => {
  const verdict = verdictFor("https://a.test/", look({ length: 120, signIn: ["log in", "sign up"], composer: 1 }));
  assert.equal(verdict.reach, "sign_in");
  assert.ok(verdict.detail.includes("log in"));
});

test("a long page mentioning signing in is not a wall", () => {
  // An answer with a sign-in banner beside it is still an answer.
  const verdict = verdictFor("https://a.test/", look({ length: 9000, signIn: ["sign in"] }));
  assert.equal(verdict.reach, "drivable");
});

test("a page that rendered nothing is unreachable", () => {
  assert.equal(verdictFor("https://a.test/", look({ length: 0 })).reach, "unreachable");
});

test("a page with nothing to type into cannot be driven", () => {
  const verdict = verdictFor("https://a.test/", look({ composer: 0 }));
  assert.equal(verdict.reach, "unreachable");
  assert.ok(verdict.detail.includes("nothing on it to type"));
});

test("a sign-in wall in another language is still caught", () => {
  const verdict = verdictFor("https://a.test/", look({ length: 300, signIn: ["登录"], composer: 2 }));
  assert.equal(verdict.reach, "sign_in");
});

test("the caveat refuses to promise an answer", () => {
  assert.ok(REACH_CAVEAT.includes("not that an answer will come back"));
});
