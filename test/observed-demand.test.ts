import test from "node:test";
import assert from "node:assert/strict";
import { demandLines, emptyDemand, fromSearchRows, hasObserved, OBSERVED_KEPT } from "../src/product/topics/observed-demand.js";
import { promptGenerationPrompt } from "../src/product/topics/prompt-generation-protocol.js";
import type { SearchRow } from "../src/product/search-console/search-console-client.js";

function row(query: string, impressions: number): SearchRow {
  return { query, clicks: 0, impressions, ctr: 0, position: 10 };
}

const SUBJECT = {
  brandName: "Tradomate", domain: "tradomate.one",
  businessDescription: "A stock screener for Indian markets.", productCategory: "stock screener",
  competitors: [], topicCount: 5, promptsPerTopic: 6,
};

test("a query that already names the brand says nothing about discovery", () => {
  const demand = fromSearchRows([
    row("tradomate login", 900),
    row("tradomate.one pricing", 500),
    row("best stock screener india", 300),
  ], ["Tradomate", "tradomate.one"]);
  assert.deepEqual(demand.questions.map((q) => q.text), ["best stock screener india"]);
  assert.equal(demand.navigational, 2, "they are counted out, not silently filtered");
  assert.equal(demand.searchQueries, 3);
});

test("the strongest queries come first, because a proposal can only carry so many", () => {
  const demand = fromSearchRows([row("a", 1), row("b", 50), row("c", 20)], [], 2);
  assert.deepEqual(demand.questions.map((q) => q.text), ["b", "c"]);
  assert.equal(demand.questions[0]?.weight, 50);
});

test("nothing observed is an empty set, never an invented one", () => {
  const demand = fromSearchRows([], ["Tradomate"]);
  assert.equal(hasObserved(demand), false);
  assert.equal(demandLines(demand), null);
});

test("a grounded proposal carries what was observed and what that is worth", () => {
  const observed = fromSearchRows([row("best stock screener india", 2300)], ["Tradomate"]);
  const prompt = promptGenerationPrompt({ ...SUBJECT, observed });
  assert.ok(prompt.includes("Ground the proposal in them"));
  assert.ok(prompt.includes("- best stock screener india (2300 search impressions)"));
  assert.ok(prompt.includes("not a measure of how often anyone asks an assistant"), "the limit travels with the evidence");
  assert.ok(!prompt.includes("your own supposition"));
});

test("a proposal with nothing observed is told it is a supposition", () => {
  const prompt = promptGenerationPrompt({ ...SUBJECT, observed: emptyDemand() });
  assert.ok(prompt.includes("your own supposition"));
  assert.ok(prompt.includes("Say so as the first entry in unknowns"));
  assert.ok(!prompt.includes("Observed questions:"));
});

test("no demand passed at all reads the same as none observed", () => {
  assert.ok(promptGenerationPrompt(SUBJECT).includes("your own supposition"));
});

test("the cap is stated rather than left to whoever calls it", () => {
  const rows = Array.from({ length: 200 }, (_, at) => row(`q${at}`, 200 - at));
  assert.equal(fromSearchRows(rows, []).questions.length, OBSERVED_KEPT);
});
