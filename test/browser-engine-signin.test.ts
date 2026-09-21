import test from "node:test";
import assert from "node:assert/strict";
import { browserEngine } from "../src/product/engines/engine-registry.js";
import type { CdpSession } from "../src/product/engines/cdp-client.js";

/** A page that answers whatever the expressions ask, so the decision logic can
 * be driven without a browser. */
function fakeSession(page: { containers: string[]; bodyText: string; answerText?: string; links?: string[] }): CdpSession {
  const has = (expr: string) => page.containers.some((selector) => expr.includes(JSON.stringify(selector)) || expr.includes(selector));
  return {
    send: async () => ({}),
    close: () => undefined,
    evaluate: async (expression: string) => {
      if (expression.includes("document.body ? document.body.innerText")) {
        const lower = page.bodyText.toLowerCase();
        const hits = ["sign in", "log in", "sign up", "create an account", "continue with google"].filter((p) => lower.includes(p)).length;
        return (hits > 0 && page.bodyText.length < 2500) as never;
      }
      if (expression.includes(".some((selector) => document.querySelector(selector))")) return has(expression) as never;
      if (expression.startsWith("Boolean(") || expression.startsWith("(() => { const found")) return has(expression) as never;
      if (expression.includes("const selectors =")) {
        if (!page.containers.length) return null as never;
        return { selector: page.containers[0], text: page.answerText || "", links: page.links || [] } as never;
      }
      return null as never;
    },
  } as unknown as CdpSession;
}

test("a sign-in wall with no answer reports sign in, not a changed page", async () => {
  const engine = browserEngine("chatgpt");
  assert.ok(engine);
  const outcome = await engine.ask(fakeSession({ containers: [], bodyText: "Log in or sign up to continue" }), "q");
  assert.equal(outcome.state, "unavailable");
  assert.ok(outcome.state === "unavailable" && outcome.detail.includes("sign in"));
  // The two are fixed differently, so they must never be reported as one.
  assert.notEqual(outcome.state, "unreadable");
});

test("a sign-in banner beside a real answer is a banner, not a wall", async () => {
  const engine = browserEngine("perplexity-web");
  assert.ok(engine);
  const outcome = await engine.ask(
    fakeSession({
      containers: ["[data-testid='answer']"],
      bodyText: "Sign in to save your history",
      answerText: "x".repeat(400),
      links: ["https://source.test/a"],
    }),
    "q",
  );
  assert.equal(outcome.state, "answered");
  assert.deepEqual(outcome.state === "answered" ? outcome.answer.citationUrls : [], ["https://source.test/a"]);
});

test("a page that changed with no sign-in prompt is unreadable, which is the adapter's problem", async () => {
  const engine = browserEngine("copilot");
  assert.ok(engine);
  const outcome = await engine.ask(fakeSession({ containers: [], bodyText: "x".repeat(4000) }), "q");
  assert.equal(outcome.state, "unreadable");
  assert.ok(outcome.state === "unreadable" && outcome.detail.includes("needs updating"));
});

test("every engine states what reading it this way cannot promise", () => {
  for (const id of ["google-ai-overview", "perplexity-web", "chatgpt", "copilot"]) {
    const engine = browserEngine(id);
    assert.ok(engine?.caveat && engine.caveat.length > 40, `${id} has no caveat`);
  }
  // Verified against the live page: signed out it answers and links nothing.
  assert.ok(browserEngine("perplexity-web")?.caveat.includes("renders no linked sources"));
});
