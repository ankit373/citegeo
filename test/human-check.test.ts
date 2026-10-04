import test from "node:test";
import assert from "node:assert/strict";
import { buildAgreement, CHECK_CAVEAT, CHECK_FIELDS, mentionId, reviewable, sampleFor, type Verdict } from "../src/product/topics/human-check.js";
import type { AnswerMention, PromptAnswer } from "../src/product/topics/prompt-run-schema.js";

function mention(name: string, over: Partial<AnswerMention> = {}): AnswerMention {
  return { name, domain: null, recommendation: "positive", mentionQuote: null, firstMentionOffset: 0, firstMentionState: "unique", isTarget: false, ...over };
}

function answer(id: string, text: string, mentions: AnswerMention[], over: Partial<PromptAnswer> = {}): PromptAnswer {
  return {
    id, projectId: "p", runId: "r", promptId: "q", topicId: "t", promptText: "best screener",
    intent: "discovery", providerId: "openai", modelId: "gpt-4o", modelDisplayName: "M",
    regionId: "global", languageId: "en", status: "completed", text, mentions,
    citationUrls: [], errorCode: null, errorMessage: null, latencyMs: 1, createdAt: "", ...over,
  };
}

function verdict(id: string, over: Partial<Verdict> = {}): Verdict {
  return { id, field: "recommendation", agreed: true, at: "", ...over };
}

test("every mention on a completed answer is something a person could judge", () => {
  const items = reviewable([
    answer("a1", "Tradomate is good. Tickertape is also good.", [mention("Tradomate", { isTarget: true }), mention("Tickertape")]),
    answer("a2", "", [mention("Nobody")], { status: "provider_failed" }),
  ]);
  assert.equal(items.length, 2, "the failed answer has nothing to judge");
  assert.equal(items[0]?.name, "Tradomate");
  assert.equal(items[0]?.isTarget, true);
});

test("an answer with no text cannot be judged, because there is no evidence", () => {
  assert.deepEqual(reviewable([answer("a1", "", [mention("Tradomate")])]), []);
});

test("the excerpt centres on the mention rather than the start of the answer", () => {
  const filler = Array.from({ length: 400 }, (_, i) => "word" + i).join(" ");
  const text = filler + " Tradomate is good. " + filler;
  const items = reviewable([answer("a1", text, [mention("Tradomate", { firstMentionOffset: 9999 })])]);
  const excerpt = items[0]?.excerpt || "";
  assert.ok(excerpt.includes("Tradomate is good"));
  assert.ok(!excerpt.startsWith("word0 "), "it should not start at the beginning");
});

test("a window built off the stored offset ran past the end and gave nothing", () => {
  // The offset indexes the tokenised answer, which has more entries than the
  // text has words, so a long answer produced an empty excerpt on live data.
  const text = Array.from({ length: 300 }, (_, i) => "word" + i).join(" ") + " Tickertape is fine.";
  const items = reviewable([answer("a1", text, [mention("Tickertape", { firstMentionOffset: 420 })])]);
  assert.ok((items[0]?.excerpt || "").includes("Tickertape is fine"));
});

test("a name the answer does not contain still gets a readable excerpt", () => {
  const items = reviewable([answer("a1", "Some answer about screeners generally.", [mention("Nowhere")])]);
  assert.ok((items[0]?.excerpt || "").startsWith("Some answer"));
});

test("the same sample comes back, so a reviewer returns to the queue they left", () => {
  const items = reviewable([answer("a1", "x y z", [mention("A"), mention("B"), mention("C"), mention("D")])]);
  const first = sampleFor(items, 2).map((row) => row.id);
  const again = sampleFor(items, 2).map((row) => row.id);
  assert.deepEqual(first, again);
});

test("a different seed draws a different sample", () => {
  const many = reviewable([answer("a1", "x y z", Array.from({ length: 30 }, (_, i) => mention("N" + i)))]);
  const a = sampleFor(many, 5, "one").map((row) => row.id).join(",");
  const b = sampleFor(many, 5, "two").map((row) => row.id).join(",");
  assert.notEqual(a, b);
});

test("asking for more than exists gives what exists", () => {
  const items = reviewable([answer("a1", "x y z", [mention("A")])]);
  assert.equal(sampleFor(items, 50).length, 1);
  assert.equal(sampleFor(items, 0).length, 0);
  assert.equal(sampleFor(items, -3).length, 0);
});

test("nothing checked is not perfect agreement", () => {
  const items = reviewable([answer("a1", "x y z", [mention("A")])]);
  const report = buildAgreement({ items, verdicts: [] });
  for (const field of report.byField) {
    assert.equal(field.checked, 0);
    assert.equal(field.interval.rate, null, "nought checked must not read as agreed");
  }
});

test("agreement carries the range it is consistent with", () => {
  const items = reviewable([answer("a1", "x y z", Array.from({ length: 10 }, (_, i) => mention("N" + i)))]);
  const verdicts = items.slice(0, 5).map((item) => verdict(item.id));
  const report = buildAgreement({ items, verdicts });
  const field = report.byField.find((row) => row.field === "recommendation");
  assert.equal(field?.checked, 5);
  assert.equal(field?.agreed, 5);
  assert.equal(field?.interval.rate, 1);
  assert.ok((field?.interval.low || 1) < 1, "five of five is not certainty");
});

test("a disagreement carries what it should have said", () => {
  const items = reviewable([answer("a1", "x y z", [mention("A")])]);
  const id = items[0]?.id as string;
  const report = buildAgreement({
    items,
    verdicts: [verdict(id, { agreed: false, correction: "negative" })],
  });
  const field = report.byField.find((row) => row.field === "recommendation");
  assert.equal(field?.agreed, 0);
  assert.deepEqual(field?.corrections, [{ value: "negative", count: 1 }]);
});

test("a verdict on a mention that no longer exists is left out, not counted either way", () => {
  const items = reviewable([answer("a1", "x y z", [mention("A")])]);
  const report = buildAgreement({ items, verdicts: [verdict("gone-for-ever")] });
  assert.equal(report.byField.find((row) => row.field === "recommendation")?.checked, 0);
});

test("the two fields are counted apart, because they are different claims", () => {
  const items = reviewable([answer("a1", "x y z", [mention("A")])]);
  const id = items[0]?.id as string;
  const report = buildAgreement({
    items,
    verdicts: [verdict(id, { field: "recommendation", agreed: true }), verdict(id, { field: "isTarget", agreed: false, correction: "false" })],
  });
  assert.equal(report.byField.find((row) => row.field === "recommendation")?.agreed, 1);
  assert.equal(report.byField.find((row) => row.field === "isTarget")?.agreed, 0);
  assert.deepEqual(CHECK_FIELDS, ["recommendation", "isTarget"]);
});

test("a mention is identified by the answer and the name, so it survives a reload", () => {
  assert.equal(mentionId("a1", "Tradomate"), mentionId("a1", "Tradomate"));
  assert.notEqual(mentionId("a1", "Tradomate"), mentionId("a2", "Tradomate"));
});

test("the caveat says why the sample is random", () => {
  assert.ok(CHECK_CAVEAT.includes("not from the ones the classifier found hard"));
  assert.equal(buildAgreement({ items: [], verdicts: [] }).caveat, CHECK_CAVEAT);
});
