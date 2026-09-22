import test from "node:test";
import assert from "node:assert/strict";
import { panelLayout, panelOrder, setPanelSpan, togglePanelHidden } from "../src/ui/app/components/reorder.js";

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

test("a board arranged before widths existed is not made to be arranged again", () => {
  // The first version stored a bare array. Reading it as a layout keeps the
  // order somebody already chose.
  withStorage(JSON.stringify(["c", "a"]), () => {
    const layout = panelLayout(["a", "b", "c"]);
    assert.deepEqual(layout.order, ["c", "a", "b"]);
    assert.deepEqual(layout.spans, {});
    assert.deepEqual(layout.hidden, []);
  });
});

test("a width is kept, and one nobody offered is refused rather than stored", () => {
  withStorage(null, () => {
    setPanelSpan("a", 2);
    setPanelSpan("b", 7);
    const layout = panelLayout(["a", "b"]);
    assert.equal(layout.spans["a"], 2);
    assert.equal(layout.spans["b"], undefined);
  });
});

test("a panel taken off the board comes back the same way it went", () => {
  withStorage(null, () => {
    togglePanelHidden("a");
    assert.deepEqual(panelLayout(["a", "b"]).hidden, ["a"]);
    togglePanelHidden("a");
    assert.deepEqual(panelLayout(["a", "b"]).hidden, []);
  });
});

test("a panel that no longer exists is dropped from the hidden list too", () => {
  withStorage(JSON.stringify({ order: ["a"], spans: {}, hidden: ["gone"] }), () => {
    assert.deepEqual(panelLayout(["a", "b"]).hidden, []);
  });
});
