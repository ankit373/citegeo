import { html } from "../dom.js";
import { button } from "../components/button.js";
import { archived, formatTime } from "../format.js";
import type { LoadState, ProjectRow } from "../types.js";

export interface ProjectList {
  mode: string;
  projects: ProjectRow[];
  selectedId: string;
}

/** The part of the app state the overview reads, so the state itself fits. */
export interface OverviewState extends ProjectList {
  selections: unknown[];
  recognitionRuns: unknown[];
}

export interface FooterInput {
  homeState: LoadState;
  selectedId: string;
  home: { answers?: unknown; lastRun?: { at: unknown } | null } | null | undefined;
}

export interface FooterActions {
  loadHome(): void;
}

const statusText = (status: string) => status === "draft" ? "Draft" : status === "active" ? "Running" : status === "archived" ? "Archived" : "Deleted";

export function projectsForMode(mode: string, projects: ProjectRow[]): ProjectRow[] {
  if (mode === "archived") return projects.filter((item) => item.status === "archived");
  if (mode === "deleted") return projects.filter((item) => item.status === "deleted");
  return projects.filter((item) => item.status === "draft" || item.status === "active");
}

export function cardActions(mode: string, item: { id: string }): string {
  if (mode === "archived") return '<div class="card-actions">' + button({ label: "Restore project", kind: "quiet", on: { "data-project-action": "restore", "data-project-id": item.id } }) + '</div>';
  if (mode === "deleted") {
    return '<div class="card-actions">'
      + button({ label: "Restore project", kind: "quiet", on: { "data-project-action": "restore", "data-project-id": item.id } })
      + button({ label: "Purge permanently", kind: "quiet", tone: "danger", on: { "data-project-action": "purge", "data-project-id": item.id } }) + '</div>';
  }
  return '<div class="card-actions">'
    + button({ label: "Archive", kind: "quiet", on: { "data-project-action": "archive", "data-project-id": item.id } })
    + button({ label: "Delete", kind: "quiet", tone: "danger", on: { "data-project-action": "delete", "data-project-id": item.id } }) + '</div>';
}

export function renderProjectCards(list: ProjectList): string {
  const rows = projectsForMode(list.mode, list.projects);
  if (rows.length === 0) {
    const title = list.mode === "current" ? "No projects yet" : list.mode === "archived" ? "No archived projects" : "No recently deleted projects";
    const copy = list.mode === "current" ? "Once you enter a domain, the project is saved as a draft immediately." : "Project lifecycle records are kept here.";
    return '<div class="empty"><div class="empty-copy" data-testid="empty-state"><h2>' + title + '</h2><p class="subtle">' + copy + '</p>'
      + (list.mode === "current" ? button({ label: "New project", kind: "primary", id: "empty-new-project" }) : '') + '</div></div>';
  }
  return '<div class="mtable" data-testid="project-list"><div class="mhead mcols-project"><span>Project</span><span>Domain</span><span>Status</span><span>Updated</span><span></span></div>'
    + rows.map((item) => '<div class="mrow mcols-project ' + (item.id === list.selectedId ? "is-selected" : "") + '" data-testid="project-card" data-project-id="' + html(item.id)
      + '"><button type="button" class="rowlink" data-project-action="select" data-project-id="' + html(item.id) + '" data-testid="project-title">' + html(item.name)
      + '</button><span class="mcell mono" data-testid="project-domain">' + html(item.normalizedDomain)
      + '</span><span class="tag ' + html(item.status) + '">' + statusText(item.status)
      + '</span><span class="mcell mono">' + html(formatTime(item.updatedAt as string)) + '</span>' + cardActions(list.mode, item) + '</div>').join("")
    + '</div>';
}

