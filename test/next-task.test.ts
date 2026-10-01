import test from "node:test";
import assert from "node:assert/strict";
import { buildStabilityReport } from "../src/product/topics/answer-stability.js";
import { summariseCorroboration } from "../src/product/topics/mention-corroboration.js";
import { splitActivation, type ActivationSplit } from "../src/product/topics/search-activation.js";
import { nextTasks, type TaskInput } from "../src/product/topics/next-task.js";
import { emptyScore } from "../src/product/topics/visibility-score.js";
import { wilsonInterval } from "../src/product/topics/proportion-interval.js";

function activation(over: Partial<ActivationSplit> = {}): ActivationSplit {
  return { ...splitActivation([]), ...over };
}

/** A project where everything that could block the measurement is clear, so a
 * test naming one condition is the only thing that could have produced it. */
function sound(over: Partial<TaskInput> = {}): TaskInput {
  return {
    answers: 40,
    answersFailed: 0,
    overall: { ...emptyScore(), answers: 40, appearances: 20, presenceRate: 0.5, presenceInterval: wilsonInterval(20, 40) },
    activation: activation({ considered: 40, activated: 40, rate: 1, low: 1, high: 1 }),
    stability: { ...buildStabilityReport([]), measured: 4 },
    corroboration: summariseCorroboration([]),
    citationsUnavailable: false,
    absentFrom: 0,
    ...over,
  };
}

function ids(input: TaskInput): string[] {
  return nextTasks(input).map((task) => task.id);
}

test("with nothing answered the only task is to answer something", () => {
  const tasks = nextTasks(sound({ answers: 0 }));
  assert.deepEqual(tasks.map((task) => task.id), ["no-answers"]);
  assert.equal(tasks[0]?.urgency, "blocking");
});

test("search switched off is named as the cause, not as a missing provider", () => {
  const tasks = nextTasks(sound({
    citationsUnavailable: true,
    activation: activation({ considered: 15, activated: 0, notRequested: 9, unknown: 6, low: 0, high: 0.4 }),
  }));
  const first = tasks[0];
  assert.equal(first?.id, "search-switched-off");
  assert.equal(first?.page, "models", "the page that turns it on, not the page that reports it");
  assert.ok(first?.evidence.includes("9 of 15"));
});

test("a model that cannot search at all is a different task from one told not to", () => {
  assert.ok(ids(sound({
    citationsUnavailable: true,
    activation: activation({ considered: 8, unavailable: 8, rate: 0, low: 0, high: 0 }),
  })).includes("no-model-can-search"));
});

test("models that searched and cited nothing is neither of those", () => {
  const found = ids(sound({
    citationsUnavailable: true,
    activation: activation({ considered: 8, activated: 8, rate: 1, low: 1, high: 1 }),
  }));
  assert.ok(found.includes("no-sources-returned"));
  assert.ok(!found.includes("search-switched-off"));
  assert.ok(!found.includes("no-model-can-search"));
});

test("asking once is a limit on reading the figure, not a blocker", () => {
  const tasks = nextTasks(sound({ stability: { ...buildStabilityReport([]), measured: 0, askedOnce: 12 } }));
  const asked = tasks.find((task) => task.id === "asked-once");
  assert.equal(asked?.urgency, "limiting");
  assert.ok(asked?.evidence.includes("12 questions were asked once and none more than once"));
});

test("most questions asked once still counts, even where some were asked twice", () => {
  const majority = nextTasks(sound({ stability: { ...buildStabilityReport([]), measured: 5, askedOnce: 6 } }));
  const asked = majority.find((task) => task.id === "asked-once");
  assert.ok(asked, "six single draws beside five measured questions is still mostly single draws");
  assert.ok(asked?.evidence.includes("6 of 11 questions were asked once"));
  const few = nextTasks(sound({ stability: { ...buildStabilityReport([]), measured: 15, askedOnce: 1 } }));
  assert.ok(!few.some((task) => task.id === "asked-once"), "one question of sixteen is not worth a task");
});

test("sources that do not survive being asked again are their own task", () => {
  const turning = nextTasks(sound({ stability: { ...buildStabilityReport([]), measured: 5, askedOnce: 0, sourceOverlap: 0 } }));
  const task = turning.find((task) => task.id === "sources-turn-over");
  assert.equal(task?.urgency, "limiting");
  assert.ok(task?.evidence.includes("0% of cited sources survived"));
  assert.ok(task?.evidence.includes("34%"), "the published figure it is being judged against");
  const steady = nextTasks(sound({ stability: { ...buildStabilityReport([]), measured: 5, askedOnce: 0, sourceOverlap: 0.6 } }));
  assert.ok(!steady.some((task) => task.id === "sources-turn-over"));
});

test("no pair of passes citing anything leaves the overlap alone", () => {
  const none = nextTasks(sound({ stability: { ...buildStabilityReport([]), measured: 5, askedOnce: 0, sourceOverlap: null } }));
  assert.ok(!none.some((task) => task.id === "sources-turn-over"), "unmeasurable is not nought");
});

