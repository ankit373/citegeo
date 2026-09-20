import test from "node:test";
import assert from "node:assert/strict";
import { domainLabel, namesIdentity, tokenize } from "../src/product/topics/prompt-identity.js";

test("a brand name inside a longer word is not a mention of the brand", () => {
  // The keyword check this replaces used substring containment, so a brand
  // called Ten was "named" by every prompt containing the word often.
  assert.equal(namesIdentity("how do i often screen for breakouts", ["Ten"]), false);
  assert.equal(namesIdentity("is ten any good for options", ["Ten"]), true);
});

test("a multi-word brand is matched as a phrase, not as loose words", () => {
  assert.equal(namesIdentity("best blue chip screener", ["Blue Chip Analytics"]), false);
  assert.equal(namesIdentity("is blue chip analytics worth it", ["Blue Chip Analytics"]), true);
});

test("a domain matches on its distinguishing label, with or without the suffix", () => {
  assert.equal(domainLabel("screener.in"), "screener");
  assert.equal(domainLabel("www.blue-chip.co.uk"), "chip");
  assert.equal(namesIdentity("alternatives to screener", ["screener.in"]), true);
  assert.equal(namesIdentity("alternatives to screener.in", ["screener.in"]), true);
});

test("punctuation and case do not hide a mention", () => {
  assert.equal(namesIdentity("Tradomate's pricing?", ["tradomate"]), true);
  assert.equal(tokenize("Tradomate's pricing?").join(","), "tradomate,s,pricing");
});

test("an empty identity never matches everything", () => {
  assert.equal(namesIdentity("best stock screener", ["", "   "]), false);
});
