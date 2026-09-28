import test from "node:test";
import assert from "node:assert/strict";
import { alignEntity, anchorsFrom } from "../src/product/entity/entity-alignment.js";
import { buildLlmsTxt } from "../src/product/entity/llms-txt.js";
import type { SiteSignals } from "../src/product/actions/site-signals.js";

function signals(over: Partial<SiteSignals> = {}): SiteSignals {
  return {
    domain: "example.com",
    checkedAt: "2026-01-01T00:00:00.000Z",
    reachable: true,
    robots: { present: true, blocked: [], allowed: [] },
    llmsTxt: { present: false, bytes: 0 },
    structuredData: { organization: false, sameAs: [], independent: [] },
    wikidata: { present: false, id: null, searched: "Example" },
    ...over,
  } as SiteSignals;
}

function page(over: Record<string, unknown> = {}): any {
  return { url: "https://example.com/a", title: "A page", description: "What it is.", headings: ["A page"], text: "Body text.", ...over };
}

test("a profile the brand publishes itself corroborates nothing", () => {
  const anchors = anchorsFrom(signals({
    structuredData: { organization: true, sameAs: ["https://linkedin.com/company/x"], independent: [] },
  }));
  assert.equal(anchors.find((row) => row.kind === "owned_profile")?.independent, false);
  assert.equal(anchors.filter((row) => row.independent).length, 0);
});

test("organization markup is the brand's own claim, not corroboration", () => {
  const anchors = anchorsFrom(signals({ structuredData: { organization: true, sameAs: [], independent: [] } }));
  assert.equal(anchors[0]?.kind, "structured_data");
  assert.equal(anchors[0]?.independent, false, "a site saying who it is does not confirm who it is");
});

test("a Wikidata entity is an anchor nobody at the brand controls", () => {
  const anchors = anchorsFrom(signals({ wikidata: { present: true, id: "Q42", searched: "Example" } }));
  assert.equal(anchors[0]?.kind, "wikidata");
  assert.equal(anchors[0]?.independent, true);
});

test("a sameAs somewhere the brand does not control counts as corroboration", () => {
  const url = "https://crunchbase.com/organization/x";
  const report = alignEntity(signals({ structuredData: { organization: true, sameAs: [url], independent: [url] } }));
  assert.equal(report.corroborated, 1);
  assert.ok(!report.risks.some((row) => row.includes("Nothing corroborates")));
});

test("an entity with only its own word for itself is named as the risk", () => {
  const report = alignEntity(signals({
    structuredData: { organization: true, sameAs: ["https://x.com/brand"], independent: [] },
  }));
  assert.equal(report.corroborated, 0);
  assert.ok(report.risks.some((row) => row.includes("outside the brand's own control")));
  assert.ok(report.risks.some((row) => row.includes("cannot confirm the entity")));
});

test("what is absent is stated as an absence, not counted as zero", () => {
  const report = alignEntity(signals());
  assert.equal(report.corroborated, 0);
  assert.equal(report.missing.length, 3, "no markup, no Wikidata and no sameAs are three separate facts");
  assert.ok(report.missing.some((row) => row.includes("Wikidata")));
  assert.ok(report.missing.some((row) => row.includes("Organization markup")));
});

test("a site that could not be read says so rather than reading as unresolvable", () => {
  const report = alignEntity(signals({ reachable: false }));
  assert.ok(report.risks.some((row) => row.includes("could not be read")));
});

test("llms.txt lists a real page in that page's own words", () => {
  const draft = buildLlmsTxt({
    brandName: "Example",
    summary: "It does a thing.",
    site: { domain: "example.com", reachable: true, detail: null, pages: [page()] },
  });
  assert.ok(draft.text.includes("# Example"));
  assert.ok(draft.text.includes("> It does a thing."));
  assert.ok(draft.text.includes("- [A page](https://example.com/a): What it is."));
  assert.equal(draft.listed, 1);
});

test("a page with no name to call it by is skipped with the reason", () => {
  const draft = buildLlmsTxt({
    brandName: "Example",
    summary: null,
    site: { domain: "example.com", reachable: true, detail: null, pages: [page({ title: "", headings: [] })] },
  });
  assert.equal(draft.listed, 0);
  assert.equal(draft.skipped.length, 1);
  assert.ok(draft.skipped[0]?.reason.includes("no title"));
});

test("the same url is listed once", () => {
  const draft = buildLlmsTxt({
    brandName: "Example",
    summary: null,
    site: { domain: "example.com", reachable: true, detail: null, pages: [page(), page()] },
  });
  assert.equal(draft.listed, 1);
  assert.ok(draft.skipped[0]?.reason.includes("already"));
});

test("a site that read nothing says so rather than serving an empty map", () => {
  const draft = buildLlmsTxt({
    brandName: "Example",
    summary: null,
    site: { domain: "example.com", reachable: false, detail: "down", pages: [] },
  });
  assert.equal(draft.listed, 0);
  assert.ok(draft.text.includes("could be read"), "an empty file would claim the site has nothing");
});

test("every url in the draft came from a page that was read", () => {
  const site = { domain: "example.com", reachable: true, detail: null, pages: [page(), page({ url: "https://example.com/b", title: "B" })] };
  const draft = buildLlmsTxt({ brandName: "Example", summary: null, site });
  for (const line of draft.text.split("\n").filter((row) => row.startsWith("- "))) {
    assert.ok(site.pages.some((row) => line.includes(row.url)), `${line} points somewhere no page was read from`);
  }
});

test("a bracket in a title cannot close the link early", () => {
  const draft = buildLlmsTxt({
    brandName: "Example",
    summary: null,
    site: { domain: "example.com", reachable: true, detail: null, pages: [page({ title: "Pricing [2026]" })] },
  });
  const line = draft.text.split("\n").find((row) => row.startsWith("- ")) || "";
  // Exactly one link: the title's brackets must not read as a second one.
  assert.equal(line.split("](").length, 2, `the link is malformed: ${line}`);
  assert.ok(line.includes("https://example.com/a"));
});
