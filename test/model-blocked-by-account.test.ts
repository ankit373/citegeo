import test from "node:test";
import assert from "node:assert/strict";
import { modelsBlockedByAccount, type ProviderStatus } from "../src/product/configuration/provider-status.js";

function status(overrides: Partial<ProviderStatus>): ProviderStatus {
  return {
    providerId: "openrouter", label: "An aggregator", configured: true, envKeys: [], settingsEnvKeys: [],
    endpoint: null, modelCount: 10, nativeWebSearchModels: 1, freeModels: 2, reachable: true,
    runnableNow: true, citationCapable: true, balance: null, detail: "", setupNote: "",
    ...overrides,
  };
}

const PAID = { providerId: "openrouter" as const, modelId: "vendor/a-model" };
const FREE = { providerId: "openrouter" as const, modelId: "vendor/a-model:free" };

test("a paid model on an account with no credit is not asked", () => {
  // It answers HTTP 402 to every question, so asking it files one provider
  // error per question and measures nothing.
  const blocked = modelsBlockedByAccount([PAID], [status({ balance: { purchased: 0, used: 1.06, remaining: -1.06, paidModelsRunnable: false } })]);
  assert.equal(blocked.length, 1);
  assert.ok(blocked[0]?.reason.includes("no credit"));
  assert.ok(blocked[0]?.reason.includes("402"));
});

test("a free model on the same account still runs", () => {
  const blocked = modelsBlockedByAccount([FREE], [status({ balance: { purchased: 0, used: 1.06, remaining: -1.06, paidModelsRunnable: false } })]);
  assert.deepEqual(blocked, []);
});

test("credit left blocks nothing", () => {
  const blocked = modelsBlockedByAccount([PAID, FREE], [status({ balance: { purchased: 10, used: 1, remaining: 9, paidModelsRunnable: true } })]);
  assert.deepEqual(blocked, []);
});

test("a provider with no key is named rather than asked", () => {
  const blocked = modelsBlockedByAccount([PAID], [status({ configured: false })]);
  assert.equal(blocked.length, 1);
  assert.ok(blocked[0]?.reason.includes("No key is set"));
});

test("a provider that reports no balance blocks nothing, because unknown is not empty", () => {
  const blocked = modelsBlockedByAccount([PAID], [status({ balance: null })]);
  assert.deepEqual(blocked, []);
});

test("a model whose provider is not in the status list is left alone", () => {
  const blocked = modelsBlockedByAccount([{ providerId: "anthropic", modelId: "claude" }], [status({})]);
  assert.deepEqual(blocked, []);
});
