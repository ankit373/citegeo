// Where the reader is, written into the address. A hash route, because the
// server answers only "/" with the app and the hash never reaches it.

export interface Section {
  slug: string;
  page: string;
  label: string;
  /** One of the five tabs in the bar. */
  tab?: boolean;
  /** Listed under More. The rest are reached from inside another page. */
  menu?: boolean;
  /** Pages reached from inside this one, so its tab stays marked there. */
  also?: string[];
}

export const SECTIONS: Section[] = [
  { slug: "overview", page: "dashboard", label: "Overview", tab: true },
  { slug: "questions", page: "prompts", label: "Questions", tab: true },
  { slug: "rivals", page: "brand-visibility", label: "Rivals", tab: true },
  { slug: "sources", page: "answer-engine", label: "Sources", tab: true },
  {
    slug: "runs",
    page: "recognition",
    label: "Runs",
    tab: true,
    also: ["models", "reports", "configuration"],
  },
  { slug: "trust", page: "trust", label: "Trust", menu: true },
  {
    slug: "act",
    page: "marketer",
    label: "Act",
    menu: true,
    also: ["drafts", "claims", "buying", "conversations", "entity"],
  },
  { slug: "models", page: "models", label: "Models and surfaces", menu: true },
  { slug: "report", page: "reports", label: "Current report" },
  { slug: "configuration", page: "configuration", label: "Configuration" },
  { slug: "drafts", page: "drafts", label: "Drafts" },
  { slug: "claims", page: "claims", label: "Claims" },
  { slug: "buying", page: "buying", label: "Buying" },
  { slug: "conversations", page: "conversations", label: "Conversations" },
  { slug: "entity", page: "entity", label: "Entity" },
  { slug: "visibility", page: "visibility", label: "Visibility" },
];

/** Pages that are not about one project, so their address names none. */
export const APP_PAGES: Section[] = [
  { slug: "projects", page: "overview", label: "Projects", menu: true },
  { slug: "setup", page: "setup", label: "Setup", menu: true },
];

export const NOT_FOUND = "not-found";

export type Route =
  | { kind: "page"; page: string; projectId: string }
  | { kind: "none" }
  | { kind: "not-found"; path: string };

function segments(path: string): string[] | null {
  try {
    return path
      .split("/")
      .filter(Boolean)
      .map((part) => decodeURIComponent(part));
  } catch (_error) {
    return null;
  }
}

/** An empty hash is not an error: it is a first visit or an old link. */
export function parseRoute(hash: string): Route {
  const path = hash.startsWith("#") ? hash.slice(1) : hash;
  const found = segments(path);
  if (!found) return { kind: "not-found", path };
  if (found.length === 0) return { kind: "none" };
  const [first = "", id = "", slug = "overview", ...rest] = found;
  if (found.length === 1) {
    const page = APP_PAGES.find((row) => row.slug === first);
    return page
      ? { kind: "page", page: page.page, projectId: "" }
      : { kind: "not-found", path };
  }
  if (first !== "projects" || rest.length) return { kind: "not-found", path };
  const section = SECTIONS.find((row) => row.slug === slug);
  return section
    ? { kind: "page", page: section.page, projectId: id }
    : { kind: "not-found", path };
}

/** The address for a page, or null when it has none: a project page with no
 * project chosen, or the not-found state, which keeps the address it was given. */
export function routeHash(page: string, projectId: string): string | null {
  const app = APP_PAGES.find((row) => row.page === page);
  if (app) return `#/${app.slug}`;
  const section = SECTIONS.find((row) => row.page === page);
  if (!section || !projectId) return null;
  return `#/projects/${encodeURIComponent(projectId)}/${section.slug}`;
}

/** The section a page belongs to, for marking the tab and naming the page. */
export function sectionFor(page: string): Section | null {
  return (
    SECTIONS.find(
      (row) => row.page === page || (row.also || []).includes(page),
    ) ||
    APP_PAGES.find((row) => row.page === page) ||
    null
  );
}

export interface AddressBar {
  hash(): string;
  push(hash: string): void;
  replace(hash: string): void;
}

/** Writes the address after each render. The first write replaces, so Back
 * does not return to the same page without its address. */
export function addressWriter(bar: AddressBar): (hash: string | null) => void {
  let first = true;
  return (hash) => {
    if (hash === null) return;
    const replace = first;
    first = false;
    if (hash === bar.hash()) return;
    if (replace) bar.replace(hash);
    else bar.push(hash);
  };
}
