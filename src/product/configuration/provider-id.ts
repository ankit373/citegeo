// The workbench was built against OpenRouter alone. Local heads reach it through
// the openai-compatible gateway, so every record carries which provider produced it.
export type ProductProviderId = "openrouter" | "openai-compatible" | "azure-openai";

export const PRODUCT_PROVIDER_IDS: ProductProviderId[] = ["openrouter", "openai-compatible", "azure-openai"];

export function isProductProviderId(value: unknown): value is ProductProviderId {
  return typeof value === "string" && (PRODUCT_PROVIDER_IDS as string[]).includes(value);
}
