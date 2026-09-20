import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPromptTrend } from "../src/product/topics/prompt-trend.js";
import { buildTopicInsights } from "../src/product/topics/topic-insights.js";
import { audienceInstruction, GLOBAL_REGION, region, REGIONS } from "../src/product/topics/region.js";
import { promptAnswerPrompt } from "../src/product/topics/prompt-answer-protocol.js";
import { PromptScheduleFileStore, PromptScheduleService } from "../src/product/topics/prompt-schedule.js";
import { ProductProjectFileStore } from "../src/product/projects/project-store.js";
import { ProductProjectService } from "../src/product/projects/project-service.js";
import type { AnswerMention, PromptAnswer, PromptRun } from "../src/product/topics/prompt-run-schema.js";
import type { TopicSet } from "../src/product/topics/topic-schema.js";

function mention(overrides: Partial<AnswerMention> & { name: string }): AnswerMention {
  return { domain: null, recommendation: "mentioned", mentionQuote: null, firstMentionOffset: null, firstMentionState: "unresolved", isTarget: false, ...overrides };
}

function answer(overrides: Partial<PromptAnswer> = {}): PromptAnswer {
  return {
    id: `a-${Math.random()}`, projectId: "p", runId: "r1", promptId: "prompt-1", topicId: "topic-1",
    promptText: "best stock screener", intent: "discovery", providerId: "openrouter", modelId: "m",
    modelDisplayName: "M", regionId: "global", languageId: "en", status: "completed", text: "...", mentions: [],
    citationUrls: [], errorCode: null, errorMessage: null, latencyMs: 1, createdAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function run(id: string, startedAt: string, regionIds: string[] = ["global"]): PromptRun {
  return { id, projectId: "p", status: "completed", promptIds: ["prompt-1"], modelIds: ["m"], regionIds, languageIds: ["en"], answersRequested: 1, answersCompleted: 1, answersFailed: 0, startedAt, completedAt: startedAt };
}

const SET: TopicSet = {
  projectId: "p", generatedAt: null, updatedAt: "",
  topics: [{ id: "topic-1", projectId: "p", name: "Screening", description: "", source: "generated", status: "active", createdAt: "" }],
  prompts: [{ id: "prompt-1", projectId: "p", topicId: "topic-1", text: "best stock screener", normalizedText: "best stock screener", intent: "discovery", source: "generated", measuresVisibility: true, visibilityExclusionReason: null, status: "active", createdAt: "", activatedAt: null }],
};

test("a trend is one point per run, oldest first", () => {
  const trend = buildPromptTrend({
    runs: [run("r2", "2026-09-08T00:00:00.000Z"), run("r1", "2026-09-01T00:00:00.000Z")],
    answers: [
      answer({ runId: "r1", mentions: [mention({ name: "Rival" })] }),
      answer({ runId: "r2", mentions: [mention({ name: "Us", isTarget: true, recommendation: "positive", firstMentionOffset: 1 })] }),
    ],
    rankOf: () => null,
  });
  assert.deepEqual(trend.points.map((point) => point.runId), ["r1", "r2"]);
  assert.equal(trend.points[0]?.score.score, 0);
  assert.equal(trend.points[1]?.score.score, 100);
  assert.equal(trend.change, 100);
});

test("a run where every answer failed is left out, not plotted as a drop to zero", () => {
  // An outage is not a loss of visibility, and a dip in the chart would say it was.
  const trend = buildPromptTrend({
    runs: [run("r1", "2026-09-01T00:00:00.000Z"), run("r2", "2026-09-08T00:00:00.000Z")],
    answers: [
      answer({ runId: "r1", mentions: [mention({ name: "Us", isTarget: true })] }),
      answer({ runId: "r2", status: "provider_failed" }),
    ],
    rankOf: () => null,
  });
  assert.deepEqual(trend.points.map((point) => point.runId), ["r1"]);
  assert.equal(trend.change, null, "one point is not a trend");
});

test("a single run reports no change rather than a change of zero", () => {
  const trend = buildPromptTrend({ runs: [run("r1", "2026-09-01T00:00:00.000Z")], answers: [answer({})], rankOf: () => null });
  assert.equal(trend.change, null);
  assert.equal(trend.since, null);
});

test("markets are compared only when more than one was asked", () => {
  const single = buildTopicInsights({ projectId: "p", set: SET, answers: [answer({ regionId: "us" })] });
  assert.deepEqual(single.byRegion, [], "one market is not a comparison");

  const many = buildTopicInsights({
    projectId: "p",
    set: SET,
    answers: [
      answer({ regionId: "us", mentions: [mention({ name: "Us", isTarget: true, recommendation: "positive", firstMentionOffset: 1 })] }),
      answer({ regionId: "in", mentions: [mention({ name: "Rival" })] }),
    ],
  });
  assert.equal(many.byRegion.length, 2);
  assert.equal(many.byRegion[0]?.label, "India", "worst market first");
  assert.equal(many.byRegion[0]?.score.score, 0);
});

test("every regional figure carries the caveat that the market is stated, not detected", () => {
  const insights = buildTopicInsights({ projectId: "p", set: SET, answers: [answer({})] });
  assert.ok(insights.regionCaveat.includes("stated to the model"));
  assert.ok(insights.regionCaveat.includes("not detected"));
});

test("the global market adds nothing to the prompt, so old runs stay comparable", () => {
  assert.equal(audienceInstruction(GLOBAL_REGION), "");
  const plain = promptAnswerPrompt({ question: "best screener" });
  const global = promptAnswerPrompt({ question: "best screener", audience: audienceInstruction(GLOBAL_REGION) });
  assert.equal(plain, global);
});

test("a stated market is added to the prompt verbatim", () => {
  const india = region("in");
  assert.ok(india);
  const prompt = promptAnswerPrompt({ question: "best screener", audience: audienceInstruction(india) });
  assert.ok(prompt.includes("Answer as you would for someone in India."));
});

test("every market declares a locale and a distinct id", () => {
  const ids = new Set(REGIONS.map((row) => row.id));
  assert.equal(ids.size, REGIONS.length);
  assert.ok(REGIONS.every((row) => row.locale.length > 0 && row.label.length > 0));
});

async function scheduleHarness() {
  const dir = await mkdtemp(join(tmpdir(), "citegeo-sched-"));
  const store = new ProductProjectFileStore(dir);
  const projects = new ProductProjectService(store);
  const project = await projects.createDraft({ name: "N", primaryDomain: "example.com", brandName: "N" });
  const started: Array<{ projectId: string; regionIds?: string[] }> = [];
  const runs = {
    start: async (input: { projectId: string; regionIds?: string[] }) => {
      started.push(input);
      return { id: "prompt-run-1" };
    },
  };
  const service = new PromptScheduleService(new PromptScheduleFileStore(store), runs as never);
  return { service, projectId: project.id, started, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test("a schedule is off until it is enabled, and enabling computes the next run", async () => {
  const { service, projectId, cleanup } = await scheduleHarness();
  try {
    assert.equal((await service.get(projectId)).enabled, false);
    const set = await service.set(projectId, { enabled: true, rule: { frequency: "daily", timezone: "UTC", hour: 9, minute: 0 } });
    assert.equal(set.enabled, true);
    assert.ok(set.nextRunAt, "an enabled schedule knows when it next fires");
  } finally {
    await cleanup();
  }
});

test("an invalid rule is refused when set, not silently never fired", async () => {
  const { service, projectId, cleanup } = await scheduleHarness();
  try {
    await assert.rejects(() => service.set(projectId, { enabled: true, rule: { frequency: "weekly", timezone: "UTC", hour: 9, minute: 0 } }));
  } finally {
    await cleanup();
  }
});

test("a due schedule runs once and advances before the run starts", async () => {
  const { service, projectId, started, cleanup } = await scheduleHarness();
  try {
    await service.set(projectId, { enabled: true, rule: { frequency: "daily", timezone: "UTC", hour: 9, minute: 0 }, regionIds: ["us", "in"] });
    const later = new Date(Date.now() + 1000 * 60 * 60 * 48);
    await service.runDue([projectId], later);
    assert.equal(started.length, 1);
    assert.deepEqual(started[0]?.regionIds, ["us", "in"]);
    const after = await service.get(projectId);
    assert.equal(after.lastRunId, "prompt-run-1");
    // Advanced past the firing time, so a slow run cannot queue a second copy.
    assert.ok(Date.parse(after.nextRunAt || "") > later.getTime());
  } finally {
    await cleanup();
  }
});

test("a schedule that is not due does not run", async () => {
  const { service, projectId, started, cleanup } = await scheduleHarness();
  try {
    await service.set(projectId, { enabled: true, rule: { frequency: "monthly", timezone: "UTC", hour: 9, minute: 0, dayOfMonth: 1 } });
    await service.runDue([projectId], new Date());
    assert.equal(started.length, 0);
  } finally {
    await cleanup();
  }
});

test("a failing run is recorded on the schedule rather than thrown away", async () => {
  const dir = await mkdtemp(join(tmpdir(), "citegeo-sched-fail-"));
  try {
    const store = new ProductProjectFileStore(dir);
    const projects = new ProductProjectService(store);
    const project = await projects.createDraft({ name: "N", primaryDomain: "example.com", brandName: "N" });
    const runs = { start: async () => { throw new Error("No active prompts."); } };
    const service = new PromptScheduleService(new PromptScheduleFileStore(store), runs as never);
    await service.set(project.id, { enabled: true, rule: { frequency: "daily", timezone: "UTC", hour: 9, minute: 0 } });
    const fired = await service.runDue([project.id], new Date(Date.now() + 1000 * 60 * 60 * 48));
    assert.equal(fired[0]?.lastError, "No active prompts.");
    // A silent failure is how a tracker stops tracking without anyone noticing.
    assert.ok(fired[0]?.nextRunAt, "it still schedules the next attempt");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
