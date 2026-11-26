import test from "node:test";
import assert from "node:assert/strict";
import {
  blockedSelectionBanner, catalogVendors, filteredCatalogModels, renderCatalogModelRows, renderEngines, renderModels, renderReach, renderSelectedModels,
  type ModelsActions, type ModelsState,
} from "../src/ui/app/pages/models-view.js";
import { renderSetup, type SetupActions, type SetupPageState } from "../src/ui/app/pages/setup-view.js";
import { renderConfiguration, renderConfigurationDiff, renderConfigurationRows, renderTechnicalDetails, type ConfigurationState } from "../src/ui/app/pages/configuration-view.js";
import { saveConfigurationButton, type MonitoringConfigurationView } from "../src/ui/app/components/configuration-button.js";
import type { ProviderRow } from "../src/ui/app/pages/setup-view.js";
import type { CatalogModel, ProjectRow, SelectionRow } from "../src/ui/app/types.js";
import type { ProductBaseline } from "../src/product/configuration/baseline-schema.js";
import type { EngineStatus } from "../src/ui/app/../../product/engines/engine-service.js";
import type { EngineReachReport } from "../src/ui/app/pages/models-view.js";

function has(text: string, ...parts: string[]): void {
  for (const part of parts) assert.ok(text.includes(part), `${JSON.stringify(text)} lacks ${part}`);
}
function lacks(text: string, ...parts: string[]): void {
  for (const part of parts) assert.ok(!text.includes(part), `${JSON.stringify(text)} has ${part}`);
}

const calls: string[] = [];
const spy = (...names: string[]) => Object.fromEntries(names.map((name) => [name, () => { calls.push(name); }]));
const modelsActions = () => spy("loadProviders", "loadEngines") as unknown as ModelsActions;
const setupActions = () => spy("loadProviders", "loadStorage", "loadCredentials", "loadIntegrations", "loadExternalMetrics") as unknown as SetupActions;
const tabs = () => "TABS";
const project: ProjectRow = { id: "p1", name: "Acme", normalizedDomain: "acme.example", status: "active" };

const provider = (providerId: string, over: Partial<ProviderRow> = {}): ProviderRow => ({
  providerId, label: providerId.toUpperCase(), endpoint: null, detail: "ok", modelCount: 1, freeModels: 0, nativeWebSearchModels: 0, citationCapable: true,
  configured: true, reachable: true, runnableNow: true, balance: null, envKeys: [], ...over,
});
const model = (modelId: string, displayName: string, over: Partial<CatalogModel> = {}): CatalogModel => ({
  modelId, displayName, providerId: modelId.startsWith("openai/") ? "openai" : "openrouter", available: true, nativeWebSearchSupported: false, ...over,
});
const catalog: CatalogModel[] = [
  model("openai/gpt-a", "GPT A", { nativeWebSearchSupported: true, releasedAt: "2026-05-01T00:00:00Z", vendor: "OpenAI" }),
  model("openrouter/m1:free", "Meta: M1 free", { releasedAt: "2026-01-01T00:00:00Z" }),
  model("anthropic/c1", "Anthropic: C1", { releasedAt: "2026-09-01T00:00:00Z", nativeWebSearchSupported: true }),
  model("google/g1", "G1<", { available: false, unavailableReason: "retired&", releasedAt: null }),
];
const selection = (modelId: string, over: Partial<SelectionRow> = {}): SelectionRow => ({
  id: "s-" + modelId, providerId: "openrouter", modelId, displayName: modelId, webSearchMode: "off", nativeWebSearchSupported: true, available: true, enabled: true, ...over,
});
const baseline = (id: string, version: number, over: Partial<ProductBaseline> = {}): ProductBaseline => ({
  id, projectId: "p1", version, normalizedDomain: "acme.example", recognitionProtocol: {} as never,
  modelSnapshots: [{ selectionId: "s", providerId: "openrouter", modelId: "m", displayName: "M<", webSearchMode: "provider_native", nativeWebSearchSupported: true, capabilityCheckedAt: "2026-11-01T10:00:00Z" }],
  language: "en", analysisVersion: "v1", configHash: "h", createdAt: "2026-11-02T10:00:00Z", ...over,
});
const noDiff = { addedModels: [], removedModels: [], webSearchModeChanges: [], protocolVersionChange: null, domainChange: null, languageChange: null };
const configuration = (over: Partial<MonitoringConfigurationView> = {}): MonitoringConfigurationView => ({
  status: "changed", currentVersion: 2, nextVersion: 3, currentBaseline: baseline("b2", 2),
  currentProtocol: { protocolId: "domain-recognition", protocolVersion: "v1", promptTemplateHash: "abc<" },
  currentDomain: "acme.example", currentLanguage: "en", currentModelSnapshots: baseline("b2", 2).modelSnapshots, diff: noDiff, ...over,
});
const engines = (over: Partial<EngineStatus> = {}): EngineStatus => ({
  endpoint: "http://127.0.0.1:9222", reachable: null, detail: "d&", engines: [{ id: "e1", label: "Surface<", caveat: "c", selected: true }, { id: "e2", label: "Two", caveat: "c2", selected: false }], looked: [], caveat: "x", ...over,
});
const reach = (over: Partial<EngineReachReport> = {}): EngineReachReport => ({
  endpoint: "e", found: "found<", caveat: "cav&",
  engines: [
    { id: "e1", label: "One<", home: "https://home.example", reach: "drivable", detail: "ok", landedOn: "https://landed.example/a-path-that-is-much-longer-than-thirty-four" },
    { id: "e2", label: "Two", home: "https://two.example/x", reach: "blocked", detail: "no", landedOn: "" },
  ], ...over,
});

