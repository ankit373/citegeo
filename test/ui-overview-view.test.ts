import test from "node:test";
import assert from "node:assert/strict";
import { formatTime } from "../src/ui/app/format.js";
import {
  cardActions, projectsForMode, renderFooter, renderNextSteps, renderOverview, renderProjectCards, type FooterInput, type OverviewState,
} from "../src/ui/app/pages/overview-view.js";
import type { ProjectRow } from "../src/ui/app/types.js";

function has(text: string, ...parts: string[]): void {
  for (const part of parts) assert.ok(text.includes(part), `${JSON.stringify(text)} lacks ${part}`);
}

const project = (id: string, status: string, name = id): ProjectRow => ({ id, name, normalizedDomain: id + ".example", status, updatedAt: "2026-11-24T10:00:00Z" });
const projects = [project("a", "draft"), project("b", "active", "B<"), project("c", "archived"), project("d", "deleted")];
const view = (mode: string, extra: Partial<OverviewState> = {}): OverviewState => ({ mode, projects, selectedId: "b", selections: [], recognitionRuns: [], ...extra });

test("each list mode shows only its own projects", () => {
  assert.deepEqual(projectsForMode("current", projects).map((item) => item.id), ["a", "b"]);
  assert.deepEqual(projectsForMode("archived", projects).map((item) => item.id), ["c"]);
  assert.deepEqual(projectsForMode("deleted", projects).map((item) => item.id), ["d"]);
});

test("card actions offer restore for a kept project and purge only for a deleted one", () => {
  has(cardActions("current", { id: "a" }), "Archive", "Delete");
  has(cardActions("archived", { id: "a" }), "Restore project");
  assert.equal(cardActions("archived", { id: "a" }).includes("Purge"), false);
  has(cardActions("deleted", { id: "a" }), "Restore project", "Purge permanently");
});

test("the project list marks the selection, escapes names and says when it is empty", () => {
  const list = renderProjectCards(view("current"));
  has(list, "is-selected", "B&lt;", "Running", "Draft", formatTime("2026-11-24T10:00:00Z"));
  has(renderProjectCards(view("current", { projects: [] })), "No projects yet", "empty-new-project");
  const none = renderProjectCards(view("deleted", { projects: [] }));
  has(none, "No recently deleted projects");
  assert.equal(none.includes("empty-new-project"), false);
});

test("the next step is the first one not done, and a saved version is named", () => {
  const fresh = renderNextSteps(0, 0, null);
  has(fresh, "None yet", "Not run yet", "Do this next", "Choose models");
  const saved = renderNextSteps(2, 1, 3);
  has(saved, "2 selected, saved v3", "1 run", "Ready");
  has(renderNextSteps(2, 0, null), "2 selected, not saved");
  has(renderNextSteps(0, 2, 1), "2 runs");
});

test("the overview lists projects alone until one is selected", () => {
  const without = renderOverview(view("current"), null, null);
  has(without, "Create a project before configuring");
  assert.equal(without.includes("project-edit-form"), false);
  const withOne = renderOverview(view("archived", { selections: [1, 2] }), project("b", "active", "B<"), 4);
  has(withOne, "B&lt;", "selected-project-id", "<strong>2</strong>", "v4", "data-list-mode=\"archived\"", "project-edit-form");
  has(renderOverview(view("current"), project("b", "active"), null), "Not saved yet");
});

test("the footer asks for the summary once, because loading it leaves the idle state", () => {
  let loads = 0;
  const input: FooterInput = { homeState: "idle", selectedId: "a", home: null };
  const actions = { loadHome: () => { loads += 1; input.homeState = "loading"; } };
  has(renderFooter(input, actions), "Reading the archive");
  renderFooter(input, actions);
  assert.equal(loads, 1);
  const quiet: FooterInput = { homeState: "idle", selectedId: "", home: null };
  renderFooter(quiet, actions);
  renderFooter({ homeState: "ready", selectedId: "a", home: null }, actions);
  assert.equal(loads, 1);
  const done = renderFooter({ homeState: "ready", selectedId: "a", home: { answers: 12, lastRun: { at: "2026-11-24T10:20:30Z" } } }, actions);
  has(done, "12 archived answer(s)", "last run 2026-11-24 10:20");
  has(renderFooter({ homeState: "ready", selectedId: "a", home: { answers: "x" } }, actions), "Nothing archived yet");
});
