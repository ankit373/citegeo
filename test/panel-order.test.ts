import test from "node:test";
import assert from "node:assert/strict";
import { panelOrder } from "../src/ui/app/components/reorder.js";

function withStorage(value: string | null, run: () => void): void {
  const store: Record<string, string> = {};
  if (value !== null) store["citegeo.dashboard.panels"] = value;
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, next: string) => { store[key] = next; },
    removeItem: (key: string) => { delete store[key]; },
  };
  try {
    run();
  } finally {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  }
}

test("with nothing saved the panels keep the order the product argues for", () => {
  withStorage(null, () => {
    assert.deepEqual(panelOrder(["a", "b", "c"]), ["a", "b", "c"]);
  });
});

test("a saved arrangement is honoured", () => {
  withStorage(JSON.stringify(["c", "a", "b"]), () => {
    assert.deepEqual(panelOrder(["a", "b", "c"]), ["c", "a", "b"]);
  });
});

test("a panel added since the arrangement was saved is not stranded", () => {
  // Appended rather than dropped, or shipping a panel would hide it from
  // everyone who had ever rearranged their dashboard.
  withStorage(JSON.stringify(["c", "a"]), () => {
    assert.deepEqual(panelOrder(["a", "b", "c"]), ["c", "a", "b"]);
  });
});

test("a panel that no longer exists is dropped rather than left as a hole", () => {
  withStorage(JSON.stringify(["gone", "b", "a"]), () => {
    assert.deepEqual(panelOrder(["a", "b"]), ["b", "a"]);
  });
});

test("unreadable storage falls back to the default order", () => {
  withStorage("not json", () => {
    assert.deepEqual(panelOrder(["a", "b"]), ["a", "b"]);
  });
});
