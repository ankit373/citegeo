import test from "node:test";
import assert from "node:assert/strict";
import { GRID_COLUMNS, mappable, placementFor, regionMap, unmappable, type RegionCell } from "../src/ui/app/pages/region-map.js";
import { REGIONS, REGION_CAVEAT } from "../src/product/topics/region.js";

function cell(regionId: string, score: number | null, rank: number | null = 1, answers = 10): RegionCell {
  return { regionId, label: regionId.toUpperCase(), score, rank, answers };
}

test("no stated market is never placed on the map", () => {
  // It has no geography. Putting it anywhere would say the answer came from
  // somewhere, which is the one thing this grid must not claim.
  assert.equal(placementFor("global"), null);
  const cells = [cell("global", 70), cell("in", 60)];
  assert.deepEqual(mappable(cells).map((row) => row.regionId), ["in"]);
  assert.deepEqual(unmappable(cells).map((row) => row.regionId), ["global"]);
});

test("every real market has a place, so none is silently dropped", () => {
  for (const region of REGIONS) {
    if (region.id === "global") continue;
    assert.ok(placementFor(region.id), `${region.id} has no placement and would vanish from the grid`);
  }
});

test("no two markets share a square", () => {
  const seen = new Set<string>();
  for (const region of REGIONS) {
    const at = placementFor(region.id);
    if (!at) continue;
    const key = `${at.col}:${at.row}`;
    assert.equal(seen.has(key), false, `${region.id} overlaps another market at ${key}`);
    seen.add(key);
  }
});

test("every placement sits inside the grid it declares", () => {
  for (const region of REGIONS) {
    const at = placementFor(region.id);
    if (!at) continue;
    assert.ok(at.col >= 1 && at.col <= GRID_COLUMNS, `${region.id} sits outside the columns`);
  }
});

test("the caveat travels with the grid, because a map implies a place", () => {
  const drawn = regionMap([cell("in", 60)], REGION_CAVEAT);
  assert.ok(drawn.includes("stated to the model"));
});

test("a market nobody was named in reads as not named, not as nought", () => {
  const drawn = regionMap([cell("in", null)], REGION_CAVEAT);
  assert.ok(drawn.includes("Not named"));
  assert.equal(drawn.includes(">0<"), false);
});

test("no stated market still reports its figure, off the grid", () => {
  const drawn = regionMap([cell("in", 60), cell("global", 44)], REGION_CAVEAT);
  assert.ok(drawn.includes("rloose"));
  assert.ok(drawn.includes("GLOBAL"));
});

test("nothing stated anywhere says so rather than drawing an empty grid", () => {
  const drawn = regionMap([cell("global", 44)], REGION_CAVEAT);
  assert.ok(drawn.includes("No run has stated a market yet"));
});

test("an unknown market is left off rather than guessed at", () => {
  assert.equal(placementFor("zz"), null);
  assert.deepEqual(mappable([cell("zz", 50)]).length, 0);
});
