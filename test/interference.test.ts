import test from "node:test";
import assert from "node:assert/strict";
import { BROAD_ARRIVAL, buildInterferenceReport, INTERFERENCE_CAVEAT, PAGE_SHIFT, textShift } from "../src/product/citations/interference.js";
import type { PromptAnswer, PromptRun } from "../src/product/topics/prompt-run-schema.js";
import type { SourcePage } from "../src/product/citations/source-page.js";

function run(id: string, startedAt: string): PromptRun {
  return {
    id, projectId: "p", status: "completed", promptIds: [], modelIds: [], regionIds: [], languageIds: [],
    answersRequested: 0, answersCompleted: 0, answersFailed: 0, startedAt, completedAt: startedAt,
  };
}

function answer(runId: string, promptId: string, urls: string[]): PromptAnswer {
  return {
    id: String(Math.random()), projectId: "p", runId, promptId, topicId: "t",
    promptText: promptId, intent: "discovery", providerId: "openai", modelId: "gpt-4o",
    modelDisplayName: "M", regionId: "global", languageId: "en", status: "completed", text: "",
    mentions: [], citationUrls: urls, errorCode: null, errorMessage: null, latencyMs: 1, createdAt: startedOf(runId),
  };
}

function startedOf(runId: string): string {
  return runId === "r1" ? "2026-09-01T00:00:00.000Z" : "2026-09-08T00:00:00.000Z";
}

function page(over: Partial<SourcePage> = {}): SourcePage {
  return {
    url: "https://a.test/x", host: "a.test", fetchedAt: "2026-09-08T00:00:00.000Z", title: "t",
    description: "", headings: [], words: 100, namesYou: false, named: [], detail: null, ...over,
  };
}

const RUNS = [run("r1", "2026-09-01T00:00:00.000Z"), run("r2", "2026-09-08T00:00:00.000Z")];

test("nothing in the first run that cited anything is sudden", () => {
  // Everything arrived there. Calling it all suspicious is the same as none.
  const report = buildInterferenceReport({
    runs: RUNS,
    pages: [],
    answers: [answer("r1", "q1", ["https://a.test/1"]), answer("r1", "q2", ["https://a.test/2"])],
  });
  assert.equal(report.arrivals.length, 1);
  assert.equal(report.arrivals[0]?.sudden, false);
  assert.equal(report.arrivals[0]?.breadth, 1);
});

test("a host arriving across most questions in a later run is the shape", () => {
  const report = buildInterferenceReport({
    runs: RUNS,
    pages: [],
    answers: [
      answer("r1", "q1", ["https://old.test/1"]), answer("r1", "q2", ["https://old.test/2"]),
      answer("r2", "q1", ["https://old.test/1", "https://new.test/a"]),
      answer("r2", "q2", ["https://old.test/2", "https://new.test/b"]),
    ],
  });
  const arrival = report.arrivals.find((row) => row.host === "new.test");
  assert.equal(arrival?.sudden, true);
  assert.equal(arrival?.questionsAtArrival, 2);
  assert.equal(arrival?.questionsInRun, 2);
  assert.equal(report.arrivals.find((row) => row.host === "old.test")?.sudden, false);
});

test("a host arriving on one question of many is a citation, not a pattern", () => {
  const report = buildInterferenceReport({
    runs: RUNS,
    pages: [],
    answers: [
      answer("r1", "q1", ["https://old.test/1"]), answer("r1", "q2", ["https://old.test/2"]),
      answer("r1", "q3", ["https://old.test/3"]), answer("r1", "q4", ["https://old.test/4"]),
      answer("r2", "q1", ["https://old.test/1", "https://new.test/a"]),
      answer("r2", "q2", ["https://old.test/2"]), answer("r2", "q3", ["https://old.test/3"]),
      answer("r2", "q4", ["https://old.test/4"]),
    ],
  });
  const arrival = report.arrivals.find((row) => row.host === "new.test");
  assert.ok((arrival?.breadth || 0) < BROAD_ARRIVAL);
  assert.equal(arrival?.sudden, false);
});

test("a run that cited nothing is not a run a host failed to arrive in", () => {
  const report = buildInterferenceReport({
    runs: RUNS,
    pages: [],
    answers: [answer("r1", "q1", []), answer("r2", "q1", ["https://new.test/a"])],
  });
  assert.equal(report.runs, 1, "only one run cited anything");
  assert.equal(report.arrivals[0]?.sudden, false, "it is the first run with a citation in it");
});

test("a page that changed under a URL already cited is surfaced", () => {
  const before = Array.from({ length: 40 }, (_, i) => "alpha" + i).join(" ");
  const after = Array.from({ length: 40 }, (_, i) => (i < 10 ? "alpha" + i : "bravo" + i)).join(" ");
  const report = buildInterferenceReport({
    runs: RUNS, answers: [],
    pages: [page({ text: after, previousText: before, previousFetchedAt: "2026-09-01T00:00:00.000Z" })],
  });
  assert.equal(report.shifts.length, 1);
  assert.ok((report.shifts[0]?.changed || 0) >= PAGE_SHIFT);
  assert.equal(report.shifts[0]?.previousAt, "2026-09-01T00:00:00.000Z");
});

test("a date moving in a footer is not a page somebody worked on", () => {
  const before = Array.from({ length: 40 }, (_, i) => "alpha" + i).join(" ");
  const after = before + " updated september";
  const report = buildInterferenceReport({
    runs: RUNS, answers: [],
    pages: [page({ text: after, previousText: before, previousFetchedAt: "2026-09-01T00:00:00.000Z" })],
  });
  assert.deepEqual(report.shifts, []);
});

test("a page read further is not a page that was rewritten", () => {
  // The two reads were capped at different lengths. Comparing all of the long
  // one against the truncated one reported four live sites as rewritten.
  const before = Array.from({ length: 40 }, (_, i) => "alpha" + i).join(" ");
  const after = before + " " + Array.from({ length: 200 }, (_, i) => "bravo" + i).join(" ");
  assert.equal(textShift(before, after), 0, "nothing in the shared region changed");
  const report = buildInterferenceReport({
    runs: RUNS, answers: [],
    pages: [page({ text: after, previousText: before, previousFetchedAt: "2026-09-01T00:00:00.000Z" })],
  });
  assert.deepEqual(report.shifts, []);
});

test("a page read once has nothing to be compared against", () => {
  const report = buildInterferenceReport({ runs: RUNS, answers: [], pages: [page({ text: "a page read once only" })] });
  assert.deepEqual(report.shifts, []);
});

test("a page too short to compare is unknown rather than unchanged", () => {
  assert.equal(textShift("one two three", "four five six"), null);
  const long = Array.from({ length: 40 }, (_, i) => "word" + i).join(" ");
  assert.equal(textShift(long, "short"), null);
  assert.equal(textShift(long, long), 0);
});

test("the caveat refuses to claim intent", () => {
  assert.ok(INTERFERENCE_CAVEAT.includes("not findings"));
  assert.ok(INTERFERENCE_CAVEAT.includes("nothing here claims intent"));
  const empty = buildInterferenceReport({ runs: [], answers: [], pages: [] });
  assert.equal(empty.caveat, INTERFERENCE_CAVEAT);
  assert.equal(empty.runs, 0);
});
