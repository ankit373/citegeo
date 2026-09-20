import test from "node:test";
import assert from "node:assert/strict";
import { providerStatuses } from "../src/product/configuration/provider-status.js";
import { hasProviderKey, providerEnvKeys } from "../src/config/env.js";
import type { ProductModelCatalog, ProviderModelCatalogItem } from "../src/product/configuration/model-selection-schema.js";
import { PRODUCT_PROVIDER_IDS } from "../src/product/configuration/provider-id.js";
import type { ProductProviderId } from "../src/product/configuration/provider-id.js";
import type { OpenRouterAccountBalance } from "../src/providers/openrouter-account.js";

function model(providerId: ProductProviderId, modelId: string): ProviderModelCatalogItem {
  return {
    providerId,
    modelId,
    displayName: modelId,
    available: true,
    unavailableReason: null,
    nativeWebSearchSupported: false,
    checkedAt: "2026-01-01T00:00:00.000Z",
    source: providerId === "openrouter" ? "openrouter_catalog" : "local_capability_registry",
  };
}

function catalogOf(items: ProviderModelCatalogItem[]): ProductModelCatalog {
  return { list: async () => items };
}

function withOpenRouterKey<T>(run: () => Promise<T>): Promise<T> {
  const previous = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-key";
  const restore = () => {
    if (previous === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previous;
  };
  return run().finally(restore);
}

const balanceOf = (purchased: number, used: number) => async (): Promise<OpenRouterAccountBalance> => ({
  purchased,
  used,
  remaining: purchased - used,
  paidModelsRunnable: purchased - used > 0,
});

test("an empty OpenRouter balance is reported before a run, not as a mid-run 402", async () => {
  await withOpenRouterKey(async () => {
    const rows = await providerStatuses(
      catalogOf([model("openrouter", "openai/gpt-4o-mini"), model("openrouter", "vendor/small:free")]),
      { balance: balanceOf(0, 1.06) },
    );
    const openrouter = rows.find((row) => row.providerId === "openrouter");
    assert.ok(openrouter);
    assert.equal(openrouter.balance?.paidModelsRunnable, false);
    assert.equal(openrouter.freeModels, 1);
    assert.ok(openrouter.detail.includes("never purchased credits"));
    assert.ok(openrouter.detail.includes("HTTP 402"));
    // A free model still runs, so the provider is not written off entirely.
    assert.equal(openrouter.runnableNow, true);
  });
});

test("an empty balance with no free model leaves nothing runnable", async () => {
  await withOpenRouterKey(async () => {
    const rows = await providerStatuses(
      catalogOf([model("openrouter", "openai/gpt-4o-mini")]),
      { balance: balanceOf(0, 1.06) },
    );
    const openrouter = rows.find((row) => row.providerId === "openrouter");
    assert.equal(openrouter?.runnableNow, false);
    assert.equal(openrouter?.freeModels, 0);
  });
});

test("a funded account reports what is left rather than a warning", async () => {
  await withOpenRouterKey(async () => {
    const rows = await providerStatuses(
      catalogOf([model("openrouter", "openai/gpt-4o-mini")]),
      { balance: balanceOf(10, 2.5) },
    );
    const openrouter = rows.find((row) => row.providerId === "openrouter");
    assert.equal(openrouter?.runnableNow, true);
    assert.ok(openrouter?.detail.includes("$7.50"));
  });
});

test("the balance lookup never runs for providers that are not OpenRouter", async () => {
  const rows = await providerStatuses(catalogOf([model("azure-openai", "gpt-4o")]), {
    balance: async () => {
      throw new Error("the balance endpoint is OpenRouter-only");
    },
  });
  assert.equal(rows.find((row) => row.providerId === "azure-openai")?.balance, null);
});

test("every local gateway model counts as free to run", async () => {
  const previousUrl = process.env.OPENAI_COMPATIBLE_BASE_URL;
  const previousKey = process.env.OPENAI_COMPATIBLE_API_KEY;
  process.env.OPENAI_COMPATIBLE_BASE_URL = "http://127.0.0.1:8788/v1";
  process.env.OPENAI_COMPATIBLE_API_KEY = "local";
  try {
    const rows = await providerStatuses(
      catalogOf([model("openai-compatible", "claude-code"), model("openai-compatible", "codex")]),
    );
    const local = rows.find((row) => row.providerId === "openai-compatible");
    assert.equal(local?.freeModels, 2);
    assert.equal(local?.runnableNow, true);
    assert.ok(local?.detail.includes("cost nothing"));
  } finally {
    if (previousUrl === undefined) delete process.env.OPENAI_COMPATIBLE_BASE_URL;
    else process.env.OPENAI_COMPATIBLE_BASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.OPENAI_COMPATIBLE_API_KEY;
    else process.env.OPENAI_COMPATIBLE_API_KEY = previousKey;
  }
});

test("every product provider registers the env keys its configuration check reads", () => {
  // hasProviderKey ends in [].some(...), which is false for an unregistered
  // provider no matter how completely the user configured it.
  for (const providerId of PRODUCT_PROVIDER_IDS) {
    assert.ok(providerEnvKeys(providerId).length > 0, `${providerId} registers no env key`);
  }
});

test("a fully configured Azure deployment reads as configured", () => {
  const previous = {
    key: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    deployments: process.env.AZURE_OPENAI_DEPLOYMENTS,
  };
  process.env.AZURE_OPENAI_API_KEY = "test-key";
  process.env.AZURE_OPENAI_ENDPOINT = "https://example.openai.azure.com";
  process.env.AZURE_OPENAI_DEPLOYMENTS = "gpt-4o";
  try {
    assert.equal(hasProviderKey("azure-openai"), true);
  } finally {
    for (const [name, value] of [
      ["AZURE_OPENAI_API_KEY", previous.key],
      ["AZURE_OPENAI_ENDPOINT", previous.endpoint],
      ["AZURE_OPENAI_DEPLOYMENTS", previous.deployments],
    ] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
