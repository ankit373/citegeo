import { watsonxIamHost } from "../config/env.js";

// The data plane takes an IAM bearer token, not the API key, so the key buys a
// token first and the token is reused until it is nearly expired.
const GRANT = "urn:ibm:params:oauth:grant-type:apikey";
const EARLY_REFRESH_MS = 60_000;
const FALLBACK_TTL_SECONDS = 3600;

interface CachedToken {
  token: string;
  expiresAtMs: number;
}

const tokens = new Map<string, CachedToken>();

export function resetWatsonxTokenCache(): void {
  tokens.clear();
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export async function watsonxAccessToken(apiKey: string, now = Date.now()): Promise<string> {
  const cached = tokens.get(apiKey);
  if (cached && cached.expiresAtMs - EARLY_REFRESH_MS > now) return cached.token;

  const url = `https://${watsonxIamHost()}/identity/token`;
  const body = new URLSearchParams({ grant_type: GRANT, apikey: apiKey }).toString();
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
    });
  } catch (error) {
    throw new Error(`watsonx token exchange could not be reached: ${error instanceof Error ? error.message : String(error)}`);
  }

  const payload = asObject(await response.json().catch(() => null));
  if (!response.ok) {
    const detail = typeof payload?.errorMessage === "string" ? payload.errorMessage : `HTTP ${response.status}`;
    throw new Error(`watsonx rejected the API key: ${detail}`);
  }
  const token = typeof payload?.access_token === "string" ? payload.access_token : "";
  if (!token) throw new Error("watsonx returned no access token.");
  const ttlSeconds = typeof payload?.expires_in === "number" ? payload.expires_in : FALLBACK_TTL_SECONDS;
  tokens.set(apiKey, { token, expiresAtMs: now + ttlSeconds * 1000 });
  return token;
}
