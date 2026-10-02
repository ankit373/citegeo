import test from "node:test";
import assert from "node:assert/strict";
import { chatgptWeb } from "../src/product/engines/engine-registry.js";
import type { CdpSession } from "../src/product/engines/cdp-client.js";

// A sign-in wall and a surface that answered nothing are different things. One
// is an action for whoever runs this; the other is a finding about the surface.

function session(page: { selectors: string[]; signedOut: boolean; answer?: string }): CdpSession {
  const evaluate = async (expression: string): Promise<unknown> => {
    if (expression.indexOf("prompts.filter") >= 0) return page.signedOut;
    if (expression.indexOf(".some((selector) =>") >= 0) {
      return page.selectors.some((selector) => expression.indexOf(selector) >= 0);
    }
    if (expression.indexOf("const selectors =") >= 0) {
      if (!page.answer) return null;
      return { selector: "article", text: page.answer, links: [] };
    }
    return false;
  };
  return { evaluate, send: async () => ({}), close: () => {} } as unknown as CdpSession;
}

test("the wall's own article does not count as a transcript", async () => {
  // The signed-out page carries exactly one article and none of the attributes
  // a real transcript does, so reading article as proof reported a sign-in
  // wall as a surface that answered nothing.
  const outcome = await chatgptWeb.ask(session({ selectors: ["article"], signedOut: true }), "best screener");
  assert.equal(outcome.state, "unavailable");
  assert.ok(outcome.state === "unavailable" && outcome.detail.indexOf("sign in") >= 0);
});

test("a real transcript is never mistaken for a wall", async () => {
  const outcome = await chatgptWeb.ask(
    session({ selectors: ["[data-message-author-role='assistant']"], signedOut: false, answer: "x".repeat(400) }),
    "best screener",
  );
  assert.notEqual(outcome.state, "unavailable");
});
