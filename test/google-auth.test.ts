import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import {
  GOOGLE_SCOPES,
  GoogleAuthError,
  GoogleTokens,
  isOAuthClient,
  parseGoogleCredential,
} from "../src/product/search-console/google-auth.js";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

const SERVICE_ACCOUNT = JSON.stringify({
  type: "service_account",
  project_id: "paper-mill-471",
  private_key_id: "9c1f0b2a",
  private_key: PEM,
  client_email: "reader@paper-mill-471.iam.gserviceaccount.com",
  client_id: "104729000000000000001",
  token_uri: "https://oauth2.example/token",
});

const CLIENT_SECRET = "GOCSPX-thisisnotarealclientsecret";
const REFRESH_TOKEN = "1//04thisisnotarealrefreshtoken";
const OAUTH_CLIENT = JSON.stringify({
  client_id: "104729000000000000001.apps.googleusercontent.com",
  client_secret: CLIENT_SECRET,
  refresh_token: REFRESH_TOKEN,
  token_uri: "https://oauth2.example/token",
});

interface Exchange {
  url: string;
  method: string;
  contentType: string;
  body: URLSearchParams;
}

function recorder(replies: Response[]): { calls: Exchange[]; post: typeof fetch } {
  const calls: Exchange[] = [];
  const post: typeof fetch = async (url, init) => {
    const headers = new Headers(init?.headers);
    calls.push({
      url: String(url),
      method: init?.method || "GET",
      contentType: headers.get("content-type") || "",
      body: new URLSearchParams(typeof init?.body === "string" ? init.body : ""),
    });
    return replies[Math.min(calls.length - 1, replies.length - 1)] || new Response("", { status: 500 });
  };
  return { calls, post };
}

function granted(token: string, expiresIn: number | null): Response {
  const payload: Record<string, unknown> = { access_token: token, token_type: "Bearer" };
  if (expiresIn !== null) payload.expires_in = expiresIn;
  return new Response(JSON.stringify(payload), { status: 200 });
}

test("the scopes asked of the user are the two read-only ones and nothing else", () => {
  assert.deepEqual(GOOGLE_SCOPES, [
    "https://www.googleapis.com/auth/webmasters.readonly",
    "https://www.googleapis.com/auth/analytics.readonly",
  ]);
});

test("each shape is identified by the fields it carries, not by a flag", () => {
  const account = parseGoogleCredential(SERVICE_ACCOUNT);
  assert.equal(isOAuthClient(account), false);
  assert.deepEqual(account, {
    clientEmail: "reader@paper-mill-471.iam.gserviceaccount.com",
    privateKey: PEM,
    tokenUri: "https://oauth2.example/token",
  });

  const client = parseGoogleCredential(OAUTH_CLIENT);
  assert.equal(isOAuthClient(client), true);
  assert.deepEqual(client, {
    clientId: "104729000000000000001.apps.googleusercontent.com",
    clientSecret: CLIENT_SECRET,
    refreshToken: REFRESH_TOKEN,
    tokenUri: "https://oauth2.example/token",
  });
});

test("an OAuth client with no token_uri falls back to Google's endpoint", () => {
  const client = parseGoogleCredential(JSON.stringify({ client_id: "a", client_secret: "b", refresh_token: "c" }));
  assert.equal(isOAuthClient(client) && client.tokenUri, "https://oauth2.googleapis.com/token");
});

test("a credential missing a required field is refused by the field it is missing", () => {
  assert.throws(() => parseGoogleCredential("not json"), GoogleAuthError);
  assert.throws(() => parseGoogleCredential("[]"), (error: Error) => error.message.includes("not an object"));
  assert.throws(
    () => parseGoogleCredential(JSON.stringify({ client_secret: "b", refresh_token: "c" })),
    (error: Error) => error.message.includes("client_id"),
  );
  assert.throws(
    () => parseGoogleCredential(JSON.stringify({ client_id: "a", refresh_token: "c" })),
    (error: Error) => error.message.includes("client_secret"),
  );
  assert.throws(
    () => parseGoogleCredential(JSON.stringify({ client_id: "a", client_secret: "b" })),
    (error: Error) => error.message.includes("refresh_token"),
  );
  assert.throws(
    () => parseGoogleCredential(JSON.stringify({ private_key: PEM })),
    (error: Error) => error.message.includes("client_email"),
  );
  assert.throws(
    () => parseGoogleCredential(JSON.stringify({ client_email: "a@b" })),
    (error: Error) => error.message.includes("private_key"),
  );
});

test("JSON that is neither shape names both fields it would have needed", () => {
  assert.throws(
    () => parseGoogleCredential(JSON.stringify({ project_id: "paper-mill-471", api_key: "nope" })),
    (error: Error) => error.message.includes("client_email") && error.message.includes("refresh_token"),
  );
});

test("two credentials pasted together are refused rather than guessed at", () => {
  assert.throws(
    () => parseGoogleCredential(JSON.stringify({ client_email: "a@b", private_key: PEM, refresh_token: "c" })),
    (error: Error) => error.message.includes("cannot be told"),
  );
});

