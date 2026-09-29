import { GOOGLE_SCOPES, GoogleAuthError } from "./google-auth.js";
import { issueSession, verifySession } from "../auth/session.js";

// Consent is the hard part of this credential, and asking a reader to perform
// it by hand and keep the refresh token is asking them to be an OAuth client.

const AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
/** Long enough to read a consent screen, short enough to be worth signing. */
const STATE_LIFETIME_MS = 15 * 60 * 1000;

export interface OAuthStart {
  clientId: string;
  clientSecret: string;
}

/** The address Google is told to come back to. It has to match a redirect URI
 * registered on the client exactly, so it is derived once and reused. */
export function callbackUrl(origin: string): string {
  let base = origin;
  while (base.endsWith("/")) base = base.slice(0, -1);
  return `${base}/api/google/callback`;
}

export function authorizeUrl(input: { clientId: string; redirectUri: string; state: string }): string {
  const url = new URL(AUTHORIZE);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
  // Offline and consent together are what return a refresh token. Without both
  // a second authorisation returns none and the credential cannot be renewed.
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", input.state);
  return url.toString();
}

export function issueState(secret: string, now = Date.now()): string {
  return issueSession(secret, STATE_LIFETIME_MS, now);
}

/** A callback nobody here started is a request from somewhere else. */
export function stateIsOurs(secret: string, state: string, now = Date.now()): boolean {
  return Boolean(state) && verifySession(secret, state, now);
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/**
 * Exchanges the one-time code for the credential this product stores. The
 * refresh token is the whole point: an access token expires in an hour.
 */
export async function exchangeCode(input: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<string> {
  const body = new URLSearchParams({
    code: input.code,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
  }).toString();

  let response: Response;
  try {
    response = await fetch(TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch (error) {
    throw new GoogleAuthError(`Google could not be reached to exchange the code: ${error instanceof Error ? error.message : String(error)}`);
  }

  const payload = asObject(await response.json().catch(() => null));
  if (!response.ok) {
    const detail = typeof payload?.error_description === "string" ? payload.error_description
      : typeof payload?.error === "string" ? payload.error : `HTTP ${response.status}`;
    throw new GoogleAuthError(`Google refused the authorisation code: ${detail}`);
  }
  const refreshToken = typeof payload?.refresh_token === "string" ? payload.refresh_token : "";
  if (!refreshToken) {
    // Google returns none when the account has consented before and the
    // request did not force the screen again.
    throw new GoogleAuthError("Google returned no refresh token, so the credential could not be renewed later. Remove this product's access in your Google account and connect again.");
  }
  return JSON.stringify({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    refresh_token: refreshToken,
  });
}
