import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isLive } from "../src/product/topics/prompt-run-schema.js";
import { PromptRunFileStore } from "../src/product/topics/prompt-run-store.js";
import { PromptRunService, PromptRunUnavailableError } from "../src/product/topics/prompt-run-service.js";
import { ProductProjectFileStore } from "../src/product/projects/project-store.js";
import { ProductProjectService } from "../src/product/projects/project-service.js";
import type { PromptRun } from "../src/product/topics/prompt-run-schema.js";

function run(overrides: Partial<PromptRun> = {}): PromptRun {
  return {
    id: "prompt-run-1", projectId: "p", status: "running", promptIds: ["a"], modelIds: ["m"],
    regionIds: ["global"], languageIds: ["en"], answersRequested: 13, answersCompleted: 0,
    answersFailed: 0, startedAt: "2026-09-20T09:06:00.000Z", completedAt: null, ...overrides,
  };
}

async function harness() {
  const dir = await mkdtemp(join(tmpdir(), "citegeo-runctl-"));
  const projectStore = new ProductProjectFileStore(dir);
  const projects = new ProductProjectService(projectStore);
  const project = await projects.createDraft({ name: "N", primaryDomain: "example.com", brandName: "N" });
  const store = new PromptRunFileStore(projectStore);
  const topics = { get: async () => ({ topics: [], prompts: [] }) };
  const baselines = { list: async () => [] };
  const service = new PromptRunService(store, topics as never, projects, baselines as never, {} as never);
  return { service, store, projectId: project.id, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test("a run that is neither finished nor abandoned counts as live", () => {
  assert.equal(isLive("running"), true);
  assert.equal(isLive("cancelling"), true);
  for (const done of ["completed", "partial", "failed", "cancelled", "interrupted"] as const) {
    assert.equal(isLive(done), false, `${done} must not read as live`);
  }
});

test("stopping asks the loop to stop rather than tearing out the answer in flight", async () => {
  const { service, store, projectId, cleanup } = await harness();
  try {
    await store.saveRun(run({ projectId }));
    const stopped = await service.cancel(projectId, "prompt-run-1");
    // The provider is already being charged for the request in flight.
    assert.equal(stopped.status, "cancelling");
  } finally {
    await cleanup();
  }
});

test("stopping a run that already finished changes nothing", async () => {
  const { service, store, projectId, cleanup } = await harness();
  try {
    await store.saveRun(run({ projectId, status: "completed", completedAt: "x" }));
    assert.equal((await service.cancel(projectId, "prompt-run-1")).status, "completed");
  } finally {
    await cleanup();
  }
});

test("stopping a run that does not exist says so rather than passing silently", async () => {
  const { service, projectId, cleanup } = await harness();
  try {
    await assert.rejects(() => service.cancel(projectId, "nope"), PromptRunUnavailableError);
  } finally {
    await cleanup();
  }
});

test("a run left running by a dead process is interrupted, not failed", async () => {
  // Nothing can be in flight when the server has only just started, so a live
  // record at that moment is a lie the interface would keep telling.
  const { service, store, projectId, cleanup } = await harness();
  try {
    await store.saveRun(run({ id: "r1", projectId }));
    await store.saveRun(run({ id: "r2", projectId, status: "cancelling" }));
    await store.saveRun(run({ id: "r3", projectId, status: "completed", completedAt: "x" }));
    assert.equal(await service.reconcileInterrupted(projectId), 2);
    const rows = await service.listRuns(projectId);
    assert.equal(rows.find((row) => row.id === "r1")?.status, "interrupted");
    assert.equal(rows.find((row) => row.id === "r2")?.status, "interrupted");
    // A finished run is left exactly as it was.
    assert.equal(rows.find((row) => row.id === "r3")?.status, "completed");
    assert.ok(rows.find((row) => row.id === "r1")?.completedAt, "an interrupted run has an end time");
  } finally {
    await cleanup();
  }
});

test("a second run is refused while one is live, so three clicks are not three runs", async () => {
  const { service, store, projectId, cleanup } = await harness();
  try {
    await store.saveRun(run({ projectId, answersCompleted: 4 }));
    await assert.rejects(
      () => service.start({ projectId }),
      (error: Error) => error instanceof PromptRunUnavailableError && error.message.includes("4 of 13"),
    );
  } finally {
    await cleanup();
  }
});
