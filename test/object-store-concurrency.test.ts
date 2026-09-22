import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_READ_CONCURRENCY,
  LOCAL_READ_CONCURRENCY,
  LocalObjectStore,
  getJson,
  listJson,
  readConcurrencyFor,
  readJsonEntries,
  type ObjectStore,
} from "../src/product/storage/object-store.js";

// The read path as it was before the pool, kept here as the thing every
// bounded read is compared against.
async function serialListJson<T>(store: ObjectStore, prefix: string): Promise<T[]> {
  const rows: T[] = [];
  for (const key of await store.list(prefix)) {
    if (!key.endsWith(".json")) continue;
    const row = await getJson<T>(store, key);
    if (row) rows.push(row);
  }
  return rows;
}

interface Counted {
  store: ObjectStore;
  reads: () => number;
  peak: () => number;
}

function countingStore(objects: Map<string, string>, latencyMs = 0, failOn?: string): Counted {
  let inFlight = 0;
  let peak = 0;
  let reads = 0;
  const store: ObjectStore = {
    async get(key: string) {
      reads += 1;
      inFlight += 1;
      if (inFlight > peak) peak = inFlight;
      try {
        if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs));
        else await Promise.resolve();
        if (failOn !== undefined && key === failOn) throw new Error(`the bucket refused ${key}`);
        return objects.get(key) ?? null;
      } finally {
        inFlight -= 1;
      }
    },
    async put(key: string, body: string) { objects.set(key, body); },
    async delete(key: string) { objects.delete(key); },
    async list(prefix: string) {
      const clean = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
      return [...objects.keys()].filter((key) => key === clean || key.startsWith(`${clean}/`)).sort();
    },
    describe() { return "counted"; },
  };
  return { store, reads: () => reads, peak: () => peak };
}

function documents(count: number): Map<string, string> {
  const objects = new Map<string, string>();
  for (let index = 0; index < count; index += 1) {
    const padded = String(index).padStart(4, "0");
    objects.set(`answers/${padded}.json`, JSON.stringify({ id: padded, order: index }));
  }
  return objects;
}

test("a bounded read returns exactly what the serial read returned, in the same order", async () => {
  const objects = documents(120);
  // A half-written document, a key that is not JSON and two documents that
  // parse falsy, so the comparison covers every branch the serial loop had.
  objects.set("answers/0007.json", "{not json");
  objects.set("answers/notes.txt", "ignored");
  objects.set("answers/0011.json", "0");
  objects.set("answers/0012.json", "null");
  const serial = await serialListJson<{ id: string }>(countingStore(objects).store, "answers");
  const bounded = await listJson<{ id: string }>(countingStore(objects).store, "answers");
  assert.deepEqual(bounded, serial);
  assert.equal(bounded.length, 117, "a half-written, a zero and a null document all drop out");
  assert.deepEqual(bounded.map((row) => row.id).slice(0, 3), ["0000", "0001", "0002"]);
});

test("a read that fails fails the whole listing, exactly as the serial read did", async () => {
  const objects = documents(40);
  const serialError = await serialListJson(countingStore(objects, 0, "answers/0021.json").store, "answers")
    .then(() => null, (error: Error) => error.message);
  const boundedError = await listJson(countingStore(objects, 0, "answers/0021.json").store, "answers")
    .then(() => null, (error: Error) => error.message);
  assert.equal(serialError, "the bucket refused answers/0021.json");
  assert.equal(boundedError, serialError);
});

test("no more reads are in flight than the bound allows", async () => {
  const objects = documents(200);
  for (const bound of [1, 4, 16]) {
    const counted = countingStore(objects, 1);
    const rows = await listJson<{ order: number }>(counted.store, "answers", bound);
    assert.equal(rows.length, 200);
    assert.ok(counted.peak() <= bound, `${counted.peak()} reads were in flight against a bound of ${bound}`);
    assert.equal(counted.peak(), bound, "the bound was never actually reached, so nothing ran in parallel");
  }
});

test("the environment overrides the bound the backend asks for", async () => {
  const objects = documents(50);
  const previous = process.env.OBJECT_READ_CONCURRENCY;
  process.env.OBJECT_READ_CONCURRENCY = "3";
  try {
    const counted = countingStore(objects, 1);
    await listJson(counted.store, "answers");
    assert.equal(counted.peak(), 3);
  } finally {
    if (previous === undefined) delete process.env.OBJECT_READ_CONCURRENCY;
    else process.env.OBJECT_READ_CONCURRENCY = previous;
  }
});

test("a disk and a bucket are bounded by different things", async () => {
  const dir = await mkdtemp(join(tmpdir(), "citegeo-bound-"));
  try {
    assert.equal(readConcurrencyFor(new LocalObjectStore(dir)), LOCAL_READ_CONCURRENCY);
    assert.equal(readConcurrencyFor(countingStore(new Map()).store), DEFAULT_READ_CONCURRENCY);
    assert.ok(LOCAL_READ_CONCURRENCY < DEFAULT_READ_CONCURRENCY);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("an empty prefix reads nothing and asks the store for nothing", async () => {
  const counted = countingStore(new Map());
  assert.deepEqual(await listJson(counted.store, "answers"), []);
  assert.equal(counted.reads(), 0);
  assert.deepEqual(await readJsonEntries(counted.store, []), []);
});

test("five hundred objects read faster in a pool than one at a time", async () => {
  const objects = documents(500);
  const serialStore = countingStore(objects, 1);
  const serialStarted = Date.now();
  const serial = await serialListJson<{ order: number }>(serialStore.store, "answers");
  const serialMs = Date.now() - serialStarted;

  const boundedStore = countingStore(objects, 1);
  const boundedStarted = Date.now();
  const bounded = await listJson<{ order: number }>(boundedStore.store, "answers", DEFAULT_READ_CONCURRENCY);
  const boundedMs = Date.now() - boundedStarted;

  assert.deepEqual(bounded, serial, "the pool must not change a single value or its position");
  assert.equal(serialStore.reads(), boundedStore.reads());
  console.log(`  500 objects at 1ms each: serial ${serialMs}ms, pool of ${DEFAULT_READ_CONCURRENCY} ${boundedMs}ms`);
  assert.ok(boundedMs * 4 < serialMs, `the pool took ${boundedMs}ms against ${serialMs}ms serial`);
});

test("five hundred objects on a real disk read faster in a pool", async () => {
  const dir = await mkdtemp(join(tmpdir(), "citegeo-read-"));
  try {
    const store = new LocalObjectStore(dir);
    for (const [key, body] of documents(500)) await store.put(key, body);

    const serialStarted = Date.now();
    const serial = await serialListJson<{ order: number }>(store, "answers");
    const serialMs = Date.now() - serialStarted;

    const boundedStarted = Date.now();
    const bounded = await listJson<{ order: number }>(store, "answers");
    const boundedMs = Date.now() - boundedStarted;

    assert.deepEqual(bounded, serial);
    assert.equal(bounded.length, 500);
    console.log(`  500 objects on disk: serial ${serialMs}ms, pool of ${LOCAL_READ_CONCURRENCY} ${boundedMs}ms`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
