import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { assertionFor, parseServiceAccount, ServiceAccountError, ServiceAccountTokens } from "../src/product/search-console/service-account.js";
import { recentWindow, SearchConsoleClient } from "../src/product/search-console/search-console-client.js";
import { buildSearchDemand } from "../src/product/search-console/search-demand.js";
import type { Prompt } from "../src/product/topics/topic-schema.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const KEY = JSON.stringify({ client_email: "reader@example.iam.gserviceaccount.com", private_key: PEM, token_uri: "https://oauth2.example/token" });

function decode(part: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(part.split("-").join("+").split("_").join("/"), "base64").toString("utf8")) as Record<string, unknown>;
}

test("a key missing a field is refused by the field it is missing", () => {
  assert.throws(() => parseServiceAccount("not json"), ServiceAccountError);
  assert.throws(() => parseServiceAccount(JSON.stringify({ private_key: "x" })), (error: Error) => error.message.includes("client_email"));
  assert.throws(() => parseServiceAccount(JSON.stringify({ client_email: "a@b" })), (error: Error) => error.message.includes("private_key"));
});

test("the assertion is signed with the key and verifies against its public half", () => {
  const account = parseServiceAccount(KEY);
  const token = assertionFor(account, 1_700_000_000);
  const [header, claims, signature] = token.split(".");
  assert.deepEqual(decode(header || ""), { alg: "RS256", typ: "JWT" });
  const payload = decode(claims || "");
  assert.equal(payload.iss, "reader@example.iam.gserviceaccount.com");
  assert.equal(payload.aud, "https://oauth2.example/token");
  assert.equal(payload.exp, 1_700_003_600);
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${header}.${claims}`);
  assert.equal(verifier.verify(publicKey, Buffer.from((signature || "").split("-").join("+").split("_").join("/"), "base64")), true);
});

test("a token is held until it is nearly spent, so one report is one exchange", async () => {
  let exchanges = 0;
  const tokens = new ServiceAccountTokens(async () => {
    exchanges += 1;
    return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
  });
  const account = parseServiceAccount(KEY);
  await tokens.token(account);
  await tokens.token(account);
  assert.equal(exchanges, 1);
});

test("a refused key says Google refused it rather than failing as a parse", async () => {
  const tokens = new ServiceAccountTokens(async () => new Response("invalid_grant", { status: 400 }));
  await assert.rejects(() => tokens.token(parseServiceAccount(KEY)), (error: Error) => error.message.includes("Google refused the key (400)"));
});

test("a property the account cannot see says to add the account, not that the key is wrong", async () => {
  const client = new SearchConsoleClient(
    { token: async () => "t" } as never,
    async () => new Response("forbidden", { status: 403 }),
  );
  await assert.rejects(
    () => client.queries({ account: parseServiceAccount(KEY), siteUrl: "https://example.com/", window: recentWindow() }),
    (error: Error) => error.message.includes("Add the service account as a user"),
  );
});

test("the window ends before today, because the last days have no rows yet", () => {
  const window = recentWindow(30, new Date("2026-03-31T00:00:00.000Z"));
  assert.equal(window.to, "2026-03-28");
  assert.equal(window.from, "2026-02-26");
});

function prompt(id: string, text: string): Prompt {
  return {
    id, projectId: "p", topicId: "t", text, normalizedText: text, intent: "discovery", source: "authored",
    measuresVisibility: true, visibilityExclusionReason: null, status: "active", createdAt: "", activatedAt: null,
  };
}

const ROWS = [
  { query: "best stock screener india", clicks: 10, impressions: 1000, ctr: 0.01, position: 8 },
  { query: "stock screener", clicks: 1, impressions: 100, ctr: 0.01, position: 20 },
  { query: "how to bake bread", clicks: 5, impressions: 50, ctr: 0.1, position: 2 },
];

test("a query sharing every meaningful word is exact, most of them is related, the rest is neither", () => {
  const report = buildSearchDemand({
    siteUrl: "https://example.com/", window: recentWindow(), rows: ROWS,
    prompts: [prompt("q1", "best stock screener india")],
  });
  const row = report.prompts[0];
  assert.deepEqual(row?.exact.map((match) => match.query), ["best stock screener india"]);
  assert.deepEqual(row?.related.map((match) => match.query), ["stock screener"]);
  assert.equal(row?.impressions, 1100);
});

test("position is weighted by impressions, and nothing matched is null rather than zero", () => {
  const report = buildSearchDemand({
    siteUrl: "https://example.com/", window: recentWindow(), rows: ROWS,
    prompts: [prompt("q1", "best stock screener india"), prompt("q2", "portfolio rebalancing calculator")],
  });
  const matched = report.prompts.find((row) => row.promptId === "q1");
  const unmatched = report.prompts.find((row) => row.promptId === "q2");
  assert.equal(Math.round((matched?.position || 0) * 100) / 100, 9.09);
  assert.equal(unmatched?.position, null);
  assert.equal(unmatched?.impressions, 0);
});
