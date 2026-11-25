import { html } from "../dom.js";
import { button } from "../components/button.js";
import { selectedModelTable, webSearchModeControl } from "../components/model-picker.js";
import {
  blockedSelection, catalogHead, catalogReleasedAt, catalogResultSummary, catalogVendor, modelIsBlocked, openRouterOutOfCredit,
  providerShortLabel, runsNowCell, selectedRows,
} from "../components/catalog-rows.js";
import { reachInk, reachWords } from "../labels.js";
import { saveConfigurationButton, type ConfigurationSaveState, type MonitoringConfigurationView } from "../components/configuration-button.js";
import type { ProviderRow } from "./setup-view.js";
import type { CatalogModel, LoadState, Notice, ProjectRow, SelectionRow } from "../types.js";
import type { EngineStatus } from "../../../product/engines/engine-service.js";
import type { probeReach } from "../../../product/engines/engine-reach.js";

/** What the browser reach check answers with. */
export type EngineReachReport = Awaited<ReturnType<typeof probeReach>>;

/** The chosen models and the catalog they are chosen from. */
export interface SelectionState {
  providers: ProviderRow[];
  catalog: CatalogModel[];
  catalogState: LoadState;
  selections: SelectionRow[];
  draftSelections: Map<string, string>;
}

export interface CatalogFilters {
  catalog: CatalogModel[];
  query: string;
  catalogProvider: string;
  catalogNativeSearch: string;
  catalogSort: string;
}

export interface EnginesState {
  engines: EngineStatus | null;
  enginesState: LoadState;
  reach: EngineReachReport | null;
  reachState: LoadState;
}

export interface ModelsState extends SelectionState, CatalogFilters, EnginesState, ConfigurationSaveState {
  providersState: LoadState;
  catalogError: string;
  selectionsDirty: boolean;
  modelNotice: Notice;
  modelActionState: string;
}

/** The loaders these pages call while idle. Each must be a hoisted function declaration that reads live state. */
export interface ModelsActions {
  loadProviders(): void;
  loadEngines(): void;
}

/** The six-destination strip the machine pages share. Passed in because it reads the page. */
export type MachineTabs = () => string;

const CATALOG_LIMIT = 80;

export function renderSelectedModels(state: SelectionState, readOnly?: boolean): string {
  return selectedModelTable({
    ...(readOnly === undefined ? {} : { readOnly }),
    rows: selectedRows(state.catalog, state.selections, state.draftSelections, state.catalogState).map((row) => ({
      modelId: row.modelId,
      displayName: String(row.model.displayName),
      providerLabel: providerShortLabel(state.providers, String(row.model.providerId)),
      webSearchMode: row.webSearchMode === "provider_native" ? "provider_native" as const : "off" as const,
      nativeWebSearchSupported: row.model.nativeWebSearchSupported === true,
      runnable: row.inCatalog ? runsNowCell(row.model, row.modelId, state.providers) : "",
      unavailable: blockedSelection(row),
    })),
  });
}

export function catalogVendors(catalog: CatalogModel[]): string[] {
  const vendors = catalog.map((item) => catalogVendor(item)).filter((vendor) => vendor.length > 0);
  return Array.from(new Set(vendors)).sort((left, right) => left.localeCompare(right));
}

