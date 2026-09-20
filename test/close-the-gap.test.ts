import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promptExportNames, promptExportTable, promptExportTables } from "../src/product/topics/topic-export.js";
import { buildTopicInsights } from "../src/product/topics/topic-insights.js";
import { DEFAULT_LANGUAGE, LANGUAGES, language, languageForLocale, languageInstruction } from "../src/product/topics/language.js";
import { promptAnswerPrompt } from "../src/product/topics/prompt-answer-protocol.js";
import { BROWSER_ENGINES, browserEngine } from "../src/product/engines/engine-registry.js";
import { REGIONS } from "../src/product/topics/region.js";
import { TopicFileStore } from "../src/product/topics/topic-store.js";
import { TopicService, TopicSetUnavailableError } from "../src/product/topics/topic-service.js";
import { ProductProjectFileStore } from "../src/product/projects/project-store.js";
import { ProductProjectService } from "../src/product/projects/project-service.js";
import type { AnswerMention, PromptAnswer } from "../src/product/topics/prompt-run-schema.js";
import type { TopicSet } from "../src/product/topics/topic-schema.js";

function mention(overrides: Partial<AnswerMention> & { name: string }): AnswerMention {
  return { domain: null, recommendation: "mentioned", mentionQuote: null, firstMentionOffset: null, firstMentionState: "unresolved", isTarget: false, ...overrides };
}

function answer(overrides: Partial<PromptAnswer> = {}): PromptAnswer {
  return {
    id: `a-${Math.random()}`, projectId: "p", runId: "r1", promptId: "prompt-1", topicId: "topic-1",
    promptText: "best stock screener", intent: "discovery", providerId: "openrouter", modelId: "m",
    modelDisplayName: "M", regionId: "global", languageId: "en", status: "completed", text: "...",
    mentions: [], citationUrls: [], errorCode: null, errorMessage: null, latencyMs: 1,
    createdAt: "2026-09-01T00:00:00.000Z", ...overrides,
  };
}

const SET: TopicSet = {
  projectId: "p", generatedAt: null, updatedAt: "",
  topics: [{ id: "topic-1", projectId: "p", name: "Screening, ranked", description: "", source: "generated", status: "active", createdAt: "" }],
  prompts: [{ id: "prompt-1", projectId: "p", topicId: "topic-1", text: "best stock screener", normalizedText: "best stock screener", intent: "discovery", source: "generated", measuresVisibility: true, visibilityExclusionReason: null, status: "active", createdAt: "", activatedAt: null }],
};

const INSIGHTS = () => buildTopicInsights({
  projectId: "p",
  set: SET,
  answers: [
    answer({ mentions: [mention({ name: "Rival, Inc", firstMentionOffset: 1 }), mention({ name: "Us", isTarget: true, firstMentionOffset: 2 })] }),
    answer({ regionId: "in", languageId: "de", mentions: [mention({ name: "Rival, Inc" })] }),
  ],
  runs: [{ id: "r1", projectId: "p", status: "completed", promptIds: ["prompt-1"], modelIds: ["m"], regionIds: ["global"], languageIds: ["en"], answersRequested: 2, answersCompleted: 2, answersFailed: 0, startedAt: "2026-09-01T00:00:00.000Z", completedAt: null }],
});

test("every advertised prompt export produces a table", () => {
  const tables = promptExportTables(INSIGHTS());
  for (const name of promptExportNames()) {
    assert.ok(name in tables, `${name} is advertised but has no table`);
  }
});

test("a name containing a comma is quoted, not split across columns", () => {
  const csv = promptExportTable(INSIGHTS(), "leaderboard") || "";
  assert.ok(csv.includes('"Rival, Inc"'));
});

test("a null score exports as an empty cell, never as zero", () => {
  const empty = buildTopicInsights({ projectId: "p", set: SET, answers: [answer({ status: "provider_failed" })] });
  const csv = promptExportTable(empty, "scores") || "";
  const row = csv.split("\r\n")[1] || "";
  assert.ok(row.includes(",,"), `expected empty cells for unmeasurable values, saw ${row}`);
});

test("the name works with or without the extension, and an unknown one is null", () => {
  assert.equal(promptExportTable(INSIGHTS(), "trend"), promptExportTable(INSIGHTS(), "trend.csv"));
  assert.equal(promptExportTable(INSIGHTS(), "nonsense"), null);
});

