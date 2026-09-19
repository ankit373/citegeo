import test from "node:test";
import assert from "node:assert/strict";
import { parseJudgement, summariseNarrative } from "../src/product/insights/narrative.js";
import type { NarrativeJudgement } from "../src/product/insights/narrative.js";

function judgement(overrides: Partial<NarrativeJudgement> = {}): NarrativeJudgement {
  return { modelRunId: "r", modelId: "m", sentiment: "neutral", themes: [], raw: "{}", ...overrides };
}

test("a well formed reply is read", () => {
  const parsed = parseJudgement('{"sentiment":"positive","themes":["fast screening","indian equities"]}');
  assert.equal(parsed.sentiment, "positive");
  assert.deepEqual(parsed.themes, ["fast screening", "indian equities"]);
});

test("a sentiment outside the allowed set becomes unknown rather than a nearest guess", () => {
  assert.equal(parseJudgement('{"sentiment":"mixed","themes":[]}').sentiment, "unknown");
  assert.equal(parseJudgement('{"sentiment":"POSITIVE!","themes":[]}').sentiment, "unknown");
});

test("casing and padding are tolerated because they are not a different answer", () => {
  assert.equal(parseJudgement('{"sentiment":" Positive ","themes":[]}').sentiment, "positive");
});

test("a reply that is not JSON is unknown, not neutral", () => {
  assert.equal(parseJudgement("The brand seems well regarded.").sentiment, "unknown");
  assert.equal(parseJudgement("").sentiment, "unknown");
});

test("a theme long enough to be prose is dropped", () => {
  const parsed = parseJudgement(JSON.stringify({
    sentiment: "neutral",
    themes: ["short phrase", "x".repeat(200)],
  }));
  assert.deepEqual(parsed.themes, ["short phrase"]);
});

test("non-string themes are ignored rather than coerced", () => {
  const parsed = parseJudgement('{"sentiment":"neutral","themes":["ok",42,null,{"a":1}]}');
  assert.deepEqual(parsed.themes, ["ok"]);
});

test("a repeated theme in one reply is counted once", () => {
  const parsed = parseJudgement('{"sentiment":"neutral","themes":["screener","screener"]}');
  assert.deepEqual(parsed.themes, ["screener"]);
});

test("the dominant reading is the clear majority", () => {
  const summary = summariseNarrative([
    judgement({ sentiment: "positive" }),
    judgement({ sentiment: "positive" }),
    judgement({ sentiment: "negative" }),
  ]);
  assert.equal(summary.dominant, "positive");
  assert.equal(summary.counts.positive, 2);
});

test("a tie has no dominant reading rather than an invented majority", () => {
  const summary = summariseNarrative([
    judgement({ sentiment: "positive" }),
    judgement({ sentiment: "negative" }),
  ]);
  assert.equal(summary.dominant, null);
});

test("unknowns never become the dominant reading", () => {
  const summary = summariseNarrative([
    judgement({ sentiment: "unknown" }),
    judgement({ sentiment: "unknown" }),
    judgement({ sentiment: "neutral" }),
  ]);
  assert.equal(summary.dominant, "neutral");
  assert.equal(summary.counts.unknown, 2);
});

test("nothing judged leaves the dominant reading null, not neutral", () => {
  const summary = summariseNarrative([]);
  assert.equal(summary.dominant, null);
  assert.equal(summary.judged, 0);
});

test("themes are counted across answers, case folded", () => {
  const summary = summariseNarrative([
    judgement({ themes: ["Stock Screener"] }),
    judgement({ themes: ["stock screener", "charting"] }),
  ]);
  assert.equal(summary.themes[0]?.theme, "stock screener");
  assert.equal(summary.themes[0]?.count, 2);
});
