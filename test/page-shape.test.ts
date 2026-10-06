import test from "node:test";
import assert from "node:assert/strict";
import { compareShapes, SHAPE_CAVEAT, SHAPE_EFFECT } from "../src/product/citations/page-shape.js";
import type { SourcePage } from "../src/product/citations/source-page.js";

function page(over: Partial<SourcePage> = {}): SourcePage {
  return {
    url: "https://them.test/x", host: "them.test", fetchedAt: "", title: "t", description: "",
    headings: [], words: 1000, namesYou: false, named: [], detail: null,
    shape: { headings: 10, listItems: 20, tables: 1, paragraphs: 30 }, ...over,
  };
}

test("their pages are the ones that beat you, not every page that is not yours", () => {
  // A page you are already named on did not beat you.
  const report = compareShapes({
    domain: "mine.test",
    pages: [page(), page({ url: "https://them.test/y", namesYou: true })],
  });
  assert.equal(report.theirs.pages, 1);
});

/** A side rather than a page: the verdict needs MIN_PAGES_TO_COMPARE of each. */
function side(count: number, over: Partial<SourcePage>): SourcePage[] {
  return Array.from({ length: count }, (_unused, index) =>
    page({ ...over, url: `${over.url || "https://them.test/x"}-${index}` }));
}

test("structure is counted per thousand words, or a long page always wins", () => {
  const report = compareShapes({
    domain: "mine.test",
    pages: [
      ...side(3, { words: 4000, shape: { headings: 40, listItems: 0, tables: 0, paragraphs: 0 } }),
      ...side(3, { host: "mine.test", url: "https://mine.test/a", words: 500, shape: { headings: 5, listItems: 0, tables: 0, paragraphs: 0 } }),
    ],
  });
  assert.equal(report.theirs.headingsPerThousand, 10);
  assert.equal(report.yours.headingsPerThousand, 10, "same density, different length");
  assert.equal(report.behindOnAll, false);
});

test("being behind on every count that can be compared is the finding", () => {
  const report = compareShapes({
    domain: "mine.test",
    pages: [
      ...side(3, { shape: { headings: 12, listItems: 30, tables: 2, paragraphs: 40 } }),
      ...side(3, { host: "mine.test", url: "https://mine.test/a", shape: { headings: 2, listItems: 1, tables: 0, paragraphs: 40 } }),
    ],
  });
  assert.equal(report.behindOnAll, true);
  assert.equal(report.yours.withTable, 0);
  assert.equal(report.theirs.withTable, 1);
});

test("ahead on one count is not behind on all of them", () => {
  const report = compareShapes({
    domain: "mine.test",
    pages: [
      ...side(3, { shape: { headings: 12, listItems: 1, tables: 2, paragraphs: 40 } }),
      ...side(3, { host: "mine.test", url: "https://mine.test/a", shape: { headings: 2, listItems: 30, tables: 0, paragraphs: 40 } }),
    ],
  });
  assert.equal(report.behindOnAll, false);
});

test("with no page of your own there is no gap, which is not no gap found", () => {
  const report = compareShapes({ domain: "mine.test", pages: [page()] });
  assert.equal(report.yours.pages, 0);
  assert.equal(report.behindOnAll, null, "unknown, because there is nothing of yours to compare");
});

test("a subdomain of yours is yours", () => {
  const report = compareShapes({
    domain: "mine.test",
    pages: [page(), page({ host: "blog.mine.test", url: "https://blog.mine.test/a" })],
  });
  assert.equal(report.yours.pages, 1);
});

test("a page stored before the markup was counted is left out rather than called flat", () => {
  const report = compareShapes({ domain: "mine.test", pages: [page({ shape: undefined }), page({ url: "https://them.test/z" })] });
  assert.equal(report.theirs.pages, 1, "the one without a shape cannot be read as having none");
});

test("a page with no words cannot have a density", () => {
  const report = compareShapes({ domain: "mine.test", pages: [page({ words: 0 })] });
  assert.equal(report.theirs.pages, 0);
  assert.equal(report.theirs.headingsPerThousand, null);
});

test("the effect is stated as causal and as zero sum", () => {
  assert.ok(SHAPE_EFFECT.includes("causally"));
  assert.ok(SHAPE_EFFECT.includes("came out of another page"));
  assert.ok(SHAPE_CAVEAT.includes("rather than what works everywhere"));
  assert.equal(compareShapes({ pages: [] }).effect, SHAPE_EFFECT);
});

test("one page of yours is a page, not a side", () => {
  // The verdict has always promised null where a side is too thin, and the
  // only thinness it tested was none at all.
  const report = compareShapes({
    domain: "mine.test",
    pages: [
      ...side(10, { shape: { headings: 12, listItems: 30, tables: 2, paragraphs: 40 } }),
      page({ host: "mine.test", url: "https://mine.test/a", shape: { headings: 2, listItems: 1, tables: 0, paragraphs: 40 } }),
    ],
  });
  assert.equal(report.yours.pages, 1);
  assert.equal(report.theirs.pages, 10);
  assert.equal(report.behindOnAll, null, "one page against ten is not a comparison of two kinds of page");
  assert.equal(report.minimum, 3);
});
