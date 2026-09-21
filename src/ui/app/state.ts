import { type Loadable } from "./loadable.js";

// One store, grouped by what a reader is looking at rather than by the order
// features were added. Everything fetched is a Loadable, so "not loaded",
// "loaded and empty" and "failed" cannot be confused for one another.

export interface Notice {
  text: string;
  kind: "error" | "success" | "info";
}

export const NO_NOTICE: Notice = { text: "", kind: "info" };

export interface ProjectRow {
  id: string;
  name: string;
  normalizedDomain: string;
  status: string;
}

export interface Filters {
  modelId: string;
  regionId: string;
  languageId: string;
  topicId: string;
}

export const NO_FILTERS: Filters = { modelId: "", regionId: "", languageId: "", topicId: "" };

export interface PromptFilters {
  query: string;
  topicId: string;
  intent: string;
  status: string;
}

export type PromptSort = "topic" | "open" | "worst";

/** What the right pane is showing. One slot, because one pane. */
export type PanelState =
  | { kind: "none" }
  | { kind: "evidence"; promptId: string; title: string }
  | { kind: "run"; runId: string };

export interface ProjectsSlice {
  all: ProjectRow[];
  selectedId: string;
}

export interface PromptsSlice {
  set: Loadable<unknown>;
  filters: PromptFilters;
  sort: PromptSort;
  selection: string[];
  priority: Loadable<unknown>;
  notice: Notice;
  /** Not a Loadable: this is an action in progress, not data being read. */
  action: "idle" | "generating" | "running" | "saving" | "stopping";
}

export interface ScoresSlice {
  insights: Loadable<unknown>;
  plan: Loadable<unknown>;
  actions: Loadable<unknown>;
  brief: Loadable<unknown>;
  outreach: Loadable<unknown>;
  cited: Loadable<unknown>;
  rivals: Loadable<unknown>;
  segments: Loadable<unknown>;
  personas: Loadable<unknown>;
  filters: Filters;
}

export interface RunSlice {
  live: unknown | null;
  last: unknown | null;
  feed: Loadable<unknown[]>;
  pollTimer: number;
  feedTimer: number;
}

export interface IntegrationsSlice {
  engines: Loadable<unknown>;
  storage: Loadable<unknown>;
  searchDemand: Loadable<unknown>;
  referrals: Loadable<unknown>;
  credentials: Loadable<unknown>;
  /** Long-running pulls, named so two cannot be confused for one. */
  busy: Set<string>;
}

export interface Store {
  page: string;
  projects: ProjectsSlice;
  prompts: PromptsSlice;
  scores: ScoresSlice;
  run: RunSlice;
  integrations: IntegrationsSlice;
  panel: PanelState;
  panelAnswers: Loadable<unknown[]>;
  home: Loadable<unknown>;
}

export function emptyStore(page: string, selectedId: string): Store {
  return {
    page,
    projects: { all: [], selectedId },
    prompts: {
      set: { status: "idle" },
      filters: { query: "", topicId: "", intent: "", status: "" },
      sort: "topic",
      selection: [],
      priority: { status: "idle" },
      notice: NO_NOTICE,
      action: "idle",
    },
    scores: {
      insights: { status: "idle" }, plan: { status: "idle" }, actions: { status: "idle" },
      brief: { status: "idle" }, outreach: { status: "idle" }, cited: { status: "idle" },
      rivals: { status: "idle" }, segments: { status: "idle" }, personas: { status: "idle" },
      filters: { ...NO_FILTERS },
    },
    run: { live: null, last: null, feed: { status: "idle" }, pollTimer: 0, feedTimer: 0 },
    integrations: {
      engines: { status: "idle" }, storage: { status: "idle" }, searchDemand: { status: "idle" },
      referrals: { status: "idle" }, credentials: { status: "idle" }, busy: new Set<string>(),
    },
    panel: { kind: "none" },
    panelAnswers: { status: "idle" },
    home: { status: "idle" },
  };
}

/** Switching project invalidates everything read for the old one. Forgetting
 * one of these is how a figure from another project stayed on the screen. */
export function forProject(store: Store, selectedId: string): Store {
  const fresh = emptyStore(store.page, selectedId);
  fresh.projects.all = store.projects.all;
  return fresh;
}
