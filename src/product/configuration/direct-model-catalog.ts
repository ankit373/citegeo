import { hasProviderKey, resolveProviderKey } from "../../config/env.js";
import { PROVIDER_DEFINITIONS } from "../../providers/catalog.js";
import { canCite, providerAccess } from "./provider-access.js";
import type { ProductModelCatalog, ProviderModelCatalogItem } from "./model-selection-schema.js";
import type { ProductProviderId } from "./provider-id.js";

// Each provider is asked what models the key can actually reach, rather than
// being given a list compiled here. A hardcoded list goes stale silently: the
// catalogue still named gemini-1.5-flash long after Google had moved on, and
// nothing in the product could tell.
//
// Providers that publish no listing endpoint fall back to their declared
// models, which is the only honest thing left to do.

type Listing = (apiKey: string) => Promise<Array<{ id: string; name?: string; vendor?: string; releasedAt?: string }>>;

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function getJson(url: string, headers: Record<string, string>): Promise<unknown> {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.json();
}

// Model ids that answer a text question. The rest of an account's catalogue is
// embeddings, audio and image models, which cannot be asked about a brand.
const NOT_A_CHAT_MODEL = [
  "embedding", "embed", "audio", "tts", "whisper", "transcribe", "moderation",
  "image", "dall-e", "realtime", "search-preview", "computer-use", "aqa", "veo", "imagen",
];

function answersQuestions(id: string): boolean {
  const lower = id.toLowerCase();
  return !NOT_A_CHAT_MODEL.some((fragment) => lower.includes(fragment));
}

const LISTINGS: Partial<Record<ProductProviderId, Listing>> = {
  openai: async (apiKey) => {
    const payload = asObject(await getJson("https://api.openai.com/v1/models", { Authorization: `Bearer ${apiKey}` }));
    return asArray(payload?.data).flatMap((value) => {
      const row = asObject(value);
      if (typeof row?.id !== "string" || !answersQuestions(row.id)) return [];
      const created = typeof row.created === "number" ? new Date(row.created * 1000).toISOString() : undefined;
      return [{ id: row.id, vendor: "openai", ...(created ? { releasedAt: created } : {}) }];
    });
  },
  anthropic: async (apiKey) => {
    const payload = asObject(await getJson("https://api.anthropic.com/v1/models?limit=1000", {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    }));
    return asArray(payload?.data).flatMap((value) => {
      const row = asObject(value);
      if (typeof row?.id !== "string" || !answersQuestions(row.id)) return [];
      return [{
        id: row.id,
        ...(typeof row.display_name === "string" ? { name: row.display_name } : {}),
        vendor: "anthropic",
        ...(typeof row.created_at === "string" ? { releasedAt: row.created_at } : {}),
      }];
    });
  },
  gemini: async (apiKey) => {
    const payload = asObject(await getJson(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(apiKey)}`,
      {},
    ));
    return asArray(payload?.models).flatMap((value) => {
      const row = asObject(value);
      if (typeof row?.name !== "string") return [];
      // The listing returns "models/gemini-x"; the generate endpoint wants the bare id.
      const id = row.name.startsWith("models/") ? row.name.slice("models/".length) : row.name;
      const methods = asArray(row.supportedGenerationMethods).filter((m): m is string => typeof m === "string");
      if (!methods.includes("generateContent") || !answersQuestions(id)) return [];
      return [{ id, ...(typeof row.displayName === "string" ? { name: row.displayName } : {}), vendor: "google" }];
    });
  },
};

/**
 * Whether a model can run a web search, taken from the provider rather than the
 * model. No provider publishes this per model, so deriving it per model would
 * mean guessing; the provider's own posture is the most that can be known, and
 * the caveats that go with it travel on the provider row.
 */
function webSearchSupported(providerId: ProductProviderId): boolean {
  const access = providerAccess(providerId);
  return access ? canCite(access) : false;
}

function declaredModels(providerId: ProductProviderId): Array<{ id: string }> {
  const definition = PROVIDER_DEFINITIONS.find((item) => item.id === providerId);
  return (definition?.defaultModels || []).map((id) => ({ id }));
}

/**
 * One provider's models, read from the provider. Used for every provider the
 * product talks to directly, which is all of them except OpenRouter (its own
 * catalogue carries per-model search pricing) and the two endpoints the user
 * supplies themselves.
 */
export class DirectProviderModelCatalog implements ProductModelCatalog {
  constructor(private readonly providerId: ProductProviderId) {}

  async list(): Promise<ProviderModelCatalogItem[]> {
    if (!hasProviderKey(this.providerId)) return [];
    const listing = LISTINGS[this.providerId];
    let rows: Array<{ id: string; name?: string; vendor?: string; releasedAt?: string }>;
    if (listing) {
      try {
        rows = await listing(resolveProviderKey(this.providerId));
      } catch {
        // A provider that will not answer contributes nothing. Falling back to
        // its declared models here would present a list the key cannot run.
        return [];
      }
    } else {
      rows = declaredModels(this.providerId);
    }
    const checkedAt = new Date().toISOString();
    const nativeWebSearchSupported = webSearchSupported(this.providerId);
    return rows.map((row) => ({
      providerId: this.providerId,
      modelId: row.id,
      displayName: row.name || row.id,
      vendor: row.vendor || this.providerId,
      releasedAt: row.releasedAt || null,
      available: true,
      unavailableReason: null,
      nativeWebSearchSupported,
      checkedAt,
      source: listing ? ("provider_catalog" as const) : ("local_capability_registry" as const),
    }));
  }
}
