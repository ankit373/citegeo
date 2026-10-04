import test from "node:test";
import assert from "node:assert/strict";
import {
  OWNED_BASELINE_HIGH,
  OWNED_BASELINE_LOW, buildPageKinds, CORPORATE_BASELINE, formatOf, KIND_CAVEAT, LISTICLE_BASELINE, sourceOf } from "../src/product/citations/page-kind.js";
import type { SourcePage } from "../src/product/citations/source-page.js";

function page(over: Partial<SourcePage> = {}): SourcePage {
  return {
    url: "https://them.test/x", host: "them.test", fetchedAt: "", title: "A page", description: "",
    headings: [], words: 1000, namesYou: false, named: [], detail: null,
    shape: { headings: 8, listItems: 4, tables: 0, paragraphs: 30 }, ...over,
  };
}

test("a ranked best-of with a list in it is a listicle", () => {
  assert.equal(formatOf(page({ title: "8 Best Stock Screeners in India", shape: { headings: 10, listItems: 40, tables: 1, paragraphs: 20 } })), "listicle");
});

test("a numbered title is a listicle even before the markup is counted", () => {
  assert.equal(formatOf(page({ title: "10 tools for investors", shape: undefined })), "listicle");
});

test("a head to head is a comparison rather than a listicle", () => {
  // It says best and it is a list, but the stronger signal is what it is for.
  assert.equal(formatOf(page({ title: "Screener vs Tickertape: which is best", shape: { headings: 6, listItems: 30, tables: 2, paragraphs: 10 } })), "comparison");
});

test("where the page lives beats what it is called", () => {
  assert.equal(formatOf(page({ host: "www.youtube.com", title: "10 best screeners" })), "video");
  assert.equal(formatOf(page({ host: "old.reddit.com", title: "best screener?" })), "forum");
  assert.equal(formatOf(page({ host: "en.wikipedia.org", title: "Stock screener" })), "reference");
});

test("guides, reviews and documentation are told apart", () => {
  assert.equal(formatOf(page({ title: "How to screen Indian stocks" })), "guide");
  assert.equal(formatOf(page({ title: "Screener.in review" })), "review");
  assert.equal(formatOf(page({ host: "docs.them.test", title: "Query reference" })), "documentation");
});

test("a page that is none of those is an article rather than unclassified", () => {
  assert.equal(formatOf(page({ title: "Markets rally on budget news" })), "article");
});

test("your own site and a rival's are told apart from everybody else", () => {
  const scope = { domain: "mine.test", rivalDomains: ["rival.test"] };
  assert.equal(sourceOf({ host: "blog.mine.test" }, scope), "yours");
  assert.equal(sourceOf({ host: "rival.test" }, scope), "rival");
  assert.equal(sourceOf({ host: "somebody.test" }, scope), "independent");
  assert.equal(sourceOf({ host: "www.linkedin.com" }, scope), "social");
  assert.equal(sourceOf({ host: "www.reddit.com" }, scope), "community");
  assert.equal(sourceOf({ host: "youtu.be" }, scope), "video");
  assert.equal(sourceOf({ host: "en.wikipedia.org" }, scope), "reference");
});

test("a host that merely ends in a known name is not that site", () => {
  // notreddit.com is not reddit, and the suffix check has to know it.
  assert.equal(sourceOf({ host: "notreddit.com" }, {}), "independent");
  assert.equal(sourceOf({ host: "myreddit.com" }, {}), "independent");
});

test("a page that would not load says nothing about what gets cited", () => {
  const report = buildPageKinds({ pages: [page(), page({ url: "https://b.test/x", detail: "The page is gone (404)." })] });
  assert.equal(report.pages, 1, "an unread page is not an article");
});

test("shares are taken over the pages that could be read", () => {
  const report = buildPageKinds({
    domain: "mine.test",
    pages: [
      page({ title: "8 best screeners", shape: { headings: 4, listItems: 40, tables: 0, paragraphs: 5 } }),
      page({ url: "https://mine.test/a", host: "mine.test", title: "Our product" }),
      page({ url: "https://www.reddit.com/r/x", host: "www.reddit.com", title: "best screener?" }),
      page({ url: "https://c.test/g", host: "c.test", title: "How to screen stocks" }),
    ],
  });
  assert.equal(report.pages, 4);
  assert.equal(report.listicleShare, 0.25);
  // Only the two sites belonging to somebody in this category. A publisher
  // writing about it is not a company's own site, and counting it as one put
  // this share at 1.00 on live data and made the comparison meaningless.
  assert.equal(report.corporateShare, 0.25);
  assert.equal(report.ownedShare, 0.25);
  assert.equal(report.sources.find((row) => row.kind === "independent")?.pages, 2);
  assert.equal(report.sources.find((row) => row.kind === "community")?.pages, 1);
});

test("your own domain is read against what a brand's own domain usually gets", () => {
  // Every 2026 study puts a brand's own site at a twentieth to a tenth of its
  // citations, so nought of six being yours is usual rather than a finding.
  const report = buildPageKinds({
    domain: "mine.test",
    pages: [page(), page({ url: "https://b.test/x", host: "b.test", title: "Another" })],
  });
  assert.equal(report.ownedShare, 0);
  assert.equal(report.ownedBaselineLow, OWNED_BASELINE_LOW);
  assert.equal(report.ownedBaselineHigh, OWNED_BASELINE_HIGH);
  assert.ok(report.ownedBaselineLow < report.ownedBaselineHigh);
});

test("with nothing read back every share is unknown rather than nought", () => {
  const report = buildPageKinds({ pages: [] });
  assert.equal(report.listicleShare, null);
  assert.equal(report.corporateShare, null);
  assert.equal(report.ownedShare, null);
  assert.deepEqual(report.formats, []);
});

test("the baselines travel and the caveat refuses to call the split a census", () => {
  const report = buildPageKinds({ pages: [page()] });
  assert.equal(report.listicleBaseline, LISTICLE_BASELINE);
  assert.equal(report.corporateBaseline, CORPORATE_BASELINE);
  assert.ok(KIND_CAVEAT.includes("a reading rather than a census"));
  assert.ok(KIND_CAVEAT.includes("reads as a publisher here"));
  assert.equal(report.caveat, KIND_CAVEAT);
});
