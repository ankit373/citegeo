// The product used to speak only to OpenRouter, with local heads reaching it
// through the openai-compatible gateway. Everything here is a provider the
// shared catalogue already implements; narrowing the list to three was what
// made one aggregator's credit balance able to stop the whole product.
export type ProductProviderId =
  | "openrouter"
  | "openai"
  | "anthropic"
  | "gemini"
  | "perplexity"
  | "deepseek"
  | "azure-openai"
  | "openai-compatible";

export const PRODUCT_PROVIDER_IDS: ProductProviderId[] = [
  "openrouter",
  "openai",
  "anthropic",
  "gemini",
  "perplexity",
  "deepseek",
  "azure-openai",
  "openai-compatible",
];

export function isProductProviderId(value: unknown): value is ProductProviderId {
  return typeof value === "string" && (PRODUCT_PROVIDER_IDS as string[]).includes(value);
}
