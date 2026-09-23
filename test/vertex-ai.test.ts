import test from "node:test";
import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { hasProviderKey } from "../src/config/env.js";
import { ProductModelCatalogUnavailableError } from "../src/product/configuration/configuration-errors.js";
import { DatabricksProductModelCatalog } from "../src/product/configuration/databricks-model-catalog.js";
import { accessEndpoint, providerAccess } from "../src/product/configuration/provider-access.js";
import { isProductProviderId } from "../src/product/configuration/provider-id.js";
import { VertexProductModelCatalog, vertexModelId } from "../src/product/configuration/vertex-model-catalog.js";
import { WatsonxProductModelCatalog } from "../src/product/configuration/watsonx-model-catalog.js";
import { PROVIDER_DEFINITIONS } from "../src/providers/catalog.js";
import { DatabricksProvider, databricksInvocationUrl } from "../src/providers/databricks.js";
import { ProviderRequestError } from "../src/providers/provider-error.js";
import { VertexAIProvider, splitVertexModel, vertexGenerateUrl } from "../src/providers/vertex-ai.js";
import { resetVertexTokenCache, vertexAssertion } from "../src/providers/vertex-auth.js";
import { WatsonxProvider, watsonxChatUrl } from "../src/providers/watsonx.js";
import { resetWatsonxTokenCache, watsonxAccessToken } from "../src/providers/watsonx-auth.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

const ENV_NAMES = [
  "GOOGLE_VERTEX_PROJECT_ID", "GOOGLE_VERTEX_LOCATION", "GOOGLE_VERTEX_CLIENT_EMAIL", "GOOGLE_VERTEX_PRIVATE_KEY",
  "GOOGLE_CLOUD_PROJECT", "GOOGLE_CLOUD_REGION", "GOOGLE_VERTEX_TOKEN_HOST",
  "DATABRICKS_HOST", "DATABRICKS_TOKEN",
  "WATSONX_API_KEY", "WATSONX_PROJECT_ID", "WATSONX_REGION", "WATSONX_IAM_HOST", "WATSONX_API_VERSION",
];

const VERTEX_ENV: Record<string, string> = {
  GOOGLE_VERTEX_PROJECT_ID: "screener-dev",
  GOOGLE_VERTEX_LOCATION: "us-central1",
  GOOGLE_VERTEX_CLIENT_EMAIL: "citegeo@screener-dev.iam.gserviceaccount.com",
  GOOGLE_VERTEX_PRIVATE_KEY: PEM,
};

const DATABRICKS_ENV: Record<string, string> = {
  DATABRICKS_HOST: "https://dbc-1234.cloud.databricks.com",
  DATABRICKS_TOKEN: "dapi-token",
};

const WATSONX_ENV: Record<string, string> = {
  WATSONX_API_KEY: "ibm-key",
  WATSONX_PROJECT_ID: "project-uuid",
  WATSONX_REGION: "eu-gb",
};

/** Every name is cleared first, so an ambient cloud profile cannot decide a result. */
function withEnv<T>(values: Record<string, string>, run: () => Promise<T> | T): Promise<T> {
  const previous = new Map(ENV_NAMES.map((name) => [name, process.env[name]]));
  for (const name of ENV_NAMES) delete process.env[name];
  for (const [name, value] of Object.entries(values)) process.env[name] = value;
  resetVertexTokenCache();
  resetWatsonxTokenCache();
  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const [name, value] of previous) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
      resetVertexTokenCache();
      resetWatsonxTokenCache();
    });
}

function withFetch<T>(stub: typeof fetch, run: () => Promise<T>): Promise<T> {
  const previous = globalThis.fetch;
  globalThis.fetch = stub;
  return run().finally(() => {
    globalThis.fetch = previous;
  });
}

