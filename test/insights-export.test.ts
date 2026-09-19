import test from "node:test";
import assert from "node:assert/strict";
import { exportNames, exportTable, exportTables } from "../src/product/insights/insights-export.js";
import type { ProjectInsights } from "../src/product/insights/insights-service.js";

function built(overrides: Partial<ProjectInsights["insights"]> = {}): ProjectInsights {
  return {
    projectId: "p",
    domain: "example.com",
    runsConsidered: 1,
    citationGap: [{ domain: "directory.com", answers: 2, competitors: ["Rival"], models: ["a"] }],
    claimAudit: { answers: 0, disagreements: [], unsourced: [], mismatches: [] },
    fanout: { answers: 0, answersWithFanout: 0, queries: [{ query: "best screener", answers: 2, models: ["a"] }], modifiers: [] },
    trend: [],
    citedPaths: [],
    insights: {
      target: "example.com",
      answered: 2,
      visibility: { recognized: 1, answered: 2, score: 0.5, byModel: [{ modelId: "a", displayName: "Model, A", answered: 2, recognized: 1, score: 0.5 }] },
      shareOfVoice: { target: { name: "Example", domain: "example.com", mentions: 1, share: null }, competitors: [] },
      citations: { answersWithCitations: 1, targetCitedIn: 1, domains: [{ domain: "example.com", answers: 1, isTarget: true, models: ["a"] }] },
      categories: [{ value: "Stock screener", count: 2 }],
      ...overrides,
    },
  } as ProjectInsights;
}

test("every advertised export produces a table", () => {
  const tables = exportTables(built());
  for (const name of exportNames()) {
    assert.ok(name in tables, `${name} is advertised but has no table`);
  }
});

test("a browser asking for gap.csv gets the gap table", () => {
  const csv = exportTable(built(), "gap.csv");
  assert.ok(csv?.startsWith("domain,answers,competitors,models"));
  assert.ok(csv?.includes("directory.com"));
});

test("the name works with or without the extension", () => {
  assert.equal(exportTable(built(), "gap"), exportTable(built(), "gap.csv"));
});

test("an unknown table is null rather than an empty file", () => {
  assert.equal(exportTable(built(), "nonsense"), null);
});

test("a model name containing a comma is quoted, not split across columns", () => {
  const csv = exportTable(built(), "visibility") || "";
  assert.ok(csv.includes('"Model, A"'));
});

test("a null share exports as an empty cell, never as zero", () => {
  const csv = exportTable(built(), "voice") || "";
  const row = csv.split("\r\n")[1] || "";
  assert.ok(row.endsWith(",,true"), `expected an empty share cell, saw ${row}`);
});

test("a list cell is joined rather than rendered as an array", () => {
  const csv = exportTable(built(), "citations") || "";
  assert.ok(csv.includes("example.com,1,true,a"));
});
