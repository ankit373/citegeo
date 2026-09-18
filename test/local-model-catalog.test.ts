import assert from "node:assert/strict";
import test from "node:test";
import { CompositeProductModelCatalog, OpenAiCompatibleProductModelCatalog } from "../src/product/configuration/local-model-catalog.js";
import type { ProductModelCatalog, ProviderModelCatalogItem } from "../src/product/configuration/model-selection-schema.js";

function stub(items: Partial<ProviderModelCatalogItem>[]): ProductModelCatalog {
  return { list: async () => items as ProviderModelCatalogItem[] };
}

test("a local gateway model is offered as its own provider, never as OpenRouter", async () => {
  const original = globalThis.fetch;
  process.env.OPENAI_COMPATIBLE_BASE_URL = "http://127.0.0.1:9/v1";
  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => ({ data: [{ id: "claude-code:haiku", owned_by: "claude", note: "Claude Code CLI" }] }),
  })) as unknown as typeof fetch;
  try {
    const models = await new OpenAiCompatibleProductModelCatalog().list();
    assert.equal(models.length, 1);
    assert.equal(models[0]?.providerId, "openai-compatible");
    assert.equal(models[0]?.modelId, "claude-code:haiku");
    // A local head has no provider-native search, so it must never claim one.
    assert.equal(models[0]?.nativeWebSearchSupported, false);
  } finally {
    globalThis.fetch = original;
    delete process.env.OPENAI_COMPATIBLE_BASE_URL;
  }
});

test("an unreachable gateway contributes nothing instead of emptying the catalog", async () => {
  const original = globalThis.fetch;
  process.env.OPENAI_COMPATIBLE_BASE_URL = "http://127.0.0.1:9/v1";
  globalThis.fetch = (async () => { throw new Error("connection refused"); }) as unknown as typeof fetch;
  try {
    const composite = new CompositeProductModelCatalog([
      stub([{ providerId: "openrouter", modelId: "openai/gpt-4o-mini" }]),
      new OpenAiCompatibleProductModelCatalog(),
    ]);
    const models = await composite.list();
    assert.deepEqual(models.map((item) => item.modelId), ["openai/gpt-4o-mini"]);
  } finally {
    globalThis.fetch = original;
    delete process.env.OPENAI_COMPATIBLE_BASE_URL;
  }
});

test("one failing provider never discards another provider's models", async () => {
  const composite = new CompositeProductModelCatalog([
    { list: async () => { throw new Error("OpenRouter is down"); } },
    stub([{ providerId: "openai-compatible", modelId: "ollama:qwen3:0.6b" }]),
  ]);
  assert.deepEqual((await composite.list()).map((item) => item.modelId), ["ollama:qwen3:0.6b"]);
});
