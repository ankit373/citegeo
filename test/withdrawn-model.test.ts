import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { OpenAICompatibleProvider } from "../src/providers/openai-compatible.js";
import { ProviderRequestError } from "../src/providers/provider-error.js";
import type { ProviderDefinition } from "../src/core/types.js";

const DEFINITION: ProviderDefinition = {
  id: "openrouter", label: "Aggregator", sourceType: "api", envKeys: ["KEY"],
  defaultModels: [], supportsNativeCitations: false, supportsWebSearch: false,
  resultCaveat: "",
};

// The aggregator's own words for a free slug it has retired, which is what 238
// archived answers carry.
const RETIRED = "This model is unavailable for free. The paid version is available now - use this slug instead: qwen/qwen3.8-27b";

async function askStub(status: number, message: string): Promise<unknown> {
  const server = createServer((_request, response) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { message } }));
  });
  await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
  const port = (server.address() as { port: number }).port;
  const provider = new OpenAICompatibleProvider({
    definition: DEFINITION,
    endpoint: `http://127.0.0.1:${port}/v1/chat/completions`,
  });
  try {
    return await provider.run({
      prompt: "best stock screener", model: "qwen/qwen3.8-27b:free", apiKey: "k",
      maxTokens: 64, temperature: 0, webSearchEnabled: false,
    }).then(() => null, (error: unknown) => error);
  } finally {
    await new Promise<void>((shut) => server.close(() => shut()));
  }
}

test("a retired slug reaches the reader as a withdrawn model, not a refused request", async () => {
  const failure = await askStub(404, RETIRED);
  assert.ok(failure instanceof ProviderRequestError, String(failure));
  assert.equal(failure.code, "model_unavailable");
});

test("a genuine refusal is still a refusal", async () => {
  const failure = await askStub(400, "Unsupported value: 'messages[0].role'");
  assert.ok(failure instanceof ProviderRequestError);
  assert.equal(failure.code, "invalid_response");
});
