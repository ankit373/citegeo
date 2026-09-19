import test from "node:test";
import assert from "node:assert/strict";
import { ProductInsightsService } from "../src/product/insights/insights-service.js";

// The cache is keyed on the run set, so it has to recompute the moment a run
// is added or one still in flight changes, and never otherwise.

function harness(runs: Array<{ id: string; status: string; successfulModelRunCount: number; failedModelRunCount: number }>) {
  let listCalls = 0;
  let modelRunReads = 0;
  const projects = { get: async () => ({ id: "p", name: "Example", normalizedDomain: "example.com" }) };
  const recognition = {
    list: async () => { listCalls += 1; return runs; },
    get: async (_projectId: string, runId: string) => ({
      run: runs.find((row) => row.id === runId),
      modelRuns: [{ id: `${runId}-m`, modelSnapshot: { modelId: "m", displayName: "M" } }],
    }),
    getModelRun: async () => {
      modelRunReads += 1;
      return { archive: null, attempts: [] };
    },
  };
  const service = new ProductInsightsService(projects as never, recognition as never);
  return { service, counts: () => ({ listCalls, modelRunReads }) };
}

test("a second request with an unchanged run set reads no archives again", async () => {
  const { service, counts } = harness([{ id: "r1", status: "completed", successfulModelRunCount: 1, failedModelRunCount: 0 }]);
  await service.build("p");
  const afterFirst = counts().modelRunReads;
  assert.ok(afterFirst > 0, "the first build reads evidence");
  await service.build("p");
  assert.equal(counts().modelRunReads, afterFirst, "the second build reads nothing further");
  assert.equal(counts().listCalls, 2, "the run list is still checked, which is how staleness is detected");
});

test("a new run invalidates the cache", async () => {
  const runs = [{ id: "r1", status: "completed", successfulModelRunCount: 1, failedModelRunCount: 0 }];
  const { service, counts } = harness(runs);
  await service.build("p");
  const afterFirst = counts().modelRunReads;
  runs.push({ id: "r2", status: "completed", successfulModelRunCount: 1, failedModelRunCount: 0 });
  await service.build("p");
  assert.ok(counts().modelRunReads > afterFirst, "new evidence is read");
});

test("a run still in flight invalidates the cache as its counts move", async () => {
  const runs = [{ id: "r1", status: "running", successfulModelRunCount: 0, failedModelRunCount: 0 }];
  const { service, counts } = harness(runs);
  await service.build("p");
  const afterFirst = counts().modelRunReads;
  runs[0]!.successfulModelRunCount = 1;
  await service.build("p");
  assert.ok(counts().modelRunReads > afterFirst, "a progressing run is not served from cache");
});

test("a different run limit is a different question and is not served from cache", async () => {
  const { service, counts } = harness([
    { id: "r1", status: "completed", successfulModelRunCount: 1, failedModelRunCount: 0 },
    { id: "r2", status: "completed", successfulModelRunCount: 1, failedModelRunCount: 0 },
  ]);
  await service.build("p");
  const afterFirst = counts().modelRunReads;
  await service.build("p", { runLimit: 1 });
  assert.ok(counts().modelRunReads > afterFirst);
});
