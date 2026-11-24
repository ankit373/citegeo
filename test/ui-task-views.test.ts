import test from "node:test";
import assert from "node:assert/strict";
import { answerTasks, renderTasks, taskCta, taskFor, taskRow } from "../src/ui/app/pages/task-views.js";
import { renderDecomposition, renderUptake } from "../src/ui/app/pages/source-sections.js";
import { renderStability, type FoldCard } from "../src/ui/app/pages/trust-sections.js";
import type { MeasurementTask } from "../src/product/topics/next-task.js";
import type { UptakeSummary, PageUptake } from "../src/product/citations/answer-uptake.js";
import type { QuestionStability, StabilityReport } from "../src/product/topics/answer-stability.js";
import type { CitationDecomposition } from "../src/product/topics/citation-decomposition.js";
import type { ActivationSplit } from "../src/product/topics/search-activation.js";

function has(text: string, ...parts: string[]): void {
  for (const part of parts) assert.ok(text.includes(part), `${JSON.stringify(text)} lacks ${part}`);
}

const task = (id: string, urgency: MeasurementTask["urgency"]): MeasurementTask =>
  ({ id, urgency, title: "Title<" + id, why: "why&", evidence: "seen", page: "reports", action: "Do " + id });
const tasks = [task("a", "blocking"), task("b", "limiting"), task("c", "work")];

test("tasks are read off the answer-engine data and nothing before it arrives", () => {
  assert.deepEqual(answerTasks(null), []);
  assert.deepEqual(answerTasks({}), []);
  assert.deepEqual(answerTasks({ tasks }), tasks);
  assert.equal(taskFor(tasks, "b")?.id, "b");
  assert.equal(taskFor(tasks, "zz"), null);
});

test("a task call to action names its urgency and escalates only a blocker", () => {
  has(taskCta(tasks, "a"), "state-bad", "blocking", "Title&lt;a", "Do a");
  has(taskCta(tasks, "c"), "state-ok", "to do");
  assert.equal(taskCta(tasks, "zz"), "");
  has(taskRow(task("b", "limiting")), 'data-state="next"', "why&amp;", "Observed: seen");
  has(taskRow(task("a", "blocking")), 'data-state="warn"');
});

test("the task list counts blockers and says how many it left out", () => {
  assert.equal(renderTasks([]), "");
  has(renderTasks(tasks), "1 of these stops a number being produced", "Title&lt;c");
  has(renderTasks(tasks.slice(1)), "Ordered by what is holding the measurement back");
  has(renderTasks(tasks, 2), "1 more on the full report.");
});

const page = (uptake: number | null, phrases: PageUptake["phrases"] = []): PageUptake => ({
  url: "https://p.example/" + "x".repeat(80), host: "p.example", answerId: "a", promptText: "Q<", modelId: "m", uptake, shared: uptake === null ? null : 0.3,
  phrases, coverage: null, citedAt: 2, detail: null,
});
const uptake = (over: Partial<UptakeSummary> = {}): UptakeSummary =>
  ({ measured: 2, unread: 0, pagesRead: 2, pagesUnread: 0, mean: 0.5, citedNotUsed: 0, pages: [page(0.5, [{ text: "shared words", at: 0 }]), page(0)], caveat: "cv<", ...over });

test("uptake loads while idle, waits in words, and says when nothing was cited", () => {
  const calls: string[] = [];
  const actions = { loadUptake: () => { calls.push("uptake"); } };
  has(renderUptake("idle", null, tasks, actions), "Reading what the answers took");
  assert.deepEqual(calls, ["uptake"]);
  has(renderUptake("error", null, tasks, actions), "Could not read what the answers took");
  assert.equal(calls.length, 1);
  has(renderUptake("ready", uptake({ measured: 0, unread: 0 }), tasks, actions), "No answer carried a citation");
});

