import test from "node:test";
import assert from "node:assert/strict";
import { answerNamesBrand, resolveBrandIdentity, textNamesBrand } from "../src/product/topics/brand-identity.js";

const SCREENER = resolveBrandIdentity({
  brandName: "Screener",
  domain: "screener.in",
  categoryText: "Stock screener / equity fundamental research software. Create a stock screen, run queries.",
});

const NINETHIRTY = resolveBrandIdentity({
  brandName: "Ninethirty",
  domain: "ninethirty.ai",
  categoryText: "Stock screener and backtesting software for US equities",
});

test("a brand named after its own category has no distinctive name left", () => {
  assert.deepEqual(SCREENER.distinctive, []);
  assert.ok(SCREENER.ambiguous.includes("Screener"));
  assert.equal(SCREENER.nameMatchingUnreliable, true);
  assert.ok(SCREENER.caveat?.includes("ordinary word in this category"));
});

test("a brand whose name is not category vocabulary is measured by name as before", () => {
  assert.ok(NINETHIRTY.distinctive.includes("Ninethirty"));
  assert.equal(NINETHIRTY.nameMatchingUnreliable, false);
  assert.equal(NINETHIRTY.caveat, null);
});

test("the category word alone is not counted as naming the ambiguous brand", () => {
  // This is the whole point: "best stock screener" is a category question, not
  // a mention of the product called Screener.
  assert.equal(textNamesBrand("what is the best stock screener for indian stocks", SCREENER), false);
  assert.equal(textNamesBrand("do i need a bloomberg terminal or can a cheap screener do this", SCREENER), false);
});

test("the host still counts, because it stays distinctive when the name does not", () => {
  assert.equal(textNamesBrand("screener.in is great for this", SCREENER), true);
  assert.equal(textNamesBrand("try https://screener.in/company/X", SCREENER), true);
});

test("an unambiguous brand is still matched on its name", () => {
  assert.equal(textNamesBrand("ninethirty is good for backtesting", NINETHIRTY), true);
  assert.equal(textNamesBrand("best stock screener for us equities", NINETHIRTY), false);
});

test("a citation to the site is a mention even when the prose never spells the name", () => {
  const cited = answerNamesBrand(
    { text: "Use a fundamentals tool for this.", citationUrls: ["https://screener.in/company/ITC/"], names: [] },
    SCREENER,
  );
  assert.equal(cited, true);
  const uncited = answerNamesBrand(
    { text: "Use a fundamentals tool for this.", citationUrls: ["https://tickertape.in"], names: [] },
    SCREENER,
  );
  assert.equal(uncited, false);
});

test("with no category known, a name is treated as distinctive rather than assumed ambiguous", () => {
  // Assuming ambiguity would silently switch every project to host-only
  // matching and undercount them all.
  const unknown = resolveBrandIdentity({ brandName: "Screener", domain: "screener.in" });
  assert.equal(unknown.nameMatchingUnreliable, false);
  assert.ok(unknown.distinctive.includes("Screener"));
});

test("the caveat names the undercount direction, because that decides how to read the number", () => {
  assert.ok(SCREENER.caveat?.includes("undercounts rather than overcounts"));
});
