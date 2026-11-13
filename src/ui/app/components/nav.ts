import { html } from "../dom.js";
import { APP_PAGES, routeHash, SECTIONS, type Section, sectionFor } from "../routes.js";

// The bar every page sits under: the wordmark, five tabs, the project and the
// theme. Each destination is a link, so it can be opened in a tab or copied.

export interface AppbarInput {
  page: string;
  projectId: string;
  /** The project switcher's options, already escaped. */
  projectOptions: string;
  lockup: string;
  demo: boolean;
  dark: boolean;
  /** Controls that act rather than go somewhere, such as New project. */
  actions: string;
}

/** Made-up projects carry this prefix, so their figures are labelled as such. */
export function isDemoProject(projectId: string): boolean {
  return projectId.startsWith("demo-");
}

function link(section: Section, input: AppbarInput, current: Section | null): string {
  const target = routeHash(section.page, input.projectId);
  const kind = section.tab ? "appnav-tab" : "appmore-item";
  const where = target ? `href="${html(target)}"` : 'aria-disabled="true"';
  const here = current === section ? ' aria-current="page"' : "";
  return `<a class="${kind}" ${where} data-route="${html(section.slug)}"${here}>${html(section.label)}</a>`;
}

export function appbar(input: AppbarInput): string {
  const current = sectionFor(input.page);
  const more = SECTIONS.concat(APP_PAGES).filter((row) => row.menu);
  return (
    '<header class="appbar">' +
    '<a class="appbar-lockup" href="' +
    html(routeHash("dashboard", input.projectId) || "#/projects") +
    '" aria-label="Back to the overview">' +
    input.lockup +
    "</a>" +
    '<nav class="appnav" aria-label="Sections">' +
    SECTIONS.filter((row) => row.tab)
      .map((row) => link(row, input, current))
      .join("") +
    "</nav>" +
    '<div class="appbar-project">' +
    '<select id="project-select" class="appbar-select" aria-label="Switch project" data-testid="project-select">' +
    input.projectOptions +
    "</select>" +
    (input.demo ? '<span class="demo-badge">Demo data</span>' : "") +
    "</div>" +
    '<details class="appmore"><summary>More</summary><div class="appmore-list">' +
    more.map((row) => link(row, input, current)).join("") +
    '<a class="appmore-item" href="?view=measurements">Continuous measurement</a>' +
    "</div></details>" +
    input.actions +
    '<button type="button" class="appbar-theme" data-theme-toggle aria-label="Switch between light and dark">' +
    (input.dark ? "Light" : "Dark") +
    "</button>" +
    "</header>"
  );
}