function state(over: Partial<ModelsState & ConfigurationState> = {}): ModelsState & ConfigurationState {
  return {
    providers: [provider("openrouter", { balance: { paidModelsRunnable: true } }), provider("openai")], providersState: "ready",
    catalog, catalogState: "ready", catalogError: "oops<", query: "", catalogProvider: "", catalogNativeSearch: "all", catalogSort: "name",
    selections: [selection("openai/gpt-a", { webSearchMode: "provider_native" })],
    draftSelections: new Map([["openai/gpt-a", "provider_native"], ["openrouter/m1:free", "off"]]), selectionsDirty: false,
    modelNotice: { text: "", kind: "" }, modelActionState: "idle", monitoringSaveState: "idle", configurationState: "ready",
    monitoringNotice: { text: "", kind: "" }, baselines: [baseline("b2", 2), baseline("b1", 1, { createdAt: "2026-10-01T10:00:00Z" })],
    engines: engines(), enginesState: "ready", reach: null, reachState: "idle", ...over,
  };
}
const ids = (rows: CatalogModel[]) => rows.map((row) => row.modelId);

test("the catalog is searched by name, id and vendor, and filtered by vendor and web search", () => {
  assert.deepEqual(ids(filteredCatalogModels(state({ query: "gpt" }))), ["openai/gpt-a"]);
  assert.deepEqual(ids(filteredCatalogModels(state({ query: "OPENAI" }))), ["openai/gpt-a"]);
  assert.deepEqual(ids(filteredCatalogModels(state({ query: "c1" }))), ["anthropic/c1"]);
  assert.deepEqual(ids(filteredCatalogModels(state({ catalogProvider: "Meta" }))), ["openrouter/m1:free"]);
  assert.deepEqual(ids(filteredCatalogModels(state({ catalogNativeSearch: "supported" }))), ["anthropic/c1", "openai/gpt-a"]);
  assert.deepEqual(ids(filteredCatalogModels(state({ catalogNativeSearch: "unsupported" }))), ["google/g1", "openrouter/m1:free"]);
});

test("the catalog sorts by name, vendor and release date, undated last either way", () => {
  assert.deepEqual(ids(filteredCatalogModels(state({ catalogSort: "name" }))), ["anthropic/c1", "google/g1", "openai/gpt-a", "openrouter/m1:free"]);
  assert.deepEqual(ids(filteredCatalogModels(state({ catalogSort: "vendor" }))), ["anthropic/c1", "google/g1", "openrouter/m1:free", "openai/gpt-a"]);
  assert.deepEqual(ids(filteredCatalogModels(state({ catalogSort: "newest" }))), ["anthropic/c1", "openai/gpt-a", "openrouter/m1:free", "google/g1"]);
  assert.deepEqual(ids(filteredCatalogModels(state({ catalogSort: "oldest" }))), ["openrouter/m1:free", "openai/gpt-a", "anthropic/c1", "google/g1"]);
});

