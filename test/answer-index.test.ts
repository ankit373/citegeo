import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AnswerIndexService } from "../src/product/index/answer-index-service.js";
import { answerIndexEntry } from "../src/product/index/answer-index-entry.js";
import { loadDatabaseClass } from "../src/product/index/answer-index.js";
import { ProductProjectFileStore } from "../src/product/projects/project-store.js";
import { PromptRunFileStore } from "../src/product/topics/prompt-run-store.js";
import type { PromptAnswer } from "../src/product/topics/prompt-run-schema.js";
import { assertSafeKey, putJson, type ObjectStore } from "../src/product/storage/object-store.js";

// node:sqlite is absent before Node 22.5 and flagged for a while after, so
// what it can prove is skipped rather than failed where it does not exist.
const needsIndex = (await loadDatabaseClass()) ? {} : { skip: "node:sqlite is not available on this runtime" };

const PROJECT = "p1";
const PREFIX = `projects/${PROJECT}/prompt-answers`;

class CountingMemoryStore implements ObjectStore {
  readonly objects = new Map<string, string>();
  reads = 0;
  lists = 0;
  latencyMs = 0;

  async get(key: string): Promise<string | null> {
    this.reads += 1;
    if (this.latencyMs > 0) await new Promise((done) => setTimeout(done, this.latencyMs));
    return this.objects.get(assertSafeKey(key)) ?? null;
  }

  async put(key: string, body: string): Promise<void> { this.objects.set(assertSafeKey(key), body); }
  async delete(key: string): Promise<void> { this.objects.delete(assertSafeKey(key)); }

  async list(prefix: string): Promise<string[]> {
    this.lists += 1;
    const clean = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
    return [...this.objects.keys()].filter((key) => key === clean || key.startsWith(`${clean}/`)).sort();
  }

  describe(): string { return "counting memory"; }
}

function answer(id: string, runId: string, options: { status?: PromptAnswer["status"]; mentions?: number; citations?: number } = {}): PromptAnswer {
  const mentions = options.mentions ?? 0;
  return {
    id,
    projectId: PROJECT,
    runId,
    promptId: `prompt-${id}`,
    topicId: "topic-1",
    promptText: "best tool for this job",
    intent: "discovery",
    providerId: "openrouter",
    modelId: "model-a",
    modelDisplayName: "Model A",
    regionId: "global",
    languageId: "en",
    status: options.status ?? "completed",
    text: `answer ${id}`,
    mentions: Array.from({ length: mentions }, (_unused, position) => ({
      name: `Named ${position}`,
      domain: null,
      recommendation: "mentioned" as const,
      mentionQuote: null,
      firstMentionOffset: null,
      firstMentionState: "none" as const,
      isTarget: position === 0,
    })),
    citationUrls: Array.from({ length: options.citations ?? 0 }, (_unused, position) => `https://example.test/${id}/${position}`),
    errorCode: null,
    errorMessage: null,
    latencyMs: 12,
    createdAt: `2026-01-01T00:00:${id.padStart(2, "0")}.000Z`,
  };
}

async function temporaryDir(): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), "citegeo-index-"));
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

function storeWith(objects: CountingMemoryStore, index?: AnswerIndexService): PromptRunFileStore {
  const projects = new ProductProjectFileStore("unused", objects);
  return index ? new PromptRunFileStore(projects, index) : new PromptRunFileStore(projects);
}

async function seed(runs: PromptRunFileStore, count: number): Promise<void> {
  for (let position = 0; position < count; position += 1) {
    await runs.saveAnswer(answer(String(position + 1).padStart(2, "0"), position % 2 === 0 ? "run-a" : "run-b"));
  }
}

test("an index that this runtime cannot open falls back to the scan and returns the same answers", async () => {
  const { dir, cleanup } = await temporaryDir();
  try {
    const withIndex = new CountingMemoryStore();
    const withoutIndex = new CountingMemoryStore();
    const indexed = storeWith(withIndex, new AnswerIndexService({ dir }));
    // What Node 22 without the flag hands back: no database class at all.
    const unavailable = new AnswerIndexService({ dir, load: async () => null });
    const scanned = storeWith(withoutIndex, unavailable);
    await seed(indexed, 20);
    await seed(scanned, 20);

    assert.equal(await unavailable.available(), false);
    assert.deepEqual(await indexed.listAnswers(PROJECT), await scanned.listAnswers(PROJECT));
    assert.deepEqual(await indexed.listAnswers(PROJECT, "run-b"), await scanned.listAnswers(PROJECT, "run-b"));
    assert.equal((await scanned.listAnswers(PROJECT, "run-b")).length, 10);
    assert.equal(await scanned.verifyAnswerIndex(PROJECT), null, "no index reports as absent, not as agreement");
    assert.equal(await scanned.rebuildAnswerIndex(PROJECT), null);
  } finally {
    await cleanup();
  }
});

