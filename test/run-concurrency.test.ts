import test from "node:test";
import assert from "node:assert/strict";
import { PromptRunService } from "../src/product/topics/prompt-run-service.js";

/** Records when each provider is asked, so overlap can be asserted rather
 * than timed. */
function recorder() {
  const log: string[] = [];
  const inFlight = new Map<string, number>();
  const seenTogether = new Set<string>();
  let maxPerProvider = 0;
  return {
    log,
    seenTogether,
    get maxPerProvider() { return maxPerProvider; },
    async run(providerId: string) {
      const now = (inFlight.get(providerId) || 0) + 1;
      inFlight.set(providerId, now);
      maxPerProvider = Math.max(maxPerProvider, now);
      if ([...inFlight.values()].filter((count) => count > 0).length > 1) {
        seenTogether.add([...inFlight.entries()].filter(([, count]) => count > 0).map(([id]) => id).sort().join("+"));
      }
      log.push(`start ${providerId}`);
      await new Promise((resolve) => setTimeout(resolve, 5));
      log.push(`end ${providerId}`);
      inFlight.set(providerId, (inFlight.get(providerId) || 1) - 1);
    },
  };
}

function service(track: ReturnType<typeof recorder>, runs: unknown[]) {
  const models = [
    { providerId: "alpha", modelId: "alpha-1", displayName: "A1", webSearchMode: "off" },
    { providerId: "beta", modelId: "beta-1", displayName: "B1", webSearchMode: "off" },
  ];
  const store = {
    listRuns: async () => [],
    saveRun: async (row: unknown) => { runs.push(JSON.parse(JSON.stringify(row))); },
    saveAnswer: async () => {},
  };
  const topics = {
    get: async () => ({
      projectId: "p", topics: [], generatedAt: null, updatedAt: "",
      prompts: [1, 2, 3].map((n) => ({
        id: `q${n}`, projectId: "p", topicId: "t", text: `question ${n}`, normalizedText: `question ${n}`,
        intent: "discovery", source: "authored", measuresVisibility: true, visibilityExclusionReason: null,
        status: "active", createdAt: "", activatedAt: "",
      })),
    }),
    targetIdentity: async () => ({ host: "mine.test", distinctive: ["mine"], ambiguous: [], nameMatchingUnreliable: false, caveat: null }),
  };
  const executor = {
    execute: async (request: { modelSnapshot: { providerId: string } }) => {
      await track.run(request.modelSnapshot.providerId);
      return {
        providerId: request.modelSnapshot.providerId, providerName: "x", sourceType: "model_api", sourceLabel: "x",
        resultCaveat: "c", model: "m", modelVersion: "m", text: "An answer.",
        structuredOutput: { transport: "response_json_schema", value: JSON.stringify({ analysisStatus: "completed", answer: "An answer.", mentions: [], citationUrls: [] }) },
        citations: [], webQueries: [], latencyMs: 1, createdAt: "2026-10-04T00:00:00.000Z",
      };
    },
  };
  return new PromptRunService(
    store as never,
    topics as never,
    { get: async () => ({ id: "p", normalizedDomain: "mine.test" }) } as never,
    { list: async () => [{ id: "b", projectId: "p", version: 1, createdAt: "", modelSnapshots: models }] } as never,
    executor as never,
  );
}

test("every provider is asked at once and each one is asked one question at a time", async () => {
  // Waiting on one provider while the others idle is how 28 questions became
  // a three hour job, and asking one twice at once risks its rate limit.
  const track = recorder();
  const runs: unknown[] = [];
  const result = await service(track, runs).start({ projectId: "p" });
  assert.equal(result.answersCompleted, 6, "three questions of two models");
  assert.equal(track.maxPerProvider, 1, "a provider was asked twice at once");
  assert.ok(track.seenTogether.has("alpha+beta"), "the two providers never overlapped");
});

test("progress is written as it happens rather than at the end", async () => {
  const track = recorder();
  const runs: Array<{ answersCompleted: number }> = [];
  await service(track, runs as never).start({ projectId: "p" });
  const counts = runs.map((row) => row.answersCompleted);
  assert.ok(counts.includes(1) && counts.includes(3), `progress was not written as it went: ${counts.join(",")}`);
});
