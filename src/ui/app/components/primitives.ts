import { html, join } from "../dom.js";

// The pieces every page is built from. A page that needs a new shape adds one
// here rather than writing markup inline, which is how six table layouts that
// were meant to be one came about.

export type Tone = "" | "good" | "bad" | "flat" | "warning" | "ready";

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

export function tiles(rows: TileInput[]): string {
  return `<div class="dtiles">${rows.map((row) => join([
    '<div class="dtile"><span>', html(row.label), "</span>",
    `<strong class="${html(row.tone || "")}">`, html(row.value), "</strong>",
    "<small>", html(row.note), "</small>",
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
}

export function section(input: SectionInput): string {
  return join([
    '<section class="section-card"><div class="section-head"><div class="headmain">',
    `<h2>${html(input.title)}</h2>`,
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
