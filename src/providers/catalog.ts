import type { AnswerProvider, ProviderDefinition } from "../core/types.js";
import { azureOpenAIApiVersion, azureOpenAIEndpoint, bedrockRegion, openAICompatibleBaseUrl } from "../config/env.js";
import { AnthropicProvider } from "./anthropic.js";
import { GeminiProvider } from "./gemini.js";
import { dedupeCitations, extractAnnotationCitations, extractPerplexityCitations } from "./citation-extractors.js";
import { AzureOpenAIProvider } from "./azure-openai.js";
import { BedrockProvider } from "./bedrock.js";
import { DatabricksProvider } from "./databricks.js";
import { VertexAIProvider } from "./vertex-ai.js";
import { WatsonxProvider } from "./watsonx.js";
import { OpenAICompatibleGatewayProvider } from "./openai-compatible-gateway.js";
import { OpenAICompatibleProvider, perplexityCitationExtractor } from "./openai-compatible.js";
import { openRouterNativeWebSearch } from "./openrouter-native-search.js";
import { OpenRouterModelCatalog } from "./openrouter-model-capabilities.js";
import { ProviderModelCapabilityCatalog } from "./model-capability-catalog.js";
import { ResponsesCompatibleProvider } from "./responses-compatible.js";

const API_CAVEAT = "API results are provider API results. They are not claimed to match browser UI or human verified regional results.";

