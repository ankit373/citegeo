import {
  azureOpenAIEndpoint,
  hasProviderKey,
  openAICompatibleBaseUrl,
  providerEnvKeys,
  resolveProviderKey,
} from "../../config/env.js";
import { openRouterAccountBalance, type OpenRouterAccountBalance } from "../../providers/openrouter-account.js";
import type { ProductModelCatalog, ProviderModelCatalogItem } from "./model-selection-schema.js";
import type { ProductProviderId } from "./provider-id.js";

export interface ProviderStatus {
  providerId: ProductProviderId;
  label: string;
  configured: boolean;
  envKeys: string[];
  endpoint: string | null;
  modelCount: number;
  nativeWebSearchModels: number;
  /** Models this provider can run without spending anything. */
  freeModels: number;
  reachable: boolean;
  /** False when a run would fail right now for a reason we can already see. */
  runnableNow: boolean;
  balance: OpenRouterAccountBalance | null;
  detail: string;
}

export interface ProviderStatusOptions {
  balance?: ((apiKey: string) => Promise<OpenRouterAccountBalance | null>) | undefined;
}

function money(value: number): string {
  const rounded = Math.abs(value).toFixed(2);
  return value < 0 ? `-$${rounded}` : `$${rounded}`;
}

// OpenRouter marks no-cost models with this suffix; nothing else advertises one.
function isFreeToRun(providerId: ProductProviderId, item: ProviderModelCatalogItem): boolean {
  if (providerId === "openai-compatible") return true;
  if (providerId === "openrouter") return item.modelId.endsWith(":free");
  return false;
}

// One place that answers "can I actually run anything, and with what?".
// Without it the only signal was a provider error in the middle of a run.
export async function providerStatuses(
  catalog: ProductModelCatalog,
  options: ProviderStatusOptions = {},
): Promise<ProviderStatus[]> {
  let models: ProviderModelCatalogItem[] = [];
  try {
    models = await catalog.list();
  } catch {
    models = [];
  }
  const readBalance = options.balance || openRouterAccountBalance;

  const rows: ProviderStatus[] = [];
  for (const providerId of ["openrouter", "openai-compatible", "azure-openai"] as ProductProviderId[]) {
    const mine = models.filter((item) => item.providerId === providerId);
    const configured = hasProviderKey(providerId);
    const freeModels = mine.filter((item) => isFreeToRun(providerId, item)).length;
    const balance = providerId === "openrouter" && configured ? await safeBalance(readBalance) : null;
    rows.push({
      providerId,
      label: providerId === "openrouter" ? "OpenRouter" : providerId === "azure-openai" ? "Azure OpenAI" : "Local gateway",
      configured,
      envKeys: providerEnvKeys(providerId),
      endpoint: endpointFor(providerId),
      modelCount: mine.length,
      nativeWebSearchModels: mine.filter((item) => item.nativeWebSearchSupported).length,
      freeModels,
      reachable: mine.length > 0,
      runnableNow: configured && mine.length > 0 && (balance === null || balance.paidModelsRunnable || freeModels > 0),
      balance,
      detail: detailFor({ providerId, configured, models: mine.length, freeModels, balance }),
    });
  }
  return rows;
}

function endpointFor(providerId: ProductProviderId): string | null {
  if (providerId === "openai-compatible") return openAICompatibleBaseUrl() || null;
  if (providerId === "azure-openai") return azureOpenAIEndpoint() || null;
  return "https://openrouter.ai/api/v1";
}

async function safeBalance(
  read: (apiKey: string) => Promise<OpenRouterAccountBalance | null>,
): Promise<OpenRouterAccountBalance | null> {
  try {
    return await read(resolveProviderKey("openrouter"));
  } catch {
    return null;
  }
}

function detailFor(input: {
  providerId: ProductProviderId;
  configured: boolean;
  models: number;
  freeModels: number;
  balance: OpenRouterAccountBalance | null;
}): string {
  if (input.providerId === "azure-openai") {
    if (!input.configured) return "No Azure key set. Add AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_DEPLOYMENTS to .env.";
    if (!input.models) return "Key set, but no deployments declared. List them in AZURE_OPENAI_DEPLOYMENTS.";
    return "Your Azure deployments. Billed to your Azure subscription. No provider-native web search.";
  }
  if (!input.configured) {
    return input.providerId === "openrouter"
      ? "No API key set. Add OPENROUTER_API_KEY to .env to use hosted models."
      : "No local gateway set. Point OPENAI_COMPATIBLE_BASE_URL at an OpenAI-compatible endpoint to use local models.";
  }
  if (!input.models) return "Configured, but the endpoint returned no models. It may be unreachable.";
  if (input.providerId === "openai-compatible") {
    return "Local models. Runs cost nothing and never leave this machine. No provider-native web search.";
  }
  if (input.balance && !input.balance.paidModelsRunnable) {
    const head = input.balance.purchased === 0
      ? "This account has never purchased credits"
      : `This account's balance is ${money(input.balance.remaining)}`;
    const fallback = input.freeModels
      ? ` The ${input.freeModels} models ending in :free still run, and local models cost nothing.`
      : " Local models cost nothing and still run.";
    return `${head}, so every paid model answers HTTP 402 and no run can finish.${fallback} Native web search is only sold on paid models.`;
  }
  if (input.balance) {
    return `${money(input.balance.remaining)} of credit left. Runs are billed to your OpenRouter account and fail once it reaches zero.`;
  }
  return "Hosted models. Runs are billed to your OpenRouter account, and a run fails if the balance is empty.";
}
