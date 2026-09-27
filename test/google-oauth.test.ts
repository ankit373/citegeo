import test from "node:test";
import assert from "node:assert/strict";
import { GOOGLE_SCOPES, GoogleAuthError } from "../src/product/search-console/google-auth.js";
import { authorizeUrl, callbackUrl, exchangeCode, issueState, stateIsOurs } from "../src/product/search-console/google-oauth.js";

const SECRET = "a-server-secret";

function withFetch<T>(stub: typeof fetch, run: () => Promise<T>): Promise<T> {
  const previous = globalThis.fetch;
  globalThis.fetch = stub;
  return run().finally(() => { globalThis.fetch = previous; });
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("the callback address is one string, however the origin was spelled", () => {
  assert.equal(callbackUrl("http://127.0.0.1:8787"), "http://127.0.0.1:8787/api/google/callback");
  // A trailing slash would register a different redirect uri from the one sent.
  assert.equal(callbackUrl("http://127.0.0.1:8787/"), "http://127.0.0.1:8787/api/google/callback");
  assert.equal(callbackUrl("http://127.0.0.1:8787///"), "http://127.0.0.1:8787/api/google/callback");
});

test("the consent request asks for a refresh token rather than hoping for one", () => {
  const url = new URL(authorizeUrl({ clientId: "abc.apps.googleusercontent.com", redirectUri: callbackUrl("http://127.0.0.1:8787"), state: "signed" }));
  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(url.searchParams.get("response_type"), "code");
  // Offline and consent together are what return one. Either alone does not.
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("prompt"), "consent");
  assert.equal(url.searchParams.get("scope"), GOOGLE_SCOPES.join(" "));
  assert.equal(url.searchParams.get("state"), "signed");
  assert.equal(url.searchParams.get("client_id"), "abc.apps.googleusercontent.com");
});

test("the client secret never travels to the consent screen", () => {
  const url = authorizeUrl({ clientId: "abc", redirectUri: callbackUrl("http://x"), state: "s" });
  assert.equal(url.includes("client_secret"), false);
});

test("a callback nobody here started is refused", () => {
  const state = issueState(SECRET);
  assert.equal(stateIsOurs(SECRET, state), true);
  assert.equal(stateIsOurs(SECRET, ""), false);
  assert.equal(stateIsOurs(SECRET, "forged"), false);
  assert.equal(stateIsOurs("a-different-secret", state), false);
});

test("a state older than its window is refused", () => {
  const issued = issueState(SECRET, 1_000_000);
  assert.equal(stateIsOurs(SECRET, issued, 1_000_000 + 60_000), true);
  assert.equal(stateIsOurs(SECRET, issued, 1_000_000 + 16 * 60 * 1000), false);
});

test("the exchange returns the credential this product already knows how to read", async () => {
  const seen: string[] = [];
  await withFetch(async (input, init) => {
    seen.push(String(input));
    seen.push(String(init?.body));
    return json({ access_token: "ya29.x", refresh_token: "1//refresh", expires_in: 3599 });
  }, async () => {
    const credential = await exchangeCode({
      clientId: "abc", clientSecret: "shh", code: "one-time", redirectUri: "http://127.0.0.1:8787/api/google/callback",
    });
    const parsed = JSON.parse(credential);
    assert.deepEqual(parsed, { client_id: "abc", client_secret: "shh", refresh_token: "1//refresh" });
  });
  assert.equal(seen[0], "https://oauth2.googleapis.com/token");
  assert.ok(seen[1]!.includes("grant_type=authorization_code"));
  assert.ok(seen[1]!.includes("code=one-time"));
});

test("a response with no refresh token says what to do about it", async () => {
  // Google returns none when the account consented before, and an access token
  // that expires in an hour is not a credential this product can keep.
  await withFetch(async () => json({ access_token: "ya29.x", expires_in: 3599 }), async () => {
    await assert.rejects(
      () => exchangeCode({ clientId: "a", clientSecret: "b", code: "c", redirectUri: "d" }),
      (error: unknown) => error instanceof GoogleAuthError && error.message.includes("Remove this product's access"),
    );
  });
});

test("a refused code is reported with the reason Google gave", async () => {
  await withFetch(async () => json({ error: "invalid_grant", error_description: "Bad Request" }, 400), async () => {
    await assert.rejects(
      () => exchangeCode({ clientId: "a", clientSecret: "b", code: "stale", redirectUri: "d" }),
      (error: unknown) => error instanceof GoogleAuthError && error.message.includes("Bad Request"),
    );
  });
});

test("an unreachable token endpoint is not a refused code", async () => {
  await withFetch(async () => { throw new Error("ENOTFOUND"); }, async () => {
    await assert.rejects(
      () => exchangeCode({ clientId: "a", clientSecret: "b", code: "c", redirectUri: "d" }),
      (error: unknown) => error instanceof GoogleAuthError && error.message.includes("could not be reached"),
    );
  });
});

test("the file Google downloads is accepted as downloaded", async () => {
  const { unwrapClientFile, parseGoogleCredential } = await import("../src/product/search-console/google-auth.js");
  // Google hands you {"web": {...}}. Refusing that for its wrapper is a bad
  // first five minutes with this product.
  const web = { web: { client_id: "a", client_secret: "b", refresh_token: "c", token_uri: "https://oauth2.googleapis.com/token" } };
  assert.equal(unwrapClientFile(web).client_id, "a");
  assert.equal(unwrapClientFile({ installed: { client_id: "z" } }).client_id, "z");
  // A flat object is already unwrapped and must pass through untouched.
  assert.equal(unwrapClientFile({ client_id: "flat" }).client_id, "flat");
  const credential = parseGoogleCredential(JSON.stringify(web));
  assert.equal((credential as { clientId: string }).clientId, "a");
});