export const PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  {
    id: "openrouter",
    label: "OpenRouter",
    sourceType: "api",
    envKeys: ["OPENROUTER_API_KEY", "OPENROUTER_KEY"],
    defaultModels: ["openai/gpt-4o-mini", "anthropic/claude-3.5-haiku", "google/gemini-flash-1.5"],
    analysisModel: "openai/gpt-5.6-luna",
    supportsAnyModel: true,
    supportsJsonSchema: true,
    supportsNativeCitations: true,
    supportsWebSearch: true,
    nativeWebSearch: {
      endpointProtocol: "chat_completions",
      toolName: "openrouter:web_search",
    },
    resultCaveat: API_CAVEAT,
  },
  {
    id: "openai",
    label: "OpenAI",
    sourceType: "api",
    envKeys: ["OPENAI_API_KEY"],
    defaultModels: ["gpt-4o-mini", "gpt-4o"],
    defaultModelCapabilities: [
      { model: "gpt-4o-mini", nativeWebSearchSupported: false },
      { model: "gpt-4o", nativeWebSearchSupported: false },
    ],
    analysisModel: "gpt-4o-mini",
    // Discovered from the provider's own /v1/models listing.
    supportsAnyModel: true,
    supportsNativeCitations: true,
    supportsWebSearch: true,
    nativeWebSearch: {
      endpointProtocol: "responses",
      toolName: "web_search",
    },
    resultCaveat: API_CAVEAT,
  },
  {
    id: "anthropic",
    label: "Anthropic",
    sourceType: "api",
    envKeys: ["ANTHROPIC_API_KEY"],
    defaultModels: ["claude-3-5-haiku-latest", "claude-3-5-sonnet-latest"],
    defaultModelCapabilities: [
      { model: "claude-3-5-haiku-latest", nativeWebSearchSupported: true },
      { model: "claude-3-5-sonnet-latest", nativeWebSearchSupported: false },
    ],
    analysisModel: "claude-3-5-haiku-latest",
    // Discovered from the provider's own /v1/models listing.
    supportsAnyModel: true,
    supportsNativeCitations: true,
    supportsWebSearch: true,
    nativeWebSearch: {
      endpointProtocol: "messages",
      toolName: "web_search_20250305",
    },
    resultCaveat: API_CAVEAT,
  },
  {
    id: "gemini",
    label: "Google Gemini",
    sourceType: "api",
    envKeys: ["GEMINI_API_KEY"],
    defaultModels: ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.5-pro"],
    defaultModelCapabilities: [
      // Grounding with Google Search is a per-account entitlement, not a per
      // model one: these models accept the tool, and a free-tier key is told so
      // by the API rather than by us.
      { model: "gemini-3.5-flash", nativeWebSearchSupported: true },
      { model: "gemini-2.5-flash", nativeWebSearchSupported: true },
      { model: "gemini-2.5-pro", nativeWebSearchSupported: true },
    ],
    analysisModel: "gemini-2.5-flash",
    // The models endpoint is the authority on what a key can reach, so a model
    // discovered there is valid even though it is not named above.
    supportsAnyModel: true,
    supportsNativeCitations: true,
    supportsWebSearch: true,
    nativeWebSearch: {
      endpointProtocol: "gemini_generate_content",
      toolName: "google_search",
    },
    resultCaveat: API_CAVEAT,
  },
  {
    id: "perplexity",
    label: "Perplexity",
    sourceType: "api",
    envKeys: ["PERPLEXITY_API_KEY"],
    defaultModels: ["sonar", "sonar-pro"],
    defaultModelCapabilities: [
      { model: "sonar", nativeWebSearchSupported: true },
      { model: "sonar-pro", nativeWebSearchSupported: true },
    ],
    analysisModel: "sonar",
    supportsNativeCitations: true,
    supportsWebSearch: true,
    nativeWebSearch: {
      endpointProtocol: "perplexity_sonar",
      toolName: "sonar_web_grounding",
      alwaysOn: true,
    },
    resultCaveat: API_CAVEAT,
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    sourceType: "api",
    envKeys: ["DEEPSEEK_API_KEY"],
    defaultModels: ["deepseek-chat"],
    defaultModelCapabilities: [{ model: "deepseek-chat", nativeWebSearchSupported: false }],
    analysisModel: "deepseek-chat",
    supportsNativeCitations: false,
    supportsWebSearch: false,
    resultCaveat: API_CAVEAT,
  },
  {
    id: "vertex-ai",
    label: "Google Vertex AI",
    sourceType: "api",
    envKeys: ["GOOGLE_VERTEX_PRIVATE_KEY"],
    defaultModels: [],
    // Read from the publisher listings, which are the authority on what this
    // project can reach in this region.
    supportsAnyModel: true,
    supportsJsonSchema: true,
    supportsNativeCitations: true,
    supportsWebSearch: true,
    resultCaveat: API_CAVEAT,
  },
  {
    id: "databricks",
    label: "Databricks",
    sourceType: "api",
    envKeys: ["DATABRICKS_TOKEN"],
    defaultModels: [],
    supportsAnyModel: true,
    supportsJsonSchema: true,
    supportsNativeCitations: false,
    supportsWebSearch: false,
    resultCaveat: API_CAVEAT,
  },
  {
    id: "watsonx",
    label: "IBM watsonx.ai",
    sourceType: "api",
    envKeys: ["WATSONX_API_KEY"],
    defaultModels: [],
    supportsAnyModel: true,
    supportsJsonSchema: true,
    supportsNativeCitations: false,
    supportsWebSearch: false,
    resultCaveat: API_CAVEAT,
  },
  {
    id: "azure-openai",
    label: "Azure OpenAI",
    sourceType: "api",
    envKeys: ["AZURE_OPENAI_API_KEY"],
    defaultModels: [],
    supportsAnyModel: true,
    supportsJsonSchema: true,
    supportsNativeCitations: false,
    supportsWebSearch: false,
    resultCaveat: API_CAVEAT,
  },
  {
    id: "openai-compatible",
    label: "OpenAI-compatible",
    sourceType: "api",
    envKeys: ["OPENAI_COMPATIBLE_API_KEY", "OPENAI_COMPATIBLE_BASE_URL"],
    defaultModels: ["model-id"],
    defaultModelCapabilities: [{ model: "model-id", nativeWebSearchSupported: false }],
    supportsAnyModel: true,
    supportsNativeCitations: true,
    supportsWebSearch: true,
    nativeWebSearch: {
      endpointProtocol: "responses",
      toolName: "web_search",
    },
    resultCaveat: API_CAVEAT,
  },
  {
    id: "bedrock",
    label: "Amazon Bedrock",
    sourceType: "api",
    envKeys: ["AWS_BEDROCK_SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY"],
    defaultModels: [],
    // Read from ListFoundationModels, which is the authority on what this
    // account has been granted in this region.
    supportsAnyModel: true,
    supportsJsonSchema: true,
    supportsNativeCitations: false,
    supportsWebSearch: false,
    resultCaveat: API_CAVEAT,
  },
];

const openRouterModels = new OpenRouterModelCatalog();

export const PROVIDER_MODEL_CAPABILITIES = new ProviderModelCapabilityCatalog(PROVIDER_DEFINITIONS, [
  {
    providerId: "openrouter",
    list: async () => (await openRouterModels.list()).map((capability) => ({
      providerId: "openrouter",
      model: capability.model,
      name: capability.name,
      vendor: capability.vendor,
      releasedAt: capability.releasedAt,
      nativeWebSearchSupported: capability.nativeWebSearchSupported,
      source: "provider_catalog",
    })),
  },
]);

