import { hasProviderKey, providerEnvKeys, resolveProviderKey } from "../../config/env.js";
import { openRouterAccountBalance, type OpenRouterAccountBalance } from "../../providers/openrouter-account.js";
import { accessEndpoint, canCite, PROVIDER_ACCESS, type ProviderAccess } from "./provider-access.js";
import type { ProductModelCatalog, ProviderModelCatalogItem } from "./model-selection-schema.js";
import type { ProductProviderId } from "./provider-id.js";

export interface ProviderStatus {
  providerId: ProductProviderId;
  label: string;
  configured: boolean;
  envKeys: string[];
  /** Non-secret variables this provider also needs, such as an endpoint. */
  settingsEnvKeys: string[];
  endpoint: string | null;
  modelCount: number;
  nativeWebSearchModels: number;
  /** Models this provider can run without spending anything. */
  freeModels: number;
  reachable: boolean;
  /** False when a run would fail right now for a reason we can already see. */
  runnableNow: boolean;
  /**
   * False when answers from here carry no sources. The citation gap, cited
   * domains and query fanout are all built from citations, so a provider that
   * cannot search still powers visibility and share of voice and nothing else.
   */
  citationCapable: boolean;
  balance: OpenRouterAccountBalance | null;
  detail: string;
  /** Where to get a key, and what will surprise them after they do. */
  setupNote: string;
}

export interface ProviderStatusOptions {
  balance?: ((apiKey: string) => Promise<OpenRouterAccountBalance | null>) | undefined;
}

function money(value: number): string {
  const rounded = Math.abs(value).toFixed(2);
  return value < 0 ? `-$${rounded}` : `$${rounded}`;
}

// OpenRouter marks no-cost models with this suffix; nothing else advertises one,
// so a free-by-posture provider counts all of its models and the rest count none.
function freeModelCount(access: ProviderAccess, models: ProviderModelCatalogItem[]): number {
  if (access.id === "openrouter") return models.filter((item) => item.modelId.endsWith(":free")).length;
  return access.cost === "free" ? models.length : 0;
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
  for (const access of PROVIDER_ACCESS) {
    const mine = models.filter((item) => item.providerId === access.id);
    const configured = hasProviderKey(access.id);
    const freeModels = freeModelCount(access, mine);
    const balance = access.id === "openrouter" && configured ? await safeBalance(readBalance) : null;
    rows.push({
      providerId: access.id,
      label: access.label,
      configured,
      envKeys: providerEnvKeys(access.id),
      settingsEnvKeys: (access.settings || []).map((setting) => setting.envKey),
      endpoint: accessEndpoint(access),
      modelCount: mine.length,
      nativeWebSearchModels: mine.filter((item) => item.nativeWebSearchSupported).length,
      freeModels,
      reachable: mine.length > 0,
      runnableNow: configured && mine.length > 0 && (balance === null || balance.paidModelsRunnable || freeModels > 0),
      citationCapable: canCite(access),
      balance,
      detail: detailFor(access, { configured, models: mine.length, freeModels, balance }),
      setupNote: access.setup_note,
    });
  }
  return rows;
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

function missingConfiguration(access: ProviderAccess): string {
  const keys = providerEnvKeys(access.id).join(" or ");
  if (access.id === "azure-openai") {
    return `No Azure key set. Add ${keys}, AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_DEPLOYMENTS.`;
  }
  if (access.id === "openai-compatible") {
    return "No local gateway set. Point OPENAI_COMPATIBLE_BASE_URL at an OpenAI-compatible endpoint.";
  }
  return `No key set. Add ${keys} to use ${access.label}.`;
}

function detailFor(access: ProviderAccess, state: {
  configured: boolean;
  models: number;
  freeModels: number;
  balance: OpenRouterAccountBalance | null;
}): string {
  if (!state.configured) return `${missingConfiguration(access)} ${access.setup_note}`;
  if (!state.models) {
    return access.id === "azure-openai"
      ? "Key set, but no deployments declared. List them in AZURE_OPENAI_DEPLOYMENTS."
      : "Configured, but the provider listed no models. It may be unreachable, or the key may have no access.";
  }
  if (state.balance && !state.balance.paidModelsRunnable) {
    const head = state.balance.purchased === 0
      ? "This account has never purchased credits"
      : `This account's balance is ${money(state.balance.remaining)}`;
    const fallback = state.freeModels
      ? ` The ${state.freeModels} models ending in :free still run.`
      : "";
    return `${head}, so every paid model answers HTTP 402 and no run can finish.${fallback} Native web search is only sold on paid models.`;
  }
  if (state.balance) {
    return `${money(state.balance.remaining)} of credit left. ${access.cost_note}`;
  }
  return `${access.cost_note} ${searchNote(access)}`;
}

function searchNote(access: ProviderAccess): string {
  if (access.search === "always") return "Every answer is grounded, so the citation gap works here.";
  if (access.search === "optional") return "Web search is available, so the citation gap works here.";
  if (access.search === "paid_plan_only") {
    return "Grounding needs a paid plan, so free answers measure visibility but carry no citations.";
  }
  return "No web search, so this measures visibility and share of voice but produces no citations.";
}
