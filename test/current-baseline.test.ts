import test from "node:test";
import assert from "node:assert/strict";
import { currentBaseline } from "../src/product/configuration/current-baseline.js";
import type { ProductBaseline } from "../src/product/configuration/baseline-schema.js";

function baseline(id: string, version: number): ProductBaseline {
  return {
    id, version, projectId: "p", normalizedDomain: "example.com",
    recognitionProtocol: {} as never, modelSnapshots: [], language: "en",
    analysisVersion: "v1", configHash: id, createdAt: "",
  };
}

test("the configuration in force is the newest, not the first ever saved", () => {
  // Taking the first ran generation against a nine-model set retired long ago,
  // every one of which was on an account with no credit.
  const rows = [baseline("v1", 1), baseline("v2", 2)];
  assert.equal(currentBaseline(rows)?.id, "v2");
  assert.equal(currentBaseline([...rows].reverse())?.id, "v2", "order of the list must not decide it");
});

test("an explicitly active configuration wins over the newest", () => {
  const rows = [baseline("v1", 1), baseline("v2", 2), baseline("v3", 3)];
  assert.equal(currentBaseline(rows, "v2")?.id, "v2");
});

test("an active id that no longer exists falls back to the newest rather than nothing", () => {
  const rows = [baseline("v1", 1), baseline("v2", 2)];
  assert.equal(currentBaseline(rows, "deleted")?.id, "v2");
});

test("no configuration is null, not a guess", () => {
  assert.equal(currentBaseline([]), null);
});
