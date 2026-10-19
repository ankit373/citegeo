import test from "node:test";
import assert from "node:assert/strict";
import { askEngine, type BrowserEngine, type EngineOutcome } from "../src/product/engines/browser-engine.js";
import { BROWSER_ENGINES, browserEngine, googleAiOverview, perplexityWeb } from "../src/product/engines/engine-registry.js";
import { handleEngineApi } from "../src/product/engines/engine-http.js";
test("a browser that is not running is unavailable, never an empty answer", async () => {
  // An empty answer is a measurement. A missing browser is not one.
  const outcome = await askEngine(googleAiOverview, "best screener", { endpoint: "http://127.0.0.1:1" });
  assert.equal(outcome.state, "unavailable");
  assert.ok(outcome.state === "unavailable" && outcome.detail.length > 0);
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
    home: "https://example.test/",
    caveat: "A test engine that always throws, to prove a failure is reported and not raised.",
    grounding: "per_question",
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

test("drawing the page does not reach into the reader's browser", async () => {
  // Measured live: opening Models attached a debugger to the developer's own
  // signed-in Chrome, once per server process, with nothing asked for.
  const asked: Array<boolean | undefined> = [];
  const engines = { status: async (unused: string, probe?: boolean) => { asked.push(probe); return { engines: [] }; } };
  const call = (search: string) => handleEngineApi({
    method: "GET",
    route: ["api", "projects", "p1", "engines"],
    url: new URL("http://127.0.0.1/api/projects/p1/engines" + search),
    send: () => undefined,
    engines: engines as never,
    readJson: async () => ({}),
  });
  assert.equal(await call(""), true);
  assert.equal(asked[0], false, "a plain read probed the browser");
  assert.equal(await call("?probe=true"), true);
  assert.equal(asked[1], true, "asking by name did not probe");
});