export function renderNextSteps(models: number, runs: number, currentVersion: unknown): string {
  const saved = Boolean(currentVersion);
  const steps = [
    { label: "Choose models and save them as a configuration", done: models > 0 && saved, note: models ? models + " selected" + (saved ? ", saved v" + String(currentVersion) : ", not saved") : "None yet", page: "models", action: "Choose models" },
    { label: "Run a domain recognition test", done: runs > 0, note: runs ? runs + " run" + (runs === 1 ? "" : "s") : "Not run yet", page: "recognition", action: "Run test" },
    { label: "Read the results", done: runs > 0, note: runs ? "Ready" : "Waiting on a run", page: "reports", action: "Open results" },
  ];
  const next = steps.findIndex((step) => !step.done);
  const rows = steps.map((step, index) => {
    const state_ = step.done ? "done" : index === next ? "next" : "todo";
    const mark = step.done ? "Done" : index === next ? "Do this next" : "Later";
    const stepAction = index === next ? button({ label: step.action, kind: "primary", on: { "data-page": step.page } }) : "";
    return '<li class="step" data-state="' + state_ + '"><span class="step-index">' + (index + 1) + '</span><span class="step-label">' + html(step.label) + '</span><span class="step-note">' + html(step.note) + '</span><span class="step-mark">' + mark + '</span><span class="step-action">' + stepAction + '</span></li>';
  }).join("");
  return '<section class="section-card"><div class="section-head"><div><h2>Getting a result</h2><p class="subtle">Three steps, in order. Each one unlocks the next.</p></div></div><ol class="steps">' + rows + '</ol></section>';
}

/** `currentVersion` is the saved configuration's version, or nothing when none is saved. */
export function renderOverview(input: OverviewState, selected: ProjectRow | null, currentVersion: unknown): string {
  if (!selected) {
    return '<section class="view"><div class="heading"><div><h1>Project</h1><p class="subtle">Create a project before configuring AI models and monitoring.</p></div></div>' + renderProjectCards(input) + '</section>';
  }
  const mode = input.mode;
  return '<section class="view"><div class="heading"><div><h1>Project overview</h1><p class="subtle">A project is bound to one domain. Save models and web search modes as the fixed configuration for later monitoring.</p></div></div>'
    + '<div class="toolbar"><button type="button" class="filter ' + (mode === "current" ? "active" : "") + '" data-list-mode="current">Current</button>'
    + '<button type="button" class="filter ' + (mode === "archived" ? "active" : "") + '" data-list-mode="archived">Archived</button>'
    + '<button type="button" class="filter ' + (mode === "deleted" ? "active" : "") + '" data-list-mode="deleted">Recently deleted</button></div>'
    + renderNextSteps(input.selections.length, input.recognitionRuns.length, currentVersion) + renderProjectCards(input)
    + '<section class="detail"><div class="card-header"><div><h2 data-testid="selected-project-title">' + html(selected.name) + '</h2><p class="subtle">The saved record for this project.</p></div></div>'
    + '<div class="detail-grid"><div class="detail-cell"><span>Primary domain</span><strong class="mono" data-testid="selected-project-domain">' + html(selected.normalizedDomain) + '</strong></div>'
    + '<div class="detail-cell"><span>Selected models</span><strong>' + input.selections.length + '</strong></div>'
    + '<div class="detail-cell"><span>Current version</span><strong>' + html(currentVersion ? "v" + String(currentVersion) : "Not saved yet") + '</strong></div>'
    + '<div class="detail-cell"><span>Project ID</span><strong data-testid="selected-project-id">' + html(selected.id) + '</strong></div></div>'
    + '<form id="project-edit-form" class="form"><h3 class="form-title">Edit this project</h3>'
    + '<div class="field"><label for="edit-domain">Primary domain</label><input id="edit-domain" value="' + html(selected.primaryDomain) + '"></div>'
    + '<div class="field"><label for="edit-name">Project name</label><input id="edit-name" value="' + html(selected.name) + '"></div>'
    + '<div class="actions">' + button({ label: "Save project", kind: "primary", submit: true, testId: "save-project" }) + button({ label: "Archive", id: "archive-project", testId: "archive-project" })
    + button({ label: "Delete project", tone: "danger", id: "delete-project", testId: "delete-project" }) + '</div></form></section></section>';
}

// Says what the page is built from and when, so a tab left open overnight
// is recognisable as stale rather than read as current.
export function renderFooter(input: FooterInput, actions: FooterActions): string {
  // Every page carries the footer, and most never asked for the summary it reads.
  if (input.homeState === "idle" && input.selectedId) { actions.loadHome(); }
  const home = input.home;
  const answers = home && typeof home.answers === "number" ? home.answers : null;
  const run = home && home.lastRun ? String(home.lastRun.at) : "";
  return '<footer class="appfoot">'
    + '<span>' + html(archived(input.homeState, answers))
    + (run ? ' · last run ' + html(run.slice(0, 16).replace("T", " ")) : '') + '</span>'
    + '<span>Every figure here opens the answer it came from.</span></footer>';
}
