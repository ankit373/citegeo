import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { hasProviderKey } from "../src/config/env.js";
import { INTEGRATIONS } from "../src/product/auth/integrations.js";
import { BedrockProductModelCatalog } from "../src/product/configuration/bedrock-model-catalog.js";
import { ProductModelCatalogUnavailableError } from "../src/product/configuration/configuration-errors.js";
import { accessEndpoint, canCite, providerAccess } from "../src/product/configuration/provider-access.js";
import { isProductProviderId } from "../src/product/configuration/provider-id.js";
import { deriveSigningKey, signRequest } from "../src/product/storage/sigv4.js";
import { BedrockProvider, bedrockConverseUrl } from "../src/providers/bedrock.js";
import { bedrockCredentials, signBedrockRequest } from "../src/providers/bedrock-signing.js";
import { PROVIDER_DEFINITIONS, ProviderCatalog } from "../src/providers/catalog.js";
import { ProviderRequestError } from "../src/providers/provider-error.js";

const ACCESS_KEY_ID = "AKIDEXAMPLE";
const SECRET = "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY";
const REGION = "us-east-1";
const RUNTIME_HOST = "bedrock-runtime.us-east-1.amazonaws.com";

// A real Bedrock id carries a colon, which is what makes the path encoding
// visible: %3A on the wire, and %253A again inside the canonical request.
const MODEL = "anthropic.claude-3-5-sonnet-20241022-v2:0";
const REQUEST_PATH = "/model/anthropic.claude-3-5-sonnet-20241022-v2%3A0/converse";
const CANONICAL_PATH = "/model/anthropic.claude-3-5-sonnet-20241022-v2%253A0/converse";

const AWS_ENV_NAMES = [
  "AWS_BEDROCK_REGION", "AWS_BEDROCK_ACCESS_KEY_ID", "AWS_BEDROCK_SECRET_ACCESS_KEY", "AWS_BEDROCK_SESSION_TOKEN",
  "AWS_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN",
];

const CONFIGURED: Record<string, string> = {
  AWS_BEDROCK_REGION: REGION,
  AWS_BEDROCK_ACCESS_KEY_ID: ACCESS_KEY_ID,
  AWS_BEDROCK_SECRET_ACCESS_KEY: SECRET,
};

/** Every AWS name is cleared first, so an ambient profile cannot decide a result. */
function withAwsEnv<T>(values: Record<string, string>, run: () => Promise<T> | T): Promise<T> {
  const previous = new Map(AWS_ENV_NAMES.map((name) => [name, process.env[name]]));
  for (const name of AWS_ENV_NAMES) delete process.env[name];
  for (const [name, value] of Object.entries(values)) process.env[name] = value;
  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [name, value] of previous) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    });
}

