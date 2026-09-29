import test from "node:test";
import assert from "node:assert/strict";
import { activationOf, splitActivation } from "../src/product/topics/search-activation.js";
import { decomposeCitations } from "../src/product/topics/citation-decomposition.js";
import type { BrandIdentity } from "../src/product/topics/brand-identity.js";
import type { AnswerSourceId } from "../src/product/configuration/provider-id.js";
import type { PromptAnswer } from "../src/product/topics/prompt-run-schema.js";

const IDENTITY: BrandIdentity = {
  distinctive: ["tradomate"], ambiguous: [], host: "tradomate.one",
  nameMatchingUnreliable: false, caveat: null,
};

function answer(providerId: AnswerSourceId, citationUrls: string[], status: PromptAnswer["status"] = "completed"): PromptAnswer {
  return {
    id: String(Math.random()), projectId: "p", runId: "r", promptId: "q", topicId: "t",
    promptText: "best screener", intent: "discovery", providerId, modelId: "m",
    modelDisplayName: "M", regionId: "global", languageId: "en", status, text: "",
    mentions: [], citationUrls, errorCode: null, errorMessage: null, latencyMs: 1, createdAt: "",
  };
}

test("an answer carrying a source searched, whatever the provider can do", () => {
  assert.equal(activationOf(answer("deepseek", ["https://a.test/x"])), "activated");
  assert.equal(activationOf(answer("openai", ["https://a.test/x"])), "activated");
});

test("a surface with no web search could not have searched, so no source is not a miss", () => {
  assert.equal(activationOf(answer("deepseek", [])), "unavailable");
});

test("a surface that always grounds searched even where it cited nobody", () => {
  assert.equal(activationOf(answer("perplexity", [])), "activated");
});

test("a surface that could have searched and cited nothing is unknown, never a zero", () => {
  assert.equal(activationOf(answer("openai", [])), "unknown", "no search and a search that found nothing look identical from here");
  assert.equal(activationOf(answer("browser", [])), "unknown");
});

test("an answer that never completed says nothing about searching", () => {
  assert.equal(activationOf(answer("openai", [], "provider_failed")), "unknown");
});

test("a rate is only given where every answer's activation is known", () => {
  const known = splitActivation([answer("perplexity", []), answer("deepseek", [])]);
  assert.equal(known.rate, 0.5);
  assert.equal(known.low, 0.5);
  assert.equal(known.high, 0.5);

  const mixed = splitActivation([answer("perplexity", []), answer("openai", [])]);
  assert.equal(mixed.rate, null, "half the population is unknown, so there is no rate to give");
  assert.equal(mixed.low, 0.5);
  assert.equal(mixed.high, 1);
});

test("nothing answered is no activation rate rather than a rate of zero", () => {
  const empty = splitActivation([]);
  assert.equal(empty.considered, 0);
  assert.equal(empty.rate, null);
  assert.equal(empty.low, null);
  assert.equal(empty.high, null);
});

test("the share among answers that searched is kept apart from the share of all answers", () => {
  const report = decomposeCitations({
    answers: [
      answer("perplexity", ["https://tradomate.one/a"]),
      answer("perplexity", ["https://rival.test/b"]),
      answer("deepseek", []),
      answer("deepseek", []),
    ],
    identity: IDENTITY,
  });
  assert.equal(report.activated, 2);
  assert.equal(report.citedYou, 1);
  assert.equal(report.citedGivenActivated, 0.5, "half the answers that searched cited you");
  assert.equal(report.activation.rate, 0.5);
  assert.equal(report.overall, 0.25, "half of half, because half the answers never searched at all");
});

test("an unknown activation makes the overall share a band, not a number", () => {
  const report = decomposeCitations({
    answers: [
      answer("perplexity", ["https://tradomate.one/a"]),
      answer("openai", []),
    ],
    identity: IDENTITY,
  });
  assert.equal(report.citedGivenActivated, 1);
  assert.equal(report.overall, null, "one factor is unknown, so the product is unknown");
  assert.equal(report.overallLow, 0.5);
  assert.equal(report.overallHigh, 1);
});

test("www and the bare host are the same domain when deciding you were cited", () => {
  const report = decomposeCitations({
    answers: [answer("perplexity", ["https://www.tradomate.one/a"])],
    identity: IDENTITY,
  });
  assert.equal(report.citedYou, 1);
});

test("nothing activated is no conditional share rather than a share of zero", () => {
  const report = decomposeCitations({ answers: [answer("deepseek", [])], identity: IDENTITY });
  assert.equal(report.activated, 0);
  assert.equal(report.citedGivenActivated, null);
  assert.equal(report.overall, null);
});

test("both judgements travel with the figures", () => {
  const report = decomposeCitations({ answers: [], identity: IDENTITY });
  assert.ok(report.caveat.includes("is not a share of all answers"));
  assert.ok(report.activation.caveat.includes("No provider reports whether it searched"));
});