test("English adds the instruction it always did, so old runs stay comparable", () => {
  assert.equal(languageInstruction(DEFAULT_LANGUAGE), "Use English for all string values.");
  assert.equal(promptAnswerPrompt({ question: "q" }), promptAnswerPrompt({ question: "q", languageInstruction: languageInstruction(DEFAULT_LANGUAGE) }));
});

test("another language changes the answer but not the structured fields", () => {
  const german = language("de");
  assert.ok(german);
  const instruction = languageInstruction(german);
  assert.ok(instruction.includes("Write the answer in German"));
  // Translating the enums would break parsing and translating a name would
  // invent a second entity for one brand.
  assert.ok(instruction.includes("Keep every other field in English"));
  assert.ok(instruction.includes("company names exactly as they are normally written"));
});

test("a market's locale picks its language, and an unknown one falls back to English", () => {
  assert.equal(languageForLocale("de-DE").id, "de");
  assert.equal(languageForLocale("en-IN").id, "en");
  assert.equal(languageForLocale("xx-YY").id, "en");
});

test("languages are compared only when a run asked in more than one", () => {
  const single = buildTopicInsights({ projectId: "p", set: SET, answers: [answer({})] });
  assert.deepEqual(single.byLanguage, []);
  const many = INSIGHTS();
  assert.equal(many.byLanguage.length, 2);
  assert.equal(many.byLanguage[0]?.label, "German", "worst language first");
});

test("every language and market declares a distinct id and a label", () => {
  for (const rows of [LANGUAGES, REGIONS]) {
    const ids = new Set(rows.map((row) => row.id));
    assert.equal(ids.size, rows.length);
    assert.ok(rows.every((row) => row.label.length > 0));
  }
});

test("the four surfaces buyers use are all addressable", () => {
  assert.equal(BROWSER_ENGINES.length, 4);
  for (const id of ["google-ai-overview", "perplexity-web", "chatgpt", "copilot"]) {
    assert.equal(browserEngine(id)?.id, id, `${id} is not registered`);
  }
});

test("the product engine says it is not the API, because they measure different things", () => {
  const chatgpt = browserEngine("chatgpt");
  assert.ok(chatgpt?.caveat.includes("API"));
});

async function harness() {
  const dir = await mkdtemp(join(tmpdir(), "citegeo-bulk-"));
  const store = new ProductProjectFileStore(dir);
  const projects = new ProductProjectService(store);
  const project = await projects.createDraft({ name: "N", primaryDomain: "example.com", brandName: "Ninethirty" });
  const service = new TopicService(new TopicFileStore(store), projects);
  const set = await service.addTopic(project.id, { name: "Pasted" });
  return { service, projectId: project.id, topicId: set.topics[0]!.id, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test("a pasted list becomes one prompt per line", async () => {
  const { service, projectId, topicId, cleanup } = await harness();
  try {
    const result = await service.addPrompts(projectId, {
      topicId,
      intent: "discovery",
      text: "best stock screener\n\n  alternatives to screener.in  \nbest portfolio tracker\n",
    });
    assert.equal(result.added, 3, "blank lines are skipped, not counted");
    assert.equal(result.set.prompts.length, 3);
    assert.ok(result.set.prompts.every((prompt) => prompt.status === "active"));
  } finally {
    await cleanup();
  }
});

test("a duplicate in a pasted list is skipped rather than refusing the whole paste", async () => {
  const { service, projectId, topicId, cleanup } = await harness();
  try {
    await service.addPrompts(projectId, { topicId, intent: "discovery", text: "best stock screener" });
    const result = await service.addPrompts(projectId, { topicId, intent: "discovery", text: "best stock screener\nbest portfolio tracker" });
    assert.equal(result.added, 1);
    assert.equal(result.skipped, 1);
  } finally {
    await cleanup();
  }
});

test("a pasted line naming the brand still cannot measure visibility", async () => {
  const { service, projectId, topicId, cleanup } = await harness();
  try {
    const result = await service.addPrompts(projectId, { topicId, intent: "brand", text: "is ninethirty any good\nbest stock screener" });
    const named = result.set.prompts.find((prompt) => prompt.text.includes("ninethirty"));
    assert.equal(named?.measuresVisibility, false);
    assert.equal(named?.visibilityExclusionReason, "names_the_brand");
  } finally {
    await cleanup();
  }
});

test("text with no questions in it is refused rather than silently adding nothing", async () => {
  const { service, projectId, topicId, cleanup } = await harness();
  try {
    await assert.rejects(() => service.addPrompts(projectId, { topicId, intent: "discovery", text: "\n  \n" }), TopicSetUnavailableError);
  } finally {
    await cleanup();
  }
});