test("an index with no directory is off, and every read still answers", async () => {
  const objects = new CountingMemoryStore();
  const runs = storeWith(objects);
  await seed(runs, 6);
  assert.equal((await runs.listAnswers(PROJECT)).length, 6);
  assert.equal((await runs.listAnswers(PROJECT, "run-a")).length, 3);
  assert.equal(await runs.verifyAnswerIndex(PROJECT), null);
});

test("a run-scoped read fetches only that run once the index has seen the answers", needsIndex, async () => {
  const { dir, cleanup } = await temporaryDir();
  try {
    const objects = new CountingMemoryStore();
    const runs = storeWith(objects, new AnswerIndexService({ dir }));
    await seed(runs, 40);

    objects.reads = 0;
    const scoped = await runs.listAnswers(PROJECT, "run-b");
    assert.equal(scoped.length, 20);
    assert.equal(objects.reads, 20, "the other run's documents were fetched anyway");
    assert.ok(scoped.every((row) => row.runId === "run-b"));

    objects.reads = 0;
    assert.equal((await runs.listAnswers(PROJECT)).length, 40);
    assert.equal(objects.reads, 40, "an unscoped read still needs every body");
  } finally {
    await cleanup();
  }
});

test("an answer that reached the store but never the index is recovered by the next read", needsIndex, async () => {
  const { dir, cleanup } = await temporaryDir();
  try {
    const objects = new CountingMemoryStore();
    const index = new AnswerIndexService({ dir });
    const runs = storeWith(objects, index);
    await seed(runs, 10);

    // The crash case: the write landed and the process died before indexing.
    const orphan = answer("99", "run-b", { mentions: 2, citations: 3 });
    await putJson(objects, `${PREFIX}/99.json`, orphan);

    const before = await runs.verifyAnswerIndex(PROJECT);
    assert.deepEqual(before?.missing, [`${PREFIX}/99.json`]);
    assert.deepEqual(before?.extra, []);
    assert.deepEqual(before?.mismatched, []);

    const scoped = await runs.listAnswers(PROJECT, "run-b");
    assert.ok(scoped.some((row) => row.id === "99"), "an unindexed key must be read, not assumed absent");

    const after = await runs.verifyAnswerIndex(PROJECT);
    assert.deepEqual(after?.missing, [], "reading it indexed it");
    assert.equal(after?.checked, 11);
  } finally {
    await cleanup();
  }
});

test("a key deleted from the store leaves the index on the next read", needsIndex, async () => {
  const { dir, cleanup } = await temporaryDir();
  try {
    const objects = new CountingMemoryStore();
    const runs = storeWith(objects, new AnswerIndexService({ dir }));
    await seed(runs, 8);
    await objects.delete(`${PREFIX}/03.json`);

    assert.deepEqual((await runs.verifyAnswerIndex(PROJECT))?.extra, [`${PREFIX}/03.json`]);
    const rows = await runs.listAnswers(PROJECT);
    assert.equal(rows.length, 7);
    assert.equal(rows.some((row) => row.id === "03"), false);
    assert.deepEqual((await runs.verifyAnswerIndex(PROJECT))?.extra, [], "the reader dropped it from the index");
  } finally {
    await cleanup();
  }
});

test("the stored answer wins when the index disagrees with it", needsIndex, async () => {
  const { dir, cleanup } = await temporaryDir();
  try {
    const objects = new CountingMemoryStore();
    const runs = storeWith(objects, new AnswerIndexService({ dir }));
    await seed(runs, 6);

    // Rewritten behind the index's back, which is the only way the two can
    // hold different things about a key that exists in both.
    const moved = { ...answer("02", "run-c"), text: "rewritten out of band" };
    await putJson(objects, `${PREFIX}/02.json`, moved);

    const difference = await runs.verifyAnswerIndex(PROJECT);
    assert.deepEqual(difference?.mismatched, [`${PREFIX}/02.json`]);

    const stale = await runs.listAnswers(PROJECT, "run-b");
    assert.equal(stale.some((row) => row.id === "02"), false, "the index claimed it for run-b and the body did not");
    const whole = await runs.listAnswers(PROJECT);
    assert.equal(whole.find((row) => row.id === "02")?.text, "rewritten out of band");

    assert.equal(await runs.rebuildAnswerIndex(PROJECT), 6);
    assert.deepEqual((await runs.verifyAnswerIndex(PROJECT))?.mismatched, []);
    assert.equal((await runs.listAnswers(PROJECT, "run-c")).length, 1, "the rebuild put it under the run the body names");
  } finally {
    await cleanup();
  }
});