// Only an aggregator routes by "vendor/model". A direct provider given one
// answers 404 in the middle of a run, which reads as the model being gone
// rather than as an id pasted into the wrong provider.
const ROUTED_ID_PROVIDERS = new Set(["openrouter"]);
// These three name models their own way: a deployment, whatever the gateway
// behind it uses, or an ARN, so a slash in the id is not a paste error.
const OWN_MODEL_ID_PROVIDERS = new Set([
  "azure-openai",
  "openai-compatible",
  "bedrock",
  "vertex-ai",
  "databricks",
  "watsonx",
]);

function definition(id: string): ProviderDefinition {
  const found = PROVIDER_DEFINITIONS.find((item) => item.id === id);
  if (!found) throw new Error(`Unsupported provider: ${id}`);
  return found;
}

export class ProviderCatalog {
  private readonly providers = new Map<string, AnswerProvider>();

  constructor() {
    const openrouterDefinition = definition("openrouter");
    this.providers.set(
      "openrouter",
      new OpenAICompatibleProvider({
        definition: openrouterDefinition,
        endpoint: "https://openrouter.ai/api/v1/chat/completions",
        extraHeaders: {
          "HTTP-Referer": "http://localhost",
          "X-Title": "citegeo OSS",
          "X-OpenRouter-Metadata": "enabled",
        },
        citationExtractor: (raw) => dedupeCitations([...extractAnnotationCitations(raw), ...extractPerplexityCitations(raw)]),
        nativeWebSearch: openRouterNativeWebSearch,
      }),
    );

    this.providers.set(
      "openai",
      new ResponsesCompatibleProvider({
        definition: definition("openai"),
        endpoint: "https://api.openai.com/v1/responses",
      }),
    );

    this.providers.set("anthropic", new AnthropicProvider(definition("anthropic")));
    this.providers.set("gemini", new GeminiProvider(definition("gemini")));

    this.providers.set(
      "perplexity",
      new OpenAICompatibleProvider({
        definition: definition("perplexity"),
        endpoint: "https://api.perplexity.ai/chat/completions",
        endpointProtocol: "perplexity_sonar",
        extraBody: { return_citations: true },
        citationExtractor: perplexityCitationExtractor,
        nativeWebSearch: {
          toolName: "sonar_web_grounding",
          alwaysOn: true,
          note: "Perplexity Sonar responses are web-grounded by the provider API.",
        },
      }),
    );

    this.providers.set(
      "deepseek",
      new OpenAICompatibleProvider({
        definition: definition("deepseek"),
        endpoint: "https://api.deepseek.com/chat/completions",
      }),
    );

    this.providers.set(
      "azure-openai",
      new AzureOpenAIProvider(definition("azure-openai"), azureOpenAIEndpoint() || "", azureOpenAIApiVersion()),
    );

    this.providers.set("bedrock", new BedrockProvider(definition("bedrock")));
    this.providers.set("vertex-ai", new VertexAIProvider(definition("vertex-ai")));
    this.providers.set("databricks", new DatabricksProvider(definition("databricks")));
    this.providers.set("watsonx", new WatsonxProvider(definition("watsonx")));

    const compatibleBaseUrl = openAICompatibleBaseUrl();
    this.providers.set(
      "openai-compatible",
      new OpenAICompatibleGatewayProvider(definition("openai-compatible"), compatibleBaseUrl || "http://localhost"),
    );
  }

  list(): ProviderDefinition[] {
    return PROVIDER_DEFINITIONS;
  }

  get(providerId: string): AnswerProvider {
    if (providerId === "azure-openai" && !azureOpenAIEndpoint()) {
      throw new Error("Missing AZURE_OPENAI_ENDPOINT for provider \"azure-openai\".");
    }
    if (providerId === "openai-compatible" && !openAICompatibleBaseUrl()) {
      throw new Error("Missing OPENAI_COMPATIBLE_BASE_URL for provider \"openai-compatible\".");
    }
    if (providerId === "bedrock" && !bedrockRegion()) {
      throw new Error("Missing AWS_BEDROCK_REGION for provider \"bedrock\".");
    }
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error(`Provider "${providerId}" is not registered.`);
    return provider;
  }

  validate(providerId: string, model: string): void {
    const provider = this.get(providerId);
    if (ROUTED_ID_PROVIDERS.has(providerId) === false && OWN_MODEL_ID_PROVIDERS.has(providerId) === false && model.includes("/")) {
      throw new Error(
        `Model "${model}" is a routed id, which only an aggregator accepts. Provider "${providerId}" wants a bare model id.`,
      );
    }
    if (provider.definition.supportsAnyModel) return;
    if (!provider.definition.defaultModels.includes(model)) {
      throw new Error(
        `Model "${model}" is not in the catalog for provider "${providerId}". Supported: ${provider.definition.defaultModels.join(", ")}`,
      );
    }
  }
}