test("only the first eighty matches are drawn, and the vendor list is sorted and unique", () => {
  const many = Array.from({ length: 90 }, (_, index) => model(`v${index % 3}/m${index}`, `Model ${String(index).padStart(2, "0")}`));
  assert.equal(filteredCatalogModels(state({ catalog: many })).length, 80);
  assert.deepEqual(catalogVendors(many), ["v0", "v1", "v2"]);
});

test("a catalog row says what it is, whether it can be chosen, and why not", () => {
  const rows = renderCatalogModelRows(catalog, state());
  has(rows, 'data-model-id="openai/gpt-a"', 'data-model-vendor="OpenAI"', 'data-native-search="true"', 'data-model-checkbox="openai/gpt-a" checked');
  has(rows, ' · no release date', "retired&amp;", "G1&lt;");
  assert.ok(rows.includes('data-model-checkbox="google/g1"  disabled') || rows.includes('data-model-checkbox="google/g1" disabled'));
  lacks(rows.slice(rows.indexOf('data-model-id="anthropic/c1"'), rows.indexOf('data-model-id="google/g1"')), " checked");
});

test("selected models are listed with their provider, and a missing one is marked", () => {
  const out = renderSelectedModels(state());
  has(out, "GPT A", "OPENAI");
  const gone = renderSelectedModels(state({ draftSelections: new Map([["ghost/x", "off"]]), selections: [selection("ghost/x", { displayName: "Ghost" })] }));
  has(gone, "Ghost");
});

test("the credit banner appears only once providers are read, only for paid selections, and counts them", () => {
  const broke = [provider("openrouter", { balance: { paidModelsRunnable: false } })];
  const paid = new Map([["openrouter/m1:free", "off"], ["anthropic/c1", "off"]]);
  assert.equal(blockedSelectionBanner(state({ providers: broke, draftSelections: paid })).includes("1 of these 2 models cannot run right now"), true);
  assert.equal(blockedSelectionBanner(state({ providers: broke, draftSelections: new Map([["openrouter/m1:free", "off"]]) })), "");
  assert.equal(blockedSelectionBanner(state({ providers: broke, draftSelections: paid, providersState: "loading" })), "");
  assert.equal(blockedSelectionBanner(state({ draftSelections: paid })), "");
});

test("the engines panel says not checked, drivable or unreachable, and offers the check", () => {
  const idle = calls.length;
  has(renderEngines(state({ engines: engines() }), modelsActions()), "Not checked.", 'id="probe-engines"', "Asked on every run", "Not asked", 'data-engine-checkbox="e1" checked');
  has(renderEngines(state({ engines: engines({ reachable: true }) }), modelsActions()), "success-box", "http://127.0.0.1:9222");
  const down = renderEngines(state({ engines: engines({ reachable: false, looked: ["a<", "b"] }) }), modelsActions());
  has(down, "No browser to drive.", "Looked at: ", "a&lt;");
  lacks(renderEngines(state({ engines: engines({ reachable: false }) }), modelsActions()), "Looked at:");
  assert.equal(calls.length, idle);
  has(renderEngines(state({ enginesState: "error", engines: null }), modelsActions()), "Could not read the engines.");
  calls.length = 0;
  has(renderEngines(state({ enginesState: "idle", engines: null }), modelsActions()), "Checking for a browser to drive.");
  assert.deepEqual(calls, ["loadEngines"]);
});

test("the reach check shows each surface's state and where it landed, shortened", () => {
  has(renderReach(state({ reachState: "loading" })), "Checking…", " disabled");
  has(renderReach(state({ reachState: "error" })), "Could not check.");
  const out = renderReach(state({ reachState: "ready", reach: reach() }));
  has(out, "One&lt;", "found&lt;", "cav&amp;", "https://landed.example/a-path-that<");
  lacks(out, "a-path-that-is");
  has(out, "https://two.example/x");
  lacks(renderReach(state({ reachState: "ready", reach: reach({ found: "" }) })), "found&lt;");
});

