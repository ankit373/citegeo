import type { CredentialService } from "../auth/credential-service.js";
import { GoogleAuthError, unwrapClientFile } from "./google-auth.js";
import { authorizeUrl, callbackUrl, exchangeCode, issueState, stateIsOurs } from "./google-oauth.js";
import { markStateUsed, stateWasUsed } from "../auth/oauth-state.js";
import { SAFETY_HEADERS } from "../http-io.js";

// Two routes, and the second one is the careful one: the browser arrives from
// Google, so a SameSite=Strict session cookie is not sent with it.

export interface GoogleOAuthInput {
  method: string;
  route: string[];
  url: URL;
  origin: string;
  authSecret: string;
  credentials: CredentialService;
  send: (status: number, body: unknown, contentType?: string) => void;
  redirect: (status: number, location: string, headers?: Record<string, string>) => void;
  /** Whether the caller holds a session. The callback cannot require one. */
  signedIn: boolean;
}

function parseClient(raw: string | null): { clientId: string; clientSecret: string } | null {
  if (!raw) return null;
  try {
    const parsed = unwrapClientFile(JSON.parse(raw) as Record<string, unknown>);
    const clientId = typeof parsed.client_id === "string" ? parsed.client_id : "";
    const clientSecret = typeof parsed.client_secret === "string" ? parsed.client_secret : "";
    return clientId && clientSecret ? { clientId, clientSecret } : null;
  } catch {
    return null;
  }
}

export async function handleGoogleOAuth(input: GoogleOAuthInput): Promise<boolean> {
  const { method, route, url, send, redirect } = input;
  if (route[0] !== "api" || route[1] !== "google") return false;

  if (method === "GET" && route[2] === "authorize" && route.length === 3) {
    // Starting a flow is an action, so it needs the session the callback cannot.
    if (!input.signedIn) {
      send(401, { error: "Authentication required." });
      return true;
    }
    const client = parseClient(await input.credentials.resolve("google"));
    if (!client) {
      send(400, {
        error: "Save a Google client first, as {\"client_id\", \"client_secret\"}. Consent needs a client of your own, because a copy running on your machine registers no application with Google.",
      });
      return true;
    }
    const state = issueState(input.authSecret);
    redirect(303, authorizeUrl({
      clientId: client.clientId,
      redirectUri: callbackUrl(input.origin),
      state,
    }));
    return true;
  }

  if (method === "GET" && route[2] === "callback" && route.length === 3) {
    const state = url.searchParams.get("state") || "";
    const code = url.searchParams.get("code") || "";
    const denied = url.searchParams.get("error");

    // The signed state is the authentication here. The browser arrives from
    // Google, so the session cookie is not sent and checking it would refuse
    // every real callback.
    if (!stateIsOurs(input.authSecret, state) || stateWasUsed(state)) {
      redirect(303, "/?connected=google&result=refused");
      return true;
    }
    markStateUsed(state);

    if (denied || !code) {
      redirect(303, "/?connected=google&result=declined");
      return true;
    }

    const client = parseClient(await input.credentials.resolve("google"));
    if (!client) {
      redirect(303, "/?connected=google&result=noclient");
      return true;
    }

    try {
      const credential = await exchangeCode({
        clientId: client.clientId,
        clientSecret: client.clientSecret,
        code,
        redirectUri: callbackUrl(input.origin),
      });
      const written = await input.credentials.save("google", credential);
      // A save that refused and a save that worked must not land in the same
      // place. The environment owning this slot silently discarded the token.
      if (written.outcome !== "saved") {
        redirect(303, `/?connected=google&result=${written.outcome}`);
        return true;
      }
    } catch (error) {
      // The reason is not put in the address bar, because the address bar is
      // where the code already was and this one is going in a history entry.
      const failed = error instanceof GoogleAuthError ? "exchange" : "unknown";
      redirect(303, `/?connected=google&result=${failed}`);
      return true;
    }

    // A redirect, immediately, so the code leaves the address bar and cannot
    // travel on in a Referer or sit in the history of a shared machine.
    redirect(303, "/?connected=google&result=ok", SAFETY_HEADERS);
    return true;
  }

  return false;
}
