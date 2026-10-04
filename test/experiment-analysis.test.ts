import test from "node:test";
import assert from "node:assert/strict";
import { analyseExperiment, EXPERIMENT_CAVEAT, MIN_PER_ARM } from "../src/product/experiments/experiment-analysis.js";
import type { AnswerMention, PromptAnswer } from "../src/product/topics/prompt-run-schema.js";

const TARGET: AnswerMention = {
  name: "Tradomate", domain: null, recommendation: "positive", mentionQuote: null,
  firstMentionOffset: 0, firstMentionState: "unique", isTarget: true,
};

const CHANGED = "2026-06-01T00:00:00.000Z";

function answer(promptId: string, named: boolean, when: string): PromptAnswer {
  return {
    id: String(Math.random()), projectId: "p", runId: "r", promptId, topicId: "t",
    promptText: promptId, intent: "discovery", providerId: "openai", modelId: "gpt-4o",
    modelDisplayName: "M", regionId: "global", languageId: "en", status: "completed", text: "",
    mentions: named ? [TARGET] : [], citationUrls: [], errorCode: null, errorMessage: null,
    latencyMs: 1, createdAt: when,
  };
}

/** `named` of `count` answers to this question, on this side of the change. */
function arm(promptId: string, named: number, count: number, when: string): PromptAnswer[] {
  return Array.from({ length: count }, (_, index) => answer(promptId, index < named, when));
}

const BEFORE = "2026-05-01T00:00:00.000Z";
const AFTER = "2026-07-01T00:00:00.000Z";

test("without a control, nothing is concluded", () => {
  // A number moving after you changed something is not evidence it moved it,
  // and this is the mistake the whole field makes.
  const result = analyseExperiment({
    answers: [...arm("t", 2, 20, BEFORE), ...arm("t", 18, 20, AFTER)],
    treatedPromptIds: ["t"], controlPromptIds: [], changedAt: CHANGED,
  });
  assert.equal(result.verdict, "no_control");
  assert.equal(result.difference, null);
  assert.ok(result.detail.includes("not evidence your change moved it"));
});

test("a rise the control shares is not the change working", () => {
  // Both sides went up by half. The model shipped, or the season turned.
  const result = analyseExperiment({
    answers: [
      ...arm("t", 2, 20, BEFORE), ...arm("t", 12, 20, AFTER),
      ...arm("c", 2, 20, BEFORE), ...arm("c", 12, 20, AFTER),
    ],
    treatedPromptIds: ["t"], controlPromptIds: ["c"], changedAt: CHANGED,
  });
  assert.equal(result.difference, 0);
  assert.equal(result.verdict, "no_effect_shown");
});

test("a rise the control did not share, and large enough, reads as moved", () => {
  const result = analyseExperiment({
    answers: [
      ...arm("t", 2, 60, BEFORE), ...arm("t", 50, 60, AFTER),
      ...arm("c", 20, 60, BEFORE), ...arm("c", 20, 60, AFTER),
    ],
    treatedPromptIds: ["t"], controlPromptIds: ["c"], changedAt: CHANGED,
  });
  assert.equal(result.verdict, "moved");
  assert.ok((result.low || 0) > 0, "the range must clear nought to say anything");
  assert.ok(result.detail.includes("does not cross nought"));
});

test("a small rise on few answers is consistent with nothing", () => {
  const result = analyseExperiment({
    answers: [
      ...arm("t", 5, 12, BEFORE), ...arm("t", 7, 12, AFTER),
      ...arm("c", 5, 12, BEFORE), ...arm("c", 5, 12, AFTER),
    ],
    treatedPromptIds: ["t"], controlPromptIds: ["c"], changedAt: CHANGED,
  });
  assert.equal(result.verdict, "no_effect_shown");
  assert.ok((result.low || 0) < 0 && (result.high || 0) > 0, "the band straddles nought");
});

test("a fall is reported as a fall rather than as nothing", () => {
  const result = analyseExperiment({
    answers: [
      ...arm("t", 50, 60, BEFORE), ...arm("t", 2, 60, AFTER),
      ...arm("c", 20, 60, BEFORE), ...arm("c", 20, 60, AFTER),
    ],
    treatedPromptIds: ["t"], controlPromptIds: ["c"], changedAt: CHANGED,
  });
  assert.equal(result.verdict, "moved");
  assert.ok((result.difference || 0) < 0);
  assert.ok((result.high || 0) < 0);
});

