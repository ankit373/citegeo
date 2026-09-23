import {
  azureOpenAIEndpoint,
  bedrockRuntimeEndpoint,
  databricksHost,
  openAICompatibleBaseUrl,
  vertexEndpoint,
  watsonxEndpoint,
} from "../../config/env.js";
import type { ProductProviderId } from "./provider-id.js";

// What each provider costs and whether it can produce a citation. This used to
// be a chain of `providerId === "openrouter" ? ... :` expressions inside the
// status builder, which is why the product only ever offered three providers:
// every new one meant another branch in four places.

/** Whether running a model here spends money, and whose. */
export type CostPosture =
  /** Nothing is charged for the calls this product makes. */
  | "free"
  /** Billed per call to an account the user holds directly. */
  | "metered"
  /** Billed against a prepaid balance that can run out mid-run. */
  | "prepaid";

/**
 * Half of this product needs the model to cite a source: the citation gap,
 * cited domains and query fanout are all built from citations. The other half,
 * visibility and share of voice and sentiment, only needs the answer text. A
 * provider that cannot search the web still powers the second half fully, and
 * saying so is more useful than calling it unsupported.
 */
export type SearchPosture =
  /** Every answer is web-grounded and carries sources. */
  | "always"
  /** Web search is available and requested per run. */
  | "optional"
  /** Available, but only once the account is on a paid plan. */
  | "paid_plan_only"
  /** The provider has no web search, so answers carry no citations. */
  | "never";

export interface ProviderAccess {
  id: ProductProviderId;
  label: string;
  cost: CostPosture;
  search: SearchPosture;
  /** Fixed endpoint, or null when the user supplies it. */
  endpoint: string | null;
  /** Read the endpoint from configuration instead, where the user owns it. */
  resolveEndpoint?: () => string | null;
  /** What a run costs, in the user's terms. Shown next to the provider. */
  cost_note: string;
  /** Where to get a key, and anything that will surprise them after they do. */
  setup_note: string;
  /** Non-secret settings this provider needs before it can run at all. */
  settings?: Array<{ key: string; label: string; envKey: string }>;
}

