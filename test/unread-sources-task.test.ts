import test from "node:test";
import assert from "node:assert/strict";
import { nextTasks, type TaskInput } from "../src/product/topics/next-task.js";

function input(over: Partial<TaskInput> = {}): TaskInput {
  return {
    answers: 40,
    answersFailed: 0,
    overall: {
      answers: 40, appearances: 8, presenceRate: 0.2, tooFewAnswers: false,
      presenceInterval: { rate: 0.2, low: 0.1, high: 0.35, trials: 40, successes: 8 },
      prominence: null, sentiment: null, score: null,
    } as never,
    activation: { considered: 40, activated: 40, unavailable: 0, notRequested: 0, unknown: 0, rate: 1, low: 1, high: 1 } as never,
    stability: { measured: 4, askedOnce: 0, sourceOverlap: 0.5, namingUnstable: 0, questions: [] } as never,
    corroboration: { reported: 10, measured: 10, namedOnly: 0, absentFromAnswer: 0, quotesChecked: 4, quotesFound: 4, caveat: "" } as never,
    citationsUnavailable: false,
    absentFrom: 0,
    ...over,
  };
}

test("cited pages nobody has opened are named as the thing to do", () => {
  // Uptake, credit, page shape and what kind of page wins are all taken over
  // the pages themselves, and all four sat empty with nothing saying why.
  const tasks = nextTasks(input({ citedPages: { cited: 12, read: 3 } }));
  const task = tasks.find((row) => row.id === "sources-unread");
  assert.ok(task, "no task told anybody to read them");
  assert.ok(task.title.includes("9 cited pages"));
  assert.ok(task.evidence.includes("3 of 12"));
  assert.equal(task.urgency, "limiting");
  assert.equal(task.action, "Read the pages");
});

test("one unread page is one page, not 1 pages", () => {
  const tasks = nextTasks(input({ citedPages: { cited: 4, read: 3 } }));
  assert.ok(tasks.find((row) => row.id === "sources-unread")?.title.includes("1 cited page"));
});

test("every cited page read means nothing to do about it", () => {
  const tasks = nextTasks(input({ citedPages: { cited: 12, read: 12 } }));
  assert.equal(tasks.find((row) => row.id === "sources-unread"), undefined);
});

test("nothing cited is not pages left unread", () => {
  const tasks = nextTasks(input({ citedPages: { cited: 0, read: 0 } }));
  assert.equal(tasks.find((row) => row.id === "sources-unread"), undefined);
});

test("nobody having counted is silent rather than saying nought are read", () => {
  // Absent is absent. Claiming nought of nought were read would invent a
  // finding out of a question nobody asked.
  const tasks = nextTasks(input());
  assert.equal(tasks.find((row) => row.id === "sources-unread"), undefined);
});