interface SeenRequest {
  url: string;
  authorization: string;
  body: Record<string, unknown>;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const TOKEN_BODY = { access_token: "ya29.stub", expires_in: 3600 };

function provider<T>(id: string, make: (definition: (typeof PROVIDER_DEFINITIONS)[number]) => T): T {
  const definition = PROVIDER_DEFINITIONS.find((item) => item.id === id);
  assert.ok(definition, `missing definition for ${id}`);
  return make(definition);
}

const RUN_INPUT = {
  prompt: "Who makes a stock screener?",
  model: "google/gemini-2.5-pro",
  apiKey: "unused-for-vertex",
  maxTokens: 900,
  temperature: 0,
  webSearchEnabled: false,
};

test("the three platform providers are registered and well formed", () => {
  for (const id of ["vertex-ai", "databricks", "watsonx"]) {
    assert.equal(isProductProviderId(id), true, `${id} is not a product provider id`);
    const row = providerAccess(id as "vertex-ai");
    assert.ok(row, `${id} has no access row`);
    assert.equal(row.cost, "metered");
    assert.ok(row.setup_note.length > 0);
    assert.ok(PROVIDER_DEFINITIONS.some((item) => item.id === id), `${id} has no provider definition`);
  }
});

test("each endpoint is built from its own region or host, never pasted in", async () => {
  await withEnv({ ...VERTEX_ENV, ...DATABRICKS_ENV, ...WATSONX_ENV }, () => {
    assert.equal(accessEndpoint(providerAccess("vertex-ai")!), "https://us-central1-aiplatform.googleapis.com");
    assert.equal(accessEndpoint(providerAccess("databricks")!), "https://dbc-1234.cloud.databricks.com");
    assert.equal(accessEndpoint(providerAccess("watsonx")!), "https://eu-gb.ml.cloud.ibm.com");
  });
});

test("a provider is unconfigured until every part it needs is present", async () => {
  await withEnv({}, () => {
    assert.equal(hasProviderKey("vertex-ai"), false);
    assert.equal(hasProviderKey("databricks"), false);
    assert.equal(hasProviderKey("watsonx"), false);
  });
  // The key alone is not enough: Vertex cannot address a project it was not given.
  const { GOOGLE_VERTEX_PROJECT_ID: _project, ...withoutProject } = VERTEX_ENV;
  await withEnv(withoutProject, () => assert.equal(hasProviderKey("vertex-ai"), false));
  await withEnv({ DATABRICKS_TOKEN: "dapi-token" }, () => assert.equal(hasProviderKey("databricks"), false));
  await withEnv({ WATSONX_API_KEY: "ibm-key", WATSONX_REGION: "eu-gb" }, () => assert.equal(hasProviderKey("watsonx"), false));
  await withEnv({ ...VERTEX_ENV, ...DATABRICKS_ENV, ...WATSONX_ENV }, () => {
    assert.equal(hasProviderKey("vertex-ai"), true);
    assert.equal(hasProviderKey("databricks"), true);
    assert.equal(hasProviderKey("watsonx"), true);
  });
});

test("the service account assertion verifies against its own public key", async () => {
  await withEnv(VERTEX_ENV, () => {
    const audience = "https://oauth2.googleapis.com/token";
    const assertion = vertexAssertion({ clientEmail: VERTEX_ENV.GOOGLE_VERTEX_CLIENT_EMAIL!, privateKey: PEM }, 1_700_000_000, audience);
    const [header, claims, signature] = assertion.split(".");
    assert.deepEqual(JSON.parse(Buffer.from(header!, "base64url").toString()), { alg: "RS256", typ: "JWT" });
    const payload = JSON.parse(Buffer.from(claims!, "base64url").toString());
    assert.equal(payload.iss, VERTEX_ENV.GOOGLE_VERTEX_CLIENT_EMAIL);
    assert.equal(payload.aud, audience);
    assert.equal(payload.scope, "https://www.googleapis.com/auth/cloud-platform");
    assert.equal(payload.exp - payload.iat, 3600);

    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${header}.${claims}`);
    verifier.end();
    assert.equal(verifier.verify(publicKey, Buffer.from(signature!, "base64url")), true);
  });
});

test("a private key flattened to backslash n still signs", async () => {
  await withEnv({ ...VERTEX_ENV, GOOGLE_VERTEX_PRIVATE_KEY: PEM.split("\n").join("\\n") }, async () => {
    let calls = 0;
    await withFetch(async (input) => {
      calls += 1;
      if (String(input).includes("oauth2")) return json(TOKEN_BODY);
      return json({ candidates: [{ content: { parts: [{ text: "ok" }] } }] });
    }, async () => {
      const result = await provider("vertex-ai", (d) => new VertexAIProvider(d)).run({ ...RUN_INPUT });
      assert.equal(result.text, "ok");
    });
    assert.equal(calls, 2);
  });
});

test("a model id keeps its publisher, and a bare id defaults to google", () => {
  assert.deepEqual(splitVertexModel("anthropic/claude-sonnet-4"), { publisher: "anthropic", model: "claude-sonnet-4" });
  assert.deepEqual(splitVertexModel("gemini-2.5-pro"), { publisher: "google", model: "gemini-2.5-pro" });
  assert.equal(
    vertexGenerateUrl("https://us-central1-aiplatform.googleapis.com", "screener-dev", "us-central1", "anthropic/claude-sonnet-4"),
    "https://us-central1-aiplatform.googleapis.com/v1/projects/screener-dev/locations/us-central1"
      + "/publishers/anthropic/models/claude-sonnet-4:generateContent",
  );
  assert.equal(vertexModelId("publishers/google/models/gemini-2.5-pro"), "google/gemini-2.5-pro");
  assert.equal(vertexModelId("publishers/google"), null);
});

test("the access token is exchanged once and reused for the next call", async () => {
  await withEnv(VERTEX_ENV, async () => {
    let tokenCalls = 0;
    await withFetch(async (input) => {
      if (String(input).includes("oauth2")) {
        tokenCalls += 1;
        return json(TOKEN_BODY);
      }
      return json({ candidates: [{ content: { parts: [{ text: "answer" }] } }] });
    }, async () => {
      const vertex = provider("vertex-ai", (d) => new VertexAIProvider(d));
      await vertex.run({ ...RUN_INPUT });
      await vertex.run({ ...RUN_INPUT });
    });
    assert.equal(tokenCalls, 1);
  });
});

test("a run carries the bearer token and reads grounding sources", async () => {
  await withEnv(VERTEX_ENV, async () => {
    const seen: SeenRequest[] = [];
    await withFetch(async (input, init) => {
      if (String(input).includes("oauth2")) return json(TOKEN_BODY);
      const headers = new Headers(init?.headers);
      seen.push({
        url: String(input),
        authorization: headers.get("authorization") || "",
        body: JSON.parse(String(init?.body)),
      });
      return json({
        candidates: [{
          content: { parts: [{ text: "Screener.in is one option." }] },
          groundingMetadata: {
            webSearchQueries: ["best stock screener india"],
            groundingChunks: [{ web: { uri: "https://www.screener.in/", title: "Screener" } }],
          },
        }],
        usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 7, totalTokenCount: 18 },
      });
    }, async () => {
      const result = await provider("vertex-ai", (d) => new VertexAIProvider(d))
        .run({ ...RUN_INPUT, webSearchEnabled: true });
      assert.equal(result.text, "Screener.in is one option.");
      assert.deepEqual(result.tokenUsage, { input: 11, output: 7, total: 18 });
      assert.equal(result.citations.length > 0, true);
      assert.deepEqual(result.webQueries, ["best stock screener india"]);
    });
    assert.equal(seen.length, 1);
    assert.equal(seen[0]!.authorization, "Bearer ya29.stub");
    assert.equal(seen[0]!.url.endsWith("/publishers/google/models/gemini-2.5-pro:generateContent"), true);
    assert.deepEqual(seen[0]!.body.tools, [{ googleSearch: {} }]);
  });
});

test("a response schema replaces grounding rather than joining it", async () => {
  await withEnv(VERTEX_ENV, async () => {
    let body: Record<string, unknown> = {};
    await withFetch(async (input, init) => {
      if (String(input).includes("oauth2")) return json(TOKEN_BODY);
      body = JSON.parse(String(init?.body));
      return json({ candidates: [{ content: { parts: [{ text: '{"named":[]}' }] } }] });
    }, async () => {
      const result = await provider("vertex-ai", (d) => new VertexAIProvider(d)).run({
        ...RUN_INPUT,
        webSearchEnabled: true,
        responseJsonSchema: { name: "brands", schema: { type: "object" } },
      });
      assert.equal(result.structuredOutput?.transport, "response_json_schema");
      assert.equal(result.search?.note?.includes("rejects grounding"), true);
    });
    assert.equal(body.tools, undefined);
    const generationConfig = body.generationConfig as Record<string, unknown>;
    assert.equal(generationConfig.responseMimeType, "application/json");
  });
});

test("a rejected Vertex call reports the fault it was given", async () => {
  await withEnv(VERTEX_ENV, async () => {
    await withFetch(async (input) => {
      if (String(input).includes("oauth2")) return json(TOKEN_BODY);
      // The one-element array is the shape Vertex actually answers with.
      return json([{ error: { message: "Permission denied on resource project screener-dev." } }], 403);
    }, async () => {
      await assert.rejects(
        () => provider("vertex-ai", (d) => new VertexAIProvider(d)).run({ ...RUN_INPUT }),
        (error: unknown) => {
          assert.ok(error instanceof ProviderRequestError);
          assert.equal(error.code, "authentication");
          assert.equal(error.message.includes("Permission denied"), true);
          return true;
        },
      );
    });
  });
});

test("an empty Vertex answer is an empty answer, not a broken payload", async () => {
  await withEnv(VERTEX_ENV, async () => {
    await withFetch(async (input) => {
      if (String(input).includes("oauth2")) return json(TOKEN_BODY);
      return json({ candidates: [{ content: { parts: [] } }] });
    }, async () => {
      await assert.rejects(
        () => provider("vertex-ai", (d) => new VertexAIProvider(d)).run({ ...RUN_INPUT }),
        (error: unknown) => error instanceof ProviderRequestError && error.code === "empty_answer",
      );
    });
  });
});

test("a refused assertion is named rather than surfacing on the first model call", async () => {
  await withEnv(VERTEX_ENV, async () => {
    await withFetch(async () => json({ error_description: "Invalid JWT Signature." }, 400), async () => {
      await assert.rejects(
        () => provider("vertex-ai", (d) => new VertexAIProvider(d)).run({ ...RUN_INPUT }),
        (error: unknown) => error instanceof Error && error.message.includes("Invalid JWT Signature"),
      );
    });
  });
});

test("the Vertex listing reads the shapes the API actually returns", async () => {
  await withEnv(VERTEX_ENV, async () => {
    await withFetch(async (input) => {
      const url = String(input);
      if (url.includes("oauth2")) return json(TOKEN_BODY);
      if (url.includes("/publishers/google/models")) {
        // PublisherModel as the discovery document defines it: no displayName,
        // and supportedActions is a CallToAction that names no inference call.
        return json({
          publisherModels: [
            {
              name: "publishers/google/models/gemini-2.5-pro",
              versionId: "001",
              launchStage: "GA",
              versionState: "VERSION_STATE_STABLE",
              supportedActions: { viewRestApi: { references: {} }, openGenerationAiStudio: { references: {} } },
            },
            {
              name: "publishers/google/models/gemma-3-27b",
              launchStage: "PUBLIC_PREVIEW",
              supportedActions: { deploy: { modelDisplayName: "gemma" }, openNotebook: { references: {} } },
            },
          ],
        });
      }
      return json({ error: { message: "not enabled" } }, 403);
    }, async () => {
      const models = await new VertexProductModelCatalog().list();
      assert.deepEqual(models.map((model) => model.modelId), ["google/gemini-2.5-pro", "google/gemma-3-27b"]);
      // A launch stage of GA is not a reachability signal, and a model exposing
      // a REST surface is callable.
      assert.equal(models[0]!.available, true);
      assert.equal(models[0]!.displayName, "google/gemini-2.5-pro");
      // Deploy without a REST surface means an endpoint has to exist first.
      assert.equal(models[1]!.available, false);
      assert.equal(models[1]!.unavailableReason?.includes("endpoint of your own"), true);
    });
  });
});

test("a model card asking for access is still offered, because the card is not this project", async () => {
  await withEnv(VERTEX_ENV, async () => {
    await withFetch(async (input) => {
      const url = String(input);
      if (url.includes("oauth2")) return json(TOKEN_BODY);
      if (url.includes("/publishers/google/models")) {
        return json({
          publisherModels: [{
            name: "publishers/google/models/gated-model",
            supportedActions: { requestAccess: { references: {} }, viewRestApi: { references: {} } },
          }],
        });
      }
      return json({ error: { message: "not enabled" } }, 403);
    }, async () => {
      const models = await new VertexProductModelCatalog().list();
      // Unavailable disables the checkbox outright, so a listing that cannot
      // know whether access was already granted must not decide it here.
      assert.equal(models[0]!.available, true);
      assert.equal(models[0]!.unavailableReason, null);
    });
  });
});

test("every page of the listing is read, not just the first", async () => {
  await withEnv(VERTEX_ENV, async () => {
    const seen: string[] = [];
    await withFetch(async (input) => {
      const url = String(input);
      if (url.includes("oauth2")) return json(TOKEN_BODY);
      if (!url.includes("/publishers/google/models")) return json({ error: { message: "no" } }, 403);
      seen.push(url);
      if (!url.includes("pageToken")) {
        return json({
          publisherModels: [{ name: "publishers/google/models/first" }],
          nextPageToken: "page-2",
        });
      }
      return json({ publisherModels: [{ name: "publishers/google/models/second" }] });
    }, async () => {
      const models = await new VertexProductModelCatalog().list();
      assert.deepEqual(models.map((model) => model.modelId), ["google/first", "google/second"]);
    });
    assert.equal(seen.length, 2);
    assert.equal(seen[1]!.includes("pageToken=page-2"), true);
  });
});

test("a listing nobody could reach is unavailable, never an account with no models", async () => {
  await withEnv(VERTEX_ENV, async () => {
    await withFetch(async (input) => {
      if (String(input).includes("oauth2")) return json(TOKEN_BODY);
      return json({ error: { message: "denied" } }, 403);
    }, async () => {
      await assert.rejects(
        () => new VertexProductModelCatalog().list(),
        (error: unknown) => error instanceof ProductModelCatalogUnavailableError,
      );
    });
  });
});

test("a Databricks endpoint name is a path segment, and the body is the chat shape", async () => {
  assert.equal(
    databricksInvocationUrl("https://dbc-1234.cloud.databricks.com", "my endpoint/v2"),
    "https://dbc-1234.cloud.databricks.com/serving-endpoints/my%20endpoint%2Fv2/invocations",
  );
  await withEnv(DATABRICKS_ENV, async () => {
    const seen: SeenRequest[] = [];
    await withFetch(async (input, init) => {
      const headers = new Headers(init?.headers);
      seen.push({ url: String(input), authorization: headers.get("authorization") || "", body: JSON.parse(String(init?.body)) });
      return json({
        choices: [{ message: { content: "Served." }, finish_reason: "stop" }],
        usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
      });
    }, async () => {
      const result = await provider("databricks", (d) => new DatabricksProvider(d))
        .run({ ...RUN_INPUT, model: "databricks-claude-sonnet-4", apiKey: "dapi-token" });
      assert.equal(result.text, "Served.");
      assert.deepEqual(result.tokenUsage, { input: 4, output: 2, total: 6 });
    });
    assert.equal(seen[0]!.authorization, "Bearer dapi-token");
    assert.equal(seen[0]!.url.endsWith("/serving-endpoints/databricks-claude-sonnet-4/invocations"), true);
  });
});

test("a Databricks endpoint that is not ready is listed and marked unreachable", async () => {
  await withEnv(DATABRICKS_ENV, async () => {
    await withFetch(async () => json({
      endpoints: [
        { name: "chat-prod", task: "llm/v1/chat", state: { ready: "READY" } },
        { name: "chat-staging", task: "llm/v1/chat", state: { ready: "NOT_READY" } },
        { name: "embeddings", task: "llm/v1/embeddings", state: { ready: "READY" } },
      ],
    }), async () => {
      const models = await new DatabricksProductModelCatalog().list();
      assert.deepEqual(models.map((model) => model.modelId), ["chat-prod", "chat-staging"]);
      assert.equal(models[1]!.available, false);
      assert.equal(models[1]!.unavailableReason?.includes("not ready"), true);
    });
  });
});

test("watsonx buys one IAM token, reuses it, and versions the chat call", async () => {
  assert.equal(
    watsonxChatUrl("https://eu-gb.ml.cloud.ibm.com", "2024-10-10"),
    "https://eu-gb.ml.cloud.ibm.com/ml/v1/text/chat?version=2024-10-10",
  );
  await withEnv(WATSONX_ENV, async () => {
    let tokenCalls = 0;
    let body: Record<string, unknown> = {};
    await withFetch(async (input, init) => {
      if (String(input).includes("iam.cloud.ibm.com")) {
        tokenCalls += 1;
        return json({ access_token: "iam-token", expires_in: 3600 });
      }
      body = JSON.parse(String(init?.body));
      return json({ choices: [{ message: { content: "Answered." }, finish_reason: "stop" }] });
    }, async () => {
      const watsonx = provider("watsonx", (d) => new WatsonxProvider(d));
      await watsonx.run({ ...RUN_INPUT, model: "ibm/granite-3-8b-instruct", apiKey: "ibm-key" });
      const second = await watsonx.run({ ...RUN_INPUT, model: "ibm/granite-3-8b-instruct", apiKey: "ibm-key" });
      assert.equal(second.text, "Answered.");
    });
    assert.equal(tokenCalls, 1);
    assert.equal(body.project_id, "project-uuid");
    assert.equal(body.model_id, "ibm/granite-3-8b-instruct");
  });
});

test("a refused IBM key is named, and a withdrawn model is not offered as available", async () => {
  await withEnv(WATSONX_ENV, async () => {
    await withFetch(async () => json({ errorMessage: "Provided API key could not be found." }, 400), async () => {
      await assert.rejects(
        () => watsonxAccessToken("ibm-key"),
        (error: unknown) => error instanceof Error && error.message.includes("could not be found"),
      );
    });
  });
  await withEnv(WATSONX_ENV, async () => {
    await withFetch(async (input) => {
      if (String(input).includes("iam.cloud.ibm.com")) return json({ access_token: "iam-token", expires_in: 3600 });
      // Shapes taken from a live foundation_model_specs response: task_ids is
      // null on most rows and functions carries the real capability list.
      return json({
        resources: [
          {
            model_id: "ibm/granite-3-8b-instruct", label: "Granite 3 8B", provider: "IBM",
            task_ids: null, functions: [{ id: "text_chat" }, { id: "text_generation" }],
            lifecycle: [{ id: "available", start_date: "2024-09-17" }],
          },
          {
            model_id: "ibm/granite-13b-chat-v2", task_ids: null, functions: [{ id: "text_generation" }],
            lifecycle: [{ id: "available" }, { id: "deprecated" }, { id: "withdrawn" }],
          },
          {
            model_id: "cross-encoder/ms-marco-minilm-l-12-v2", label: "ms-marco", provider: "cross-encoder",
            task_ids: null, functions: [{ id: "rerank" }],
          },
          { model_id: "ibm/slate-125m-english-rtrvr", task_ids: null, functions: [{ id: "embedding" }] },
        ],
      });
    }, async () => {
      const models = await new WatsonxProductModelCatalog().list();
      // A reranker and an embedding model answer neither chat nor generation,
      // so offering them as models to ask a question of would be a lie.
      assert.deepEqual(models.map((model) => model.modelId), ["ibm/granite-3-8b-instruct", "ibm/granite-13b-chat-v2"]);
      assert.equal(models[0]!.displayName, "Granite 3 8B");
      assert.equal(models[0]!.available, true);
      assert.equal(models[1]!.available, false);
      assert.equal(models[1]!.unavailableReason?.includes("Withdrawn"), true);
    });
  });
});
