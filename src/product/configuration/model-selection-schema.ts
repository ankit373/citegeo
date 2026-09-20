import type { ProductProviderId } from "./provider-id.js";
export type ProductWebSearchMode = "off" | "provider_native";

export interface ProductModelSelection {
  id: string;
  projectId: string;
  providerId: ProductProviderId;
  modelId: string;
  displayName: string;
  webSearchMode: ProductWebSearchMode;
  nativeWebSearchSupported: boolean;
  available: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductModelSelectionInput {
  modelId: string;
  webSearchMode: ProductWebSearchMode;
}

export interface ProviderModelCatalogItem {
  providerId: ProductProviderId;
  modelId: string;
  displayName: string;
  vendor?: string | undefined;
  releasedAt?: string | null | undefined;
  available: boolean;
  unavailableReason: string | null;
  nativeWebSearchSupported: boolean;
  checkedAt: string;
  /**
   * Where this row came from. "provider_catalog" is the provider's own listing
   * endpoint, which is the only source that cannot go stale behind our back.
   */
  source: "openrouter_catalog" | "provider_catalog" | "local_capability_registry";
}

export interface ProductModelCatalog {
  list(): Promise<ProviderModelCatalogItem[]>;
}