function withFetch<T>(stub: typeof fetch, run: () => Promise<T>): Promise<T> {
  const previous = globalThis.fetch;
  globalThis.fetch = stub;
  return run().finally(() => {
    globalThis.fetch = previous;
  });
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Signature Version 4 written out again from its own steps, so the signer is
 * checked against the specification rather than against itself.
 */
function expectedAuthorization(input: {
  method: string;
  canonicalPath: string;
  host: string;
  body: string;
  service: string;
  stamp: string;
  sessionToken?: string;
}): string {
  const payloadHash = sha256Hex(input.body);
  const named: Array<[string, string]> = [
    ["accept", "application/json"],
    ["content-type", "application/json"],
    ["host", input.host],
    ["x-amz-content-sha256", payloadHash],
    ["x-amz-date", input.stamp],
  ];
  if (input.sessionToken) named.push(["x-amz-security-token", input.sessionToken]);
  named.sort((left, right) => (left[0] < right[0] ? -1 : 1));
  const canonicalHeaders = named.map(([name, value]) => `${name}:${value}\n`).join("");
  const signedHeaders = named.map(([name]) => name).join(";");
  const canonicalRequest = [input.method, input.canonicalPath, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const date = input.stamp.slice(0, 8);
  const scope = `${date}/${REGION}/${input.service}/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", input.stamp, scope, sha256Hex(canonicalRequest)].join("\n");
  const signature = createHmac("sha256", deriveSigningKey(SECRET, date, REGION, input.service))
    .update(toSign, "utf8")
    .digest("hex");
  return `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

const AT = new Date("2015-08-30T12:36:00Z");
const STAMP = "20150830T123600Z";

test("a Converse call is signed over the canonical request AWS specifies", async () => {
  await withAwsEnv(CONFIGURED, () => {
    const url = bedrockConverseUrl(`https://${RUNTIME_HOST}`, MODEL);
    assert.equal(url.pathname, REQUEST_PATH, "the model id is escaped once on the wire");
    const body = JSON.stringify({ messages: [{ role: "user", content: [{ text: "hello" }] }] });
    const headers = signBedrockRequest(
      { method: "POST", url, body, service: "bedrock-runtime", credentials: bedrockCredentials() },
      AT,
    );
    assert.equal(headers["x-amz-date"], STAMP);
    assert.equal(headers["x-amz-content-sha256"], sha256Hex(body));
    assert.equal(headers.host, RUNTIME_HOST);
    assert.equal(
      headers.authorization,
      expectedAuthorization({ method: "POST", canonicalPath: CANONICAL_PATH, host: RUNTIME_HOST, body, service: "bedrock-runtime", stamp: STAMP }),
    );
  });
});

test("the control plane and the runtime are signed as two different services", async () => {
  await withAwsEnv(CONFIGURED, () => {
    const credentials = bedrockCredentials();
    const listing = signBedrockRequest(
      { method: "GET", url: new URL(`https://bedrock.${REGION}.amazonaws.com/foundation-models`), body: "", service: "bedrock", credentials },
      AT,
    );
    assert.ok(listing.authorization?.includes(`/${REGION}/bedrock/aws4_request`));
    assert.equal(
      listing.authorization,
      expectedAuthorization({ method: "GET", canonicalPath: "/foundation-models", host: `bedrock.${REGION}.amazonaws.com`, body: "", service: "bedrock", stamp: STAMP }),
    );
    const runtime = signBedrockRequest(
      { method: "GET", url: new URL(`https://bedrock.${REGION}.amazonaws.com/foundation-models`), body: "", service: "bedrock-runtime", credentials },
      AT,
    );
    assert.notEqual(listing.authorization, runtime.authorization);
  });
});

test("a session token is signed, not merely sent alongside", async () => {
  await withAwsEnv({ ...CONFIGURED, AWS_BEDROCK_SESSION_TOKEN: "temporary-token" }, () => {
    const url = bedrockConverseUrl(`https://${RUNTIME_HOST}`, MODEL);
    const headers = signBedrockRequest({ method: "POST", url, body: "{}", service: "bedrock-runtime", credentials: bedrockCredentials() }, AT);
    assert.equal(headers["x-amz-security-token"], "temporary-token");
    assert.ok(headers.authorization?.includes("x-amz-security-token"));
    assert.equal(
      headers.authorization,
      expectedAuthorization({ method: "POST", canonicalPath: CANONICAL_PATH, host: RUNTIME_HOST, body: "{}", service: "bedrock-runtime", stamp: STAMP, sessionToken: "temporary-token" }),
    );
  });
});

test("the object store keeps the single-encoded path that S3 alone signs", () => {
  const body = "{}";
  const headers = signRequest(
    { method: "PUT", url: new URL("https://bucket.s3.amazonaws.com/a%20b.json"), headers: { "content-type": "application/json", accept: "application/json" }, body },
    { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET, region: REGION, service: "s3" },
    AT,
  );
  assert.equal(
    headers.authorization,
    expectedAuthorization({ method: "PUT", canonicalPath: "/a%20b.json", host: "bucket.s3.amazonaws.com", body, service: "s3", stamp: STAMP }),
  );
});

test("a missing part of the credential is named rather than read as a bad key", async () => {
  await withAwsEnv({ AWS_BEDROCK_ACCESS_KEY_ID: ACCESS_KEY_ID, AWS_BEDROCK_SECRET_ACCESS_KEY: SECRET }, () => {
    assert.throws(() => bedrockCredentials(), (error: unknown) => error instanceof Error && error.message.includes("AWS_BEDROCK_REGION"));
    assert.equal(hasProviderKey("bedrock"), false);
  });
  await withAwsEnv({ AWS_BEDROCK_REGION: REGION, AWS_BEDROCK_SECRET_ACCESS_KEY: SECRET }, () => {
    assert.throws(() => bedrockCredentials(), (error: unknown) => error instanceof Error && error.message.includes("AWS_BEDROCK_ACCESS_KEY_ID"));
    assert.equal(hasProviderKey("bedrock"), false);
  });
  await withAwsEnv(CONFIGURED, () => {
    assert.equal(hasProviderKey("bedrock"), true);
  });
});

test("Amazon Bedrock describes itself once, on the access row everything else reads", async () => {
  const row = providerAccess("bedrock");
  assert.ok(row, "bedrock has no access row");
  assert.equal(row.label, "Amazon Bedrock");
  assert.equal(row.cost, "metered");
  assert.equal(row.search, "never");
  // Converse carries no web search tool, so it must never be sold as closing
  // the citation gap. It still measures visibility, share of voice and sentiment.
  assert.equal(canCite(row), false);
  assert.ok(row.cost_note.length > 0);
  assert.ok(row.setup_note.includes("bedrock:ListFoundationModels"));
  assert.deepEqual((row.settings || []).map((setting) => setting.envKey), ["AWS_BEDROCK_REGION", "AWS_BEDROCK_ACCESS_KEY_ID"]);
  assert.ok(isProductProviderId("bedrock"));
  assert.ok(PROVIDER_DEFINITIONS.some((item) => item.id === "bedrock"), "no provider implementation");
  const credential = INTEGRATIONS.find((item) => item.id === "bedrock");
  assert.equal(credential?.kind, "model_provider");
  assert.deepEqual(credential?.envKeys, ["AWS_BEDROCK_SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY"]);
  const definition = PROVIDER_DEFINITIONS.find((item) => item.id === "bedrock");
  assert.equal(definition?.supportsWebSearch, false);
  assert.equal(definition?.supportsAnyModel, true);
  assert.deepEqual(definition?.defaultModels, [], "models come from the provider, never from a declared list");
});

test("the endpoint is built from the configured region and is absent without one", async () => {
  const row = providerAccess("bedrock");
  assert.ok(row);
  await withAwsEnv({}, () => {
    assert.equal(accessEndpoint(row), null);
  });
  await withAwsEnv({ ...CONFIGURED, AWS_BEDROCK_REGION: "eu-central-1" }, () => {
    assert.equal(accessEndpoint(row), "https://bedrock-runtime.eu-central-1.amazonaws.com");
  });
});

test("a listing that fails reports the provider unavailable, never an account with no models", async () => {
  await withAwsEnv(CONFIGURED, () => withFetch(
    (async () => json({ message: "User is not authorized to perform bedrock:ListFoundationModels" }, 403)) as unknown as typeof fetch,
    async () => {
      await assert.rejects(
        () => new BedrockProductModelCatalog().list(),
        (error: unknown) => error instanceof ProductModelCatalogUnavailableError && error.message.includes("403"),
      );
    },
  ));
  await withAwsEnv(CONFIGURED, () => withFetch(
    (async () => { throw new Error("getaddrinfo ENOTFOUND"); }) as unknown as typeof fetch,
    async () => {
      await assert.rejects(() => new BedrockProductModelCatalog().list(), ProductModelCatalogUnavailableError);
    },
  ));
});

test("an unconfigured account is never asked for its models", async () => {
  await withAwsEnv({}, () => withFetch(
    (async () => { throw new Error("an unconfigured provider was called anyway"); }) as unknown as typeof fetch,
    async () => {
      assert.deepEqual(await new BedrockProductModelCatalog().list(), []);
    },
  ));
});

test("the listing is read from the provider, and a model one request cannot reach says why", async () => {
  await withAwsEnv(CONFIGURED, () => withFetch(
    (async (input: unknown) => {
      assert.equal(String(input), `https://bedrock.${REGION}.amazonaws.com/foundation-models`);
      return json({
        modelSummaries: [
          { modelId: MODEL, modelName: "Claude 3.5 Sonnet", providerName: "Anthropic", inputModalities: ["TEXT"], outputModalities: ["TEXT"], inferenceTypesSupported: ["ON_DEMAND"] },
          { modelId: "vendor.big-v1:0", modelName: "Big", providerName: "Vendor", inputModalities: ["TEXT"], outputModalities: ["TEXT"], inferenceTypesSupported: ["PROVISIONED"] },
          { modelId: "vendor.unknown-v1:0", modelName: "Unknown", providerName: "Vendor", inputModalities: ["TEXT"], outputModalities: ["TEXT"] },
          { modelId: "vendor.painter-v1:0", modelName: "Painter", providerName: "Vendor", inputModalities: ["TEXT"], outputModalities: ["IMAGE"], inferenceTypesSupported: ["ON_DEMAND"] },
        ],
      });
    }) as unknown as typeof fetch,
    async () => {
      const models = await new BedrockProductModelCatalog().list();
      assert.deepEqual(models.map((item) => item.modelId), [MODEL, "vendor.big-v1:0", "vendor.unknown-v1:0"]);
      const first = models[0];
      assert.equal(first?.providerId, "bedrock");
      assert.equal(first?.displayName, "Claude 3.5 Sonnet");
      assert.equal(first?.vendor, "Anthropic");
      assert.equal(first?.source, "provider_catalog");
      assert.equal(first?.available, true);
      // Bedrock publishes no release date, so it stays absent rather than being
      // filled with the day this product first saw the model.
      assert.equal(first?.releasedAt, null);
      assert.equal(first?.nativeWebSearchSupported, false);
      assert.equal(models[1]?.available, false);
      assert.ok(models[1]?.unavailableReason?.includes("provisioned"));
      assert.equal(models[2]?.available, false);
      assert.ok(models[2]?.unavailableReason?.includes("did not say"));
    },
  ));
});

function bedrockProvider(): BedrockProvider {
  const definition = PROVIDER_DEFINITIONS.find((item) => item.id === "bedrock");
  assert.ok(definition);
  return new BedrockProvider(definition);
}

const RUN_INPUT = {
  prompt: "Who makes a stock screener?",
  model: MODEL,
  apiKey: SECRET,
  maxTokens: 900,
  temperature: 0,
  webSearchEnabled: false,
};

test("a run reaches the runtime and reads the answer Converse returns", async () => {
  await withAwsEnv(CONFIGURED, () => {
    let seen: { url: string; headers: Record<string, string>; body: unknown } | null = null;
    return withFetch(
      (async (input: unknown, init: RequestInit | undefined) => {
        seen = {
          url: String(input),
          headers: (init?.headers || {}) as Record<string, string>,
          body: JSON.parse(String(init?.body || "{}")),
        };
        return json({
          output: { message: { role: "assistant", content: [{ text: "One is example.dev." }] } },
          usage: { inputTokens: 11, outputTokens: 7, totalTokens: 18 },
          stopReason: "end_turn",
        });
      }) as unknown as typeof fetch,
      async () => {
        const result = await bedrockProvider().run(RUN_INPUT);
        const request = seen as unknown as { url: string; headers: Record<string, string>; body: Record<string, unknown> };
        assert.equal(request.url, `https://${RUNTIME_HOST}${REQUEST_PATH}`);
        assert.ok(request.headers.authorization?.startsWith("AWS4-HMAC-SHA256 Credential="));
        assert.deepEqual(request.body.inferenceConfig, { maxTokens: 900, temperature: 0 });
        assert.equal(result.providerId, "bedrock");
        assert.equal(result.text, "One is example.dev.");
        assert.deepEqual(result.tokenUsage, { input: 11, output: 7, total: 18 });
        assert.equal(result.search?.endpointProtocol, "bedrock_converse");
        assert.equal(result.search?.used, false);
        assert.deepEqual(result.webQueries, []);
      },
    );
  });
});

test("a response schema is asked for as a forced tool, and the transport says so", async () => {
  await withAwsEnv(CONFIGURED, () => {
    let body: Record<string, unknown> = {};
    return withFetch(
      (async (_input: unknown, init: RequestInit | undefined) => {
        body = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
        return json({
          output: { message: { content: [{ toolUse: { toolUseId: "t1", name: "domain_recognition", input: { brandKnown: true } } }] } },
          stopReason: "tool_use",
        });
      }) as unknown as typeof fetch,
      async () => {
        const result = await bedrockProvider().run({
          ...RUN_INPUT,
          responseJsonSchema: { name: "domain_recognition", schema: { type: "object", properties: { brandKnown: { type: "boolean" } } } },
        });
        const toolConfig = body.toolConfig as { tools: Array<{ toolSpec: { name: string } }>; toolChoice: unknown };
        assert.equal(toolConfig.tools[0]?.toolSpec.name, "domain_recognition");
        assert.deepEqual(toolConfig.toolChoice, { tool: { name: "domain_recognition" } });
        // Converse has no response-format field, so the value arrived as a tool
        // call and is reported as one rather than as the format it was asked for.
        assert.equal(result.structuredOutput?.transport, "function_tool");
        assert.deepEqual(result.structuredOutput?.value, { brandKnown: true });
        assert.equal(result.text, '{"brandKnown":true}');
      },
    );
  });
});

test("a refused model is a named provider failure rather than an empty answer", async () => {
  await withAwsEnv(CONFIGURED, () => withFetch(
    (async () => json({ message: "You do not have access to the model with the specified model ID." }, 403)) as unknown as typeof fetch,
    async () => {
      await assert.rejects(() => bedrockProvider().run(RUN_INPUT), (error: unknown) => {
        assert.ok(error instanceof ProviderRequestError);
        assert.equal(error.code, "authentication");
        assert.ok(error.message.includes("do not have access"));
        return true;
      });
    },
  ));
});

test("an answer with no content is reported as empty rather than as a blank answer", async () => {
  await withAwsEnv(CONFIGURED, () => withFetch(
    (async () => json({ output: { message: { content: [] } }, stopReason: "end_turn" })) as unknown as typeof fetch,
    async () => {
      await assert.rejects(
        () => bedrockProvider().run(RUN_INPUT),
        (error: unknown) => error instanceof ProviderRequestError && error.code === "empty_answer",
      );
    },
  ));
});

test("Bedrock names models its own way, and a run without a region says which is missing", async () => {
  await withAwsEnv(CONFIGURED, () => {
    const catalog = new ProviderCatalog();
    assert.equal(catalog.get("bedrock").definition.id, "bedrock");
    // An inference-profile ARN carries slashes, which is not a routed id pasted
    // into the wrong provider.
    assert.doesNotThrow(() => catalog.validate("bedrock", "arn:aws:bedrock:us-east-1:1:inference-profile/us.vendor.model-v1:0"));
    assert.doesNotThrow(() => catalog.validate("bedrock", MODEL));
  });
  await withAwsEnv({ AWS_BEDROCK_ACCESS_KEY_ID: ACCESS_KEY_ID, AWS_BEDROCK_SECRET_ACCESS_KEY: SECRET }, () => {
    const catalog = new ProviderCatalog();
    assert.throws(() => catalog.get("bedrock"), (error: unknown) => error instanceof Error && error.message.includes("AWS_BEDROCK_REGION"));
  });
});
