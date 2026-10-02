import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PER_DAY, MAX_PER_DAY, PASTE_CAVEAT, perDayFrom, readyToPaste, type PasteInput } from "../src/product/actions/paste-fix.js";
import type { SiteSignals } from "../src/product/actions/site-signals.js";

function signals(over: Partial<SiteSignals> = {}): SiteSignals {
  return {
    domain: "example.test",
    checkedAt: "2026-10-02T00:00:00.000Z",
    reachable: true,
    robots: { present: true, blocked: [], allowed: ["GPTBot"] },
    llmsTxt: { present: true, bytes: 100 },
    structuredData: { organization: true, sameAs: ["https://www.wikidata.org/wiki/Q1"], independent: ["https://www.wikidata.org/wiki/Q1"] },
    wikidata: { present: true, id: "Q1", searched: "Example" },
    ...over,
  };
}

function input(over: Partial<PasteInput> = {}): PasteInput {
  return {
    signals: signals(),
    brandName: "Example",
    profile: { description: "A screener for Indian markets.", category: "fintech", audience: "retail investors", features: ["screening", "alerts"] },
    sources: ["https://example.test/", "https://example.test/about"],
    ...over,
  };
}

test("asking for ten does not invent ten", () => {
  // The whole difference from a tool that ships a fixed number a day.
  const list = readyToPaste(input({ wanted: 10 }));
  assert.equal(list.wanted, 10);
  assert.ok(list.fixes.length < 10);
  assert.ok(list.shortfall?.includes("of the 10 asked for"));
});

test("asking for ten gives ten where ten exist", () => {
  const list = readyToPaste(input({
    wanted: 3,
    signals: signals({
      robots: { present: true, blocked: ["GPTBot"], allowed: [] },
      llmsTxt: { present: false, bytes: 0 },
      structuredData: { organization: false, sameAs: [], independent: [] },
    }),
  }));
  assert.equal(list.fixes.length, 3);
  assert.equal(list.shortfall, null, "three were asked for and three were generated");
});

test("the count is clamped rather than refused", () => {
  assert.equal(perDayFrom(undefined), DEFAULT_PER_DAY);
  assert.equal(perDayFrom(0), 1);
  assert.equal(perDayFrom(-4), 1);
  assert.equal(perDayFrom(999), MAX_PER_DAY);
  assert.equal(perDayFrom("7"), 7);
  assert.equal(perDayFrom("nonsense"), DEFAULT_PER_DAY);
});

test("the robots snippet names the agents actually disallowed", () => {
  const list = readyToPaste(input({ signals: signals({ robots: { present: true, blocked: ["GPTBot", "ClaudeBot"], allowed: [] } }) }));
  const fix = list.fixes.find((row) => row.id === "allow-crawlers");
  assert.ok(fix?.snippet.includes("User-agent: GPTBot"));
  assert.ok(fix?.snippet.includes("User-agent: ClaudeBot"));
  assert.ok(!fix?.snippet.includes("PerplexityBot"), "never an agent that was not blocked");
});

test("llms.txt is described, not written, when nobody has read what the site is", () => {
  const list = readyToPaste(input({
    profile: undefined,
    signals: signals({ llmsTxt: { present: false, bytes: 0 } }),
  }));
  assert.ok(!list.fixes.some((row) => row.id === "publish-llms-txt"));
  const said = list.described.find((row) => row.id === "publish-llms-txt");
  assert.ok(said?.evidence.includes("inventing what the company does"));
});

test("a blank feature never becomes an empty bullet in a published file", () => {
  const list = readyToPaste(input({
    signals: signals({ llmsTxt: { present: false, bytes: 0 } }),
    profile: { description: "A screener.", category: null, audience: null, features: ["", "  ", "screening"] },
  }));
  const snippet = list.fixes.find((row) => row.id === "publish-llms-txt")?.snippet || "";
  assert.ok(snippet.includes("- screening"));
  assert.ok(!snippet.includes("- \n"), "an empty bullet ships in whatever they paste");
});

test("the generated llms.txt carries only what the site said about itself", () => {
  const list = readyToPaste(input({ signals: signals({ llmsTxt: { present: false, bytes: 0 } }) }));
  const fix = list.fixes.find((row) => row.id === "publish-llms-txt");
  assert.ok(fix?.snippet.includes("# Example"));
  assert.ok(fix?.snippet.includes("> A screener for Indian markets."));
  assert.ok(fix?.snippet.includes("https://example.test/about"));
});

test("Organization schema carries the Wikidata entity when one resolves", () => {
  const list = readyToPaste(input({ signals: signals({ structuredData: { organization: false, sameAs: [], independent: [] } }) }));
  const fix = list.fixes.find((row) => row.id === "organization-schema");
  assert.ok(fix?.snippet.includes("https://www.wikidata.org/wiki/Q1"));
  assert.ok(fix?.snippet.includes('"@type": "Organization"'));
});

test("a sameAs nobody has observed is never written for them", () => {
  const list = readyToPaste(input({
    signals: signals({
      wikidata: { present: false, id: null, searched: "Example" },
      structuredData: { organization: true, sameAs: ["https://linkedin.com/company/example"], independent: [] },
    }),
  }));
  assert.ok(!list.fixes.some((row) => row.id === "sameas-all-owned"));
  const said = list.described.find((row) => row.id === "sameas-all-owned");
  assert.ok(said?.evidence.includes("cannot be written here"));
});

test("question and answer formatting is offered with the figure against it", () => {
  const list = readyToPaste(input({ wanted: 20 }));
  assert.ok(!list.fixes.some((row) => row.id === "qa-format"), "never counted toward the day");
  const qa = list.described.find((row) => row.id === "qa-format");
  assert.ok(qa?.why.includes("5.74%"));
  assert.ok(qa?.why.includes("opposite of what this fix is usually sold as"));
});

test("a site that did not answer generates nothing and says why", () => {
  const list = readyToPaste(input({ signals: signals({ reachable: false }) }));
  assert.deepEqual(list.fixes, []);
  assert.ok(list.shortfall?.includes("did not answer"));
});

test("every generated fix says where it goes and what it came from", () => {
  const list = readyToPaste(input({
    wanted: 20,
    signals: signals({
      robots: { present: true, blocked: ["GPTBot"], allowed: [] },
      llmsTxt: { present: false, bytes: 0 },
      structuredData: { organization: false, sameAs: [], independent: [] },
    }),
  }));
  assert.ok(list.fixes.length > 0);
  for (const fix of list.fixes) {
    assert.ok(fix.where.length, `${fix.id} does not say where it goes`);
    assert.ok(fix.evidence.length, `${fix.id} was generated from nothing stated`);
    assert.ok(fix.snippet.length, `${fix.id} has nothing to paste`);
  }
  assert.equal(list.caveat, PASTE_CAVEAT);
});