export function filteredCatalogModels(state: CatalogFilters): CatalogModel[] {
  const query = state.query.toLocaleLowerCase();
  const results = state.catalog.filter((item) => {
    const vendor = catalogVendor(item);
    const matchesQuery = item.displayName.toLocaleLowerCase().includes(query)
      || item.modelId.toLocaleLowerCase().includes(query)
      || vendor.toLocaleLowerCase().includes(query);
    const matchesVendor = !state.catalogProvider || vendor === state.catalogProvider;
    const matchesSearch = state.catalogNativeSearch === "all"
      || (state.catalogNativeSearch === "supported" ? item.nativeWebSearchSupported : !item.nativeWebSearchSupported);
    return matchesQuery && matchesVendor && matchesSearch;
  });
  results.sort((left, right) => {
    const leftVendor = catalogVendor(left);
    const rightVendor = catalogVendor(right);
    if (state.catalogSort === "vendor") {
      const vendorOrder = leftVendor.localeCompare(rightVendor);
      return vendorOrder || left.displayName.localeCompare(right.displayName);
    }
    if (state.catalogSort === "newest" || state.catalogSort === "oldest") {
      const leftReleasedAt = catalogReleasedAt(left);
      const rightReleasedAt = catalogReleasedAt(right);
      if (leftReleasedAt === null && rightReleasedAt === null) return left.displayName.localeCompare(right.displayName);
      if (leftReleasedAt === null) return 1;
      if (rightReleasedAt === null) return -1;
      return state.catalogSort === "newest" ? rightReleasedAt - leftReleasedAt : leftReleasedAt - rightReleasedAt;
    }
    return left.displayName.localeCompare(right.displayName);
  });
  return results.slice(0, CATALOG_LIMIT);
}

export function renderCatalogModelRows(results: CatalogModel[], state: Pick<SelectionState, "providers" | "draftSelections">): string {
  return results.map((item) => {
    const chosen = state.draftSelections.get(item.modelId);
    const isChosen = chosen !== undefined;
    const vendor = catalogVendor(item);
    const releasedAt = catalogReleasedAt(item);
    const released = releasedAt === null ? ' · no release date' : ' · ' + new Date(releasedAt).toLocaleDateString();
    const releasedTitle = releasedAt === null ? ' title="Catalog does not provide a release date"' : '';
    return '<div class="mrow mcols-catalog" data-testid="catalog-model" data-model-id="' + html(item.modelId)
      + '" data-model-vendor="' + html(vendor)
      + '" data-model-released-at="' + html(releasedAt === null ? "" : String(releasedAt))
      + '" data-native-search="' + String(item.nativeWebSearchSupported)
      + '"><input type="checkbox" data-model-checkbox="' + html(item.modelId) + '" ' + (isChosen ? "checked" : "") + (item.available ? "" : " disabled")
      + ' aria-label="Select ' + html(item.displayName) + '"><div class="mname"><strong>' + html(item.displayName)
      + '</strong><span class="mono"' + releasedTitle + '>' + html(item.modelId) + html(released) + '</span>'
      + (item.available ? '' : '<span class="state-bad">' + html(item.unavailableReason || "Unavailable") + '</span>')
      + '</div><span class="mcell">' + html(vendor) + '</span>'
      + runsNowCell(item, item.modelId, state.providers)
      + webSearchModeControl({
        modelId: item.modelId,
        mode: chosen === "provider_native" ? "provider_native" : "off",
        supported: isChosen && item.nativeWebSearchSupported,
        attribute: "model-mode",
      })
      + '</div>';
  }).join("");
}

export function blockedSelectionBanner(state: SelectionState & Pick<ModelsState, "providersState">): string {
  if (state.providersState !== "ready") return '';
  if (!openRouterOutOfCredit(state.providers)) return '';
  const rows = selectedRows(state.catalog, state.selections, state.draftSelections, state.catalogState);
  const blocked = rows.filter((row) => modelIsBlocked(row.model, row.modelId, state.providers));
  if (!blocked.length) return '';
  return '<div class="warning-box">' + blocked.length + ' of these ' + rows.length + ' models cannot run right now. This OpenRouter account has no credit, so each one answers HTTP 402 and returns no answer. Models ending in :free still run, and local gateway models cost nothing. Setup shows the full picture.</div>';
}

