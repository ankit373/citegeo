import test from "node:test";
import assert from "node:assert/strict";
import { nextTasks, type TaskInput } from "../src/product/topics/next-task.js";
import { failureCodeForStatus } from "../src/providers/provider-error.js";

function input(reasons: Array<{ code: string; count: number }>): TaskInput {
  return {
    answers: 32,
    answersFailed: reasons.reduce((sum, row) => sum + row.count, 0),
    overall: {
      answers: 32, appearances: 8, presenceRate: 0.25, tooFewAnswers: false,
      presenceInterval: { rate: 0.25, low: 0.13, high: 0.42, trials: 32, successes: 8 },
      prominence: null, sentiment: null, score: null,
    } as never,
    activation: { considered: 32, activated: 32, unavailable: 0, notRequested: 0, unknown: 0, rate: 1, low: 1, high: 1 } as never,
    stability: { measured: 4, askedOnce: 0, sourceOverlap: 0.5, namingUnstable: 0, questions: [] } as never,
    corroboration: { reported: 10, measured: 10, namedOnly: 0, absentFromAnswer: 0, quotesChecked: 4, quotesFound: 4, caveat: "" } as never,
    citationsUnavailable: false,
    absentFrom: 0,
    failureReasons: reasons,
  };
}

test("a model over its plan's limit is named as that, not as a provider error", () => {
  // Measured live: one free model answered 429 to 14 of 16 questions while
  // another on the same key answered 14 of 16. "Provider error" hides which.
  const task = nextTasks(input([{ code: "rate_limited", count: 14 }])).find((row) => row.id === "answers-failed");
  assert.ok(task);
  assert.ok(task.evidence.includes("asked more often than its plan allows"));
  assert.equal(task.page, "models", "the keys page does not fix a plan limit");
});

test("the account not paying and the key being refused are different findings", () => {
  const billing = nextTasks(input([{ code: "billing", count: 5 }])).find((row) => row.id === "answers-failed");
  const auth = nextTasks(input([{ code: "authentication", count: 5 }])).find((row) => row.id === "answers-failed");
  assert.ok(billing?.evidence.includes("cannot pay for"));
  assert.ok(auth?.evidence.includes("refused"));
  assert.notEqual(billing?.action, auth?.action);
});

test("every code the provider layer can produce has words for it", () => {
  // An unmapped code prints as itself, which is honest and unreadable.
  for (const status of [401, 402, 408, 429, 500, 400]) {
    const code = failureCodeForStatus(status);
    const task = nextTasks(input([{ code, count: 3 }])).find((row) => row.id === "answers-failed");
    assert.ok(task, `no task for ${code}`);
    assert.equal(task.evidence.includes(code), false, `${code} printed as itself`);
  }
});
