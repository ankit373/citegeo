import { createHash } from "node:crypto";
import {
  DEFAULT_TOKEN_URI,
  RENEW_BEFORE_MS,
  ServiceAccountError,
  ServiceAccountTokens,
  parseServiceAccount,
  type AccessToken,
  type ServiceAccount,
} from "./service-account.js";

// Two ways to reach the same two read-only APIs. A self-hosted copy has no
// OAuth application of its own, so the second path is a client the user owns.

/** What the consent has to cover. Read-only on both APIs and nothing else. */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
];

export interface OAuthClientCredential {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  tokenUri: string;
}

export type GoogleCredential = ServiceAccount | OAuthClientCredential;

/** One interface for both shapes, so a client asks for a token and nothing
 * below it knows which kind of credential paid for it. */
export interface GoogleTokenSource {
  token(credential: GoogleCredential): Promise<string>;
}

/** Named for the path that failed, and still a ServiceAccountError so the
 * service keeps turning both into the same configuration answer. */
export class GoogleAuthError extends ServiceAccountError {}

export function isOAuthClient(credential: GoogleCredential): credential is OAuthClientCredential {
  return typeof (credential as OAuthClientCredential).refreshToken === "string";
}

function field(parsed: Record<string, unknown>, name: string): string {
  const value = parsed[name];
  return typeof value === "string" ? value.trim() : "";
}

function parseOAuthClient(parsed: Record<string, unknown>): OAuthClientCredential {
  const clientId = field(parsed, "client_id");
  const clientSecret = field(parsed, "client_secret");
  const refreshToken = field(parsed, "refresh_token");
  if (!clientId) throw new GoogleAuthError("The credential has no client_id. Copy it from the OAuth client you registered.");
  if (!clientSecret) throw new GoogleAuthError("The credential has no client_secret. It comes from the same OAuth client as the id.");
  if (!refreshToken) {
    throw new GoogleAuthError(`The credential has no refresh_token. Consent once to ${GOOGLE_SCOPES.join(" and ")}, and keep the refresh token that consent returns.`);
  }
  const tokenUri = field(parsed, "token_uri");
  return { clientId, clientSecret, refreshToken, tokenUri: tokenUri || DEFAULT_TOKEN_URI };
}

/** Which shape was pasted is read from the fields it carries, never from a
 * choice the user makes, because a wrong choice reads as a broken key. */
export function parseGoogleCredential(raw: string): GoogleCredential {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GoogleAuthError("That is not JSON. Paste the whole service account key file, or the OAuth client id, secret and refresh token as JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new GoogleAuthError("That JSON is not an object, so it carries neither a client_email nor a refresh_token.");
  }
  const fields = parsed as Record<string, unknown>;
  const signs = "client_email" in fields || "private_key" in fields;
  const grants = "refresh_token" in fields || "client_secret" in fields;
  // Both at once is somebody's two files pasted together, and guessing which
  // half is meant fails much later as a permission fault on the property.
  if (signs && grants) throw new GoogleAuthError("That JSON carries a private_key and a refresh_token, so which credential it is cannot be told. Paste one of them.");
  if (signs) return parseServiceAccount(raw);
  if (grants) return parseOAuthClient(fields);
  throw new GoogleAuthError("That JSON has no client_email and no refresh_token, so it is neither a service account key nor an OAuth client credential.");
}

/** Identifies a credential in the cache without the cache holding the secret. */
function fingerprint(client: OAuthClientCredential): string {
  return createHash("sha256").update(`${client.clientId}\n${client.clientSecret}\n${client.refreshToken}\n${client.tokenUri}`).digest("hex");
}

// invalid_grant and a rejected client are different repairs: one mints a new
// refresh token, the other corrects the secret, so they are never one message.
function refusal(status: number, text: string): GoogleAuthError {
  if (text.includes("invalid_grant")) {
    return new GoogleAuthError("Google rejected the refresh token (invalid_grant). It was revoked, expired, or was minted for a different client, so consent again and paste the refresh token that comes back.");
  }
  if (status === 401 || text.includes("invalid_client")) {
    return new GoogleAuthError(`Google rejected the OAuth client (${status}). The client id or the client secret does not match the client you registered.`);
  }
  return new GoogleAuthError(`Google refused the OAuth client (${status}). ${text.slice(0, 200)}`);
}

export class GoogleTokens implements GoogleTokenSource {
  private readonly signers = new Map<string, ServiceAccountTokens>();
  private readonly granted = new Map<string, AccessToken>();

  constructor(private readonly post: typeof fetch = fetch) {}

  token(credential: GoogleCredential): Promise<string> {
    return isOAuthClient(credential) ? this.refreshed(credential) : this.signed(credential);
  }

  // One held token per credential. A single slot would hand the second
  // credential the first one's token, which reads as a permission fault.
  private signed(account: ServiceAccount): Promise<string> {
    const key = `${account.clientEmail}\n${account.tokenUri}`;
    const held = this.signers.get(key) || new ServiceAccountTokens(this.post);
    this.signers.set(key, held);
    return held.token(account);
  }

  private async refreshed(client: OAuthClientCredential): Promise<string> {
    const key = fingerprint(client);
    const now = Date.now();
    const held = this.granted.get(key);
    if (held && held.expiresAt - RENEW_BEFORE_MS > now) return held.token;
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: client.clientId,
      client_secret: client.clientSecret,
      refresh_token: client.refreshToken,
    });
    const response = await this.post(client.tokenUri, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const text = await response.text();
    if (!response.ok) throw refusal(response.status, text);
    const parsed = JSON.parse(text) as { access_token?: unknown; expires_in?: unknown };
    const token = typeof parsed.access_token === "string" ? parsed.access_token : "";
    if (!token) throw new GoogleAuthError("Google returned no access token for that OAuth client.");
    // An expiry Google did not state is not an hour, so that token is used
    // once rather than held against a guess.
    const seconds = typeof parsed.expires_in === "number" ? parsed.expires_in : null;
    if (seconds !== null) this.granted.set(key, { token, expiresAt: now + seconds * 1000 });
    return token;
  }
}
