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

test("an answer carrying no source cited nobody, so the share of all answers is exact", () => {
  const report = decomposeCitations({
    answers: [
      answer("perplexity", ["https://tradomate.one/a"]),
      answer("openai", []),
    ],
    identity: IDENTITY,
  });
  assert.equal(report.activation.unknown, 1, "the openai answer could have searched and did not cite");
  assert.equal(report.overall, 0.5, "one of two answers cited you, and no unknown can change that count");
});

test("an unknown activation makes the conditional a band, because its denominator moves", () => {
  const report = decomposeCitations({
    answers: [
      answer("perplexity", ["https://tradomate.one/a"]),
      answer("openai", []),
    ],
    identity: IDENTITY,
  });
  assert.equal(report.citedGivenActivated, null, "which answers searched is not knowable, so the share among them is not either");
  assert.equal(report.citedGivenActivatedLow, 0.5, "if the openai answer searched, one of two searching answers cited you");
  assert.equal(report.citedGivenActivatedHigh, 1, "if it did not, one of one did");
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
  assert.equal(report.citedGivenActivatedLow, null);
  assert.equal(report.citedGivenActivatedHigh, null);
  assert.equal(report.overall, 0, "one answer was asked and did not cite you, which is a measured nought");
});

test("nothing answered at all is no share rather than a share of zero", () => {
  const report = decomposeCitations({ answers: [], identity: IDENTITY });
  assert.equal(report.overall, null);
  assert.equal(report.citedGivenActivatedLow, null);
});

test("both judgements travel with the figures", () => {
  const report = decomposeCitations({ answers: [], identity: IDENTITY });
  assert.ok(report.caveat.includes("is not a share of all answers"));
  assert.ok(report.caveat.includes("The share of all answers is exact"));
  assert.ok(report.activation.caveat.includes("Most providers report whether they ran a search"));
});

function searched(providerId: AnswerSourceId, said: PromptAnswer["search"], citationUrls: string[] = []): PromptAnswer {
  return { ...answer(providerId, citationUrls), ...(said ? { search: said } : {}) };
}

test("the provider's own account of searching is taken over the guess", () => {
  const ran = searched("openai", { requested: true, used: true, usedMode: "provider_native", queries: ["best screener india"] });
  assert.equal(activationOf(ran), "activated", "it says it searched and cited nobody, which the old guess called unknown");
});

test("a run that never asked for search is a measured nought, not an unknown", () => {
  const never = searched("openai", { requested: false, used: false, usedMode: "none", queries: [] });
  assert.equal(activationOf(never), "not_requested");
  const split = splitActivation([never]);
  assert.equal(split.notRequested, 1);
  assert.equal(split.unknown, 0);
  assert.equal(split.rate, 0, "nothing is unknown any more, so there is a rate");
});

test("a surface that cannot search says so even when the run asked", () => {
  const cannot = searched("deepseek", { requested: false, used: false, usedMode: "none", queries: [] });
  assert.equal(activationOf(cannot), "unavailable", "could not is not the same as was not asked");
});

test("asked and never confirmed stays unknown, because that is what it is", () => {
  const murky = searched("openai", { requested: true, used: false, usedMode: "requested_not_confirmed", queries: [] });
  assert.equal(activationOf(murky), "unknown");
});

test("an answer archived before the account was kept falls back to the guess", () => {
  assert.equal(activationOf(answer("openai", [])), "unknown");
  assert.equal(activationOf(answer("openai", ["https://a.test/x"])), "activated");
});

test("the recorded account narrows the band the guess left wide", () => {
  const rows = [
    searched("openai", { requested: true, used: true, usedMode: "provider_native", queries: ["a"] }, ["https://tradomate.one/a"]),
    searched("openai", { requested: false, used: false, usedMode: "none", queries: [] }),
    searched("openai", { requested: true, used: true, usedMode: "provider_native", queries: ["b"] }),
  ];
  const split = splitActivation(rows);
  assert.equal(split.rate, 2 / 3, "guessed from citations alone this was a band from one third to one");
  assert.equal(split.low, split.high);
  const report = decomposeCitations({ answers: rows, identity: IDENTITY });
  assert.equal(report.citedGivenActivated, 0.5, "and the conditional is a number rather than a band");
});

test("the caveat says the provider's account is preferred to the guess", () => {
  assert.ok(splitActivation([]).caveat.includes("its own account is taken over any inference"));
});
