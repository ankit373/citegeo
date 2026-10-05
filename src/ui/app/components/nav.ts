import { button } from "./button.js";

// The rail is a column on a desktop and a drawer on a phone. One toggle drives
// both, because two closed states is how a phone ends up with no way back.

const PHONE = "(max-width: 840px)";
const REMEMBERED = "citegeo.nav";

const MENU_GLYPH =
  '<svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true" focusable="false">' +
  '<path d="M1.5 3.5h12M1.5 7.5h12M1.5 11.5h12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

function phone(): boolean {
  return window.matchMedia(PHONE).matches;
}

function open(): boolean {
  const body = document.body;
  return phone() ? body.classList.contains("nav-open") : !body.classList.contains("nav-closed");
}

/** Rendered into the topbar, so it survives the app replacing its own markup. */
export function navToggle(): string {
  return button({
    label: MENU_GLYPH,
    raw: true,
    kind: "icon",
    ariaLabel: "Show or hide the navigation",
    on: { "data-nav-toggle": true, "aria-expanded": open() ? "true" : "false" },
  });
}

/** Covers the page behind the drawer, and closes it when clicked. */
export function navScrim(): string {
  return '<div class="nav-scrim" data-nav-close></div>';
}

function element(target: EventTarget | null): Element | null {
  return target instanceof Element ? target : null;
}

function set(isOpen: boolean): void {
  const body = document.body;
  if (phone()) {
    body.classList.toggle("nav-open", isOpen);
  } else {
    body.classList.toggle("nav-closed", !isOpen);
    // Only the desktop choice is worth remembering: a drawer left open on a
    // phone would cover the page on the next visit.
    try {
      localStorage.setItem(REMEMBERED, isOpen ? "open" : "closed");
    } catch (error) {
      /* the choice just will not persist */
    }
  }
  const control = document.querySelector("[data-nav-toggle]");
  if (control) control.setAttribute("aria-expanded", isOpen ? "true" : "false");
}

export function wireNav(): void {
  try {
    if (localStorage.getItem(REMEMBERED) === "closed") document.body.classList.add("nav-closed");
  } catch (error) {
    /* no stored preference is the same as the default */
  }

  document.addEventListener("click", (event) => {
    const node = element(event.target);
    if (!node) return;
    if (node.closest("[data-nav-toggle]")) {
      set(!open());
      return;
    }
    // The scrim, or any destination: choosing one on a phone should reveal it.
    if (node.closest("[data-nav-close]") || (phone() && node.closest(".sidebar [data-page]"))) {
      document.body.classList.remove("nav-open");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") document.body.classList.remove("nav-open");
  });

  // Crossing the breakpoint with the drawer open would leave it stuck open.
  window.matchMedia(PHONE).addEventListener("change", () => {
    document.body.classList.remove("nav-open");
  });
}

export interface Destination {
  page: string;
  label: string;
  /** What this page answers, shown on the page itself rather than here. */
  question: string;
  /** Pages that are really this one under another name, so the rail still
   * marks the destination when a reader lands on one of them. */
  also?: string[];
}

// Six destinations, each answering one question, after a rail of fifteen items
// in five groups where "Scores", "Visibility" and "Brand visibility" were three
// names for two pages and the same panel rendered on both of them.
export const DESTINATIONS: Destination[] = [
  { page: "dashboard", label: "Today", question: "What is the reading, and what is holding it back" },
  { page: "prompts", label: "Questions", question: "What buyers ask, and who wins each one" },
  { page: "brand-visibility", label: "Rivals", question: "Who gets named instead of you" },
  { page: "answer-engine", label: "Sources", question: "What gets cited, and whether the answer used it" },
  { page: "trust", label: "Trust", question: "Whether any of this can be relied on" },
  { page: "marketer", label: "Act", question: "What to do about it", also: ["drafts", "claims", "buying", "conversations", "entity"] },
];

const MACHINE: Destination[] = [
  { page: "models", label: "Models and surfaces", question: "", also: ["recognition", "reports"] },
  { page: "overview", label: "Projects", question: "", also: ["configuration"] },
  { page: "setup", label: "Setup", question: "" },
];

function item(destination: Destination, page: string): string {
  const here = destination.page === page || (destination.also || []).indexOf(page) >= 0;
  return '<button type="button" class="nav-item' + (here ? " active" : "")
    + '" data-page="' + destination.page + '"' + (here ? ' aria-current="page"' : "")
    + '><span>' + destination.label + "</span></button>";
}

/** The rail, in one place. It used to be written out twice, which is how it
 * grew two names for the same page without anybody noticing. */
export function sidebar(input: { page: string; options: string }): string {
  return '<nav class="nav" aria-label="Project navigation">'
    + DESTINATIONS.map((destination) => item(destination, input.page)).join("")
    + '<div class="nav-label">Machine</div>'
    + MACHINE.map((destination) => item(destination, input.page)).join("")
    + '<a class="nav-item" href="?view=measurements"><span>Continuous measurement</span></a>'
    + "</nav>";
}