test("too few answers in any one group refuses the arithmetic", () => {
  const result = analyseExperiment({
    answers: [
      ...arm("t", 1, 3, BEFORE), ...arm("t", 3, 20, AFTER),
      ...arm("c", 5, 20, BEFORE), ...arm("c", 5, 20, AFTER),
    ],
    treatedPromptIds: ["t"], controlPromptIds: ["c"], changedAt: CHANGED,
  });
  assert.equal(result.verdict, "too_thin");
  assert.ok(result.detail.includes(String(MIN_PER_ARM)));
  assert.ok(result.detail.includes("one of them does not"), "one group reads as one, not as a count");
});

test("several thin groups read as several rather than as one", () => {
  const result = analyseExperiment({
    answers: [...arm("t", 1, 3, BEFORE), ...arm("t", 1, 3, AFTER), ...arm("c", 1, 3, BEFORE), ...arm("c", 1, 3, AFTER)],
    treatedPromptIds: ["t"], controlPromptIds: ["c"], changedAt: CHANGED,
  });
  assert.ok(result.detail.includes("4 of them do not have that yet"));
});

test("answers are split by when they were archived, not by which run", () => {
  const result = analyseExperiment({
    answers: [
      ...arm("t", 0, 20, BEFORE), ...arm("t", 20, 20, AFTER),
      ...arm("c", 10, 20, BEFORE), ...arm("c", 10, 20, AFTER),
    ],
    treatedPromptIds: ["t"], controlPromptIds: ["c"], changedAt: CHANGED,
  });
  assert.equal(result.treated.before.rate, 0);
  assert.equal(result.treated.after.rate, 1);
  assert.equal(result.treated.lift, 1);
});

test("an answer with no readable time is left out rather than guessed onto a side", () => {
  const result = analyseExperiment({
    answers: [
      ...arm("t", 5, 20, BEFORE), ...arm("t", 15, 20, AFTER), answer("t", true, "not a date"),
      ...arm("c", 5, 20, BEFORE), ...arm("c", 5, 20, AFTER),
    ],
    treatedPromptIds: ["t"], controlPromptIds: ["c"], changedAt: CHANGED,
  });
  assert.equal(result.treated.after.trials, 20, "the undated answer is not on either side");
});

test("a failed answer is not an answer that did not name you", () => {
  const failed = { ...answer("t", false, AFTER), status: "provider_failed" as const };
  const result = analyseExperiment({
    answers: [...arm("t", 5, 20, BEFORE), ...arm("t", 15, 20, AFTER), failed, ...arm("c", 5, 20, BEFORE), ...arm("c", 5, 20, AFTER)],
    treatedPromptIds: ["t"], controlPromptIds: ["c"], changedAt: CHANGED,
  });
  assert.equal(result.treated.after.trials, 20);
});

test("no effect shown is never reported as no effect", () => {
  const result = analyseExperiment({
    answers: [
      ...arm("t", 5, 20, BEFORE), ...arm("t", 6, 20, AFTER),
      ...arm("c", 5, 20, BEFORE), ...arm("c", 5, 20, AFTER),
    ],
    treatedPromptIds: ["t"], controlPromptIds: ["c"], changedAt: CHANGED,
  });
  assert.ok(result.detail.includes("not the same as showing it did nothing"));
});

test("a rate of nought or one does not become certainty", () => {
  // p times one minus p is nought at both ends, which collapsed the band to a
  // single point and reported an experiment as certain from 40 answers a cell.
  const result = analyseExperiment({
    answers: [...arm("t", 0, 40, BEFORE), ...arm("t", 40, 40, AFTER), ...arm("c", 0, 40, BEFORE), ...arm("c", 0, 40, AFTER)],
    treatedPromptIds: ["t"], controlPromptIds: ["c"], changedAt: CHANGED,
  });
  assert.equal(result.difference, 1);
  assert.ok((result.high || 0) > (result.low || 0), "a band of no width is a claim of certainty");
  assert.ok((result.low || 0) < 1, `the bottom of the band should sit below the point, got ${result.low}`);
});

