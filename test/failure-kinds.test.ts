import test from "node:test";
import assert from "node:assert/strict";
import { nextTasks, type TaskInput } from "../src/product/topics/next-task.js";
import { ProviderRequestError, failureCodeForStatus, modelWithdrawn, replacementSlug } from "../src/providers/provider-error.js";
import { postJsonWithRetry } from "../src/providers/http.js";

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

test("a request that never reached the provider is not the provider erroring", async () => {
  // Measured live: 56 answers in one day recorded "fetch failed" as a provider
  // error, which sent the reader to the keys page to fix a network fault.
  const failure = await postJsonWithRetry("http://127.0.0.1:1/v1/chat", { method: "POST" }, 1)
    .then(() => null, (error: unknown) => error);
  assert.ok(failure instanceof ProviderRequestError);
  assert.equal(failure.code, "upstream_unavailable");
  assert.ok(failure.message.includes("127.0.0.1:1"), failure.message);
  const task = nextTasks(input([{ code: failure.code, count: 56 }])).find((row) => row.id === "answers-failed");
  assert.equal(task?.page, "models", "a network fault is not fixed on the keys page");
});

test("a withdrawn model is not the provider refusing one request", () => {
  // Measured live: 238 answers lost to two free slugs the aggregator retired,
  // every one filed as "the provider refusing the request" with no fix.
  const retired = "This model is unavailable for free. The paid version is available now - use this slug instead: qwen/qwen3.8-27b (HTTP 404)";
  assert.equal(modelWithdrawn(retired), true);
  assert.equal(replacementSlug(retired), "qwen/qwen3.8-27b");
  assert.equal(modelWithdrawn("No endpoints found for openai/gpt-5.2-chat. (HTTP 404)"), true);
  assert.equal(modelWithdrawn("This model is only available through the Batch API. (HTTP 400)"), true);
  // A plain refusal is still a plain refusal.
  assert.equal(modelWithdrawn("Unsupported parameter: 'temperature' (HTTP 400)"), false);
  assert.equal(replacementSlug("No endpoints found for openai/gpt-5.2-chat."), null);
});

test("every cause the reader is shown has a page that can act on it", () => {
  // "Open the run" is not a fix. A cause with words and no page fell back to it.
  for (const code of ["model_unavailable", "invalid_response", "no_answer", "no_structured_output", "rate_limited", "billing"]) {
    const task = nextTasks(input([{ code, count: 4 }])).find((row) => row.id === "answers-failed");
    assert.ok(task, `no task for ${code}`);
    assert.notEqual(task.action, "Open the run", `${code} has no fix`);
  }
});
