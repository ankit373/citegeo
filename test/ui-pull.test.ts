import test from "node:test";
import assert from "node:assert/strict";
import { settlePull } from "../src/ui/app/pull.js";

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
