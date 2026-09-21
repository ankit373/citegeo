import test from "node:test";
import assert from "node:assert/strict";
import { AnalyticsClient, assistantFor } from "../src/product/search-console/analytics-client.js";
import type { ServiceAccount } from "../src/product/search-console/service-account.js";

const ACCOUNT: ServiceAccount = { clientEmail: "a@b", privateKey: "x", tokenUri: "https://token.test" };
const TOKENS = { token: async () => "t" } as never;

function rows(pairs: Array<[string, number, number]>) {
  return JSON.stringify({
    rows: pairs.map(([source, sessions, engaged]) => ({
      dimensionValues: [{ value: source }],
      metricValues: [{ value: String(sessions) }, { value: String(engaged) }],
    })),
  });
}

test("an assistant is matched as a whole host or a subdomain, never as a substring", () => {
  assert.equal(assistantFor("chatgpt.com"), "ChatGPT");
  assert.equal(assistantFor("chat.openai.com"), "ChatGPT");
  assert.equal(assistantFor("www.perplexity.ai"), "Perplexity");
  assert.equal(assistantFor("notchatgpt.example"), null);
  assert.equal(assistantFor("chatgpt.com.phish.test"), null);
  assert.equal(assistantFor("google.com"), null);
});

test("one assistant reached from several hosts is one row", async () => {
  const client = new AnalyticsClient(TOKENS, async () => new Response(rows([["chatgpt.com", 10, 8], ["chat.openai.com", 5, 4]]), { status: 200 }));
  const report = await client.referrals({ account: ACCOUNT, propertyId: "1", from: "2026-01-01", to: "2026-02-01" });
  assert.deepEqual(report.assistants, [{ source: "ChatGPT", sessions: 15, engaged: 12 }]);
});

test("every source counts toward the total, so a share can be taken honestly", async () => {
  const client = new AnalyticsClient(TOKENS, async () => new Response(rows([["chatgpt.com", 10, 8], ["google", 990, 500]]), { status: 200 }));
  const report = await client.referrals({ account: ACCOUNT, propertyId: "1", from: "a", to: "b" });
  assert.equal(report.totalSessions, 1000);
  assert.deepEqual(report.assistants.map((row) => row.source), ["ChatGPT"]);
  assert.equal(report.empty, false);
});

test("a property that reported nothing says so rather than reading as nobody arriving", async () => {
  const client = new AnalyticsClient(TOKENS, async () => new Response(JSON.stringify({}), { status: 200 }));
  const report = await client.referrals({ account: ACCOUNT, propertyId: "1", from: "a", to: "b" });
  assert.equal(report.empty, true);
  assert.deepEqual(report.assistants, []);
  assert.equal(report.totalSessions, 0);
});

test("a property the account cannot see says who needs access, not that the key is wrong", async () => {
  const client = new AnalyticsClient(TOKENS, async () => new Response("no", { status: 403 }));
  await assert.rejects(
    () => client.referrals({ account: ACCOUNT, propertyId: "9", from: "a", to: "b" }),
    (error: Error) => error.message.includes("needs viewer access on that property")
      // Either path can be the one without access, so the advice names both.
      && error.message.includes("the account that granted consent"),
  );
});