test("uptake reports the mean, escapes the page text and offers the unread task", () => {
  const actions = { loadUptake: () => {} };
  const out = renderUptake("ready", uptake({ unread: 2, pagesUnread: 2, citedNotUsed: 1 }), [task("sources-unread", "blocking")], actions);
  has(out, "mean uptake is 50%", "1 reading is of a page whose subject", "2 of the 4 cited page(s) have not been read back", "Q&lt;", "shared words", "Do sources-unread", "cv&lt;", "…");
  has(renderUptake("ready", uptake({ mean: null }), tasks, actions), "No cited page has been read back");
  has(renderUptake("ready", uptake({ pages: [page(null)] }), tasks, actions), "Not read");
});

const question = (naming: QuestionStability["naming"], spanHours: number | null): QuestionStability =>
  ({ promptId: "p", promptText: "Q<", modelId: "m", passes: 3, named: 1, naming, namingAgreed: naming !== "split", sourceOverlap: null, sourcesAlways: 1, sourcesEver: 3, spanHours });
const stability = (over: Partial<StabilityReport> = {}): StabilityReport => ({
  measured: 2, askedOnce: 0, distinctQuestions: 2, questionsRepeated: 2, sourceOverlap: 0.4, withSources: 2, namingUnstable: 0, neverNamed: 1, alwaysNamed: 1,
  questions: [question("always", null), question("split", 0.5), question("never", 10), question("always", 100)], caveat: "cv", ...over,
});
const fold: FoldCard = (id, title, blurb, body, aside = "") => ["FOLD", id, title, blurb, body, aside].join("|");

test("stability folds its card, and a question asked once points at the task", () => {
  assert.equal(renderStability(null, tasks, fold), "");
  const once = renderStability(stability({ measured: 0 }), [task("asked-once", "limiting")], fold);
  has(once, "FOLD|trust-stability|How much the answer moves", "Every question here was asked once", "Do asked-once");
});

test("stability reads absence as agreement on absence, and never as a reassurance", () => {
  has(renderStability(stability(), tasks, fold), "40% of the cited sources survived", "Each agrees with itself", "Unknown span", "Minutes apart", "10h apart", "4d apart", "Q&lt;", "1 of 3");
  has(renderStability(stability({ alwaysNamed: 0 }), tasks, fold), "agree on an absence rather than on a reading");
  has(renderStability(stability({ neverNamed: 0 }), tasks, fold), "Every pass of every question named you.");
  has(renderStability(stability({ namingUnstable: 2, sourceOverlap: null }), [task("naming-unstable", "work")], fold), "2 question(s) named you on one pass and not on another", "no overlap to take", "Do naming-unstable");
});

const activation = (over: Partial<ActivationSplit> = {}): ActivationSplit =>
  ({ considered: 10, activated: 4, unavailable: 0, notRequested: 0, unknown: 0, rate: 0.4, low: 0.4, high: 0.4, caveat: "ac<", ...over });
const decomposition = (over: Partial<CitationDecomposition> = {}): CitationDecomposition => ({
  activation: activation(), activated: 4, citedYou: 1, citedGivenActivated: 0.25, citedGivenActivatedLow: 0.25, citedGivenActivatedHigh: 0.25, overall: 0.1, caveat: "cv", ...over,
});

test("the searching card says what is unknown instead of rounding it to a no", () => {
  assert.equal(renderDecomposition(null, tasks), "");
  assert.equal(renderDecomposition(decomposition({ activation: activation({ considered: 0 }) }), tasks), "");
  has(renderDecomposition(decomposition(), tasks), "40% of answers searched the web", "25% of the answers that searched cited you", "exact", "ac&lt;");
  const unknown = decomposition({
    activation: activation({ rate: null, low: 0.1, high: 0.7, unknown: 3, unavailable: 2, notRequested: 1 }),
    citedGivenActivated: null, citedGivenActivatedLow: 0.1, citedGivenActivatedHigh: 0.5,
  });
  has(renderDecomposition(unknown, [task("activation-unknown", "work")]), "Between 10% and 70% of answers searched", "Between 10% and 50%", "2 could not search at all", "1 was never asked to", "Do activation-unknown");
  has(renderDecomposition(decomposition({ citedGivenActivated: null, citedGivenActivatedLow: null, citedGivenActivatedHigh: null, overall: null }), tasks), "Nothing is known to have searched");
});
