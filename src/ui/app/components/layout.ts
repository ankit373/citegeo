import { html, join } from "../dom.js";

// The frame every page sits in. One bar, one right pane and one footer, so a
// page writes its own content and nothing else.

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

/** The one frame every page renders into, so no page can draw its own. */
export function shell(input: { before: string; appbar: string; content: string; footer: string }): string {
  return join([
    input.before,
    '<div class="shell">',
    input.appbar,
    '<main class="workspace">',
    `<section class="content">${input.content}</section>`,
    input.footer,
    "</main></div>",
  ]);
}
