import test from "node:test";
import assert from "node:assert/strict";
import { askEngine, chooseTarget, type BrowserEngine, type EngineOutcome } from "../src/product/engines/browser-engine.js";
import { BROWSER_ENGINES, browserEngine, googleAiOverview, perplexityWeb } from "../src/product/engines/engine-registry.js";
import type { CdpTarget } from "../src/product/engines/cdp-client.js";

function target(overrides: Partial<CdpTarget> = {}): CdpTarget {
  return { id: "t", type: "page", url: "about:blank", webSocketDebuggerUrl: "ws://127.0.0.1:1/x", ...overrides };
}

test("a browser that is not running is unavailable, never an empty answer", async () => {
  // An empty answer is a measurement. A missing browser is not one.
  const outcome = await askEngine(googleAiOverview, "best screener", { endpoint: "http://127.0.0.1:1" });
  assert.equal(outcome.state, "unavailable");
  assert.ok(outcome.state === "unavailable" && outcome.detail.length > 0);
});

test("only a page target can be driven", () => {
  assert.equal(chooseTarget([target({ type: "service_worker" }), target({ type: "background_page" })]), null);
  assert.equal(chooseTarget([target({ type: "service_worker" }), target({ id: "p", type: "page" })])?.id, "p");
  assert.equal(chooseTarget([]), null);
});

test("a target with no debugger url is not drivable", () => {
  assert.equal(chooseTarget([target({ webSocketDebuggerUrl: "" })]), null);
});

test("every engine states what reading it this way cannot promise", () => {
  for (const engine of BROWSER_ENGINES) {
    assert.ok(engine.caveat.length > 40, `${engine.id} has no caveat`);
    assert.ok(engine.label.length > 0);
  }
});

test("engines are addressable by id and unknown ones are absent, not guessed", () => {
  assert.equal(browserEngine("google-ai-overview")?.id, "google-ai-overview");
  assert.equal(browserEngine("perplexity-web")?.id, "perplexity-web");
  assert.equal(browserEngine("nonsense"), undefined);
});

test("a thrown adapter becomes unavailable rather than taking the run down", async () => {
  const broken: BrowserEngine = {
    id: "chatgpt",
    label: "Broken",
    caveat: "A test engine that always throws, to prove a failure is reported and not raised.",
    ask: async () => { throw new Error("the page went away"); },
  };
  const outcome = await askEngine(broken, "q", { endpoint: "http://127.0.0.1:1" });
  assert.equal(outcome.state, "unavailable");
});

test("the four outcome states are distinct and none of them is a silent empty answer", () => {
  const states: EngineOutcome["state"][] = ["answered", "no_answer", "unreadable", "unavailable"];
  assert.equal(new Set(states).size, 4);
  // no_answer means the surface answered nothing, which is a finding.
  // unreadable means the page changed, which is a bug in the adapter.
  // They must never collapse into each other.
  assert.notEqual("no_answer", "unreadable");
});

test("google and perplexity read different surfaces", () => {
  assert.notEqual(googleAiOverview.id, perplexityWeb.id);
  assert.ok(googleAiOverview.caveat.toLowerCase().includes("search"));
  assert.ok(perplexityWeb.caveat.toLowerCase().includes("api"));
});
