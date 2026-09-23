import { createSign } from "node:crypto";
import { vertexClientEmail, vertexPrivateKey, vertexTokenHost } from "../config/env.js";

// Vertex takes an OAuth access token, not an API key. The service account key
// signs a JWT and Google exchanges it, which is the whole of the dance.

const SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const GRANT = "urn:ietf:params:oauth:grant-type:jwt-bearer";
const LIFETIME_SECONDS = 3600;
// Refresh early so a token cannot expire between the check and the call.
const EARLY_REFRESH_MS = 60_000;

export interface VertexServiceAccount {
  clientEmail: string;
  privateKey: string;
}

export function vertexServiceAccount(): VertexServiceAccount {
  const clientEmail = vertexClientEmail();
  const privateKey = vertexPrivateKey();
  const missing: string[] = [];
  if (!clientEmail) missing.push("GOOGLE_VERTEX_CLIENT_EMAIL");
  if (!privateKey) missing.push("GOOGLE_VERTEX_PRIVATE_KEY");
  if (missing.length > 0) {
    throw new Error(`Missing ${missing.join(" and ")} for provider "vertex-ai".`);
  }
  return { clientEmail: clientEmail as string, privateKey: privateKey as string };
}

function base64Url(value: Buffer | string): string {
  const buffer = typeof value === "string" ? Buffer.from(value, "utf8") : value;
  return buffer.toString("base64url");
}

/** A signed assertion is the only credential the token endpoint accepts here,
 * so it is built rather than taken from a library. */
export function vertexAssertion(account: VertexServiceAccount, issuedAt: number, audience: string): string {
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: account.clientEmail,
    scope: SCOPE,
    aud: audience,
    iat: issuedAt,
    exp: issuedAt + LIFETIME_SECONDS,
  }));
  const signingInput = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  return `${signingInput}.${signer.sign(account.privateKey).toString("base64url")}`;
}

interface CachedToken {
  token: string;
  expiresAtMs: number;
}

const tokens = new Map<string, CachedToken>();

export function resetVertexTokenCache(): void {
  tokens.clear();
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export async function vertexAccessToken(now = Date.now()): Promise<string> {
  const account = vertexServiceAccount();
  const cached = tokens.get(account.clientEmail);
  if (cached && cached.expiresAtMs - EARLY_REFRESH_MS > now) return cached.token;

  const audience = `https://${vertexTokenHost()}/token`;
  const assertion = vertexAssertion(account, Math.floor(now / 1000), audience);
  const body = new URLSearchParams({ grant_type: GRANT, assertion }).toString();

  let response: Response;
  try {
    response = await fetch(audience, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch (error) {
    throw new Error(`Vertex AI token exchange could not be reached: ${error instanceof Error ? error.message : String(error)}`);
  }

  const payload = asObject(await response.json().catch(() => null));
  if (!response.ok) {
    // The token endpoint names the fault precisely, and a clock skew or a
    // wrapped key both land here rather than on the first model call.
    const detail = typeof payload?.error_description === "string" ? payload.error_description : `HTTP ${response.status}`;
    throw new Error(`Vertex AI rejected the service account assertion: ${detail}`);
  }
  const token = typeof payload?.access_token === "string" ? payload.access_token : "";
  if (!token) throw new Error("Vertex AI returned no access token.");
  const ttlSeconds = typeof payload?.expires_in === "number" ? payload.expires_in : LIFETIME_SECONDS;
  tokens.set(account.clientEmail, { token, expiresAtMs: now + ttlSeconds * 1000 });
  return token;
}
