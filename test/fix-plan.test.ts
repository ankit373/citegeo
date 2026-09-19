import test from "node:test";
import assert from "node:assert/strict";
import { buildFixPlan, starterLlmsTxt, unblockCrawlers } from "../src/product/integrations/fix-plan.js";
import { parseRobots } from "../src/product/actions/site-signals.js";
import type { SiteSignals } from "../src/product/actions/site-signals.js";
import type { GeoAction } from "../src/product/actions/action-plan.js";

function signals(overrides: Partial<SiteSignals> = {}): SiteSignals {
  return {
    domain: "example.com",
    checkedAt: "2026-01-01T00:00:00.000Z",
    reachable: true,
    robots: { present: true, blocked: [], allowed: ["GPTBot"] },
    llmsTxt: { present: true, bytes: 100 },
    structuredData: { organization: true, sameAs: [], independent: [] },
    wikidata: { present: false, id: null, searched: "Example" },
    ...overrides,
  };
}

const action = (id: string, severity: GeoAction["severity"] = "high"): GeoAction => ({
  id, severity, title: id, why: "", fix: "do the thing", evidence: "observed",
});

test("unblocking removes only the named crawler's group", () => {
  const before = [
    "User-agent: *",
    "Disallow: /api/",
    "Allow: /",
    "",
    "User-agent: GPTBot",
    "Disallow: /",
    "",
    "Sitemap: https://example.com/sitemap.xml",
  ].join("\n");
  const after = unblockCrawlers(before, ["GPTBot"]);
  assert.equal(after.includes("GPTBot"), true, "the note names it");
  assert.equal(after.includes("Disallow: /api/"), true, "unrelated rules survive");
  assert.equal(after.includes("Sitemap: https://example.com/sitemap.xml"), true, "so does the sitemap");
  const parsed = parseRobots(after);
  assert.equal(parsed.blocked.includes("GPTBot"), false, "and the result actually unblocks it");
});

test("a group listing two blocked crawlers is removed once", () => {
  const after = unblockCrawlers("User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n", ["GPTBot", "ClaudeBot"]);
  const parsed = parseRobots(after);
  assert.equal(parsed.blocked.includes("GPTBot"), false);
  assert.equal(parsed.blocked.includes("ClaudeBot"), false);
});

test("nothing blocked means the file is returned untouched", () => {
  const before = "User-agent: *\nAllow: /\n";
  assert.equal(unblockCrawlers(before, []), before);
});

test("a starter llms.txt asks a human to write the description rather than inventing one", () => {
  const text = starterLlmsTxt({ domain: "example.com", brand: "Example", categories: [] });
  assert.ok(text.includes("# Example"));
  assert.ok(text.includes("Replace this line"), "the one claim only the owner can make is left blank");
  assert.ok(text.includes("https://example.com/"));
});

test("categories the models used are carried in, because they are observed", () => {
  const text = starterLlmsTxt({ domain: "example.com", brand: "Example", categories: ["Stock screener"] });
  assert.ok(text.includes("Stock screener"));
});

test("a blocked crawler becomes a robots.txt patch", () => {
  const plan = buildFixPlan({
    signals: signals({ robots: { present: true, blocked: ["GPTBot"], allowed: [] } }),
    actions: [action("crawlers-blocked", "critical")],
    brand: "Example",
    robotsTxt: "User-agent: GPTBot\nDisallow: /\n",
  });
  assert.equal(plan.patches.length, 1);
  assert.equal(plan.patches[0]?.path, "robots.txt");
  assert.equal(plan.manual.length, 0, "a patched finding is not also listed as manual");
});

test("a missing llms.txt becomes a file patch", () => {
  const plan = buildFixPlan({
    signals: signals({ llmsTxt: { present: false, bytes: 0 } }),
    actions: [action("llms-txt-missing", "medium")],
    brand: "Example",
  });
  assert.deepEqual(plan.patches.map((patch) => patch.path), ["llms.txt"]);
});

test("a Wikidata finding is listed as manual with the reason it cannot be patched", () => {
  const plan = buildFixPlan({ signals: signals(), actions: [action("wikidata-missing")], brand: "Example" });
  assert.equal(plan.patches.length, 0);
  assert.equal(plan.manual.length, 1);
  assert.ok(plan.manual[0]?.reason.includes("outside this repository"));
});

test("schema findings are not guessed at, and say why", () => {
  const plan = buildFixPlan({ signals: signals(), actions: [action("sameas-all-owned")], brand: "Example" });
  assert.ok(plan.manual[0]?.reason.includes("template"), "a wrong patch there would look authoritative");
});

test("findings already in place produce nothing", () => {
  const plan = buildFixPlan({
    signals: signals(),
    actions: [action("crawlers-allowed", "done"), action("llms-txt-present", "done")],
    brand: "Example",
  });
  assert.equal(plan.worthOpening, false);
  assert.equal(plan.patches.length, 0);
  assert.equal(plan.manual.length, 0);
});
