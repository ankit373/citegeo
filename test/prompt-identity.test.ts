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
  assert.equal(domainLabel("www.blue-chip.co.uk"), "blue chip");
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

test("a brand whose domain suffix is an ordinary word does not match that word", () => {
  // tradomate.one reduced to the label "one", so every prompt containing the
  // word "one" read as naming the brand. Two real prompts were mislabelled.
  assert.equal(domainLabel("tradomate.one"), "tradomate");
  assert.equal(namesIdentity("screen stocks in one place", ["tradomate.one"]), false);
  assert.equal(namesIdentity("chartink vs screener.in which one is better", ["tradomate.one"]), false);
  assert.equal(namesIdentity("is tradomate good for equities", ["tradomate.one"]), true);
});

test("a suffix is stripped only from the end, so a hyphenated label survives", () => {
  assert.equal(domainLabel("www.blue-chip.co.uk"), "blue chip");
  assert.equal(domainLabel("a.b.example.com"), "example");
  assert.equal(domainLabel("chartink.com"), "chartink");
});

test("a host that is nothing but a suffix still yields something rather than nothing", () => {
  assert.equal(domainLabel("com"), "com");
  assert.equal(domainLabel(""), "");
});
