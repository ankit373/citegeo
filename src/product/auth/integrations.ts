// Everything this product can hold a credential for. Model providers answer
// questions; integrations reach outward to do something with the answers. They
// share a store because they share the same rules: encrypted at rest, never
// read back, and the environment wins.

export type IntegrationKind = "model_provider" | "integration";

export interface IntegrationDefinition {
  id: string;
  label: string;
  kind: IntegrationKind;
  /** What the credential lets the product do, in the user's terms. */
  purpose: string;
  /** Environment variables that own this credential when set. */
  envKeys: string[];
  /** Where to get one, so the field is not a guessing game. */
  help: string;
  /** Extra non-secret settings this integration needs before it can run. */
  settings?: Array<{ key: string; label: string; envKey: string }>;
}

export const INTEGRATIONS: IntegrationDefinition[] = [
  {
    id: "openrouter",
    label: "OpenRouter",
    kind: "model_provider",
    purpose: "Ask hosted models what they know about your domain.",
    envKeys: ["OPENROUTER_API_KEY", "OPENROUTER_KEY"],
    help: "openrouter.ai/keys",
  },
  {
    id: "openai-compatible",
    label: "Local gateway",
    kind: "model_provider",
    purpose: "Ask models running on this machine, at no cost.",
    envKeys: ["OPENAI_COMPATIBLE_API_KEY"],
    help: "Any OpenAI-compatible endpoint. The key may be a placeholder.",
    settings: [{ key: "baseUrl", label: "Base URL", envKey: "OPENAI_COMPATIBLE_BASE_URL" }],
  },
  {
    id: "azure-openai",
    label: "Azure OpenAI",
    kind: "model_provider",
    purpose: "Ask your own Azure deployments, billed to your subscription.",
    envKeys: ["AZURE_OPENAI_API_KEY"],
    help: "Azure portal, under Keys and Endpoint.",
    settings: [
      { key: "endpoint", label: "Endpoint", envKey: "AZURE_OPENAI_ENDPOINT" },
      { key: "deployments", label: "Deployments", envKey: "AZURE_OPENAI_DEPLOYMENTS" },
    ],
  },
  {
    id: "github",
    label: "GitHub",
    kind: "integration",
    purpose: "Open a pull request against your site's repository with the schema, llms.txt and robots fixes this tool recommends.",
    envKeys: ["GITHUB_TOKEN"],
    help: "A fine-grained token with Contents and Pull requests write access, on that repository only.",
    settings: [{ key: "repository", label: "Repository", envKey: "GITHUB_SITE_REPOSITORY" }],
  },
  {
    id: "google",
    label: "Google Search Console",
    kind: "integration",
    purpose: "Read the queries and impressions your site already earns, as the honest substitute for AI prompt-volume data.",
    envKeys: ["GOOGLE_SERVICE_ACCOUNT_JSON"],
    help: "A service account JSON key, with the service account added as a user on the Search Console property.",
    settings: [{ key: "siteUrl", label: "Property URL", envKey: "GOOGLE_SEARCH_CONSOLE_SITE" }],
  },
];

export function integration(id: string): IntegrationDefinition | null {
  return INTEGRATIONS.find((row) => row.id === id) || null;
}

export function integrationIds(): string[] {
  return INTEGRATIONS.map((row) => row.id);
}

/** Env keys for any integration, falling back to the model-provider list. */
export function credentialEnvKeys(id: string): string[] {
  return integration(id)?.envKeys || [];
}