export function renderReach(state: Pick<EnginesState, "reach" | "reachState">): string {
  const action = '<div class="inline-actions">'
    + button({ label: state.reachState === "loading" ? "Checking…" : "Check what this browser can reach", kind: "quiet", disabled: state.reachState === "loading", on: { "data-probe-reach": "true" } })
    + '</div>';
  if (state.reachState !== "ready" || !state.reach) {
    return action + (state.reachState === "error" ? '<p class="subtle">Could not check. The browser may not be running.</p>' : '');
  }
  const rows = state.reach.engines.map((row) => '<div class="mrow mcols-reach"><div class="mname"><strong>' + html(row.label) + '</strong>'
    + '<span class="subtle">' + html(row.detail) + '</span></div>'
    + '<span class="mcell ' + reachInk(row.reach) + '">' + html(reachWords(row.reach)) + '</span>'
    + '<span class="mcell mono">' + html((row.landedOn || row.home).slice(0, 34)) + '</span></div>').join("");
  const where = state.reach.found ? '<p class="subtle">' + html(state.reach.found) + '</p>' : '';
  return action + where + '<div class="mtable"><div class="mhead mcols-reach"><span>Surface</span><span>State</span><span>Landed on</span></div>' + rows + '</div>'
    + '<p class="mlegend">' + html(state.reach.caveat) + '</p>';
}

export function renderEngines(state: EnginesState, actions: Pick<ModelsActions, "loadEngines">): string {
  if (state.enginesState === "idle") { actions.loadEngines(); }
  if (state.enginesState !== "ready" || !state.engines) {
    return '<p class="subtle">' + (state.enginesState === "error" ? "Could not read the engines." : "Checking for a browser to drive.") + '</p>';
  }
  const data = state.engines;
  const looked = (data.looked || []).length
    ? '<p class="subtle">Looked at: ' + (data.looked || []).map((where) => '<span class="mono">' + html(where) + '</span>').join(", ") + '.</p>'
    : '';
  const reach = data.reachable === null
    ? '<div class="warning-box"><strong>Not checked.</strong> Nothing here has looked at your browser. '
      + button({ label: "Check for a browser", id: "probe-engines", testId: "probe-engines" }) + '</div>'
    : data.reachable
      ? '<div class="success-box">' + html(data.detail) + ' <span class="mono">' + html(data.endpoint) + '</span></div>'
      : '<div class="warning-box"><strong>No browser to drive.</strong> ' + html(data.detail)
        + ' Start the browser with remote debugging, or switch it on from the browser\'s own inspect page. Selecting a surface here is still saved; it just cannot run yet.'
        + looked + '</div>';
  const rows = data.engines.map((engine) => '<div class="mrow mcols-engine">'
    + '<input type="checkbox" data-engine-checkbox="' + html(engine.id) + '"' + (engine.selected ? ' checked' : '') + ' aria-label="Ask ' + html(engine.label) + '">'
    + '<div class="mname"><strong>' + html(engine.label) + '</strong><span class="subtle">' + html(engine.caveat) + '</span></div>'
    + '<span class="mcell ' + (engine.selected ? 'state-ok' : '') + '">' + (engine.selected ? "Asked on every run" : "Not asked") + '</span></div>').join("");
  return reach + '<div class="mtable"><div class="mhead mcols-engine"><span></span><span>Surface</span><span>State</span></div>' + rows + '</div>' + renderReach(state)
    + '<p class="subtle">These are the only sources here that search the web by construction, so they are where citations come from. Nothing signs in on your behalf; the answer is whatever your own signed-in session shows.</p>';
}

