import test from "node:test";
import assert from "node:assert/strict";
import { buildCitationHistory, droppedOn, RUNS_TO_CALL_IT_DROPPED } from "../src/product/citations/citation-history.js";
import type { PromptAnswer } from "../src/product/topics/prompt-run-schema.js";

function answer(runId: string, at: string, citationUrls: string[], over: Partial<PromptAnswer> = {}): PromptAnswer {
  return {
    id: `${runId}-${Math.random()}`, projectId: "p", runId, promptId: "q1", topicId: "t",
    promptText: "q", intent: "discovery", providerId: "openai", modelId: "gpt-4o",
    modelDisplayName: "M", regionId: "global", languageId: "en", status: "completed", text: "",
    mentions: [], citationUrls, errorCode: null, errorMessage: null, latencyMs: 1, createdAt: at,
    ...over,
  };
}

const PAGE = "https://tradomate.one/learn/screener";
const OTHER = "https://invezz.com/best";

function at(day: number): string {
  return `2026-0${day}-01T00:00:00.000Z`;
}

test("a page cited in every run is cited, not dropped", () => {
  const history = buildCitationHistory([
    answer("r1", at(1), [PAGE]),
    answer("r2", at(2), [PAGE]),
    answer("r3", at(3), [PAGE]),
  ]);
  const page = history.pages[0];
  assert.equal(page?.verdict, "cited");
  assert.equal(page?.runsSince, 0);
  assert.equal(page?.answers, 3);
});

test("one run of absence is slipping, not dropped", () => {
  // Everything else in this product treats a single run as inside the noise.
  const history = buildCitationHistory([
    answer("r1", at(1), [PAGE]),
    answer("r2", at(2), [PAGE]),
    answer("r3", at(3), [OTHER]),
  ]);
  const page = history.pages.find((row) => row.host === "tradomate.one");
  assert.equal(page?.verdict, "slipping");
  assert.equal(page?.runsSince, 1);
});

test("absent from two citation-carrying runs is dropped", () => {
  const history = buildCitationHistory([
    answer("r1", at(1), [PAGE]),
    answer("r2", at(2), [PAGE]),
    answer("r3", at(3), [OTHER]),
    answer("r4", at(4), [OTHER]),
  ]);
  const page = history.pages.find((row) => row.host === "tradomate.one");
  assert.equal(page?.verdict, "dropped");
  assert.equal(page?.runsSince, RUNS_TO_CALL_IT_DROPPED);
  assert.equal(page?.lastCitedAt, at(2));
});

test("a run where nothing was cited is not every page being dropped at once", () => {
  // Web search switched off for one run would otherwise read as a collapse.
  const history = buildCitationHistory([
    answer("r1", at(1), [PAGE]),
    answer("r2", at(2), []),
    answer("r3", at(3), []),
  ]);
  const page = history.pages[0];
  assert.equal(history.measurableRuns, 1);
  assert.equal(history.silentRuns, 2);
  assert.equal(page?.runsSince, 0);
  assert.equal(page?.verdict, null, "one measurable run cannot show a change in either direction");
});

test("one run says nothing either way", () => {
  const history = buildCitationHistory([answer("r1", at(1), [PAGE])]);
  assert.equal(history.pages[0]?.verdict, null);
});

test("the same page cited twice in one answer is one answer that used it", () => {
  const history = buildCitationHistory([
    answer("r1", at(1), [PAGE, `${PAGE}?utm_source=chatgpt`]),
    answer("r2", at(2), [PAGE]),
  ]);
  assert.equal(history.pages.length, 1, "a tracking parameter does not make a second page");
  assert.equal(history.pages[0]?.answers, 2);
});

test("an answer that failed carries no citation history", () => {
  const history = buildCitationHistory([
    answer("r1", at(1), [PAGE]),
    answer("r2", at(2), [PAGE], { status: "provider_failed" }),
    answer("r3", at(3), [OTHER]),
  ]);
  const page = history.pages.find((row) => row.host === "tradomate.one");
  assert.equal(page?.runs.length, 2, "the failed run cited nothing, so it is not measurable");
});

test("a page records the questions it was cited on, so a drop reads against them", () => {
  const history = buildCitationHistory([
    answer("r1", at(1), [PAGE], { promptId: "q1" }),
    answer("r1", at(1), [PAGE], { promptId: "q2" }),
    answer("r2", at(2), [PAGE], { promptId: "q1" }),
    answer("r3", at(3), [OTHER]),
    answer("r4", at(4), [OTHER]),
  ]);
  const page = history.pages.find((row) => row.host === "tradomate.one");
  assert.deepEqual(page?.promptIds, ["q1", "q2"]);
});

test("only your own pages are ones you can refresh", () => {
  const history = buildCitationHistory([
    answer("r1", at(1), [PAGE, OTHER]),
    answer("r2", at(2), [PAGE, OTHER]),
    answer("r3", at(3), ["https://third.example/x"]),
    answer("r4", at(4), ["https://third.example/x"]),
  ]);
  const mine = droppedOn(history, "tradomate.one");
  assert.equal(mine.length, 1);
  assert.equal(mine[0]?.host, "tradomate.one");
  assert.equal(droppedOn(history, "").length, 0, "no domain means no claim about whose page it is");
});

test("a subdomain of yours is yours", () => {
  const history = buildCitationHistory([
    answer("r1", at(1), ["https://docs.tradomate.one/a"]),
    answer("r2", at(2), ["https://docs.tradomate.one/a"]),
    answer("r3", at(3), [OTHER]),
    answer("r4", at(4), [OTHER]),
  ]);
  assert.equal(droppedOn(history, "tradomate.one").length, 1);
  assert.equal(droppedOn(history, "radomate.one").length, 0, "a suffix is not a subdomain");
});

test("worst first: dropped before slipping before cited once before cited", () => {
  const history = buildCitationHistory([
    answer("r1", at(1), ["https://a.example/1", "https://b.example/2", "https://d.example/4"]),
    answer("r2", at(2), ["https://a.example/1", "https://b.example/2", "https://c.example/3"]),
    answer("r3", at(3), ["https://b.example/2", "https://c.example/3"]),
    answer("r4", at(4), ["https://c.example/3"]),
  ]);
  assert.deepEqual(history.pages.map((row) => row.verdict), ["dropped", "slipping", "cited_once", "cited"]);
});

test("a page cited in only one run has no pattern to lose", () => {
  // Seven of nine pages the live project called dropped were cited exactly
  // once, ever. Reporting those as a regression sends work to the wrong page.
  const history = buildCitationHistory([
    answer("r1", at(1), [PAGE]),
    answer("r2", at(2), [OTHER]),
    answer("r3", at(3), [OTHER]),
  ]);
  const page = history.pages.find((row) => row.host === "tradomate.one");
  assert.equal(page?.verdict, "cited_once");
  assert.equal(page?.runsCited, 1);
  assert.equal(droppedOn(history, "tradomate.one").length, 0, "nothing to refresh on a page that never held a citation");
});

test("cited in two runs and then gone is a page that really stopped", () => {
  const history = buildCitationHistory([
    answer("r1", at(1), [PAGE]),
    answer("r2", at(2), [PAGE]),
    answer("r3", at(3), [OTHER]),
    answer("r4", at(4), [OTHER]),
  ]);
  const page = history.pages.find((row) => row.host === "tradomate.one");
  assert.equal(page?.verdict, "dropped");
  assert.equal(page?.runsCited, 2);
  assert.equal(droppedOn(history, "tradomate.one").length, 1);
});