test("a rebuilt index matches the answers exactly, whatever it held before", needsIndex, async () => {
  const { dir, cleanup } = await temporaryDir();
  try {
    const objects = new CountingMemoryStore();
    const runs = storeWith(objects, new AnswerIndexService({ dir }));
    await seed(runs, 12);
    for (let position = 0; position < 4; position += 1) {
      await putJson(objects, `${PREFIX}/${String(50 + position)}.json`, answer(String(50 + position), "run-c"));
    }
    await objects.delete(`${PREFIX}/01.json`);

    assert.equal(await runs.rebuildAnswerIndex(PROJECT), 15);
    const difference = await runs.verifyAnswerIndex(PROJECT);
    assert.deepEqual(difference, { checked: 15, missing: [], extra: [], mismatched: [] });

    const scanned = storeWith(objects);
    assert.deepEqual(await runs.listAnswers(PROJECT), await scanned.listAnswers(PROJECT));
    assert.deepEqual(await runs.listAnswers(PROJECT, "run-c"), await scanned.listAnswers(PROJECT, "run-c"));
  } finally {
    await cleanup();
  }
});

test("an index survives being reopened, and an unreadable directory is only slower", needsIndex, async () => {
  const { dir, cleanup } = await temporaryDir();
  try {
    const objects = new CountingMemoryStore();
    const first = new AnswerIndexService({ dir });
    await seed(storeWith(objects, first), 10);
    await first.close();

    const second = new AnswerIndexService({ dir });
    const runs = storeWith(objects, second);
    objects.reads = 0;
    assert.equal((await runs.listAnswers(PROJECT, "run-a")).length, 5);
    assert.equal(objects.reads, 5, "a reopened index still knows which keys belong to the run");
    await second.close();

    const broken = new AnswerIndexService({ dir, load: async () => { throw new Error("no sqlite here"); } });
    const fallback = storeWith(objects, broken);
    assert.equal(await broken.available(), false);
    assert.equal((await fallback.listAnswers(PROJECT, "run-a")).length, 5);
  } finally {
    await cleanup();
  }
});

test("five hundred archived answers, one run wanted: the index against the scan", needsIndex, async () => {
  const { dir, cleanup } = await temporaryDir();
  try {
    const objects = new CountingMemoryStore();
    const index = new AnswerIndexService({ dir });
    const runs = storeWith(objects, index);
    for (let position = 0; position < 500; position += 1) {
      const id = String(position + 1).padStart(3, "0");
      await runs.saveAnswer({ ...answer(id, `run-${position % 10}`), createdAt: `2026-01-01T00:00:00.${id}Z` });
    }

    // A bucket answers a GET in about a millisecond at best, which is what
    // makes the count of reads the thing worth cutting.
    objects.latencyMs = 1;
    const scanned = storeWith(objects);
    const scanStarted = Date.now();
    const withoutIndex = await scanned.listAnswers(PROJECT, "run-3");
    const scanMs = Date.now() - scanStarted;
    const scanReads = objects.reads;

    // The read path as it was: every object, one at a time.
    const serialStarted = Date.now();
    const serial: PromptAnswer[] = [];
    for (const key of await objects.list(PREFIX)) {
      const raw = await objects.get(key);
      if (raw) serial.push(JSON.parse(raw) as PromptAnswer);
    }
    const serialMs = Date.now() - serialStarted;

    objects.reads = 0;
    const indexStarted = Date.now();
    const withIndex = await runs.listAnswers(PROJECT, "run-3");
    const indexMs = Date.now() - indexStarted;

    assert.deepEqual(withIndex, withoutIndex, "the index must change the cost and nothing else");
    assert.equal(withIndex.length, 50);
    assert.equal(serial.length, 500);
    console.log(`  500 answers, one run of 10 wanted: serial scan 500 reads in ${serialMs}ms, pooled scan ${scanReads} reads in ${scanMs}ms, pooled index ${objects.reads} reads in ${indexMs}ms`);
    assert.equal(scanReads, 500);
    assert.equal(objects.reads, 50);
  } finally {
    await cleanup();
  }
});

test("a count that was never parsed is indexed as absent, not as zero", () => {
  const failed = answerIndexEntry(PREFIX, `${PREFIX}/07.json`, answer("07", "run-a", { status: "provider_failed" }));
  assert.equal(failed.mentionCount, null);
  assert.equal(failed.targetNamed, null);
  assert.equal(failed.citationCount, null);

  const named = answerIndexEntry(PREFIX, `${PREFIX}/08.json`, answer("08", "run-a", { mentions: 3, citations: 2 }));
  assert.equal(named.mentionCount, 3);
  assert.equal(named.targetNamed, true);
  assert.equal(named.citationCount, 2);
  assert.equal(named.personaId, null, "nobody stated is null, not a default persona");
});