export function renderModels(
  state: ModelsState,
  selected: ProjectRow | null,
  configuration: MonitoringConfigurationView,
  machineTabs: MachineTabs,
  actions: ModelsActions,
): string {
  if (state.providersState === "idle") { actions.loadProviders(); }
  if (!selected) return '<section class="view"><div class="empty"><div class="empty-copy"><h2>Select a project first</h2><p class="subtle">A model configuration belongs to a single project.</p></div></div></section>';
  const vendors = catalogVendors(state.catalog);
  const results = filteredCatalogModels(state);
  const list = state.catalogState === "idle" || state.catalogState === "loading"
    ? '<p class="subtle">Loading the OpenRouter model catalog…</p>'
    : state.catalogState === "error"
      ? '<div class="warning-box"><strong>Model catalog unavailable</strong><p>' + html(state.catalogError) + '</p>' + button({ label: "Retry", id: "retry-catalog", testId: "retry-catalog" }) + '</div>'
      : results.length === 0
        ? '<p class="subtle">No matching models.</p>'
        : '<p class="catalog-result-summary">' + catalogResultSummary(results.length) + '</p><div class="mtable">' + catalogHead() + '<div class="model-list">' + renderCatalogModelRows(results, state) + '</div></div>';
  const notice = state.modelNotice.text || (state.selectionsDirty ? "Configuration not saved yet" : "");
  const noticeClass = state.modelNotice.kind || (state.selectionsDirty ? "warning" : "");
  const saveLabel = state.modelActionState === "error" ? "Retry saving model configuration" : "Save model configuration";
  const vendorOptions = vendors.map((vendor) => '<option value="' + html(vendor) + '" ' + (state.catalogProvider === vendor ? "selected" : "") + '>' + html(vendor) + '</option>').join("");
  const sortOption = (value: string, label: string) => '<option value="' + value + '" ' + (state.catalogSort === value ? "selected" : "") + '>' + label + '</option>';
  const searchOption = (value: string, label: string) => '<option value="' + value + '" ' + (state.catalogNativeSearch === value ? "selected" : "") + '>' + label + '</option>';
  return '<section class="view"><div class="heading"><div><h1>Choose models</h1><p class="subtle">Pick the models to ask, set each one\'s web search mode, then save them as this project\'s configuration. Currently '
    + (configuration.currentVersion ? "saved as v" + configuration.currentVersion : "not saved") + '.</p></div><div class="inline-actions">'
    + button({ label: saveLabel, kind: state.selectionsDirty || state.modelActionState === "error" ? "primary" : "secondary", id: "save-models", testId: "save-models", on: { "data-action-state": state.modelActionState } })
    + '' + saveConfigurationButton(state, configuration, state.selections.length > 0, false) + '</div></div>'
    + machineTabs()
    + '<div id="models-status" class="form-status ' + noticeClass + '" aria-live="polite">' + html(notice) + '</div><div class="section-stack"><section class="section-card"><div class="section-head"><div><h2>Selected models</h2><p class="subtle">Select one or more models.</p></div><span class="tag">'
    + selectedRows(state.catalog, state.selections, state.draftSelections, state.catalogState).length + '  selected</span></div>'
    + blockedSelectionBanner(state) + renderSelectedModels(state)
    + '</section><section class="section-card"><div class="section-head"><div><h2>Answer surfaces</h2><p class="subtle">The products a buyer actually opens, read through your own browser. The only sources here that search the web.</p></div></div>'
    + renderEngines(state, actions)
    + '</section><section class="section-card"><div class="section-head"><div><h2>Model catalog</h2><p class="subtle">Searchable and multi-select. A provider that is unreachable contributes nothing; no fabricated models are shown.</p></div><span class="tag '
    + (state.catalogState === "ready" ? "ready" : state.catalogState === "error" ? "warning" : "") + '">'
    + (state.catalogState === "ready" ? "Catalog available" : state.catalogState === "error" ? "Catalog error" : "Loading")
    + '</span></div><input id="model-search" class="model-search" data-testid="model-search" type="search" value="' + html(state.query) + '" placeholder="Search by model name, model ID or vendor"><div class="model-catalog-controls"><label for="model-provider-filter">Model vendor<select id="model-provider-filter" data-testid="model-provider-filter"><option value="">All vendors</option>'
    + vendorOptions
    + '</select></label><label for="model-native-search-filter">Web search capability<select id="model-native-search-filter" data-testid="model-native-search-filter">'
    + searchOption("all", "All") + searchOption("supported", "Supports native web search") + searchOption("unsupported", "Does not support native web search")
    + '</select></label><label for="model-catalog-sort">Sort<select id="model-catalog-sort" data-testid="model-catalog-sort">'
    + sortOption("name", "Name A-Z") + sortOption("vendor", "Vendor A-Z") + sortOption("newest", "Release date: newest first") + sortOption("oldest", "Release date: oldest first")
    + '</select></label></div>' + list + '</section></div></section>';
}
