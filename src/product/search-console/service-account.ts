import { createSign } from "node:crypto";

// A service account key signs its own assertion and trades it for a token.
// Written here rather than taken from an SDK, the same judgement as the
// GitHub client and the S3 signing: four calls do not justify the surface.

const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";
const LIFETIME_SECONDS = 3600;
/** Renew before the edge, so a long report does not expire mid-run. */
const RENEW_BEFORE_MS = 120000;

export class ServiceAccountError extends Error {}

export interface ServiceAccount {
  clientEmail: string;
  privateKey: string;
  tokenUri: string;
}

function base64Url(value: Buffer | string): string {
  return Buffer.from(value).toString("base64").split("+").join("-").split("/").join("_").split("=").join("");
}

/** A key that is missing a field is refused by name, because "invalid JSON"
 * sends somebody to the wrong half of the problem. */
export function parseServiceAccount(raw: string): ServiceAccount {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new ServiceAccountError("That is not JSON. Paste the whole service account key file.");
  }
  const clientEmail = typeof parsed.client_email === "string" ? parsed.client_email : "";
  const privateKey = typeof parsed.private_key === "string" ? parsed.private_key : "";
  if (!clientEmail) throw new ServiceAccountError("The key has no client_email, so it is not a service account key.");
  if (!privateKey) throw new ServiceAccountError("The key has no private_key. A key downloaded as JSON carries one.");
  return {
    clientEmail,
    privateKey,
    tokenUri: typeof parsed.token_uri === "string" && parsed.token_uri ? parsed.token_uri : DEFAULT_TOKEN_URI,
  };
}

export function assertionFor(account: ServiceAccount, nowSeconds: number): string {
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: account.clientEmail,
    scope: SCOPE,
    aud: account.tokenUri,
    iat: nowSeconds,
    exp: nowSeconds + LIFETIME_SECONDS,
  }));
  const body = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(body);
  return `${body}.${base64Url(signer.sign(account.privateKey))}`;
}

export interface AccessToken {
  token: string;
  expiresAt: number;
}

export class ServiceAccountTokens {
  private held: AccessToken | null = null;

  constructor(private readonly post: typeof fetch = fetch) {}

  async token(account: ServiceAccount): Promise<string> {
    const now = Date.now();
    if (this.held && this.held.expiresAt - RENEW_BEFORE_MS > now) return this.held.token;
    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: assertionFor(account, Math.floor(now / 1000)),
    });
    const response = await this.post(account.tokenUri, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new ServiceAccountError(`Google refused the key (${response.status}). ${text.slice(0, 200)}`);
    }
    const parsed = JSON.parse(text) as { access_token?: unknown; expires_in?: unknown };
    const token = typeof parsed.access_token === "string" ? parsed.access_token : "";
    if (!token) throw new ServiceAccountError("Google returned no access token for that key.");
    const seconds = typeof parsed.expires_in === "number" ? parsed.expires_in : LIFETIME_SECONDS;
    this.held = { token, expiresAt: now + seconds * 1000 };
    return token;
  }
}
