import test from "node:test";
import assert from "node:assert/strict";
import { handleGoogleOAuth } from "../src/product/search-console/google-oauth-http.js";
import { issueState } from "../src/product/search-console/google-oauth.js";
import { resetUsedStates } from "../src/product/auth/oauth-state.js";

const SECRET = "server-secret";
const ORIGIN = "http://127.0.0.1:8787";

function harness(options: {
  path: string;
  signedIn?: boolean;
  stored?: string | null;
  saved?: string[];
}) {
  const sent: Array<{ status: number; body: unknown }> = [];
  const redirects: Array<{ status: number; location: string }> = [];
  const url = new URL(ORIGIN + options.path);
  return {
    sent, redirects, url,
    run: () => handleGoogleOAuth({
      method: "GET",
      route: url.pathname.split("/").filter(Boolean),
      url,
      origin: ORIGIN,
      authSecret: SECRET,
      signedIn: options.signedIn !== false,
      credentials: {
        resolve: async () => options.stored === undefined ? JSON.stringify({ client_id: "abc", client_secret: "shh" }) : options.stored,
        save: async (_id: string, secret: unknown) => { (options.saved || []).push(String(secret)); return { outcome: "saved" as const }; },
      } as never,
      send: (status, body) => { sent.push({ status, body }); },
      redirect: (status, location) => { redirects.push({ status, location }); },
    }),
  };
}

test("starting a flow needs a session, because it is an action", async () => {
  const h = harness({ path: "/api/google/authorize", signedIn: false });
  assert.equal(await h.run(), true);
  assert.equal(h.sent[0]?.status, 401);
  assert.equal(h.redirects.length, 0);
});

test("with no client saved, the flow says what to save rather than failing at Google", async () => {
  const h = harness({ path: "/api/google/authorize", stored: null });
  await h.run();
  assert.equal(h.sent[0]?.status, 400);
  assert.ok(String((h.sent[0]?.body as { error: string }).error).includes("client of your own"));
});

test("the consent redirect carries the client id and never the secret", async () => {
  const h = harness({ path: "/api/google/authorize" });
  await h.run();
  const location = h.redirects[0]!.location;
  assert.ok(location.startsWith("https://accounts.google.com/"));
  assert.ok(location.includes("client_id=abc"));
  assert.equal(location.includes("shh"), false);
});

test("a callback this server did not start is refused", async () => {
  resetUsedStates();
  const h = harness({ path: "/api/google/callback?code=x&state=forged" });
  await h.run();
  assert.equal(h.redirects[0]!.location, "/?connected=google&result=refused");
});

test("a callback carrying no session still works, because the state is the proof", async () => {
  // The browser arrives from Google, so a SameSite=Strict cookie is not sent.
  // Requiring one here would refuse every real callback.
  resetUsedStates();
  const saved: string[] = [];
  const state = issueState(SECRET);
  const previous = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ refresh_token: "1//r" }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
  try {
    const h = harness({ path: `/api/google/callback?code=one-time&state=${state}`, signedIn: false, saved });
    await h.run();
    assert.equal(h.redirects[0]!.location, "/?connected=google&result=ok");
    assert.ok(saved[0]!.includes("1//r"));
  } finally {
    globalThis.fetch = previous;
  }
});

test("the same callback url cannot be spent twice", async () => {
  resetUsedStates();
  const state = issueState(SECRET);
  const previous = globalThis.fetch;
  let exchanges = 0;
  globalThis.fetch = (async () => { exchanges += 1; return new Response(JSON.stringify({ refresh_token: "1//r" }), { status: 200, headers: { "content-type": "application/json" } }); }) as typeof fetch;
  try {
    await harness({ path: `/api/google/callback?code=c&state=${state}` }).run();
    const replay = harness({ path: `/api/google/callback?code=c&state=${state}` });
    await replay.run();
    // A history entry replayed must not reach Google a second time.
    assert.equal(exchanges, 1);
    assert.equal(replay.redirects[0]!.location, "/?connected=google&result=refused");
  } finally {
    globalThis.fetch = previous;
  }
});

test("a declined consent lands somewhere that says so, with no code in it", async () => {
  resetUsedStates();
  const state = issueState(SECRET);
  const h = harness({ path: `/api/google/callback?error=access_denied&state=${state}` });
  await h.run();
  assert.equal(h.redirects[0]!.location, "/?connected=google&result=declined");
});

test("no redirect ever carries the authorisation code onward", async () => {
  resetUsedStates();
  const state = issueState(SECRET);
  const previous = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ refresh_token: "1//r" }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
  try {
    const h = harness({ path: `/api/google/callback?code=SECRETCODE&state=${state}` });
    await h.run();
    for (const hop of h.redirects) {
      assert.equal(hop.location.includes("SECRETCODE"), false, "the code must not travel on");
      assert.equal(hop.status, 303);
    }
  } finally {
    globalThis.fetch = previous;
  }
});

test("the callback is open to the guard, and nothing else new is", async () => {
  const { isOpenPath } = await import("../src/product/auth/auth-guard.js");
  // It has to be, because the session cookie is not sent on a navigation from
  // Google. Its proof is the signed single-use state instead.
  assert.equal(isOpenPath("/api/google/callback"), true);
  // Starting a flow is an action and stays closed, as does everything else.
  assert.equal(isOpenPath("/api/google/authorize"), false);
  assert.equal(isOpenPath("/api/credentials"), false);
  assert.equal(isOpenPath("/api/projects"), false);
});

test("a refused save does not land where a successful one lands", async () => {
  // The environment owning this slot made save refuse, and reporting success
  // anyway threw away a refresh token while telling the reader it worked.
  resetUsedStates();
  const state = issueState(SECRET);
  const previous = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ refresh_token: "1//r" }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
  try {
    const redirects: Array<{ status: number; location: string }> = [];
    const url = new URL(`${ORIGIN}/api/google/callback?code=c&state=${state}`);
    await handleGoogleOAuth({
      method: "GET",
      route: url.pathname.split("/").filter(Boolean),
      url,
      origin: ORIGIN,
      authSecret: SECRET,
      signedIn: true,
      credentials: {
        resolve: async () => JSON.stringify({ client_id: "abc", client_secret: "shh" }),
        save: async () => ({ outcome: "owned_by_environment" as const, detail: "" }),
      } as never,
      send: () => {},
      redirect: (status, location) => { redirects.push({ status, location }); },
    });
    assert.equal(redirects[0]!.location, "/?connected=google&result=owned_by_environment");
    assert.equal(redirects[0]!.location.includes("result=ok"), false);
  } finally {
    globalThis.fetch = previous;
  }
});

test("the session cookie survives a return from a consent screen", async () => {
  const { sessionCookie } = await import("../src/product/auth/session.js");
  const cookie = sessionCookie("t", 60_000, false);
  // Strict withholds the cookie on a navigation another site started, which is
  // exactly how consent returns, so the reader lands on the login form.
  assert.equal(cookie.includes("SameSite=Lax"), true);
  assert.equal(cookie.includes("SameSite=Strict"), false);
  assert.equal(cookie.includes("HttpOnly"), true);
});
