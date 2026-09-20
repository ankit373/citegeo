import test from "node:test";
import assert from "node:assert/strict";
import { DirectProviderModelCatalog } from "../src/product/configuration/direct-model-catalog.js";
import { INTEGRATIONS } from "../src/product/auth/integrations.js";
import { PRODUCT_PROVIDER_IDS, isProductProviderId } from "../src/product/configuration/provider-id.js";
import { PROVIDER_ACCESS, canCite, providerAccess } from "../src/product/configuration/provider-access.js";
import { PROVIDER_DEFINITIONS } from "../src/providers/catalog.js";
import { providerStatuses } from "../src/product/configuration/provider-status.js";
import type { ProductModelCatalog } from "../src/product/configuration/model-selection-schema.js";

// The product spent its whole life able to reach three providers while the
// shared catalogue implemented eight, because the list lived in four places and
// only one of them was ever updated. These guard that drift.

test("every provider the product offers is implemented by the shared catalogue", () => {
  for (const providerId of PRODUCT_PROVIDER_IDS) {
    assert.ok(
      PROVIDER_DEFINITIONS.some((item) => item.id === providerId),
      `${providerId} is offered but has no provider implementation`,
    );
  }
});

test("every provider the product offers describes its cost and search posture", () => {
  for (const providerId of PRODUCT_PROVIDER_IDS) {
    assert.ok(providerAccess(providerId), `${providerId} is offered but has no access row`);
  }
  for (const access of PROVIDER_ACCESS) {
    assert.ok(isProductProviderId(access.id), `${access.id} is described but not offered`);
  }
});

test("every model provider in the credentials form is a provider the product can run", () => {
  const providers = INTEGRATIONS.filter((row) => row.kind === "model_provider");
  assert.equal(providers.length, PRODUCT_PROVIDER_IDS.length);
  for (const row of providers) {
    assert.ok(isProductProviderId(row.id), `${row.id} is addable but cannot be run`);
    assert.ok(row.envKeys.length > 0, `${row.id} is addable but reads no env key`);
  }
});

test("a provider with no web search is not sold as one that can close the citation gap", async () => {
  for (const access of PROVIDER_ACCESS) {
    if (access.search !== "never") continue;
    assert.equal(canCite(access), false, `${access.id} claims it can cite`);
  }
  const rows = await providerStatuses({ list: async () => [] });
  const deepseek = rows.find((row) => row.providerId === "deepseek");
  assert.equal(deepseek?.citationCapable, false);
});

test("Gemini's free tier is described as free answers without citations, not free grounding", () => {
  const gemini = providerAccess("gemini");
  assert.ok(gemini);
  assert.equal(gemini.search, "paid_plan_only");
  // Grounding with Google Search is sold on the paid tier only, so a free key
  // measures visibility and reports no sources at all.
  assert.ok(gemini.setup_note.includes("not sold on the free tier"));
  assert.equal(canCite(gemini), true, "it can cite once billing is on");
});

function withFetch<T>(stub: typeof fetch, run: () => Promise<T>): Promise<T> {
  const previous = globalThis.fetch;
  globalThis.fetch = stub;
  return run().finally(() => {
    globalThis.fetch = previous;
  });
}

function withKey<T>(name: string, value: string, run: () => Promise<T>): Promise<T> {
  const previous = process.env[name];
  process.env[name] = value;
  return run().finally(() => {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  });
}

const json = (body: unknown): Response => new Response(JSON.stringify(body), {
  status: 200,
  headers: { "content-type": "application/json" },
});

test("a Gemini listing is reduced to the ids the generate endpoint accepts", async () => {
  await withKey("GEMINI_API_KEY", "test-key", () => withFetch(
    (async () => json({
      models: [
        { name: "models/gemini-3.5-flash", displayName: "Gemini 3.5 Flash", supportedGenerationMethods: ["generateContent"] },
        { name: "models/text-embedding-004", displayName: "Embedding", supportedGenerationMethods: ["embedContent"] },
        { name: "models/gemini-live", displayName: "Live", supportedGenerationMethods: ["bidiGenerateContent"] },
      ],
    })) as unknown as typeof fetch,
    async () => {
      const models = await new DirectProviderModelCatalog("gemini").list();
      assert.deepEqual(models.map((row) => row.modelId), ["gemini-3.5-flash"]);
      assert.equal(models[0]?.displayName, "Gemini 3.5 Flash");
      assert.equal(models[0]?.source, "provider_catalog");
    },
  ));
});

test("a provider that will not answer contributes no models rather than a list its key cannot run", async () => {
  await withKey("OPENAI_API_KEY", "test-key", () => withFetch(
    (async () => new Response("nope", { status: 401 })) as unknown as typeof fetch,
    async () => {
      assert.deepEqual(await new DirectProviderModelCatalog("openai").list(), []);
    },
  ));
});

test("an unconfigured provider is never asked for its models", async () => {
  const previous = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    await withFetch(
      (async () => {
        throw new Error("an unconfigured provider was called anyway");
      }) as unknown as typeof fetch,
      async () => {
        assert.deepEqual(await new DirectProviderModelCatalog("anthropic").list(), []);
      },
    );
  } finally {
    if (previous !== undefined) process.env.ANTHROPIC_API_KEY = previous;
  }
});

test("a provider with no listing endpoint falls back to the models it declares", async () => {
  await withKey("PERPLEXITY_API_KEY", "test-key", () => withFetch(
    (async () => {
      throw new Error("Perplexity publishes no model listing, so none should be requested");
    }) as unknown as typeof fetch,
    async () => {
      const models = await new DirectProviderModelCatalog("perplexity").list();
      assert.ok(models.length > 0);
      assert.ok(models.every((row) => row.source === "local_capability_registry"));
      // Sonar is grounded by the API, so every answer carries sources.
      assert.ok(models.every((row) => row.nativeWebSearchSupported));
    },
  ));
});

test("an unreachable catalogue leaves every provider listed and none runnable", async () => {
  const broken: ProductModelCatalog = {
    list: async () => {
      throw new Error("catalogue is down");
    },
  };
  const rows = await providerStatuses(broken, { balance: async () => null });
  assert.equal(rows.length, PRODUCT_PROVIDER_IDS.length);
  assert.ok(rows.every((row) => row.runnableNow === false));
  assert.ok(rows.every((row) => row.detail.length > 0));
});
