import test from "node:test";
import assert from "node:assert/strict";
import { PromptRunService } from "../src/product/topics/prompt-run-service.js";
import type { PromptAnswer, PromptRun } from "../src/product/topics/prompt-run-schema.js";

const MODELS = [
  { providerId: "openai", modelId: "alpha-1", displayName: "A1", webSearchMode: "off" },
  { providerId: "anthropic", modelId: "beta-1", displayName: "B1", webSearchMode: "off" },
];

function answer(over: Partial<PromptAnswer>): PromptAnswer {
  return {
    id: String(Math.random()), projectId: "p", runId: "run-1", promptId: "q1", topicId: "t",
    promptText: "q", intent: "discovery", providerId: "openai", modelId: "alpha-1", modelDisplayName: "A1",
    regionId: "global", languageId: "en", personaId: "anyone", status: "completed", text: "", mentions: [],
    citationUrls: [], errorCode: null, errorMessage: null, latencyMs: 1, createdAt: "2026-10-04T00:00:00.000Z",
    ...over,
  } as PromptAnswer;
}

const PREVIOUS: PromptRun = {
  id: "run-1", projectId: "p", status: "completed", promptIds: ["q1", "q2"],
  modelIds: ["alpha-1", "beta-1"], regionIds: ["global"], languageIds: ["en"], personaIds: ["anyone"],
  answersRequested: 4, answersCompleted: 2, answersFailed: 2,
  startedAt: "2026-10-04T00:00:00.000Z", completedAt: "2026-10-04T00:10:00.000Z",
};

function service(stored: PromptAnswer[], asked: Array<{ model: string; prompt: string }>) {
  const store = {
    listRuns: async () => [PREVIOUS],
    listAnswers: async () => stored,
    saveRun: async () => {},
    saveAnswer: async () => {},
  };
  const topics = {
    get: async () => ({
      projectId: "p", topics: [], generatedAt: null, updatedAt: "",
      prompts: ["q1", "q2"].map((id) => ({
        id, projectId: "p", topicId: "t", text: id, normalizedText: id, intent: "discovery",
        source: "authored", measuresVisibility: true, visibilityExclusionReason: null,
        status: "active", createdAt: "", activatedAt: "",
      })),
    }),
    targetIdentity: async () => ({ host: "mine.test", distinctive: ["mine"], ambiguous: [], nameMatchingUnreliable: false, caveat: null }),
  };
  const executor = {
    execute: async (request: { modelSnapshot: { modelId: string }; prompt: string }) => {
      asked.push({ model: request.modelSnapshot.modelId, prompt: request.prompt });
      return {
        providerId: "openai", providerName: "x", sourceType: "model_api", sourceLabel: "x", resultCaveat: "c",
        model: "m", modelVersion: "m", text: "An answer.",
        structuredOutput: { transport: "response_json_schema", value: JSON.stringify({ analysisStatus: "completed", answer: "An answer.", mentions: [], citationUrls: [] }) },
        citations: [], webQueries: [], latencyMs: 1, createdAt: "2026-10-04T00:00:00.000Z",
      };
    },
  };
  return new PromptRunService(
    store as never, topics as never,
    { get: async () => ({ id: "p", normalizedDomain: "mine.test" }) } as never,
    { list: async () => [{ id: "b", projectId: "p", version: 1, createdAt: "", modelSnapshots: MODELS }] } as never,
    executor as never,
  );
}

test("a retry asks only what failed, not the whole run again", () => {
  // Live: 36 of 168 failed and the only remedy was all 168 again.
  const stored = [
    answer({ promptId: "q1", modelId: "alpha-1", status: "completed" }),
    answer({ promptId: "q1", modelId: "beta-1", providerId: "anthropic", status: "provider_failed", errorCode: "rate_limited" }),
    answer({ promptId: "q2", modelId: "alpha-1", status: "completed" }),
    answer({ promptId: "q2", modelId: "beta-1", providerId: "anthropic", status: "provider_failed", errorCode: "rate_limited" }),
  ];
  const asked: Array<{ model: string; prompt: string }> = [];
  return service(stored, asked).start({ projectId: "p", retryOf: "run-1" }).then((run) => {
    assert.equal(run.answersRequested, 2, "asked the whole cross product again");
    assert.deepEqual(asked.map((row) => row.model), ["beta-1", "beta-1"]);
  });
});

test("a surface that answered nothing is not a failure to ask again", async () => {
  // It was reached and had nothing to say, which is a finding, not a retry.
  const stored = [
    answer({ promptId: "q1", modelId: "alpha-1", status: "no_answer" }),
    answer({ promptId: "q2", modelId: "beta-1", providerId: "anthropic", status: "analysis_failed" }),
  ];
  const asked: Array<{ model: string; prompt: string }> = [];
  const run = await service(stored, asked).start({ projectId: "p", retryOf: "run-1" });
  assert.equal(run.answersRequested, 1);
  assert.deepEqual(asked.map((row) => row.model), ["beta-1"]);
});

test("a run with nothing failed says so rather than asking everything again", async () => {
  const stored = [answer({ promptId: "q1", modelId: "alpha-1", status: "completed" })];
  await assert.rejects(
    () => service(stored, []).start({ projectId: "p", retryOf: "run-1" }),
    (error: Error) => error.message.includes("Nothing failed"),
  );
});

test("a subset of models can be asked without changing what is saved", async () => {
  const asked: Array<{ model: string; prompt: string }> = [];
  const run = await service([], asked).start({ projectId: "p", modelIds: ["beta-1"] });
  assert.deepEqual(run.modelIds, ["beta-1"]);
  assert.equal(asked.length, 2, "two questions by the one model asked for");
});