test("the refresh grant posts the grant type, the client, its secret and the refresh token", async () => {
  const { calls, post } = recorder([granted("ya29.first", 3600)]);
  const token = await new GoogleTokens(post).token(parseGoogleCredential(OAUTH_CLIENT));
  assert.equal(token, "ya29.first");
  const call = calls[0];
  assert.ok(call);
  assert.equal(calls.length, 1);
  assert.equal(call.url, "https://oauth2.example/token");
  assert.equal(call.method, "POST");
  assert.equal(call.contentType, "application/x-www-form-urlencoded");
  assert.deepEqual([...call.body.entries()].sort(), [
    ["client_id", "104729000000000000001.apps.googleusercontent.com"],
    ["client_secret", CLIENT_SECRET],
    ["grant_type", "refresh_token"],
    ["refresh_token", REFRESH_TOKEN],
  ]);
  assert.equal(call.body.get("assertion"), null);
});

test("a granted token is held until it is nearly spent, so one report is one exchange", async () => {
  const { calls, post } = recorder([granted("ya29.first", 3600), granted("ya29.second", 3600)]);
  const tokens = new GoogleTokens(post);
  const client = parseGoogleCredential(OAUTH_CLIENT);
  assert.equal(await tokens.token(client), "ya29.first");
  assert.equal(await tokens.token(client), "ya29.first");
  assert.equal(calls.length, 1);
});

test("a token Google gave no expiry for is spent once rather than held against a guess", async () => {
  const { calls, post } = recorder([granted("ya29.first", null), granted("ya29.second", null)]);
  const tokens = new GoogleTokens(post);
  const client = parseGoogleCredential(OAUTH_CLIENT);
  assert.equal(await tokens.token(client), "ya29.first");
  assert.equal(await tokens.token(client), "ya29.second");
  assert.equal(calls.length, 2);
});

test("one credential's token is never handed to another", async () => {
  const { calls, post } = recorder([granted("ya29.first", 3600), granted("ya29.second", 3600)]);
  const tokens = new GoogleTokens(post);
  const first = parseGoogleCredential(OAUTH_CLIENT);
  const second = parseGoogleCredential(JSON.stringify({
    client_id: "999.apps.googleusercontent.com",
    client_secret: "GOCSPX-adifferentsecret",
    refresh_token: "1//04adifferentrefreshtoken",
    token_uri: "https://oauth2.example/token",
  }));
  assert.equal(await tokens.token(first), "ya29.first");
  assert.equal(await tokens.token(second), "ya29.second");
  assert.equal(calls.length, 2);
});

test("a service account trades a signed assertion through the same token source", async () => {
  const { calls, post } = recorder([granted("ya29.signed", 3600)]);
  const token = await new GoogleTokens(post).token(parseGoogleCredential(SERVICE_ACCOUNT));
  assert.equal(token, "ya29.signed");
  const call = calls[0];
  assert.ok(call);
  assert.equal(call.body.get("grant_type"), "urn:ietf:params:oauth:grant-type:jwt-bearer");
  assert.equal(call.body.get("client_secret"), null);
  const header = (call.body.get("assertion") || "").split(".")[0] || "";
  const decoded = JSON.parse(Buffer.from(header.split("-").join("+").split("_").join("/"), "base64").toString("utf8")) as Record<string, unknown>;
  assert.deepEqual(decoded, { alg: "RS256", typ: "JWT" });
});

test("invalid_grant is named as the refresh token, not as a bad secret", async () => {
  const body = JSON.stringify({ error: "invalid_grant", error_description: "Token has been expired or revoked." });
  const { post } = recorder([new Response(body, { status: 400 })]);
  await assert.rejects(
    () => new GoogleTokens(post).token(parseGoogleCredential(OAUTH_CLIENT)),
    (error: Error) =>
      error.message.includes("refresh token")
      && error.message.includes("invalid_grant")
      && !error.message.includes("client secret")
      && !error.message.includes(REFRESH_TOKEN),
  );
});

test("a rejected client names the client secret, not the refresh token", async () => {
  const body = JSON.stringify({ error: "invalid_client", error_description: "Unauthorized" });
  const { post } = recorder([new Response(body, { status: 401 })]);
  await assert.rejects(
    () => new GoogleTokens(post).token(parseGoogleCredential(OAUTH_CLIENT)),
    (error: Error) =>
      error.message.includes("client secret")
      && !error.message.includes("refresh token")
      && !error.message.includes(CLIENT_SECRET),
  );
});

test("a grant that answers with no token says so rather than returning an empty one", async () => {
  const { post } = recorder([new Response(JSON.stringify({ token_type: "Bearer" }), { status: 200 })]);
  await assert.rejects(
    () => new GoogleTokens(post).token(parseGoogleCredential(OAUTH_CLIENT)),
    (error: Error) => error.message.includes("no access token"),
  );
});
