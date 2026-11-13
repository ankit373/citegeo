import test from "node:test";
import assert from "node:assert/strict";
import { buildPageTypeReport } from "../src/product/topics/page-type-split.js";
import type { PromptAnswer, PromptRun } from "../src/product/topics/prompt-run-schema.js";
import type { Topic } from "../src/product/topics/topic-schema.js";
import { pageTypesView } from "../src/ui/app/pages/page-types-view.js";

function answer(over: Partial<PromptAnswer>): PromptAnswer {
  return {
    id: "a", projectId: "p", runId: "run-1", promptId: "q", topicId: "t1", promptText: "which tool",
    intent: "discovery", providerId: "openai", modelId: "m", modelDisplayName: "M", regionId: "global",
    languageId: "en", status: "completed", text: "", mentions: [], citationUrls: [], errorCode: null,
    errorMessage: null, latencyMs: null, createdAt: "2026-10-01T00:00:00.000Z", ...over,
  } as PromptAnswer;
}

function run(id: string, startedAt: string): PromptRun {
  return {
    id, projectId: "p", status: "completed", promptIds: [], modelIds: [], regionIds: [], languageIds: [],
    answersRequested: 0, answersCompleted: 0, answersFailed: 0, startedAt, completedAt: startedAt,
  };
}

const topics: Topic[] = [
  { id: "t1", projectId: "p", name: "Research", description: "", source: "authored", status: "active", createdAt: "" },
  { id: "t2", projectId: "p", name: "Alerts", description: "", source: "authored", status: "active", createdAt: "" },
];
const runs = [run("run-1", "2026-10-01T00:00:00.000Z"), run("run-2", "2026-10-08T00:00:00.000Z")];

function share(report: ReturnType<typeof buildPageTypeReport>, topicId: string, runIndex: number, type: string) {
  const topic = report.topics.find((row) => row.topicId === topicId);
  return topic?.runs[runIndex]?.types.find((row) => row.type === type);
}

test("a page cited twice in one answer counts once, and tracking parameters do not split it", () => {
  const report = buildPageTypeReport({
    topics, runs,
    answers: [answer({ citationUrls: ["https://pub.test/a-vs-b", "https://pub.test/a-vs-b/?utm_source=x", "https://pub.test/blog/x"] })],
  });
  const topic = report.topics[0];
  assert.equal(topic?.runs[0]?.citations, 2);
  assert.deepEqual(share(report, "t1", 0, "comparison"), { type: "comparison", citations: 1, share: 0.5 });
  assert.equal(topic?.pages.length, 2);
});

test("splits are per topic and per run, oldest run first, with the change between the last two", () => {
  const report = buildPageTypeReport({
    topics, runs,
    answers: [
      answer({ id: "1", runId: "run-2", citationUrls: ["https://docs.pub.test/x", "https://docs.pub.test/y"] }),
      answer({ id: "2", runId: "run-1", citationUrls: ["https://docs.pub.test/x", "https://pub.test/forum/z"] }),
      answer({ id: "3", runId: "run-1", topicId: "t2", citationUrls: ["https://pub.test/pricing"] }),
    ],
  });
  const research = report.topics.find((row) => row.topicId === "t1");
  assert.deepEqual(research?.runs.map((row) => row.runId), ["run-1", "run-2"]);
  const docs = research?.changes?.find((row) => row.type === "docs");
  assert.deepEqual(docs, { type: "docs", previous: 0.5, latest: 1, change: 0.5 });
  assert.deepEqual(research?.leaders, ["docs"]);
  const alerts = report.topics.find((row) => row.topicId === "t2");
  assert.equal(alerts?.changes, null, "one run has nothing to change from");
  assert.deepEqual(alerts?.leaders, ["vendor"]);
  // Sorted by topic name, so the order does not depend on the order answers arrived.
  assert.deepEqual(report.topics.map((row) => row.topicName), ["Alerts", "Research"]);
});

test("a run that cited nothing reads as not measurable, never as a zero share", () => {
  const report = buildPageTypeReport({
    topics, runs,
    answers: [
      answer({ id: "1", runId: "run-1", citationUrls: ["https://pub.test/blog/x"] }),
      answer({ id: "2", runId: "run-2", citationUrls: [] }),
    ],
  });
  const topic = report.topics[0];
  assert.equal(topic?.runs[1]?.citations, 0);
  assert.equal(share(report, "t1", 1, "article")?.share, null);
  assert.equal(topic?.changes?.find((row) => row.type === "article")?.change, null);
  // The leader comes from the latest run that cited anything.
  assert.deepEqual(topic?.leaders, ["article"]);
  assert.equal(report.answersWithCitations, 1);
});

test("failed answers are left out, and ties keep every leader", () => {
  const report = buildPageTypeReport({
    topics, runs,
    answers: [
      answer({ id: "1", citationUrls: ["https://pub.test/blog/x", "https://pub.test/pricing"] }),
      answer({ id: "2", status: "provider_failed", citationUrls: ["https://pub.test/forum/z"] }),
    ],
  });
  assert.equal(report.answers, 1);
  assert.deepEqual(report.topics[0]?.leaders, ["vendor", "article"]);
});

test("company domains reach the classifier, and every page carries its rule", () => {
  const report = buildPageTypeReport({
    topics, runs, companyDomains: ["rival.test"],
    answers: [answer({ citationUrls: ["https://rival.test/"] })],
  });
  assert.deepEqual(report.topics[0]?.pages[0]?.reading, { type: "vendor", rule: "company-site", evidence: "rival.test" });
});

test("the view says why it is empty, and escapes what it prints", () => {
  assert.ok(pageTypesView(buildPageTypeReport({ topics, runs, answers: [] })).includes("No answers yet"));
  assert.ok(pageTypesView(buildPageTypeReport({ topics, runs, answers: [answer({})] })).includes("cited a page"));
  const marked = [{ ...topics[0], name: "<i>Research</i>" } as Topic];
  const view = pageTypesView(buildPageTypeReport({
    topics: marked, runs,
    answers: [answer({ citationUrls: ["https://pub.test/blog/x"] })],
  }));
  assert.ok(view.includes("Blog or article"));
  assert.ok(view.includes("path has: blog"));
  assert.ok(view.includes("&lt;i&gt;Research"));
  assert.ok(!view.includes("<i>Research"));
});
