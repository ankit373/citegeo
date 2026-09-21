import test from "node:test";
import assert from "node:assert/strict";
import { briefMarkdown } from "../src/product/topics/brief-export.js";
import type { PromptBrief } from "../src/product/topics/prompt-brief.js";

function brief(overrides: Partial<PromptBrief> = {}): PromptBrief {
  return {
    promptId: "q1", text: "best stock screener", answers: 7, answersFailed: 2, appearances: 0,
    namedBy: [], missedBy: ["Claude", "GPT"], namesYouElsewhere: [],
    voices: [{
      name: "Screener.in", domain: "screener.in", isTarget: false, answers: 6, positive: 6, negative: 0,
      prominence: 1, quotes: ["best overall for fundamental screening"],
    }],
    yourQuotes: [], sources: [],
    contest: {
      promptId: "q1", text: "best stock screener", answers: 7, named: 31, namedOnce: 15,
      leaderAgreement: 0.86, usualLeader: "Screener.in", youNamed: 0, state: "settled",
      reason: "Screener.in is named first in 86% of answers.",
    },
    demand: null,
    verdict: "No answer here named you.",
    ...overrides,
  };
}

test("the brief carries the verdict, the standing and the quotes, in that order", () => {
  const text = briefMarkdown(brief());
  assert.ok(text.startsWith("# best stock screener"));
  assert.ok(text.indexOf("No answer here named you.") < text.indexOf("## Where this stands"));
  assert.ok(text.indexOf("## Where this stands") < text.indexOf("## What the models credited"));
  assert.ok(text.includes('"best overall for fundamental screening"'));
  assert.ok(text.includes("Screener.in is named first in 86% of answers."));
});

test("an absent corpus is unknown demand, in the file as on the page", () => {
  assert.ok(briefMarkdown(brief()).includes("That is not zero demand."));
  const withDemand = briefMarkdown(brief({
    demand: { promptId: "q1", text: "best stock screener", match: { exactTerms: 4, relatedTerms: 19, examples: [] }, shareOfCorpus: null },
  }));
  assert.ok(withDemand.includes("Asked 4 time(s) in the indexed corpus, 19 loosely."));
});

test("no source says so rather than leaving the section off, which would read as none looked", () => {
  assert.ok(briefMarkdown(brief()).includes("These answers cited no source"));
  assert.ok(briefMarkdown(brief({ sources: ["https://a.test/x"] })).includes("- https://a.test/x"));
});

test("what was said about the brand is carried, including the unkind lines", () => {
  const text = briefMarkdown(brief({
    appearances: 2,
    voices: [{ name: "You", domain: null, isTarget: true, answers: 2, positive: 0, negative: 2, prominence: 0.2, quotes: ["thin data, would not rely on it"] }],
  }));
  assert.ok(text.includes("## What they said about you"));
  assert.ok(text.includes('"thin data, would not rely on it"'));
});

test("it states observations and never an instruction", () => {
  const text = briefMarkdown(brief()).toLocaleLowerCase();
  for (const word of ["you should", "we recommend", "consider writing", "make sure"]) {
    assert.equal(text.includes(word), false, word);
  }
});
