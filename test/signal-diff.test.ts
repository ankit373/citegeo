import test from "node:test";
import assert from "node:assert/strict";
import { diffSignals } from "../src/product/actions/signal-diff.js";
import type { SiteSignals } from "../src/product/actions/site-signals.js";

function signals(overrides: Partial<SiteSignals> = {}): SiteSignals {
  return {
    domain: "example.com",
    checkedAt: "2026-01-01T00:00:00.000Z",
    reachable: true,
    robots: { present: true, blocked: [], allowed: ["GPTBot", "ClaudeBot"] },
    llmsTxt: { present: true, bytes: 1200 },
    structuredData: { organization: true, sameAs: ["https://www.wikidata.org/wiki/Q1"], independent: ["https://www.wikidata.org/wiki/Q1"] },
    wikidata: { present: true, id: "Q1", searched: "Example" },
    ...overrides,
  };
}

test("an unchanged site produces no changes", () => {
  assert.deepEqual(diffSignals(signals(), signals()), []);
});

test("a newly disallowed crawler is a regression naming the crawler", () => {
  const changes = diffSignals(signals(), signals({ robots: { present: true, blocked: ["GPTBot"], allowed: ["ClaudeBot"] } }));
  assert.equal(changes.length, 1);
  assert.equal(changes[0]?.direction, "regressed");
  assert.ok(changes[0]?.detail.includes("GPTBot"));
});

test("unblocking a crawler is an improvement", () => {
  const changes = diffSignals(signals({ robots: { present: true, blocked: ["GPTBot"], allowed: [] } }), signals());
  assert.equal(changes[0]?.direction, "improved");
});

test("a site going down does not report every other signal as regressing", () => {
  const down = signals({
    reachable: false,
    llmsTxt: { present: false, bytes: 0 },
    structuredData: { organization: false, sameAs: [], independent: [] },
  });
  const changes = diffSignals(signals(), down);
  assert.equal(changes.length, 1, "one cause, one finding");
  assert.equal(changes[0]?.field, "reachable");
});

test("a site coming back reports alongside whatever else changed", () => {
  const changes = diffSignals(signals({ reachable: false }), signals());
  assert.equal(changes[0]?.field, "reachable");
  assert.equal(changes[0]?.direction, "improved");
});

test("losing llms.txt is a regression", () => {
  const changes = diffSignals(signals(), signals({ llmsTxt: { present: false, bytes: 0 } }));
  assert.equal(changes[0]?.field, "llmsTxt");
  assert.equal(changes[0]?.direction, "regressed");
});

test("losing the last independent sameAs is a regression, not a neutral change", () => {
  const changes = diffSignals(
    signals(),
    signals({ structuredData: { organization: true, sameAs: ["https://twitter.com/x"], independent: [] } }),
  );
  const row = changes.find((change) => change.field === "structuredData.independent");
  assert.equal(row?.direction, "regressed");
  assert.ok(row?.detail.includes("Removed"));
});

test("gaining an independent record is an improvement", () => {
  const changes = diffSignals(
    signals({ structuredData: { organization: true, sameAs: [], independent: [] } }),
    signals({ structuredData: { organization: true, sameAs: ["https://crunchbase.com/x"], independent: ["https://crunchbase.com/x"] } }),
  );
  const row = changes.find((change) => change.field === "structuredData.independent");
  assert.equal(row?.direction, "improved");
});

test("a Wikidata entity appearing names the new identifier", () => {
  const changes = diffSignals(
    signals({ wikidata: { present: false, id: null, searched: "Example" } }),
    signals({ wikidata: { present: true, id: "Q42", searched: "Example" } }),
  );
  const row = changes.find((change) => change.field === "wikidata");
  assert.equal(row?.direction, "improved");
  assert.ok(row?.detail.includes("Q42"));
});

test("several independent regressions are all reported", () => {
  const changes = diffSignals(signals(), signals({
    llmsTxt: { present: false, bytes: 0 },
    structuredData: { organization: false, sameAs: [], independent: [] },
    wikidata: { present: false, id: null, searched: "Example" },
  }));
  assert.equal(changes.length, 4, "llms.txt, organization, independent records and wikidata");
  assert.equal(changes.every((change) => change.direction === "regressed"), true);
});
