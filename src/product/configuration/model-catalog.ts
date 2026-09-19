import type { ProviderModelCapabilityCatalog } from "../../providers/model-capability-catalog.js";
import { ProductModelCatalogUnavailableError } from "./configuration-errors.js";
import type { ProductModelCatalog, ProviderModelCatalogItem } from "./model-selection-schema.js";

export class OpenRouterProductModelCatalog implements ProductModelCatalog {
  constructor(private readonly capabilities: ProviderModelCapabilityCatalog) {}

  async list(): Promise<ProviderModelCatalogItem[]> {
    const groups = await this.capabilities.list();
    const group = groups.find((item) => item.providerId === "openrouter");
    if (!group || group.catalogStatus !== "available") {
      throw new ProductModelCatalogUnavailableError(group?.error || "OpenRouter model catalog is unavailable.");
    }
    const checkedAt = new Date().toISOString();
    return group.models.map((model) => {
      const batchOnly = model.model.endsWith(":batch");
      return {
        providerId: "openrouter" as const,
        modelId: model.model,
        displayName: model.name,
        vendor: model.vendor,
        releasedAt: model.releasedAt,
        available: !batchOnly,
        unavailableReason: batchOnly
          ? "Served only through the provider's batch API, so it cannot answer a single request."
          : null,
        nativeWebSearchSupported: batchOnly ? false : model.nativeWebSearchSupported,
        checkedAt,
        source: "openrouter_catalog" as const,
      };
    });
  }
}
