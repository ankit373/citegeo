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
  | "openai-compatible"
  | "bedrock"
  | "vertex-ai"
  | "databricks"
  | "watsonx";

export const PRODUCT_PROVIDER_IDS: ProductProviderId[] = [
  "openrouter",
  "openai",
  "anthropic",
  "gemini",
  "perplexity",
  "deepseek",
  "azure-openai",
  "openai-compatible",
  "bedrock",
  "vertex-ai",
  "databricks",
  "watsonx",
];

export function isProductProviderId(value: unknown): value is ProductProviderId {
  return typeof value === "string" && (PRODUCT_PROVIDER_IDS as string[]).includes(value);
}

/** A browser engine answers, but it is not a provider: no key, no endpoint and
 * no balance, so it stays out of the credential list above. */
export type AnswerSourceId = ProductProviderId | "browser";

export const BROWSER_SOURCE_ID = "browser";
