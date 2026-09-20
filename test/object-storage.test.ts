import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertSafeKey, getJson, LocalObjectStore, ObjectStoreError, putJson } from "../src/product/storage/object-store.js";
import { checkObjectStore, createObjectStore, STORAGE_BACKENDS, storageBackend } from "../src/product/storage/storage-config.js";
import { deriveSigningKey, encodeKeyPath, signRequest } from "../src/product/storage/sigv4.js";
import { S3ObjectStore } from "../src/product/storage/s3-store.js";
import { AzureBlobObjectStore } from "../src/product/storage/azure-blob-store.js";

async function local() {
  const dir = await mkdtemp(join(tmpdir(), "citegeo-store-"));
  return { store: new LocalObjectStore(dir), dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test("a key cannot climb out of the store", () => {
  for (const bad of ["../escape", "a/../../escape", "/absolute", "", "a//b", "a/./b"]) {
    assert.throws(() => assertSafeKey(bad), ObjectStoreError, `"${bad}" was accepted`);
  }
  assert.equal(assertSafeKey("projects/abc/project.json"), "projects/abc/project.json");
});

test("a missing object reads as absent, not as an error", async () => {
  const { store, cleanup } = await local();
  try {
    assert.equal(await store.get("projects/nope.json"), null);
    assert.equal(await getJson(store, "projects/nope.json"), null);
    assert.deepEqual(await store.list("projects"), []);
  } finally {
    await cleanup();
  }
});

test("a written object reads back, lists and deletes", async () => {
  const { store, cleanup } = await local();
  try {
    await putJson(store, "projects/a/project.json", { id: "a" });
    await putJson(store, "projects/a/topics.json", { topics: [] });
    assert.deepEqual(await getJson(store, "projects/a/project.json"), { id: "a" });
    assert.deepEqual(await store.list("projects/a"), ["projects/a/project.json", "projects/a/topics.json"]);
    await store.delete("projects/a/topics.json");
    assert.deepEqual(await store.list("projects/a"), ["projects/a/project.json"]);
  } finally {
    await cleanup();
  }
});

test("a half-written object reads as absent rather than throwing mid-run", async () => {
  const { store, cleanup } = await local();
  try {
    await store.put("projects/a/broken.json", "{not json");
    assert.equal(await getJson(store, "projects/a/broken.json"), null);
  } finally {
    await cleanup();
  }
});

test("a rename that has not landed is not listed as an object", async () => {
  const { store, cleanup } = await local();
  try {
    await store.put("projects/a/real.json", "{}");
    await store.put("projects/a/x.json.abc.tmp", "{}");
    assert.deepEqual(await store.list("projects/a"), ["projects/a/real.json"]);
  } finally {
    await cleanup();
  }
});

test("the check writes, reads back, lists and deletes, leaving nothing behind", async () => {
  const { store, cleanup } = await local();
  try {
    const result = await checkObjectStore(store);
    assert.equal(result.ok, true, result.detail);
    assert.deepEqual(await store.list(".citegeo-check"), [], "the probe must not be left behind");
  } finally {
    await cleanup();
  }
});

test("a check against a store that cannot write reports why instead of throwing", async () => {
  const broken = {
    get: async () => null,
    put: async () => { throw new Error("AccessDenied (HTTP 403)"); },
    delete: async () => undefined,
    list: async () => [],
    describe: () => "a bucket that refuses writes",
  };
  const result = await checkObjectStore(broken);
  assert.equal(result.ok, false);
  assert.ok(result.detail.includes("AccessDenied"));
});

test("every backend declares its fields and says what will surprise you", () => {
  assert.ok(STORAGE_BACKENDS.length >= 5);
  for (const backend of STORAGE_BACKENDS) {
    assert.ok(backend.note.length > 60, `${backend.id} has no note`);
    assert.ok(backend.fields.length > 0, `${backend.id} declares no fields`);
    for (const field of backend.fields) assert.ok(field.envKey.startsWith("STORAGE_") || field.envKey === "PRODUCT_DATA_DIR");
  }
  assert.equal(storageBackend("nonsense"), undefined);
});

test("a missing required field is named rather than failing on the first write", () => {
  assert.throws(
    () => createObjectStore({ backend: "s3", values: { region: "us-east-1" } }, "data"),
    (error: Error) => error.message.includes("Bucket") && error.message.includes("Access key ID"),
  );
});

test("local needs nothing configured", () => {
  const store = createObjectStore({ backend: "local", values: {} }, "data/product-v2");
  assert.ok(store.describe().includes("data/product-v2"));
});

test("AWS is addressed by host and everything else by path", () => {
  const aws = createObjectStore({ backend: "s3", values: { bucket: "b", accessKeyId: "k", secretAccessKey: "s", region: "eu-west-1" } }, "data");
  assert.ok(aws.describe().includes("s3.eu-west-1.amazonaws.com"));
  const r2 = createObjectStore({ backend: "r2", values: { bucket: "b", accessKeyId: "k", secretAccessKey: "s", endpoint: "https://acc.r2.cloudflarestorage.com" } }, "data");
  assert.ok(r2.describe().includes("r2.cloudflarestorage.com"));
});

test("the signing key matches the vector AWS publishes", () => {
  const derived = deriveSigningKey("wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY", "20120215", "us-east-1", "iam").toString("hex");
  assert.equal(derived, "f4780e2d9f65fa895f9c67b32ce1baf0b0d8a43505a000a1a9e090d414db404d");
});

test("a key is percent-encoded per RFC 3986, which is stricter than encodeURIComponent", () => {
  assert.equal(encodeKeyPath("projects/a b/c+d.json"), "projects/a%20b/c%2Bd.json");
  assert.equal(encodeKeyPath("a/b~c-d_e.f"), "a/b~c-d_e.f");
});

test("a signature is deterministic and changes with every part of the request", () => {
  const keys = { accessKeyId: "AKID", secretAccessKey: "secret", region: "us-east-1", service: "s3" };
  const at = new Date("2026-01-02T03:04:05Z");
  const sign = (method: string, path: string, body: string) =>
    signRequest({ method, url: new URL(`https://bucket.s3.amazonaws.com${path}`), body }, keys, at).authorization;
  const base = sign("PUT", "/a.json", "{}") || "";
  assert.equal(base, sign("PUT", "/a.json", "{}"), "same input, same signature");
  assert.notEqual(base, sign("GET", "/a.json", "{}"));
  assert.notEqual(base, sign("PUT", "/b.json", "{}"));
  assert.notEqual(base, sign("PUT", "/a.json", "{ }"));
  assert.ok(base.startsWith("AWS4-HMAC-SHA256 Credential=AKID/20260102/us-east-1/s3/aws4_request"));
  assert.ok(base.includes("SignedHeaders=host;x-amz-content-sha256;x-amz-date"));
});

test("a bucket or container is required before anything is attempted", () => {
  assert.throws(() => new S3ObjectStore({ bucket: "", region: "us-east-1", accessKeyId: "k", secretAccessKey: "s" }), ObjectStoreError);
  assert.throws(() => new S3ObjectStore({ bucket: "b", region: "us-east-1", accessKeyId: "", secretAccessKey: "s" }), ObjectStoreError);
  assert.throws(() => new AzureBlobObjectStore({ account: "a", container: "", accountKey: "k" }), ObjectStoreError);
});

test("a prefix keeps everything under one path and is stripped from listings", () => {
  const store = new S3ObjectStore({ bucket: "b", region: "us-east-1", accessKeyId: "k", secretAccessKey: "s", prefix: "/citegeo/" });
  assert.ok(store.describe().includes("under citegeo/"));
});

// An in-memory store with none of the filesystem's behaviour, to prove the
// product is running on the interface rather than on the disk underneath it.
class MemoryObjectStore {
  readonly objects = new Map<string, string>();
  async get(key: string) { return this.objects.get(assertSafeKey(key)) ?? null; }
  async put(key: string, body: string) { this.objects.set(assertSafeKey(key), body); }
  async delete(key: string) { this.objects.delete(assertSafeKey(key)); }
  async list(prefix: string) {
    const clean = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
    return [...this.objects.keys()].filter((key) => key === clean || key.startsWith(`${clean}/`)).sort();
  }
  describe() { return "memory"; }
}

test("a project round-trips through a store that is not a filesystem", async () => {
  const { ProductProjectFileStore } = await import("../src/product/projects/project-store.js");
  const { ProductProjectService } = await import("../src/product/projects/project-service.js");
  const memory = new MemoryObjectStore();
  const store = new ProductProjectFileStore("unused", memory);
  const projects = new ProductProjectService(store);

  const created = await projects.createDraft({ name: "Memory", primaryDomain: "memory.test", brandName: "Memory" });
  assert.equal((await projects.get(created.id)).brandName, "Memory");
  assert.deepEqual((await projects.list()).map((row) => row.id), [created.id]);
  // Nothing reached a disk: every byte is in the map.
  assert.ok([...memory.objects.keys()].some((key) => key.endsWith("project.json")));
});

test("topics, runs and answers all round-trip through the same store", async () => {
  const { ProductProjectFileStore } = await import("../src/product/projects/project-store.js");
  const { ProductProjectService } = await import("../src/product/projects/project-service.js");
  const { TopicFileStore } = await import("../src/product/topics/topic-store.js");
  const { PromptRunFileStore } = await import("../src/product/topics/prompt-run-store.js");
  const memory = new MemoryObjectStore();
  const store = new ProductProjectFileStore("unused", memory);
  const project = await new ProductProjectService(store).createDraft({ name: "M", primaryDomain: "m.test", brandName: "M" });

  const topics = new TopicFileStore(store);
  const set = await topics.load(project.id);
  assert.deepEqual(set.prompts, [], "an unseen project reads as empty, not as an error");
  await topics.save({ ...set, topics: [{ id: "t", projectId: project.id, name: "T", description: "", source: "authored", status: "active", createdAt: "" }] });
  assert.equal((await topics.load(project.id)).topics.length, 1);

  const runs = new PromptRunFileStore(store);
  await runs.saveRun({ id: "r1", projectId: project.id, status: "completed", promptIds: [], modelIds: [], regionIds: [], languageIds: [], answersRequested: 0, answersCompleted: 0, answersFailed: 0, startedAt: "2026-01-01T00:00:00.000Z", completedAt: null });
  assert.equal((await runs.listRuns(project.id)).length, 1);
  assert.deepEqual(await runs.listAnswers(project.id), []);
});

test("purging removes every key of that project and nothing of another", async () => {
  const { ProductProjectFileStore } = await import("../src/product/projects/project-store.js");
  const { ProductProjectService } = await import("../src/product/projects/project-service.js");
  const { TopicFileStore } = await import("../src/product/topics/topic-store.js");
  const memory = new MemoryObjectStore();
  const store = new ProductProjectFileStore("unused", memory);
  const projects = new ProductProjectService(store);
  const one = await projects.createDraft({ name: "One", primaryDomain: "one.test", brandName: "One" });
  const two = await projects.createDraft({ name: "Two", primaryDomain: "two.test", brandName: "Two" });
  const topics = new TopicFileStore(store);
  await topics.save(await topics.load(one.id));
  await topics.save(await topics.load(two.id));

  await store.purge(one.id);
  assert.equal([...memory.objects.keys()].some((key) => key.includes(one.id)), false);
  assert.ok([...memory.objects.keys()].some((key) => key.includes(two.id)), "the other project is untouched");
});