test("passes that disagree are raised only once there are passes to disagree", () => {
  const once = ids(sound({ stability: { ...buildStabilityReport([]), measured: 0, askedOnce: 3 } }));
  assert.ok(!once.includes("naming-unstable"), "nothing was asked twice, so nothing could disagree");
  const twice = ids(sound({ stability: { ...buildStabilityReport([]), measured: 4, askedOnce: 0, namingUnstable: 2 } }));
  assert.ok(twice.includes("naming-unstable"));
});

test("a range too wide to read asks for more answers", () => {
  const tasks = nextTasks(sound({
    overall: { ...emptyScore(), answers: 5, appearances: 2, presenceRate: 0.4, presenceInterval: wilsonInterval(2, 5), tooFewAnswers: true },
  }));
  const wide = tasks.find((task) => task.id === "too-few-answers");
  assert.ok(wide?.evidence.includes("2 of 5 answers named you"));
});

test("failed answers are a task, because the score was taken over fewer than you asked for", () => {
  const tasks = nextTasks(sound({ answers: 40, answersFailed: 819 }));
  const failed = tasks.find((task) => task.id === "answers-failed");
  assert.ok(failed?.title.includes("819"));
  assert.ok(failed?.evidence.includes("819 of 859"), "the denominator is what was requested, not what completed");
});

test("where the product knows why they failed it says so instead of asking", () => {
  const tasks = nextTasks(sound({
    answers: 22,
    answersFailed: 819,
    failureReasons: [{ code: "unavailable", count: 500 }, { code: "no_answer", count: 319 }],
  }));
  const failed = tasks.find((task) => task.id === "answers-failed");
  assert.ok(!failed?.title.startsWith("Find out why"), "it has the reason, so telling them to go and find it is withholding it");
  assert.ok(failed?.title.includes("sign in"));
  assert.ok(failed?.evidence.includes("The largest group is 500"));
  assert.equal(failed?.page, "models", "a browser surface is cleared where the surfaces are, not on the report");
});

test("the button lands where that kind of failure is cleared", () => {
  const keys = nextTasks(sound({ answersFailed: 9, failureReasons: [{ code: "provider_error", count: 9 }] }));
  assert.equal(keys.find((task) => task.id === "answers-failed")?.page, "setup");
  const unknown = nextTasks(sound({ answersFailed: 9, failureReasons: [{ code: "teapot", count: 9 }] }));
  assert.equal(unknown.find((task) => task.id === "answers-failed")?.page, "answer-engine", "nowhere known to send them is the report, not a guess");
});

test("a failure code nobody has mapped is printed as itself, not folded away", () => {
  const tasks = nextTasks(sound({
    answersFailed: 4,
    failureReasons: [{ code: "teapot", count: 4 }],
  }));
  const failed = tasks.find((task) => task.id === "answers-failed");
  assert.ok(failed?.title.includes("teapot"));
});

test("a quote the model could not back up is its own task", () => {
  const tasks = nextTasks(sound({
    corroboration: { ...summariseCorroboration([]), reported: 33, measured: 33, quotesChecked: 30, quotesFound: 25 },
  }));
  const quotes = tasks.find((task) => task.id === "quotes-not-found");
  assert.ok(quotes?.title.includes("5 quotes"));
  assert.ok(quotes?.evidence.includes("25 of 30"));
});

test("questions you never appear in are work, not a fault in the measurement", () => {
  const tasks = nextTasks(sound({ absentFrom: 7 }));
  const absent = tasks.find((task) => task.id === "absent-questions");
  assert.equal(absent?.urgency, "work");
  assert.ok(absent?.title.includes("7 questions"));
});

test("blocking comes before limiting, and limiting before work", () => {
  const tasks = nextTasks(sound({
    absentFrom: 3,
    answersFailed: 2,
    citationsUnavailable: true,
    activation: activation({ considered: 10, activated: 0, notRequested: 10, rate: 0, low: 0, high: 0 }),
  }));
  assert.deepEqual(tasks.map((task) => task.id), ["search-switched-off", "answers-failed", "absent-questions"]);
  assert.deepEqual(tasks.map((task) => task.urgency), ["blocking", "limiting", "work"]);
});

test("a sound measurement says so rather than returning an empty list", () => {
  const tasks = nextTasks(sound());
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0]?.id, "measurement-sound");
  assert.equal(tasks[0]?.urgency, "work");
});

test("every task names the page that does it and the words on the button", () => {
  const every = [sound({ answers: 0 }), sound({ absentFrom: 2 }), sound({ answersFailed: 1 }), sound()];
  for (const input of every) {
    for (const task of nextTasks(input)) {
      assert.ok(task.page.length, `${task.id} has nowhere to send anyone`);
      assert.ok(task.action.length, `${task.id} has no button`);
      assert.ok(task.evidence.length, `${task.id} states a task with no observation behind it`);
    }
  }
});

test("one answer counted once: the unknown band is only raised when something is unknown", () => {
  assert.ok(!ids(sound()).includes("activation-unknown"));
  assert.ok(ids(sound({
    activation: activation({ considered: 15, activated: 2, unknown: 6, unavailable: 7, low: 0.133, high: 0.533 }),
  })).includes("activation-unknown"));
});
