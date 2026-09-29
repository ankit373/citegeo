import test from "node:test";
import assert from "node:assert/strict";
import { corroborateMentions, summariseCorroboration, CORROBORATION_CAVEAT } from "../src/product/topics/mention-corroboration.js";
import type { AnswerMention } from "../src/product/topics/prompt-run-schema.js";

function mention(name: string, over: Partial<AnswerMention> = {}): AnswerMention {
  return {
    name, domain: null, recommendation: "positive", mentionQuote: null,
    firstMentionOffset: 0, firstMentionState: "unique", isTarget: false, ...over,
  };
}

const ANSWER = "Screener.in is strongest on fundamentals. Chartink wins on technical scans.";

test("a position is recounted from the answer, not taken from the model", () => {
  const rows = corroborateMentions({
    answer: ANSWER,
    // The model claims Chartink came first. The answer says otherwise.
    mentions: [mention("Chartink", { firstMentionOffset: 0 }), mention("Screener.in", { firstMentionOffset: 40 })],
  });
  const chartink = rows.find((row) => row.name === "Chartink");
  const screener = rows.find((row) => row.name === "Screener.in");
  assert.ok((screener?.firstMentionOffset || 0) < (chartink?.firstMentionOffset || 0), "the text decides the order");
  assert.equal(screener?.corroboration, "measured");
});

test("a name the answer never uses is reported as absent, not ranked", () => {
  const rows = corroborateMentions({
    answer: ANSWER,
    mentions: [mention("Tickertape", { firstMentionOffset: 5, firstMentionState: "unique" })],
  });
  assert.equal(rows[0]?.corroboration, "absent_from_answer");
  assert.equal(rows[0]?.firstMentionOffset, null, "keeping the position would rank a mention that is not there");
  assert.equal(rows[0]?.firstMentionState, "none");
});

test("names are matched on whole tokens, so Ten is not named by often", () => {
  const rows = corroborateMentions({ answer: "Often overlooked.", mentions: [mention("Ten")] });
  assert.equal(rows[0]?.corroboration, "absent_from_answer");
});

test("a quote is checked against the answer rather than trusted", () => {
  const rows = corroborateMentions({
    answer: ANSWER,
    mentions: [
      mention("Screener.in", { mentionQuote: "strongest on fundamentals" }),
      mention("Chartink", { mentionQuote: "the clear winner overall" }),
    ],
  });
  assert.equal(rows.find((row) => row.name === "Screener.in")?.quoteInAnswer, true);
  assert.equal(rows.find((row) => row.name === "Chartink")?.quoteInAnswer, false, "the model quoted itself saying something it never said");
});

test("two names at the same place are tied rather than ordered", () => {
  const rows = corroborateMentions({
    answer: "Alpha and Alpha again.",
    mentions: [mention("Alpha"), mention("Alpha")],
  });
  assert.equal(rows[0]?.firstMentionState, "tied");
  assert.equal(rows[0]?.corroboration, "named_only");
});

test("the summary counts what was checked and what could not be", () => {
  const rows = corroborateMentions({
    answer: ANSWER,
    mentions: [
      mention("Screener.in", { mentionQuote: "strongest on fundamentals" }),
      mention("Tickertape", { mentionQuote: "a great pick" }),
    ],
  });
  const summary = summariseCorroboration(rows);
  assert.equal(summary.reported, 2);
  assert.equal(summary.measured, 1);
  assert.equal(summary.absentFromAnswer, 1);
  assert.equal(summary.quotesChecked, 2);
  assert.equal(summary.quotesFound, 1);
});

test("the caveat separates the two paths rather than claiming one for both", () => {
  assert.ok(CORROBORATION_CAVEAT.includes("stays the model's own word"));
  assert.ok(CORROBORATION_CAVEAT.includes("not independent of the writing"), "true where a provider answered");
  assert.ok(CORROBORATION_CAVEAT.includes("read off a browser surface"), "and not true where a browser surface did");
  assert.equal(summariseCorroboration([]).caveat, CORROBORATION_CAVEAT);
});