test("Choose models asks for providers while idle, needs a project, and reflects unsaved work", () => {
  calls.length = 0;
  has(renderModels(state({ providersState: "idle" }), project, configuration(), tabs, modelsActions()), "Choose models");
  assert.deepEqual(calls, ["loadProviders", "loadEngines"].filter((name) => calls.includes(name)));
  assert.ok(calls.includes("loadProviders"));
  has(renderModels(state(), null, configuration(), tabs, modelsActions()), "Select a project first");
  const dirty = renderModels(state({ selectionsDirty: true }), project, configuration(), tabs, modelsActions());
  has(dirty, "Configuration not saved yet", 'class="form-status warning"', "TABS", "Currently saved as v2.");
  has(renderModels(state({ modelActionState: "error" }), project, configuration({ currentVersion: null }), tabs, modelsActions()), "Retry saving model configuration", "not saved.");
  has(renderModels(state({ modelNotice: { text: "bad<", kind: "error" } }), project, configuration(), tabs, modelsActions()), "bad&lt;", "form-status error");
});

test("the catalog section reports loading, an error with retry, no match, or the rows and their count", () => {
  const draw = (over: Partial<ModelsState & ConfigurationState>) => renderModels(state(over), project, configuration(), tabs, modelsActions());
  has(draw({ catalogState: "loading" }), "Loading the OpenRouter model catalog");
  has(draw({ catalogState: "error" }), "Model catalog unavailable", "oops&lt;", 'id="retry-catalog"', "Catalog error");
  has(draw({ query: "zzz" }), "No matching models.");
  const ready = draw({});
  has(ready, "Catalog available", "catalog-result-summary", 'class="model-list"', '<option value="name" selected>', "Meta");
  has(draw({ catalogSort: "oldest" }), '<option value="oldest" selected>');
  has(draw({ catalogNativeSearch: "supported" }), '<option value="supported" selected>');
  has(draw({ catalogProvider: "Meta" }), '<option value="Meta" selected>');
  has(ready, "2  selected");
});

test("the save button names the version it will write and stays off when there is nothing to save", () => {
  const button = (over: Partial<MonitoringConfigurationView>, saving = "idle", hasModels = true, lead = true) => saveConfigurationButton({ monitoringSaveState: saving }, configuration(over), hasModels, lead);
  has(button({ status: "no_version" }), "Save config v1", "primary");
  has(button({ status: "changed", nextVersion: 7 }), "Save as config v7");
  const same = button({ status: "unchanged" });
  has(same, "Current configuration saved", " disabled");
  lacks(same, "primary");
  has(button({ status: "changed" }, "saving"), "Saving…", " disabled");
  has(button({ status: "changed", currentVersion: 4 }, "saved"), "Saved as v4", " disabled");
  has(button({ status: "changed" }, "error"), "Save again");
  has(button({ status: "changed" }, "idle", false), " disabled");
  lacks(button({ status: "changed" }, "idle", true, false), "primary");
});

test("the configuration page shows the version, why it can or cannot be saved, and the past versions", () => {
  const page = (over: Partial<ConfigurationState> = {}, config = configuration()) => renderConfiguration(state(over), project, config, tabs);
  has(page(), "Target domain: <span class=\"mono\">acme.example</span>", "v2", "config v2 · Current version", "config v1", "Technical details", "TABS");
  has(page({}, configuration({ status: "no_version", currentVersion: null })), "No configuration saved yet.", "Not saved yet");
  has(page(), "The models or web search modes have changed.", "warning-box");
  has(page({}, configuration({ status: "unchanged" })), "The current models and web search modes are saved.", "success-box");
  has(page({ selections: [], draftSelections: new Map() }), "Select at least one available model", "warning-box");
  has(page({ baselines: [] }), "No past configurations yet.");
  has(page({ configurationState: "loading" }), "Loading the current configuration…");
  has(page({ monitoringNotice: { text: "note<", kind: "bad" } }), "note&lt;", "form-status bad");
  const failed = page({ configurationState: "error", monitoringNotice: { text: "read<", kind: "error" } }, configuration({ status: "no_version", currentVersion: null }));
  has(failed, "could not be read", "read&lt;", "configuration-read-error", "TABS");
  lacks(failed, "No configuration saved yet", "Save config", "save-monitoring-configuration");
  has(renderConfiguration(state(), null, configuration(), tabs), "Select a project first");
});

