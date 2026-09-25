import { html, join } from "../dom.js";
import { percent, rank as rankText, score as scoreText } from "../format.js";

// A map implies a place the answer was served. These are answers given to
// someone described as being in a market, so the caveat travels with the grid.

export interface RegionCell {
  regionId: string;
  label: string;
  score: number | null;
  rank: number | null;
  answers: number;
}

/** Roughly geographic, on a grid, because nine markets do not need a world. */
const PLACEMENT: Record<string, { col: number; row: number }> = {
  ca: { col: 1, row: 1 },
  gb: { col: 3, row: 1 },
  de: { col: 4, row: 1 },
  us: { col: 1, row: 2 },
  ae: { col: 5, row: 2 },
  in: { col: 6, row: 2 },
  sg: { col: 7, row: 3 },
  br: { col: 2, row: 3 },
  au: { col: 7, row: 4 },
};

export const GRID_COLUMNS = 7;
export const GRID_ROWS = 4;

export function placementFor(regionId: string): { col: number; row: number } | null {
  return PLACEMENT[regionId] ?? null;
}

/** No stated market has no place on a map, so it is never given one. */
export function mappable(cells: RegionCell[]): RegionCell[] {
  return cells.filter((cell) => placementFor(cell.regionId) !== null);
}

export function unmappable(cells: RegionCell[]): RegionCell[] {
  return cells.filter((cell) => placementFor(cell.regionId) === null);
}

function tone(score: number | null): string {
  if (score === null) return "";
  const mix = Math.round(12 + Math.min(100, Math.max(0, score)) * 0.6);
  return ` style="background:color-mix(in oklab, var(--accent) ${mix}%, transparent)"`;
}

function tile(cell: RegionCell): string {
  const at = placementFor(cell.regionId);
  if (!at) return "";
  const place = ` style="grid-column:${at.col};grid-row:${at.row}"`;
  return join([
    `<div class="rtile${cell.score === null ? " is-empty" : ""}"${place}`,
    ` title="${html(cell.label)}: ${cell.answers} answer(s)">`,
    `<span class="rtile-fill"${tone(cell.score)}></span>`,
    `<span class="rtile-id">${html(cell.regionId.toUpperCase())}</span>`,
    `<span class="rtile-score">${cell.score === null ? "Not named" : scoreText(cell.score)}</span>`,
    "</div>",
  ]);
}

export function regionMap(cells: RegionCell[], caveat: string): string {
  const placed = mappable(cells);
  if (!placed.length) {
    return '<p class="subtle">No run has stated a market yet, so there is nothing to place.</p>';
  }
  const aside = unmappable(cells).map((cell) => join([
    '<li class="rloose">',
    `<span>${html(cell.label)}</span>`,
    `<strong>${cell.score === null ? "Not named" : scoreText(cell.score)}</strong>`,
    `<span class="subtle">${rankText(cell.rank)} · ${cell.answers} answer(s)</span>`,
    "</li>",
  ])).join("");
  return join([
    `<div class="rgrid" style="grid-template-columns:repeat(${GRID_COLUMNS},1fr);grid-template-rows:repeat(${GRID_ROWS},1fr)">`,
    placed.map(tile).join(""),
    "</div>",
    aside ? `<ul class="rloose-list">${aside}</ul>` : "",
    `<p class="subtle rcaveat">${html(caveat)}</p>`,
  ]);
}

export { percent };
