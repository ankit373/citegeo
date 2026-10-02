import test from "node:test";
import assert from "node:assert/strict";
import { buildDecoyReport, DECOY_CAVEAT, DECOY_SOURCE, isDecoy } from "../src/product/topics/decoy-check.js";
import type { Competitor } from "../src/product/topics/competitor-set.js";
import type { AnswerMention, PromptAnswer } from "../src/product/topics/prompt-run-schema.js";

function decoy(name: string): Competitor {
  return { id: "d-" + name, name, domain: null, source: DECOY_SOURCE, tracked: true, addedAt: "" };
}

function rival(name: string): Competitor {
  return { id: "r-" + name, name, domain: null, source: "declared", tracked: true, addedAt: "" };
}

function mention(name: string, isTarget = false): AnswerMention {
  return { name, domain: null, recommendation: "mentioned", mentionQuote: null, firstMentionOffset: 0, firstMentionState: "unique", isTarget };
}

function answer(over: Partial<PromptAnswer> = {}): PromptAnswer {
  return {
    id: String(Math.random()), projectId: "p", runId: "r", promptId: "q", topicId: "t",
    promptText: "best screener", intent: "discovery", providerId: "openai", modelId: "gpt-4o",
    modelDisplayName: "M", regionId: "global", languageId: "en", status: "completed", text: "",
    mentions: [], citationUrls: [], errorCode: null, errorMessage: null, latencyMs: 1, createdAt: "",
    ...over,
  };
}

function answers(count: number, build: (index: number) => Partial<PromptAnswer> = () => ({})): PromptAnswer[] {
  return Array.from({ length: count }, (_, index) => answer(build(index)));
}

test("a decoy is told apart from a rival", () => {
  assert.equal(isDecoy(decoy("Nonesuch")), true);
  assert.equal(isDecoy(rival("Tickertape")), false);
});

test("with no decoy carried there is no floor, which is not a floor of nought", () => {
  const report = buildDecoyReport({ answers: answers(10), competitors: [rival("Tickertape")] });
  assert.equal(report.noiseFloor, null);
  assert.equal(report.clearsFloor, null, "nothing was measured, so nothing passed");
});

test("a decoy that never appeared still sets a floor, because few answers prove little", () => {
  // Nought of fifteen is not a rate of nought. It is consistent with a fifth,
  // and a brand under that has not been told apart from a name nobody wrote.
  const report = buildDecoyReport({ answers: answers(15), competitors: [decoy("Nonesuch")] });
  assert.equal(report.decoys[0]?.namedIn, 0);
  assert.equal(report.decoys[0]?.share, 0);
  assert.ok((report.noiseFloor || 0) > 0.15, `a floor of ${report.noiseFloor} should not be nought`);
});

test("more answers lower the floor, because the nought means more", () => {
  const few = buildDecoyReport({ answers: answers(15), competitors: [decoy("Nonesuch")] });
  const many = buildDecoyReport({ answers: answers(400), competitors: [decoy("Nonesuch")] });
  assert.ok((many.noiseFloor || 1) < (few.noiseFloor || 1));
});

test("a brand under the floor has not been told apart from a name that should not be there", () => {
  const report = buildDecoyReport({
    answers: answers(15, (index) => (index < 2 ? { mentions: [mention("Tradomate", true)] } : {})),
    competitors: [decoy("Nonesuch")],
  });
  assert.equal(report.presenceRate, 2 / 15);
  assert.equal(report.clearsFloor, false, "13% against a floor near 20% is not a finding");
});

test("a brand well above the floor clears it", () => {
  const report = buildDecoyReport({
    answers: answers(40, (index) => (index < 34 ? { mentions: [mention("Tradomate", true)] } : {})),
    competitors: [decoy("Nonesuch")],
  });
  assert.equal(report.clearsFloor, true);
});

test("the widest decoy sets the floor, because clearing the easiest is not clearing it", () => {
  const report = buildDecoyReport({
    answers: answers(20, (index) => (index < 4 ? { mentions: [mention("Loud")] } : {})),
    competitors: [decoy("Quiet"), decoy("Loud")],
  });
  assert.equal(report.decoys[0]?.name, "Loud", "the widest comes first");
  assert.equal(report.noiseFloor, report.decoys[0]?.high);
});

test("a decoy the model really wrote is the model's noise, not a bug", () => {
  const report = buildDecoyReport({
    answers: [answer({ text: "You could try Nonesuch for that.", mentions: [mention("Nonesuch")] })],
    competitors: [decoy("Nonesuch")],
  });
  assert.equal(report.decoys[0]?.inText, 1);
  assert.equal(report.decoys[0]?.absentFromText, 0);
  assert.equal(report.matcherErrors, 0);
});

test("a decoy reported and absent from the answer is this product's own mistake", () => {
  // The only error here that is a bug rather than a finding, so it is counted
  // separately and never folded into the model's noise.
  const report = buildDecoyReport({
    answers: [answer({ text: "Nothing of the sort appears here.", mentions: [mention("Nonesuch")] })],
    competitors: [decoy("Nonesuch")],
  });
  assert.equal(report.decoys[0]?.namedIn, 1);
  assert.equal(report.decoys[0]?.inText, 0);
  assert.equal(report.decoys[0]?.absentFromText, 1);
  assert.equal(report.matcherErrors, 1);
});

test("a retired decoy is not carried", () => {
  const retired = { ...decoy("Nonesuch"), tracked: false };
  assert.equal(buildDecoyReport({ answers: answers(10), competitors: [retired] }).noiseFloor, null);
});

test("an answer that never completed is not one the decoy failed to appear in", () => {
  const report = buildDecoyReport({
    answers: [answer(), answer({ status: "provider_failed" })],
    competitors: [decoy("Nonesuch")],
  });
  assert.equal(report.considered, 1);
});

test("with nothing answered every share is unknown rather than nought", () => {
  const report = buildDecoyReport({ answers: [], competitors: [decoy("Nonesuch")] });
  assert.equal(report.decoys[0]?.share, null);
  assert.equal(report.presenceRate, null);
  assert.equal(report.clearsFloor, null);
});

test("the caveat says why the floor is the upper end and not the share", () => {
  assert.ok(DECOY_CAVEAT.includes("upper end"));
  assert.ok(DECOY_CAVEAT.includes("has not been told apart"));
  assert.equal(buildDecoyReport({ answers: [], competitors: [] }).caveat, DECOY_CAVEAT);
});
