import test from "node:test";
import assert from "node:assert/strict";
import { loadForProject, settlePull } from "../src/ui/app/pull.js";

interface Status { configured: boolean; detail: string; report: { rows: number } | null }

const held = (detail: string): Status => ({ configured: false, detail, report: null });

test("a finished pull extends the status of the project it was for", () => {
  const settled = settlePull("a", "a", held("A"), { rows: 4 });
  assert.equal(settled.sameProject, true);
  assert.deepEqual(settled.next, { configured: true, detail: "A", report: { rows: 4 } });
});

test("a pull that ends after the reader moved to another project changes nothing", () => {
  // Project A's pull lands while B is open, and B's own status has already loaded.
  const forB = held("B");
  const loaded = settlePull("a", "b", forB, { rows: 4 });
  assert.equal(loaded.next, null);
  assert.equal(loaded.sameProject, false);
  assert.deepEqual(forB, held("B"));
  // B's status has not loaded yet: nothing is merged, and nothing marks it ready.
  const notLoaded = settlePull("a", "b", null, { rows: 4 });
  assert.equal(notLoaded.next, null);
  assert.equal(notLoaded.sameProject, false);
});

test("with no status held for the same project, nothing is built from nothing", () => {
  const settled = settlePull("a", "a", null as Status | null, { rows: 4 });
  assert.equal(settled.next, null);
  assert.equal(settled.sameProject, true);
});

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void; reject(error: Error): void } {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

test("a read for the open project applies its result", async () => {
  const slot = { data: null as string | null, status: "loading" };
  const applied = await loadForProject("a", () => "a", async () => "A rows", (value) => { slot.data = value; slot.status = "ready"; }, () => { slot.status = "error"; });
  assert.equal(applied, true);
  assert.deepEqual(slot, { data: "A rows", status: "ready" });
});

test("a read that lands after the reader opened another project is dropped, with data or with an error", async () => {
  let open = "a";
  const slot = { data: "B rows" as string | null, status: "ready" };
  const late = deferred<string>();
  const read = loadForProject("a", () => open, () => late.promise, (value) => { slot.data = value; slot.status = "ready"; }, () => { slot.status = "error"; });
  open = "b";
  late.resolve("A rows");
  assert.equal(await read, false);
  assert.deepEqual(slot, { data: "B rows", status: "ready" });

  const failing = deferred<string>();
  const failed = loadForProject("a", () => open, () => failing.promise, () => { slot.data = "wrong"; }, () => { slot.status = "error"; });
  failing.reject(new Error("boom"));
  assert.equal(await failed, false);
  assert.deepEqual(slot, { data: "B rows", status: "ready" });
});

test("a failed read for the open project reports the error, and a project reopened is the open one again", async () => {
  const slot = { status: "loading" };
  await loadForProject("a", () => "a", () => Promise.reject(new Error("boom")), () => { slot.status = "ready"; }, () => { slot.status = "error"; });
  assert.equal(slot.status, "error");
  let open = "a";
  const slow = deferred<string>();
  const read = loadForProject("a", () => open, () => slow.promise, () => { slot.status = "ready"; }, () => { slot.status = "error"; });
  open = "b";
  open = "a";
  slow.resolve("x");
  assert.equal(await read, true);
  assert.equal(slot.status, "ready");
});

test("the late response of the first project cannot overwrite the second project's own", async () => {
  let open = "a";
  const slot = { data: null as string | null };
  const slowA = deferred<string>();
  const fastB = deferred<string>();
  const first = loadForProject("a", () => open, () => slowA.promise, (value) => { slot.data = value; }, () => {});
  open = "b";
  const second = loadForProject("b", () => open, () => fastB.promise, (value) => { slot.data = value; }, () => {});
  fastB.resolve("B rows");
  await second;
  slowA.resolve("A rows");
  await first;
  assert.equal(slot.data, "B rows");
});
