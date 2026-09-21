import { html, join } from "../dom.js";

// A loader is a shadow of the thing arriving. A spinner in the middle of an
// empty card tells the reader nothing about what is coming or how much of it,
// and the layout jumps when it lands.

export interface SkeletonOptions {
  /** Rows the real thing will have, so the space it takes is already held. */
  rows?: number;
  /** Column widths as CSS track sizes, matching the table being waited on. */
  columns?: string;
}

function line(width: string): string {
  return `<span class="sk-line" style="width:${html(width)}"></span>`;
}

/** A table's shadow: the same grid, the same number of rows. */
export function skeletonTable(options: SkeletonOptions = {}): string {
  const rows = options.rows || 4;
  const columns = options.columns || "minmax(0,1fr) 96px 82px";
  const cells = columns.split(" ").length;
  const row = `<div class="sk-row" style="grid-template-columns:${html(columns)}">`
    + Array.from({ length: cells }, (unused, index) => line(index === 0 ? "70%" : "58%")).join("")
    + "</div>";
  return `<div class="sk" aria-hidden="true">${row.repeat(rows)}</div>`;
}

/** A tile strip's shadow, one block per tile the caller expects. */
export function skeletonTiles(tiles = 4): string {
  return `<div class="sk-tilerow" aria-hidden="true">`
    + Array.from({ length: tiles }, () => `<div class="sk-tile">${line("52%")}${line("38%")}${line("76%")}</div>`).join("")
    + "</div>";
}

/** Prose's shadow: a heading and a few lines of varying length. */
export function skeletonText(lines = 3): string {
  const widths = ["92%", "84%", "66%", "78%", "58%"];
  return `<div class="sk" aria-hidden="true">`
    + Array.from({ length: lines }, (unused, index) => line(widths[index % widths.length] || "80%")).join("")
    + "</div>";
}

/** A card's shadow, head and body together, for a whole section. */
export function skeletonCard(options: SkeletonOptions = {}): string {
  return join([
    '<div class="sk-head" aria-hidden="true">',
    line("34%"),
    line("62%"),
    "</div>",
    skeletonTable(options),
  ]);
}

/** Stated for a screen reader, because the visual shadow says nothing to one. */
export function loading(what: string, shadow: string): string {
  return `<div class="sk-wrap" role="status" aria-live="polite"><span class="visually-hidden">Loading ${html(what)}</span>${shadow}</div>`;
}