test("the band narrows as the answers pile up", () => {
  const width = (n: number): number => {
    const r = analyseExperiment({
      answers: [
        ...arm("t", Math.round(n * 0.2), n, BEFORE), ...arm("t", Math.round(n * 0.4), n, AFTER),
        ...arm("c", Math.round(n * 0.2), n, BEFORE), ...arm("c", Math.round(n * 0.2), n, AFTER),
      ],
      treatedPromptIds: ["t"], controlPromptIds: ["c"], changedAt: CHANGED,
    });
    return (r.high || 0) - (r.low || 0);
  };
  assert.ok(width(200) < width(50));
  assert.ok(width(50) < width(10));
});

test("a model version changing inside the window is named as a confound", () => {
  const withVersion = (rows: PromptAnswer[], version: string) => rows.map((row) => ({ ...row, modelVersion: version }));
  const result = analyseExperiment({
    answers: [
      ...withVersion(arm("t", 5, 40, BEFORE), "m-march"), ...withVersion(arm("t", 30, 40, AFTER), "m-august"),
      ...withVersion(arm("c", 5, 40, BEFORE), "m-march"), ...withVersion(arm("c", 5, 40, AFTER), "m-august"),
    ],
    treatedPromptIds: ["t"], controlPromptIds: ["c"], changedAt: CHANGED,
  });
  assert.deepEqual(result.versionsChanged, ["gpt-4o"]);
  assert.ok(result.detail.includes("model version changed inside the window"));
  assert.ok(result.detail.includes("nothing absorbs it where it did not"));
});

test("a version the provider only echoed back is not a change", () => {
  const echoed = (rows: PromptAnswer[]) => rows.map((row) => ({ ...row, modelVersion: row.modelId }));
  const result = analyseExperiment({
    answers: [
      ...echoed(arm("t", 5, 40, BEFORE)), ...echoed(arm("t", 30, 40, AFTER)),
      ...echoed(arm("c", 5, 40, BEFORE)), ...echoed(arm("c", 5, 40, AFTER)),
    ],
    treatedPromptIds: ["t"], controlPromptIds: ["c"], changedAt: CHANGED,
  });
  assert.deepEqual(result.versionsChanged, [], "echoing the model back is not a version anybody can see");
});

test("the caveat refuses the word proof and names what it cannot remove", () => {
  assert.ok(EXPERIMENT_CAVEAT.includes("evidence for the change rather than proof of it"));
  assert.ok(EXPERIMENT_CAVEAT.includes("only as good as the control being comparable"));
});

test("a version change on a question in neither arm is not this experiment's confound", () => {
  const withVersion = (rows: PromptAnswer[], version: string) => rows.map((row) => ({ ...row, modelVersion: version }));
  const result = analyseExperiment({
    answers: [
      ...withVersion(arm("t", 5, 40, BEFORE), "m-march"), ...withVersion(arm("t", 30, 40, AFTER), "m-march"),
      ...withVersion(arm("c", 5, 40, BEFORE), "m-march"), ...withVersion(arm("c", 5, 40, AFTER), "m-march"),
      ...withVersion(arm("other", 1, 40, BEFORE), "m-march"), ...withVersion(arm("other", 1, 40, AFTER), "m-august"),
    ],
    treatedPromptIds: ["t"], controlPromptIds: ["c"], changedAt: CHANGED,
  });
  assert.deepEqual(result.versionsChanged, [], "the arms were answered by one version throughout");
});

test("a side answered by two versions is already two machines", () => {
  const withVersion = (rows: PromptAnswer[], version: string) => rows.map((row) => ({ ...row, modelVersion: version }));
  const result = analyseExperiment({
    answers: [
      ...withVersion(arm("t", 2, 20, BEFORE), "m-march"), ...withVersion(arm("t", 3, 20, BEFORE), "m-april"),
      ...withVersion(arm("t", 30, 40, AFTER), "m-april"),
      ...withVersion(arm("c", 5, 40, BEFORE), "m-march"), ...withVersion(arm("c", 5, 40, AFTER), "m-april"),
    ],
    treatedPromptIds: ["t"], controlPromptIds: ["c"], changedAt: CHANGED,
  });
  assert.deepEqual(result.versionsChanged, ["gpt-4o"], "two versions on one side is not a window that held still");
});
