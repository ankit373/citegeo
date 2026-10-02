import type { PageShape } from "../discovery/site-read.js";
import type { SourcePage } from "./source-page.js";

// How a page is laid out moves citation credit between pages making the same
// claim. A causal audit crossing document order with structured and prose
// renderings of the same facts found the structured rendering took half a
// citation per answer more, and took it without the total going up: the credit
// moved rather than appeared.
//
// So this compares the shape of the pages cited instead of you against your own,
// and reports the gap. It is a lever, not a ranking factor, and the caveat says
// the gain comes out of somebody else.

export const SHAPE_EFFECT = "Measured causally rather than by correlation: the same facts rendered as structure instead of prose took about half a citation more per answer, within a 95% interval of roughly a fifth to four fifths, and the total number of citations did not rise. The gain came out of another page. Ordering the same documents differently moved far less.";

export const SHAPE_CAVEAT = "Counted from the markup of pages these answers cited, so it describes what is already winning here rather than what works everywhere. A page can be structured and say nothing worth citing.";

export interface ShapeSummary {
  pages: number;
  /** Headings, list items and tables for every thousand words, which is the
   * only way to compare a long page with a short one. */
  headingsPerThousand: number | null;
  listItemsPerThousand: number | null;
  tablesPerThousand: number | null;
  /** Share of the pages carrying at least one table. */
  withTable: number | null;
}

export interface ShapeComparison {
  /** Pages cited on questions where the brand was not named. */
  theirs: ShapeSummary;
  /** Cited pages on the brand's own domain. */
  yours: ShapeSummary;
  /** True where their pages carry more structure per thousand words than
   * yours on every count that could be compared. Null where either side is
   * too thin to compare, which is unknown rather than no gap. */
  behindOnAll: boolean | null;
  effect: string;
  caveat: string;
}

function shapeOf(page: SourcePage): PageShape | null {
  const shape = page.shape;
  if (!shape) return null;
  return shape;
}

function summarise(pages: SourcePage[]): ShapeSummary {
  const usable = pages.filter((page) => shapeOf(page) && page.words > 0);
  if (!usable.length) {
    return { pages: 0, headingsPerThousand: null, listItemsPerThousand: null, tablesPerThousand: null, withTable: null };
  }
  const per = (pick: (shape: PageShape) => number): number => {
    const total = usable.reduce((sum, page) => sum + pick(shapeOf(page) as PageShape) / page.words, 0);
    return Math.round((total / usable.length) * 1000 * 10) / 10;
  };
  return {
    pages: usable.length,
    headingsPerThousand: per((shape) => shape.headings),
    listItemsPerThousand: per((shape) => shape.listItems),
    tablesPerThousand: per((shape) => shape.tables),
    withTable: usable.filter((page) => (shapeOf(page) as PageShape).tables > 0).length / usable.length,
  };
}

export function compareShapes(input: { pages: SourcePage[]; domain?: string | undefined }): ShapeComparison {
  const yours = (input.domain || "").trim().toLocaleLowerCase();
  const isYours = (page: SourcePage): boolean =>
    Boolean(yours) && (page.host === yours || page.host.endsWith("." + yours));

  const mine = input.pages.filter(isYours);
  // Theirs is every cited page that is not yours and does not name you: a page
  // you are already on is not a page that beat you.
  const theirs = input.pages.filter((page) => !isYours(page) && !page.namesYou);

  const left = summarise(theirs);
  const right = summarise(mine);
  const counts: Array<[number | null, number | null]> = [
    [left.headingsPerThousand, right.headingsPerThousand],
    [left.listItemsPerThousand, right.listItemsPerThousand],
    [left.tablesPerThousand, right.tablesPerThousand],
  ];
  const comparable = counts.filter(([a, b]) => a !== null && b !== null);
  return {
    theirs: left,
    yours: right,
    behindOnAll: !left.pages || !right.pages || !comparable.length
      ? null
      : comparable.every(([a, b]) => (a as number) > (b as number)),
    effect: SHAPE_EFFECT,
    caveat: SHAPE_CAVEAT,
  };
}
