import test from "node:test";
import assert from "node:assert/strict";
import { copilotWeb } from "../src/product/engines/engine-registry.js";
import type { CdpSession } from "../src/product/engines/cdp-client.js";

// A stand-in for the page, keyed on the selectors the adapter contracts with
// rather than on the exact text of its expressions.
class FakePage {
  editor = "";
  posted = "";
  answer = "";
  /** Inserts that land. The real editor ignores text until it is wired up. */
  acceptsFrom = 0;
  inserts = 0;
  navigated: string[] = [];

  insert(text: string): void {
    this.inserts += 1;
    if (this.inserts > this.acceptsFrom) this.editor += text;
  }

  /** Mirrors the surface: the send control exists only once it holds text. */
  get sendable(): boolean {
    return this.editor.length > 0;
  }
}

function session(page: FakePage): CdpSession {
  const evaluate = async (expression: string): Promise<unknown> => {
    if (expression.indexOf("document.createRange") >= 0) { page.editor = ""; return undefined; }
    if (expression.indexOf("button.click()") >= 0) {
      if (!page.sendable) return false;
      page.posted = page.editor;
      return true;
    }
    if (expression.indexOf("chatQuestion") >= 0) return page.posted.length > 0 && expression.indexOf(page.posted) >= 0;
    if (expression.indexOf("const selectors =") >= 0) {
      if (!page.answer) return null;
      return { selector: "[data-testid='markdown-reply']", text: page.answer, links: [] };
    }
    if (expression.indexOf(".focus()") >= 0 && expression.indexOf("Boolean") < 0) return undefined;
    // Whatever is left asks whether the editor is holding the question, with
    // or without the send control beside it.
    const holding = page.editor.length > 0;
    if (expression.indexOf("aria-label") >= 0) return holding && page.sendable;
    return true;
  };
  const send = async (method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> => {
    if (method === "Input.insertText") page.insert(String(params.text));
    if (method === "Page.navigate") page.navigated.push(String(params.url));
    return {};
  };
  return { evaluate, send, close: () => {} } as unknown as CdpSession;
}

test("it asks the surface it can actually reach", async () => {
  const page = new FakePage();
  page.answer = "x".repeat(400);
  await copilotWeb.ask(session(page), "best screener");
  assert.deepEqual(page.navigated, ["https://copilot.com/"], "the old host redirects and drops the question with it");
});

test("a question the editor never took is never reported as an answer", async () => {
  // The editor exists before it accepts text. Sending an empty composer still
  // returns a reply, and archiving that records an answer to nothing.
  const page = new FakePage();
  page.acceptsFrom = 99;
  page.answer = "an answer to a question nobody asked".repeat(20);
  const outcome = await copilotWeb.ask(session(page), "best screener");
  assert.equal(outcome.state, "unreadable");
  assert.equal(page.posted, "", "nothing should have been sent");
});

test("an insert that lands on a later try still asks the right question", async () => {
  const page = new FakePage();
  page.acceptsFrom = 2;
  page.answer = "y".repeat(400);
  const outcome = await copilotWeb.ask(session(page), "best screener");
  assert.equal(outcome.state, "answered");
  assert.equal(page.posted, "best screener", "a retry must not append to the half-taken attempt");
});

test("the surface lists sources without linking them, so citations are empty rather than invented", () => {
  assert.ok(copilotWeb.caveat.indexOf("without linking") >= 0);
  assert.ok(copilotWeb.caveat.indexOf("rather than invented") >= 0);
});

test("it is still always grounded, because it searches whether or not a link can be read", () => {
  // Reading no citation here is a limit of the page, not the surface declining
  // to search, so this must not become per_question.
  assert.equal(copilotWeb.grounding, "always");
});
