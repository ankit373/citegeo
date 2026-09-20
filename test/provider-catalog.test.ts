import test from "node:test";
import assert from "node:assert/strict";
import { ProviderCatalog, PROVIDER_DEFINITIONS } from "../src/providers/catalog.js";
import { providerEnvKeys } from "../src/config/env.js";
import { analysisModelFor } from "../src/providers/provider-role.js";

test("core provider catalog has no fake provider and keeps key routing provider-specific", () => {
  assert.equal(PROVIDER_DEFINITIONS.some((provider) => provider.id.toLowerCase().includes("mock")), false);
  assert.deepEqual(providerEnvKeys("openai"), ["OPENAI_API_KEY"]);
  assert.deepEqual(providerEnvKeys("gemini"), ["GEMINI_API_KEY"]);
  assert.deepEqual(providerEnvKeys("openrouter"), ["OPENROUTER_API_KEY", "OPENROUTER_KEY"]);
});

test("catalog validates direct models and lets OpenRouter carry routed model ids", () => {
  const catalog = new ProviderCatalog();
  assert.doesNotThrow(() => catalog.validate("openrouter", "anthropic/claude-3.5-haiku"));
  assert.throws(() => catalog.validate("openai", "google/gemini-flash-1.5"));
});

test("provider roles keep answer models separate from stable analysis models", () => {
  const catalog = new ProviderCatalog();
  const openrouter = catalog.get("openrouter");
  assert.equal(analysisModelFor(openrouter, "vendor/answer-model"), "openai/gpt-5.6-luna");
  assert.equal(openrouter.definition.id, "openrouter");
});

test("a direct provider accepts a model its listing returned but not a routed id", () => {
  const catalog = new ProviderCatalog();
  // The models endpoint is the authority, so an id we never hardcoded is fine.
  assert.doesNotThrow(() => catalog.validate("gemini", "gemini-3.8-flash"));
  assert.doesNotThrow(() => catalog.validate("anthropic", "claude-opus-4-5-20260101"));
  // A routed id in a direct provider is a paste error, and saying so beats a 404.
  const saysRouted = (error: unknown) => error instanceof Error && error.message.includes("routed id");
  assert.throws(() => catalog.validate("gemini", "google/gemini-3.5-flash"), saysRouted);
  assert.throws(() => catalog.validate("perplexity", "perplexity/sonar"), saysRouted);
});

test("a gateway the user supplied keeps whatever id convention it uses", () => {
  const previous = process.env.OPENAI_COMPATIBLE_BASE_URL;
  process.env.OPENAI_COMPATIBLE_BASE_URL = "http://127.0.0.1:8788/v1";
  try {
    const catalog = new ProviderCatalog();
    assert.doesNotThrow(() => catalog.validate("openai-compatible", "meta-llama/Llama-3-70b"));
  } finally {
    if (previous === undefined) delete process.env.OPENAI_COMPATIBLE_BASE_URL;
    else process.env.OPENAI_COMPATIBLE_BASE_URL = previous;
  }
});