test("the diff lists each change in words and is empty when nothing changed", () => {
  assert.equal(renderConfigurationDiff(configuration()), "");
  const out = renderConfigurationDiff(configuration({
    diff: {
      addedModels: [{ modelId: "a", displayName: "Add<" }], removedModels: [{ modelId: "r", displayName: "Rem" }],
      webSearchModeChanges: [{ modelId: "w", displayName: "Web", previousMode: "off", currentMode: "provider_native" }],
      protocolVersionChange: { previous: "v1", current: "v2" }, domainChange: { previous: "a.com", current: "b.com" }, languageChange: { previous: "en", current: "en" },
    },
  }));
  has(out, "Models added: Add&lt;", "Models removed: Rem", 'Web search mode change: Web from &quot;Offline&quot; to &quot;Provider Native web search&quot;', "Protocol version change: v1 → v2", "Domain change: a.com → b.com", "Output language change: en → en");
});

test("past versions mark the current one, and technical details name the protocol", () => {
  const rows = renderConfigurationRows([baseline("b2", 2), baseline("b1", 1)], configuration());
  has(rows, "config v2 · Current version", "config v1", "acme.example · 1  models", "M&lt; (Provider Native web search)");
  assert.equal(rows.split("Current version").length - 1, 1);
  const tech = renderTechnicalDetails(configuration());
  has(tech, "domain-recognition/v1", "abc&lt;", "Domain only");
  has(renderTechnicalDetails(configuration({ currentProtocol: { protocolId: "domain-recognition", protocolVersion: "v", promptTemplateHash: "" }, currentModelSnapshots: [] })), "Recorded on first save", "recorded once models are saved");
});

test("Setup asks for each read that is idle, and only asks for metrics when a project is open", () => {
  const setup = (over: Partial<SetupPageState> = {}): SetupPageState => ({
    providers: [], providersState: "idle", storage: null, storageState: "idle", storageBackend: "", storageCheck: null, credentials: null, credentialsState: "idle",
    credentialNotice: { text: "", kind: "" }, integrations: [], integrationsState: "idle", externalMetrics: null, externalMetricsState: "idle",
    externalMetricsPulling: "", externalMetricsNotice: { text: "", kind: "" }, selectedId: "p1", ...over,
  });
  calls.length = 0;
  renderSetup(setup(), project, setupActions());
  assert.deepEqual(calls, ["loadProviders", "loadStorage", "loadCredentials", "loadIntegrations", "loadExternalMetrics"]);
  calls.length = 0;
  renderSetup(setup({ selectedId: "" }), null, setupActions());
  assert.deepEqual(calls, ["loadProviders", "loadStorage", "loadCredentials", "loadIntegrations"]);
  calls.length = 0;
  renderSetup(setup({ providersState: "ready", storageState: "ready", credentialsState: "ready", integrationsState: "ready", externalMetricsState: "ready" }), project, setupActions());
  assert.deepEqual(calls, []);
});

const tagOf = (out: string, id: string) => {
  const at = out.indexOf(`id="${id}"`);
  return out.slice(out.lastIndexOf("<button", at), out.indexOf(">", at));
};

test("a search also matches a vendor or an id that the name does not carry, and ties fall back to the name", () => {
  const odd = [
    model("zzz/unique-id", "Plain", { vendor: "Acme Labs" }),
    model("zzz/other", "Beta", { vendor: "Acme Labs" }),
    model("zzz/third", "Alpha", { vendor: "Acme Labs" }),
  ];
  assert.deepEqual(ids(filteredCatalogModels(state({ catalog: odd, query: "acme labs" }))), ["zzz/third", "zzz/other", "zzz/unique-id"]);
  assert.deepEqual(ids(filteredCatalogModels(state({ catalog: odd, query: "unique-id" }))), ["zzz/unique-id"]);
  assert.deepEqual(ids(filteredCatalogModels(state({ catalog: odd, catalogSort: "vendor" }))), ["zzz/third", "zzz/other", "zzz/unique-id"]);
});

