import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { splitLines, stripMatchingQuotes } from "../utils/text.js";

const PROVIDER_ENV_KEYS: Record<string, string[]> = {
  openrouter: ["OPENROUTER_API_KEY", "OPENROUTER_KEY"],
  openai: ["OPENAI_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
  gemini: ["GEMINI_API_KEY"],
  perplexity: ["PERPLEXITY_API_KEY"],
  deepseek: ["DEEPSEEK_API_KEY"],
  "openai-compatible": ["OPENAI_COMPATIBLE_API_KEY"],
  "azure-openai": ["AZURE_OPENAI_API_KEY"],
};

export function loadDotEnv(cwd = process.cwd()): void {
  const envPath = join(cwd, ".env");
  if (!existsSync(envPath)) return;
  const lines = splitLines(readFileSync(envPath, "utf8"));
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    const value = stripMatchingQuotes(rawValue);
    if (!process.env[key]) process.env[key] = value;
  }
}

export function providerEnvKeys(providerId: string): string[] {
  return PROVIDER_ENV_KEYS[providerId] || [];
}

export function openAICompatibleBaseUrl(): string | undefined {
  const value = process.env.OPENAI_COMPATIBLE_BASE_URL || process.env.OPENAI_COMPATIBLE_BASEURL;
  return value?.trim() || undefined;
}

function envSecretValue(key: string): string | undefined {
  const direct = process.env[key];
  if (direct?.trim()) return direct.trim();
  const filePath = process.env[`${key}_FILE`];
  if (!filePath?.trim()) return undefined;
  try {
    const fromFile = readFileSync(filePath.trim(), "utf8").trim();
    return fromFile || undefined;
  } catch {
    return undefined;
  }
}

export function resolveProviderKey(providerId: string, explicitKey?: string): string {
  if (explicitKey?.trim()) return explicitKey.trim();
  const keys = providerEnvKeys(providerId);
  for (const key of keys) {
    const value = envSecretValue(key);
    if (value) return value;
  }
  throw new Error(`Missing API key for provider "${providerId}". Expected one of: ${keys.join(", ") || "none"}`);
}

export function hasProviderKey(providerId: string): boolean {
  if (providerId === "azure-openai") {
    return Boolean(azureOpenAIEndpoint()) && providerEnvKeys(providerId).some((key) => Boolean(envSecretValue(key)));
  }
  if (providerId === "openai-compatible") {
    return Boolean(openAICompatibleBaseUrl()) && providerEnvKeys(providerId).some((key) => Boolean(envSecretValue(key)));
  }
  return providerEnvKeys(providerId).some((key) => Boolean(envSecretValue(key)));
}

// Node binds every interface when listen() is given no host. This app has no
// authentication, so the safe default is loopback and reaching it from
// elsewhere has to be a deliberate choice.
export function serverHost(): string {
  return process.env.HOST?.trim() || "127.0.0.1";
}

export function runsDir(): string {
  return process.env.RUNS_DIR || "runs";
}

export function monitoringDataDir(): string {
  return process.env.MONITORING_DATA_DIR || "data";
}

/**
 * Product-v2 has a separate persistence boundary while the legacy monitoring
 * data remains available only for a later, explicit migration.
 */
export function productDataDir(): string {
  return process.env.PRODUCT_DATA_DIR || join(monitoringDataDir(), "product-v2");
}

/**
 * Reads in flight when a whole prefix is read. Absent lets the backend pick,
 * because a disk and a bucket are bounded by different things.
 */
export function objectReadConcurrency(): number | null {
  const raw = process.env.OBJECT_READ_CONCURRENCY?.trim();
  if (!raw) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * The answer index sits beside the settings and the locks, on local disk and
 * never in the bucket it indexes. Off returns null and every read rescans.
 */
export function answerIndexDir(): string | null {
  if ((process.env.PRODUCT_ANSWER_INDEX || "").trim().toLowerCase() === "off") return null;
  return process.env.PRODUCT_INDEX_DIR?.trim() || join(productDataDir(), "index");
}

/** Where a Chrome with remote debugging is listening, for the browser
 * engines. It drives a browser you already have open; it starts nothing. */
export function browserDebugEndpoint(): string {
  return process.env.BROWSER_DEBUG_ENDPOINT || "http://127.0.0.1:9222";
}

export function azureOpenAIEndpoint(): string | undefined {
  return envSecretValue("AZURE_OPENAI_ENDPOINT") || undefined;
}

export function azureOpenAIApiVersion(): string {
  return envSecretValue("AZURE_OPENAI_API_VERSION") || "2024-10-21";
}

// Azure exposes no data-plane deployment listing, so the deployments in use are
// declared rather than discovered.
export function azureOpenAIDeployments(): string[] {
  const raw = envSecretValue("AZURE_OPENAI_DEPLOYMENTS") || "";
  return raw.split(",").map((value) => value.trim()).filter(Boolean);
}
