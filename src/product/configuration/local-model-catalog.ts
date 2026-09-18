import { azureOpenAIDeployments, openAICompatibleBaseUrl } from "../../config/env.js";
import type { ProductModelCatalog, ProviderModelCatalogItem } from "./model-selection-schema.js";

// Lists whatever an OpenAI-compatible endpoint advertises at /v1/models. That is
// how local heads (Claude Code, Codex, Ollama, a router) reach the workbench.
// None of them run provider-native web search, so they are offline-only here.
export class OpenAiCompatibleProductModelCatalog implements ProductModelCatalog {
  async list(): Promise<ProviderModelCatalogItem[]> {
    const base = openAICompatibleBaseUrl();
    if (!base) return [];
    let response: Response;
    try {
      response = await fetch(new URL("models", base.endsWith("/") ? base : `${base}/`));
    } catch {
      return [];
    }
    if (!response.ok) return [];
    const payload = (await response.json()) as { data?: unknown };
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    const checkedAt = new Date().toISOString();
    return rows.flatMap((value) => {
      const row = value as Record<string, unknown>;
      if (typeof row?.id !== "string") return [];
      const note = typeof row.note === "string" ? row.note : "";
      return [{
        providerId: "openai-compatible" as const,
        modelId: row.id,
        displayName: note ? `${row.id} (${note})` : row.id,
        vendor: typeof row.owned_by === "string" ? row.owned_by : "local",
        releasedAt: null,
        available: true,
        unavailableReason: null,
        nativeWebSearchSupported: false,
        checkedAt,
        source: "local_capability_registry" as const,
      }];
    });
  }
}

// Every configured provider in one list; a provider that is down contributes
// nothing rather than failing the whole catalogue.
export class CompositeProductModelCatalog implements ProductModelCatalog {
  constructor(private readonly catalogs: ProductModelCatalog[]) {}

  async list(): Promise<ProviderModelCatalogItem[]> {
    const results = await Promise.all(this.catalogs.map(async (catalog) => {
      try {
        return await catalog.list();
      } catch {
        return [];
      }
    }));
    return results.flat();
  }
}

// Azure has no data-plane deployment listing, so the deployments in use are
// declared through AZURE_OPENAI_DEPLOYMENTS rather than discovered.
export class AzureOpenAiProductModelCatalog implements ProductModelCatalog {
  async list(): Promise<ProviderModelCatalogItem[]> {
    const checkedAt = new Date().toISOString();
    return azureOpenAIDeployments().map((deployment) => ({
      providerId: "azure-openai" as const,
      modelId: deployment,
      displayName: `${deployment} (Azure deployment)`,
      vendor: "azure",
      releasedAt: null,
      available: true,
      unavailableReason: null,
      nativeWebSearchSupported: false,
      checkedAt,
      source: "local_capability_registry" as const,
    }));
  }
}