test("release sorts keep undated models last, in name order, whichever way they are compared", () => {
  const dated = [
    model("a/n1", "N1"), model("a/d1", "D1", { releasedAt: "2026-03-01T00:00:00Z" }), model("a/n2", "N2"),
    model("a/d2", "D2", { releasedAt: "2026-06-01T00:00:00Z" }), model("a/d3", "D3", { releasedAt: "2026-01-01T00:00:00Z" }),
  ];
  assert.deepEqual(ids(filteredCatalogModels(state({ catalog: dated, catalogSort: "newest" }))), ["a/d2", "a/d1", "a/d3", "a/n1", "a/n2"]);
  assert.deepEqual(ids(filteredCatalogModels(state({ catalog: dated, catalogSort: "oldest" }))), ["a/d3", "a/d1", "a/d2", "a/n1", "a/n2"]);
});

test("a selection the provider no longer lists says so, and a listed one says whether it runs", () => {
  const out = renderSelectedModels(state({ draftSelections: new Map([["ghost/x", "off"], ["openai/gpt-a", "off"]]), selections: [selection("ghost/x", { displayName: "Ghost" })] }));
  has(out, "No longer offered", 'state-ok">Yes');
  const broke = renderSelectedModels(state({ providers: [provider("openrouter", { balance: { paidModelsRunnable: false } })], draftSelections: new Map([["anthropic/c1", "off"]]) }));
  has(broke, "No credit");
});

test("the save buttons lead only when there is something to save", () => {
  const draw = (over: Partial<ModelsState & ConfigurationState>, config = configuration()) => renderModels(state(over), project, config, tabs, modelsActions());
  has(tagOf(draw({ selectionsDirty: true }), "save-models"), "primary");
  lacks(tagOf(draw({}), "save-models"), "primary");
  has(tagOf(draw({ modelActionState: "error" }), "save-models"), "primary");
  has(tagOf(draw({ selections: [], draftSelections: new Map() }), "save-monitoring-configuration"), " disabled");
  lacks(tagOf(draw({}), "save-monitoring-configuration"), " disabled");
});

test("the version tag is ready only when the saved configuration is the current one", () => {
  const page = (status: "unchanged" | "changed") => renderConfiguration(state(), project, configuration({ status }), tabs);
  has(page("unchanged"), '<span class="tag ready">v2</span>');
  has(page("changed"), '<span class="tag warning">v2</span>');
});

test("Setup passes the open project and the saved metrics through to the page", () => {
  const setup = (over: Partial<SetupPageState>): SetupPageState => ({
    providers: [provider("openrouter")], providersState: "ready", storage: null, storageState: "ready", storageBackend: "", storageCheck: null, credentials: null, credentialsState: "ready",
    credentialNotice: { text: "", kind: "" }, integrations: [], integrationsState: "ready", externalMetrics: null, externalMetricsState: "ready",
    externalMetricsPulling: "", externalMetricsNotice: { text: "", kind: "" }, selectedId: "p1", ...over,
  });
  const snapshots = [{ source: "ahrefs", observedAt: "2026-11-01T00:00:00Z" }] as never;
  has(renderSetup(setup({ externalMetrics: { snapshots } }), project, setupActions()), "1 snapshot saved");
  lacks(renderSetup(setup({ externalMetrics: null }), project, setupActions()), "1 snapshot saved");
  has(renderSetup(setup({}), null, setupActions()), "Choose a project");
  lacks(renderSetup(setup({}), project, setupActions()), "Choose a project");
});

test("the repainted list wraps only the rows, with the column header and the count outside it", () => {
  const out = renderModels(state(), project, configuration(), tabs, modelsActions());
  const open = out.indexOf('<div class="model-list">');
  assert.ok(open > 0);
  assert.ok(out.indexOf("catalogHead") === -1 && out.indexOf('class="mhead mcols-catalog"') < open, "the header is a sibling of the list");
  assert.ok(out.indexOf('class="catalog-result-summary"') < open, "the count is outside the list");
  const inside = out.slice(open, out.indexOf("</section>", open));
  assert.equal(inside.split('data-testid="catalog-model"').length - 1, 4);
  assert.equal(inside.includes('class="mhead'), false);
});
