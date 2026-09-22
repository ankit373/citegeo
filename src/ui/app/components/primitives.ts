import { html, join } from "../dom.js";

// The pieces every page is built from. A page that needs a new shape adds one
// here rather than writing markup inline, which is how six table layouts that
// were meant to be one came about.

export type Tone = "" | "good" | "bad" | "flat" | "warning" | "ready";

/** A brand's own mark where the site publishes one, and a monogram where it
 * does not. The mark comes from a crawl, never from a guessed path. */
export function brandIcon(name: string, icon?: string | null, ink?: string): string {
  const letter = (name.trim()[0] || "?").toUpperCase();
  // Deterministic, so a brand keeps its colour between runs and between readers.
  let sum = 0;
  for (let at = 0; at < name.length; at += 1) sum = (sum + name.charCodeAt(at) * (at + 1)) % 360;
  const ring = ink ? ` style="border-color:${ink}"` : "";
  const mark = icon ? `<img src="${html(icon)}" alt="" loading="lazy" decoding="async">` : "";
  return `<span class="bicon"${ring}><i style="background:hsl(${sum} 42% 46%);color:hsl(${sum} 44% 96%)">${html(letter)}</i>${mark}</span>`;
}

export function pill(text: string, tone: Tone = ""): string {
  return `<span class="pill ${tone}">${html(text)}</span>`;
}

export function tag(text: string, tone: Tone = "", title?: string): string {
  return `<span class="tag ${tone}"${title ? ` title="${html(title)}"` : ""}>${html(text)}</span>`;
}

export function bar(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : `<div class="bar"><i style="width:${Math.round(value * 100)}%"></i></div>`;
}

export interface TileInput {
  label: string;
  /** Already formatted. A tile never decides how a figure reads. */
  value: string;
  note: string;
  fraction?: number | null;
  tone?: string;
}

/** One row of figures. The utilities are the styling; there is no .dtile rule
 * behind this any more, so nothing can style it from a distance. */
export function tiles(rows: TileInput[]): string {
  const shell = "grid auto-rows-min gap-1 bg-surface px-[17px] py-[15px]";
  const caption = "text-[10px] font-semibold uppercase tracking-[.09em] text-weak";
  const figure = "font-display text-[26px] font-medium leading-[1.1] tracking-[-0.02em]";
  // The column count follows the tile count. auto-fit left empty cells,
  // and the separator background showed through them as a grey block.
  return `<div class="tilegrid" style="--tile-columns:${rows.length}">${rows.map((row) => join([
    `<div class="${shell}"><span class="${caption}">`, html(row.label), "</span>",
    `<strong class="${figure} ${html(row.tone || "")}">`, html(row.value), "</strong>",
    `<small class="text-xs leading-[1.45] text-weak">`, html(row.note), "</small>",
    bar(row.fraction),
    "</div>",
  ])).join("")}</div>`;
}

export interface TableInput {
  /** A CSS class naming the column layout, declared once in the stylesheet. */
  layout: string;
  columns: string[];
  rows: string[];
  empty?: string;
}

export function table(input: TableInput): string {
  if (!input.rows.length) return `<p class="subtle">${html(input.empty || "Nothing to show.")}</p>`;
  const head = `<div class="mhead ${html(input.layout)}">${input.columns.map((column) => `<span>${html(column)}</span>`).join("")}</div>`;
  return `<div class="mtable">${head}${input.rows.join("")}</div>`;
}

export function row(layout: string, cells: string[], options: { clickable?: boolean; attrs?: string } = {}): string {
  return `<div class="mrow ${html(layout)}${options.clickable ? " is-clickable" : ""}"${options.attrs ? ` ${options.attrs}` : ""}>${cells.join("")}</div>`;
}

export function nameCell(title: string, ...notes: Array<string | false | null | undefined>): string {
  return `<div class="mname"><strong>${title}</strong>${join(notes.map((note) => note ? `<span class="subtle">${note}</span>` : ""))}</div>`;
}

export function cell(content: string, tone = ""): string {
  return `<span class="mcell ${tone}">${content}</span>`;
}

export interface SectionInput {
  title: string;
  blurb?: string;
  aside?: string;
  body: string;
  /** Spans the whole dashboard row. For a table too wide for a card. */
  wide?: boolean;
  /** Stable name for this panel, so a reader can rearrange the dashboard
   * and have the arrangement survive the next render. */
  id?: string;
  /** Panel to open on a click anywhere that is not already a control. */
  open?: string;
  /** Tracks this card spans: 1, 2, or 0 for the whole row. */
  span?: number;
  /** Taken off the board, drawn only while the board is being arranged. */
  off?: boolean;
}

export function section(input: SectionInput): string {
  return join([
    `<section class="section-card${input.wide || input.span === 0 ? " is-wide" : ""}${input.span === 2 ? " is-two" : ""}`
      + `${input.open ? " is-openable" : ""}${input.off ? " is-off" : ""}"`,
    input.id ? ` data-panel="${html(input.id)}" draggable="true"` : "",
    input.open ? ` data-expand-panel="${html(input.open)}"` : "",
    `><div class="section-head"><div class="headmain">`,
    input.open
      ? `<h2><button type="button" class="panel-open" data-expand-panel="${html(input.open)}">${html(input.title)}</button></h2>`
      : `<h2>${html(input.title)}</h2>`,
    input.blurb ? `<p class="subtle">${html(input.blurb)}</p>` : "",
    "</div>",
    input.aside ? `<div class="headaside">${input.aside}</div>` : "",
    "</div>",
    input.body,
    "</section>",
  ]);
}

export function notice(text: string, kind: "error" | "success" | "info" = "info"): string {
  const shell = kind === "error" ? "warning-box" : kind === "success" ? "success-box" : "warning-box";
  return text ? `<div class="${shell}">${html(text)}</div>` : "";
}

export function emptyState(title: string, blurb?: string, action?: string): string {
  return join([
    '<div class="empty"><div class="empty-copy">',
    `<h2>${html(title)}</h2>`,
    blurb ? `<p class="subtle">${html(blurb)}</p>` : "",
    action ? `<div class="inline-actions">${action}</div>` : "",
    "</div></div>",
  ]);
}
