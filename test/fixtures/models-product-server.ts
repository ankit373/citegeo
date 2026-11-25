import { productDataDir } from "../../src/config/env.js";
import { createProductServer } from "../../src/product/product-server.js";
import { ProductProjectFileStore } from "../../src/product/projects/project-store.js";
import { ProductProjectService } from "../../src/product/projects/project-service.js";
import { LocalObjectStore } from "../../src/product/storage/object-store.js";
import type { ProductModelCatalog, ProviderModelCatalogItem } from "../../src/product/configuration/model-selection-schema.js";

// A fixed catalog, so the model pages are drawn from known figures and the
// browser never reaches a provider. Two projects, neither with a saved configuration.
const dir = productDataDir();
const projects = new ProductProjectService(new ProductProjectFileStore(dir, new LocalObjectStore(dir)));
await projects.createDraft({ primaryDomain: "acme.com", name: "Acme", brandName: "Acme" });
await projects.createDraft({ primaryDomain: "blank.com", name: "Blank" });

const item = (modelId: string, displayName: string, over: Partial<ProviderModelCatalogItem> = {}): ProviderModelCatalogItem => ({
  providerId: "openrouter", modelId, displayName, available: true, unavailableReason: null, nativeWebSearchSupported: false,
  checkedAt: "2026-11-01T00:00:00.000Z", source: "provider_catalog", ...over,
});
const models: ProviderModelCatalogItem[] = [
  item("alpha/search-1", "Alpha: Search One", { vendor: "Alpha", releasedAt: "2026-09-01T00:00:00.000Z", nativeWebSearchSupported: true }),
  item("alpha/base-1", "Alpha: Base One", { vendor: "Alpha", releasedAt: "2026-03-01T00:00:00.000Z" }),
  item("beta/chat-2", "Beta: Chat Two", { vendor: "Beta", releasedAt: "2026-06-01T00:00:00.000Z" }),
  item("beta/old-1", "Beta: Old One", { vendor: "Beta", releasedAt: null }),
  item("gamma/search-3", "Gamma: Search Three", { vendor: "Gamma", releasedAt: "2026-10-01T00:00:00.000Z", nativeWebSearchSupported: true }),
  item("gamma/gone-1", "Gamma: Gone One", { vendor: "Gamma", available: false, unavailableReason: "Retired by the provider" }),
];
const catalog: ProductModelCatalog = { list: async () => models.map((row) => ({ ...row })) };

createProductServer({ modelCatalog: catalog }).listen(Number(process.env.PORT || 8787), "127.0.0.1");
