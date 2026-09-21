import { providerEnvKeys } from "../../config/env.js";
import { GOOGLE_SCOPES } from "../search-console/google-auth.js";
import { PROVIDER_ACCESS } from "../configuration/provider-access.js";

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

// Model providers describe themselves once, in the access table, so a provider
// added there is immediately addable through the UI. Listing them again here is
// how the credentials form came to offer three providers while the catalogue
// implemented eight.
const MODEL_PROVIDERS: IntegrationDefinition[] = PROVIDER_ACCESS.map((access) => ({
  id: access.id,
  label: access.label,
  kind: "model_provider" as const,
  purpose: access.cost_note,
  envKeys: providerEnvKeys(access.id),
  help: access.setup_note,
  ...(access.settings ? { settings: access.settings } : {}),
}));

// A self-hosted copy registers no OAuth application, so the second way in is
// a client the user registers and owns. Both are pasted as JSON.
const GOOGLE_HELP = `A service account JSON key, or an OAuth client of your own as {"client_id", "client_secret", "refresh_token"} consented to ${GOOGLE_SCOPES.join(" and ")}.`;

const OUTWARD_INTEGRATIONS: IntegrationDefinition[] = [
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
    envKeys: ["GOOGLE_SERVICE_ACCOUNT_JSON", "GOOGLE_OAUTH_CREDENTIALS_JSON"],
    help: `${GOOGLE_HELP} A service account also has to be added as a user on the Search Console property.`,
    settings: [{ key: "siteUrl", label: "Property URL", envKey: "GOOGLE_SEARCH_CONSOLE_SITE" }],
  },
  {
    id: "google-analytics",
    label: "Google Analytics",
    kind: "integration",
    purpose: "Read how many people arrived from each assistant, which is a different claim from having been named by one.",
    envKeys: ["GOOGLE_SERVICE_ACCOUNT_JSON", "GOOGLE_OAUTH_CREDENTIALS_JSON"],
    help: `${GOOGLE_HELP} Whichever one Search Console holds serves this too, as a viewer on the Analytics property.`,
    settings: [{ key: "propertyId", label: "GA4 property id", envKey: "GOOGLE_ANALYTICS_PROPERTY_ID" }],
  },
];

export const INTEGRATIONS: IntegrationDefinition[] = [...MODEL_PROVIDERS, ...OUTWARD_INTEGRATIONS];

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