export const PROVIDER_ACCESS: ProviderAccess[] = [
  {
    id: "openai",
    label: "OpenAI",
    cost: "metered",
    search: "optional",
    endpoint: "https://api.openai.com/v1",
    cost_note: "Billed per call to your OpenAI account. Web search is charged on top of the tokens.",
    setup_note: "platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    cost: "metered",
    search: "optional",
    endpoint: "https://api.anthropic.com/v1",
    cost_note: "Billed per call to your Anthropic account. The web search tool is charged per search.",
    setup_note: "console.anthropic.com/settings/keys",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    cost: "free",
    search: "paid_plan_only",
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    cost_note: "Flash models answer free of charge on the free tier, within Google's daily request limit.",
    setup_note:
      "aistudio.google.com/apikey. Grounding with Google Search is not sold on the free tier, so free answers carry no citations. Enabling billing turns it on and includes 5,000 grounded searches a month.",
  },
  {
    id: "perplexity",
    label: "Perplexity",
    cost: "metered",
    search: "always",
    endpoint: "https://api.perplexity.ai",
    cost_note: "Billed per call plus a per-request search fee. Every answer is grounded, so every answer cites.",
    setup_note: "perplexity.ai/account/api. Sonar answers are web-grounded by the API and cannot be asked not to search.",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    cost: "prepaid",
    search: "optional",
    endpoint: "https://openrouter.ai/api/v1",
    cost_note: "Billed against a prepaid balance. Paid models answer HTTP 402 once it reaches zero.",
    setup_note: "openrouter.ai/keys. Native web search is only sold on paid models, so no :free model can cite.",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    cost: "metered",
    search: "never",
    endpoint: "https://api.deepseek.com",
    cost_note: "Billed per call to your DeepSeek account.",
    setup_note: "platform.deepseek.com/api_keys. No web search, so answers carry no citations.",
  },
  {
    id: "azure-openai",
    label: "Azure OpenAI",
    cost: "metered",
    search: "never",
    endpoint: null,
    resolveEndpoint: () => azureOpenAIEndpoint() || null,
    cost_note: "Billed to your Azure subscription.",
    setup_note: "Azure portal, under Keys and Endpoint. Deployments are declared, not discovered, so list them yourself.",
    settings: [
      { key: "endpoint", label: "Endpoint", envKey: "AZURE_OPENAI_ENDPOINT" },
      { key: "deployments", label: "Deployments", envKey: "AZURE_OPENAI_DEPLOYMENTS" },
    ],
  },
  {
    id: "openai-compatible",
    label: "Local gateway",
    cost: "free",
    search: "never",
    endpoint: null,
    resolveEndpoint: () => openAICompatibleBaseUrl() || null,
    cost_note: "Runs cost nothing and never leave this machine.",
    setup_note: "Any OpenAI-compatible endpoint. The key may be a placeholder.",
    settings: [{ key: "baseUrl", label: "Base URL", envKey: "OPENAI_COMPATIBLE_BASE_URL" }],
  },
  {
    id: "bedrock",
    label: "Amazon Bedrock",
    cost: "metered",
    search: "never",
    endpoint: null,
    resolveEndpoint: () => bedrockRuntimeEndpoint() || null,
    cost_note: "Billed per token to your AWS account, at whatever each model's vendor charges on Bedrock.",
    setup_note:
      "An IAM access key allowed bedrock:ListFoundationModels and bedrock:InvokeModel, plus the region. Access to each model is granted per account and per region, so a listed model still answers a 403 until it is enabled there. No web search, so answers carry no citations.",
    settings: [
      { key: "region", label: "Region", envKey: "AWS_BEDROCK_REGION" },
      { key: "accessKeyId", label: "Access key id", envKey: "AWS_BEDROCK_ACCESS_KEY_ID" },
    ],
  },
  {
    id: "vertex-ai",
    label: "Google Vertex AI",
    cost: "metered",
    search: "optional",
    endpoint: null,
    resolveEndpoint: () => vertexEndpoint() || null,
    cost_note: "Billed per token to your Google Cloud project, at whatever each model's publisher charges on Vertex.",
    setup_note:
      "A service account key with the Vertex AI User role, plus the project and the region. The model id carries its publisher, as in google/gemini-2.5-pro. Google Search grounding is available per run and returns the pages an answer used, but Vertex refuses it alongside a response schema.",
    settings: [
      { key: "projectId", label: "Project id", envKey: "GOOGLE_VERTEX_PROJECT_ID" },
      { key: "location", label: "Region", envKey: "GOOGLE_VERTEX_LOCATION" },
      { key: "clientEmail", label: "Service account email", envKey: "GOOGLE_VERTEX_CLIENT_EMAIL" },
    ],
  },
  {
    id: "databricks",
    label: "Databricks",
    cost: "metered",
    search: "never",
    endpoint: null,
    resolveEndpoint: () => databricksHost() || null,
    cost_note: "Billed to your Databricks workspace, per token on pay-per-token endpoints and per hour on provisioned ones.",
    setup_note:
      "A workspace URL and a personal access token. The model id is the serving endpoint name, not a vendor model name, so it is whatever the workspace called it. No web search, so answers carry no citations.",
    settings: [{ key: "host", label: "Workspace URL", envKey: "DATABRICKS_HOST" }],
  },
  {
    id: "watsonx",
    label: "IBM watsonx.ai",
    cost: "metered",
    search: "never",
    endpoint: null,
    resolveEndpoint: () => watsonxEndpoint() || null,
    cost_note: "Billed per token to your IBM Cloud account, against the plan attached to the project.",
    setup_note:
      "An IBM Cloud API key, the project id and the region. Models are listed per region, so one absent from the listing is absent from that region. No web search, so answers carry no citations.",
    settings: [
      { key: "region", label: "Region", envKey: "WATSONX_REGION" },
      { key: "projectId", label: "Project id", envKey: "WATSONX_PROJECT_ID" },
    ],
  },
];

export function providerAccess(id: ProductProviderId): ProviderAccess | undefined {
  return PROVIDER_ACCESS.find((row) => row.id === id);
}

export function accessEndpoint(row: ProviderAccess): string | null {
  return row.resolveEndpoint ? row.resolveEndpoint() : row.endpoint;
}

/** True when answers from this provider can carry the sources the gap analysis needs. */
export function canCite(row: ProviderAccess): boolean {
  return row.search === "always" || row.search === "optional" || row.search === "paid_plan_only";
}
