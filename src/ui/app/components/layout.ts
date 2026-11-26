import { html, join } from "../dom.js";
import { loading, skeletonCard, skeletonTiles } from "./skeleton.js";
import { DESTINATIONS } from "./nav.js";

// The frame every page sits in. One header, one left pane, one right pane and
// one footer, so a page writes its own content and nothing else.

export interface NavItem {
  page: string;
  label: string;
  /** A numbered step in a sequence, where the order is the instruction. */
  step?: string;
  /** Pages that should also light this item up. */
  alsoActive?: string[];
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export function sidebar(input: {
  brand: string;
  projectOptions: string;
  groups: NavGroup[];
  page: string;
  footer: string;
}): string {
  const item = (row: NavItem): string => {
    const active = row.page === input.page || (row.alsoActive || []).includes(input.page);
    return join([
      `<button type="button" class="nav-item${active ? " active" : ""}" data-page="${html(row.page)}"`,
      active ? ' aria-current="page"' : "",
      ">",
      row.step ? `<span class="nav-step">${html(row.step)}</span>` : "",
      `<span>${html(row.label)}</span>`,
      "</button>",
    ]);
  };
  return join([
    '<aside class="sidebar">',
    `<button type="button" class="brand" data-page="dashboard" aria-label="Back to the dashboard">${input.brand}</button>`,
    '<div class="project-label">Project</div>',
    '<select id="project-select" class="project-select" aria-label="Switch project" data-testid="project-select">',
    input.projectOptions,
    "</select>",
    '<nav class="nav" aria-label="Project navigation">',
    input.groups.map((group) => join([
      group.label ? `<div class="nav-label">${html(group.label)}</div>` : "",
      group.items.map(item).join(""),
    ])).join(""),
    "</nav>",
    `<div class="sidebar-bottom">${input.footer}</div>`,
    "</aside>",
  ]);
}

export function header(input: { product: string; project: string; actions: string }): string {
  return join([
    '<header class="topbar">',
    '<div class="crumb">',
    `<button type="button" class="crumb-home" data-page="dashboard">${html(input.product)}</button>`,
    ` / <span>${html(input.project)}</span>`,
    "</div>",
    `<div class="topbar-actions">${input.actions}</div>`,
    "</header>",
  ]);
}

export function footer(input: { left: string; right: string }): string {
  return `<footer class="appfoot"><span>${input.left}</span><span>${input.right}</span></footer>`;
}

/** The right pane. Closed is still rendered, so opening it is a transition
 * rather than an element appearing from nowhere. */
export function panel(input: { open: boolean; title?: string; blurb?: string; actions?: string; body?: string; label?: string }): string {
  if (!input.open) return '<div class="panel-scrim" data-close-panel></div><aside class="panel" aria-hidden="true"></aside>';
  return join([
    '<div class="panel-scrim" data-close-panel></div>',
    `<aside class="panel" role="dialog" aria-label="${html(input.label || input.title || "Details")}">`,
    '<div class="panel-head"><div class="headmain">',
    `<h2>${html(input.title || "")}</h2>`,
    input.blurb ? `<p class="subtle">${html(input.blurb)}</p>` : "",
    "</div>",
    '<div class="panel-actions">',
    input.actions || "",
    '<button type="button" class="close" data-close-panel aria-label="Close">×</button>',
    "</div></div>",
    `<div class="panel-body">${input.body || ""}</div>`,
    "</aside>",
  ]);
}

export function shell(input: { panel: string; sidebar: string; header: string; content: string; footer: string }): string {
  return join([
    input.panel,
    '<div class="shell">',
    input.sidebar,
    '<main class="workspace">',
    input.header,
    `<section class="content">${input.content}</section>`,
    input.footer,
    "</main></div>",
  ]);
}

// The report has its own module, but it is a page in this shell like any
// other, so the rail it used to draw for itself cannot come back.
export function renderReport(tabs: string): string {
  const module = (window as any).__citegeoPhase4;
  if (module && typeof module.body === "function") return String(module.body());
  return '<section class="view"><div class="heading"><div><h1>Current report</h1><p class="subtle">Built from the stored evidence of a finished run.</p></div></div>' + tabs + '<div class="empty"><div class="empty-copy"><h2>The report is still loading</h2><p class="subtle">Nothing has been asked of any model.</p></div></div></section>';
}

/** The first paint, before any read has landed. The page's own name is
 * known without asking, so only the figures and the table are shadows. */
export function bootShape(page: string, productName: string): string {
  return '<section class="view"><div class="heading"><div><h1>' + html(DESTINATIONS.find((row) => row.page === page || (row.also || []).includes(page))?.label || productName) + '</h1></div></div>'
    + loading("this page", skeletonTiles(4) + skeletonCard({ rows: 5 })) + '</section>';
}
