import test from "node:test";
import assert from "node:assert/strict";
import { PromptRunService } from "../src/product/topics/prompt-run-service.js";

function service(personas: Array<{ id: string; label: string; describedAs: string; tracked: boolean }>, asked: string[]) {
  const store = { listRuns: async () => [], saveRun: async () => {}, saveAnswer: async () => {} };
  const topics = {
    get: async () => ({
      projectId: "p", topics: [], generatedAt: null, updatedAt: "",
      prompts: [{
        id: "q1", projectId: "p", topicId: "t", text: "best screener", normalizedText: "best screener",
        intent: "discovery", source: "authored", measuresVisibility: true, visibilityExclusionReason: null,
        status: "active", createdAt: "", activatedAt: "",
      }],
    }),
    targetIdentity: async () => ({ host: "mine.test", distinctive: ["mine"], ambiguous: [], nameMatchingUnreliable: false, caveat: null }),
  };
  const executor = {
    execute: async (request: { prompt: string }) => {
      asked.push(request.prompt);
      return {
        providerId: "alpha", providerName: "x", sourceType: "model_api", sourceLabel: "x", resultCaveat: "c",
        model: "m", modelVersion: "m", text: "An answer.",
        structuredOutput: { transport: "response_json_schema", value: JSON.stringify({ analysisStatus: "completed", answer: "An answer.", mentions: [], citationUrls: [] }) },
        citations: [], webQueries: [], latencyMs: 1, createdAt: "2026-10-04T00:00:00.000Z",
      };
    },
  };
  return new PromptRunService(
    store as never,
    topics as never,
    { get: async () => ({ id: "p", normalizedDomain: "mine.test" }) } as never,
    { list: async () => [{ id: "b", projectId: "p", version: 1, createdAt: "", modelSnapshots: [{ providerId: "alpha", modelId: "a-1", displayName: "A", webSearchMode: "off" }] }] } as never,
    executor as never,
    undefined,
    undefined,
    { get: async () => ({ projectId: "p", personas, updatedAt: "" }) } as never,
  );
}

test("a run asked for nothing in particular covers every tracked persona", () => {
  // The interface says adding one multiplies a run. It did not: the button
  // sent no persona and the run asked on nobody's behalf, every time.
  const asked: string[] = [];
  return service([
    { id: "beginner", label: "Beginner", describedAs: "somebody new to investing", tracked: true },
    { id: "retired", label: "Retired", describedAs: "somebody who stopped using it", tracked: false },
  ], asked).start({ projectId: "p" }).then((run) => {
    assert.deepEqual(run.personaIds, ["anyone", "beginner"]);
    assert.equal(asked.length, 2);
    assert.ok(asked.some((prompt) => prompt.includes("somebody new to investing")));
    assert.equal(asked.filter((prompt) => prompt.includes("somebody who stopped using it")).length, 0, "a retired persona is not asked");
  });
});

test("asking for one persona asks for that one and no others", async () => {
  const asked: string[] = [];
  const run = await service([{ id: "beginner", label: "Beginner", describedAs: "somebody new", tracked: true }], asked)
    .start({ projectId: "p", personaIds: ["beginner"] });
  assert.deepEqual(run.personaIds, ["beginner"]);
  assert.equal(asked.length, 1);
});

test("no personas at all is still the run it always was", async () => {
  const asked: string[] = [];
  const run = await service([], asked).start({ projectId: "p" });
  assert.deepEqual(run.personaIds, ["anyone"]);
  assert.equal(asked.length, 1);
});
