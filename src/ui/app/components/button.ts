import { html, join } from "../dom.js";

// One button. Every other one in the product was a separate class that drifted
// into a different height, radius or hover, which is how a filter ended up
// forty pixels tall beside a thirty-four pixel select.

export type ButtonKind =
  /** The one thing this screen is for. At most one per view. */
  | "primary"
  /** Everything else that is a real action. */
  | "secondary"
  /** Small, inside a card header or a row. */
  | "quiet"
  /** Reads as text, behaves as a button. For an action inside a sentence. */
  | "link"
  /** Square, holds one glyph, needs a label for anyone not seeing it. */
  | "icon";

/** Sizes are a property of the one button, not a reason for a second one.
 * Geometry is the only thing that changes; weight and colour come from kind. */
export type ButtonSize = "sm" | "md";

/** Intent, which is separate from prominence: a quiet button and a primary one
 * can both be destructive, and neither becomes a red fill for it. */
export type ButtonTone = "danger";

export interface ButtonInput {
  label: string;
  kind?: ButtonKind;
  size?: ButtonSize;
  tone?: ButtonTone;
  /** Data attributes the delegated handlers read, without the brackets. */
  on?: Record<string, string | boolean>;
  disabled?: boolean;
  /** Submits the form it sits in, rather than waiting for a click handler. */
  submit?: boolean;
  /** Renders an anchor instead, for a download or an external page. */
  href?: string;
  download?: boolean;
  /** For an icon button, where the glyph says nothing to a screen reader. */
  ariaLabel?: string;
  pressed?: boolean;
  id?: string;
  testId?: string;
  /** Escaped by default. Only set when the label is markup the caller built. */
  raw?: boolean;
  title?: string;
}

const KIND: Record<ButtonKind, string> = {
  primary: "btn btn-primary",
  secondary: "btn",
  quiet: "btn btn-quiet",
  link: "linklike",
  icon: "btn btn-icon",
};

const SIZE: Record<ButtonSize, string> = { sm: "btn-sm", md: "" };

/** A link carries its own geometry, so a size on it would fight it. */
function classFor(input: ButtonInput): string {
  const kind = input.kind || "secondary";
  const base = KIND[kind];
  if (kind === "link") return base;
  const step = SIZE[input.size || (kind === "quiet" ? "sm" : "md")];
  return [base, step, input.tone === "danger" ? "btn-danger" : ""].filter(Boolean).join(" ");
}

function attributes(input: ButtonInput): string {
  const parts: string[] = [];
  for (const [name, value] of Object.entries(input.on || {})) {
    if (value === false) continue;
    parts.push(value === true ? ` ${name}` : ` ${name}="${html(value)}"`);
  }
  if (input.id) parts.push(` id="${html(input.id)}"`);
  if (input.testId) parts.push(` data-testid="${html(input.testId)}"`);
  if (input.ariaLabel) parts.push(` aria-label="${html(input.ariaLabel)}"`);
  if (input.title) parts.push(` title="${html(input.title)}"`);
  if (input.pressed !== undefined) parts.push(` aria-pressed="${input.pressed}"`);
  return parts.join("");
}

export function button(input: ButtonInput): string {
  const className = classFor(input);
  const label = input.raw ? input.label : html(input.label);
  if (input.href) {
    // An anchor for anything that navigates or downloads, so the middle click
    // and the context menu work the way they do everywhere else.
    return join([
      `<a class="${className}" href="${html(input.href)}"`,
      input.download ? " download" : "",
      attributes(input),
      `>${label}</a>`,
    ]);
  }
  return join([
    `<button type="${input.submit ? "submit" : "button"}" class="${className}"`,
    input.disabled ? " disabled" : "",
    attributes(input),
    `>${label}</button>`,
  ]);
}

/** A row of them, evenly spaced and all the same height. */
export function buttons(rows: Array<string | false | null | undefined>): string {
  return `<div class="inline-actions">${join(rows)}</div>`;
}
