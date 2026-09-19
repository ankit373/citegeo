import test from "node:test";
import assert from "node:assert/strict";
import { buildActionPlan } from "../src/product/actions/action-plan.js";
import { parseRobots, parseStructuredData } from "../src/product/actions/site-signals.js";
import type { SiteSignals } from "../src/product/actions/site-signals.js";

function signals(overrides: Partial<SiteSignals> = {}): SiteSignals {
  return {
    domain: "example.com",
    checkedAt: "2026-01-01T00:00:00.000Z",
    reachable: true,
    robots: { present: true, blocked: [], allowed: ["GPTBot", "ClaudeBot"] },
    llmsTxt: { present: true, bytes: 1200 },
    structuredData: { organization: true, sameAs: ["https://www.wikidata.org/wiki/Q1"], independent: ["https://www.wikidata.org/wiki/Q1"] },
    wikidata: { present: true, id: "Q1", searched: "Example" },
    ...overrides,
  };
}

const ids = (actions: ReturnType<typeof buildActionPlan>) => actions.map((action) => action.id);

test("a blocked crawler outranks every other finding", () => {
  const plan = buildActionPlan({
    signals: signals({ robots: { present: true, blocked: ["GPTBot"], allowed: ["ClaudeBot"] }, wikidata: { present: false, id: null, searched: "Example" } }),
  });
  assert.equal(plan[0]?.id, "crawlers-blocked");
  assert.equal(plan[0]?.severity, "critical");
});

test("sameAs pointing only at owned profiles is called out as corroborating nothing", () => {
  const owned = ["https://www.linkedin.com/company/x", "https://twitter.com/x", "https://example.com/about"];
  const plan = buildActionPlan({
    signals: signals({ structuredData: { organization: true, sameAs: owned, independent: [] } }),
  });
  const action = plan.find((item) => item.id === "sameas-all-owned");
  assert.ok(action, "expected the owned-profile finding");
  assert.equal(action.severity, "high");
});

test("zero recognition names the competitors to benchmark against", () => {
  const plan = buildActionPlan({
    signals: signals(),
    recognition: { answered: 4, recognized: 0, competitors: ["Screener.in", "Tickertape"] },
  });
  const action = plan.find((item) => item.id === "no-model-recognition");
  assert.ok(action);
  assert.equal(action.severity, "critical");
  assert.ok(action.fix.includes("Screener.in"));
});

test("a clean site with recognition produces no outstanding work", () => {
  const plan = buildActionPlan({
    signals: signals(),
    recognition: { answered: 3, recognized: 3, competitors: [] },
  });
  assert.equal(plan.every((action) => action.severity === "done"), true, ids(plan).join(", "));
});

test("an unreachable site reports only that", () => {
  const plan = buildActionPlan({ signals: signals({ reachable: false }) });
  assert.deepEqual(ids(plan), ["site-unreachable"]);
});

test("robots parsing groups directives under the agents that precede them", () => {
  const robots = parseRobots([
    "User-agent: *",
    "Disallow: /api/",
    "Allow: /",
    "",
    "User-agent: GPTBot",
    "Disallow: /",
  ].join("\n"));
  assert.ok(robots.blocked.includes("GPTBot"));
  assert.ok(robots.allowed.includes("ClaudeBot"), "the wildcard group allows everything else");
});

test("two agents sharing one group both inherit its rules", () => {
  const robots = parseRobots("User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /\n");
  assert.ok(robots.blocked.includes("GPTBot"));
  assert.ok(robots.blocked.includes("ClaudeBot"));
});

test("a comment-only robots.txt blocks nothing", () => {
  const robots = parseRobots("# just a banner\n# another line\n");
  assert.deepEqual(robots.blocked, []);
});

test("sameAs is split into owned and independent records", () => {
  const html = `<script type="application/ld+json">${JSON.stringify({
    "@type": "Organization",
    name: "Example",
    sameAs: ["https://www.linkedin.com/company/x", "https://www.crunchbase.com/organization/x"],
  })}</script>`;
  const parsed = parseStructuredData(html, "example.com");
  assert.equal(parsed.organization, true);
  assert.deepEqual(parsed.independent, ["https://www.crunchbase.com/organization/x"]);
});

test("a sameAs given as a single string is still read", () => {
  const html = `<script type="application/ld+json">${JSON.stringify({
    "@graph": [{ "@type": "Organization", sameAs: "https://www.crunchbase.com/organization/x" }],
  })}</script>`;
  const parsed = parseStructuredData(html, "example.com");
  assert.deepEqual(parsed.independent, ["https://www.crunchbase.com/organization/x"]);
});

test("unparseable JSON-LD does not stop later blocks being read", () => {
  const html = '<script type="application/ld+json">{ not json </script>'
    + `<script type="application/ld+json">${JSON.stringify({ "@type": "Organization", name: "Example" })}</script>`;
  assert.equal(parseStructuredData(html, "example.com").organization, true);
});

test("Organization markup with no sameAs at all is reported as that, not as owned links", () => {
  const plan = buildActionPlan({
    signals: signals({ structuredData: { organization: true, sameAs: [], independent: [] } }),
  });
  assert.ok(plan.some((action) => action.id === "sameas-missing"));
  assert.equal(plan.some((action) => action.id === "sameas-all-owned"), false);
});

test("the Wikidata finding names the term that was actually searched", () => {
  const plan = buildActionPlan({
    signals: signals({ wikidata: { present: false, id: null, searched: "Tradomate" } }),
  });
  const action = plan.find((item) => item.id === "wikidata-missing");
  assert.ok(action?.evidence.includes("Tradomate"));
});
