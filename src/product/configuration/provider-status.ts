import { hasProviderKey, openAICompatibleBaseUrl, providerEnvKeys } from "../../config/env.js";
import type { ProductModelCatalog } from "./model-selection-schema.js";
import type { ProductProviderId } from "./provider-id.js";

export interface ProviderStatus {
  providerId: ProductProviderId;
  label: string;
  configured: boolean;
  envKeys: string[];
  endpoint: string | null;
  modelCount: number;
  nativeWebSearchModels: number;
  reachable: boolean;
  detail: string;
}

// One place that answers "can I actually run anything, and with what?".
// Without it the only signal was a provider error in the middle of a run.
export async function providerStatuses(catalog: ProductModelCatalog): Promise<ProviderStatus[]> {
  let models: Awaited<ReturnType<ProductModelCatalog["list"]>> = [];
  try {
    models = await catalog.list();
  } catch {
    models = [];
  }
  const count = (id: ProductProviderId) => models.filter((item) => item.providerId === id);

  const rows: ProviderStatus[] = [];
  for (const providerId of ["openrouter", "openai-compatible"] as ProductProviderId[]) {
    const mine = count(providerId);
    const configured = hasProviderKey(providerId);
    const endpoint = providerId === "openai-compatible" ? openAICompatibleBaseUrl() || null : "https://openrouter.ai/api/v1";
    rows.push({
      providerId,
      label: providerId === "openrouter" ? "OpenRouter" : "Local gateway",
      configured,
      envKeys: providerEnvKeys(providerId),
      endpoint,
      modelCount: mine.length,
      nativeWebSearchModels: mine.filter((item) => item.nativeWebSearchSupported).length,
      reachable: mine.length > 0,
      detail: detailFor(providerId, configured, mine.length),
    });
  }
  return rows;
}

function detailFor(providerId: ProductProviderId, configured: boolean, models: number): string {
  if (!configured) {
    return providerId === "openrouter"
      ? "No API key set. Add OPENROUTER_API_KEY to .env to use hosted models."
      : "No local gateway set. Point OPENAI_COMPATIBLE_BASE_URL at an OpenAI-compatible endpoint to use local models.";
  }
  if (!models) return "Configured, but the endpoint returned no models. It may be unreachable.";
  return providerId === "openrouter"
    ? "Hosted models. Runs are billed to your OpenRouter account, and a run fails if the balance is empty."
    : "Local models. Runs cost nothing and never leave this machine. No provider-native web search.";
}
