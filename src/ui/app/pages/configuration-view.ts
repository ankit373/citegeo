import { html } from "../dom.js";
import { button } from "../components/button.js";
import { saveConfigurationButton, type ConfigurationSaveState, type MonitoringConfigurationView } from "../components/configuration-button.js";
import { selectedRows } from "../components/catalog-rows.js";
import { formatTime } from "../format.js";
import { renderSelectedModels, type MachineTabs, type SelectionState } from "./models-view.js";
import type { LoadState, Notice, ProjectRow } from "../types.js";
import type { MonitoringConfigurationState } from "../../../product/configuration/monitoring-configuration-state.js";
import type { ProductBaseline } from "../../../product/configuration/baseline-schema.js";

export interface ConfigurationState extends SelectionState, ConfigurationSaveState {
  configurationState: LoadState;
  baselines: ProductBaseline[];
  monitoringNotice: Notice;
}

export const modeText = (mode: string) => mode === "provider_native" ? "Provider Native web search" : "Offline";

export function renderConfigurationDiff(configuration: Pick<MonitoringConfigurationState, "diff">): string {
  const diff = configuration.diff;
  const rows: string[] = [];
  for (const item of diff.addedModels) rows.push("Models added: " + item.displayName);
  for (const item of diff.removedModels) rows.push("Models removed: " + item.displayName);
  for (const item of diff.webSearchModeChanges) {
    rows.push("Web search mode change: " + item.displayName + " from \"" + modeText(item.previousMode) + "\" to \"" + modeText(item.currentMode) + "\"");
  }
  if (diff.protocolVersionChange) rows.push("Protocol version change: " + diff.protocolVersionChange.previous + " → " + diff.protocolVersionChange.current);
  if (diff.domainChange) rows.push("Domain change: " + diff.domainChange.previous + " → " + diff.domainChange.current);
  if (diff.languageChange) rows.push("Output language change: " + diff.languageChange.previous + " → " + diff.languageChange.current);
  if (rows.length === 0) return "";
  return '<section class="section-card" data-testid="configuration-diff"><div class="section-head"><div><h2>Changes in this run</h2><p class="subtle">Saving creates a new configuration version.</p></div></div><ul class="protocol-list">'
    + rows.map((row) => '<li>' + html(row) + '</li>').join("") + '</ul></section>';
}

export function renderConfigurationRows(baselines: ProductBaseline[], configuration: Pick<MonitoringConfigurationState, "currentBaseline">): string {
  if (baselines.length === 0) return '<p class="subtle">No past configurations yet.</p>';
  const currentId = configuration.currentBaseline ? configuration.currentBaseline.id : "";
  return '<div class="baseline-list">' + baselines.map((baseline) => '<article class="baseline-row" data-testid="configuration-version-row" data-configuration-id="' + html(baseline.id)
    + '"><div><strong>config v' + baseline.version + (currentId === baseline.id ? " · Current version" : "")
    + '</strong><span>' + html(baseline.normalizedDomain) + ' · ' + baseline.modelSnapshots.length + '  models</span><span>'
    + baseline.modelSnapshots.map((item) => html(item.displayName + " (" + modeText(item.webSearchMode) + ")")).join(", ")
    + '</span></div><span class="tag mono">' + html(formatTime(baseline.createdAt)) + '</span></article>').join("") + '</div>';
}

export function renderTechnicalDetails(configuration: Pick<MonitoringConfigurationView, "currentProtocol" | "currentModelSnapshots" | "currentLanguage">): string {
  const protocol = configuration.currentProtocol;
  const capabilities = configuration.currentModelSnapshots.length
    ? configuration.currentModelSnapshots.map((item) => '<li>' + html(item.displayName + " · " + formatTime(item.capabilityCheckedAt)) + '</li>').join("")
    : '<li>The capability check time is recorded once models are saved.</li>';
  return '<details class="technical-details"><summary>Technical details</summary><div class="detail-grid"><div class="detail-cell"><span>Protocol</span><strong>'
    + html(protocol.protocolId + "/" + protocol.protocolVersion) + '</strong></div><div class="detail-cell"><span>Protocol hash</span><strong>'
    + html(protocol.promptTemplateHash || "Recorded on first save") + '</strong></div><div class="detail-cell"><span>Input scope</span><strong>Domain only</strong></div><div class="detail-cell"><span>Output language</span><strong>'
    + html(configuration.currentLanguage) + '</strong></div></div><p class="field-help">Model capability check time</p><ul class="protocol-list">' + capabilities + '</ul></details>';
}

export function renderConfiguration(
  state: ConfigurationState,
  selected: ProjectRow | null,
  configuration: MonitoringConfigurationView,
  machineTabs: MachineTabs,
): string {
  if (!selected) return '<section class="view"><div class="empty"><div class="empty-copy"><h2>Select a project first</h2><p class="subtle">A configuration belongs to a single project.</p></div></div></section>';
  if (state.configurationState === "loading") {
    return '<section class="view"><div class="heading"><div><h1>Configuration</h1><p class="subtle">Loading the current configuration…</p></div></div>'
      + machineTabs() + '<div class="section-card inline-empty" aria-live="polite">Loading the domain, models and web search modes.</div></section>';
  }
  if (state.configurationState === "error") {
    return '<section class="view"><div class="heading"><div><h1>Configuration</h1><p class="subtle">The current configuration could not be read.</p></div></div>'
      + machineTabs() + '<div class="warning-box" data-testid="configuration-read-error" role="alert">' + html(state.monitoringNotice.text || "The request failed.") + '</div></section>';
  }
  const hasModels = selectedRows(state.catalog, state.selections, state.draftSelections, state.catalogState).length > 0;
  const notice = state.monitoringNotice.text;
  const noticeKind = state.monitoringNotice.kind;
  const stateMessage = !hasModels ? "Select at least one available model before saving the configuration."
    : configuration.status === "no_version" ? "No configuration saved yet. Saving fixes the current domain, language, models and web search modes."
      : configuration.status === "changed" ? "The models or web search modes have changed. Saving creates a new configuration version."
        : "The current models and web search modes are saved.";
  const stateClass = !hasModels || configuration.status === "changed" ? "warning-box" : configuration.status === "unchanged" ? "success-box" : "warning-box";
  return '<section class="view"><div class="heading"><div><h1>Configuration</h1><p class="subtle">Save the domain, output language and each model\'s web search mode as reusable monitoring conditions.</p></div>'
    + saveConfigurationButton(state, configuration, hasModels) + '</div>' + machineTabs()
    + '<div id="monitoring-configuration-status" data-testid="monitoring-configuration-status" class="form-status ' + html(noticeKind) + '" aria-live="polite">' + html(notice)
    + '</div><div class="section-stack"><section class="section-card"><div class="section-head"><div><h2>Current version</h2><p class="subtle">Target domain: <span class="mono">' + html(selected.normalizedDomain)
    + '</span></p></div><span class="tag ' + (configuration.status === "unchanged" ? "ready" : "warning") + '">' + (configuration.currentVersion ? "v" + configuration.currentVersion : "Not saved yet")
    + '</span></div><div class="' + stateClass + '" data-testid="monitoring-configuration-summary">' + html(stateMessage)
    + '</div></section><section class="section-card"><div class="section-head"><div><h2>Current model configuration</h2><p class="subtle">Each model stores its own web search mode.</p></div>'
    + button({ label: "Adjust models", on: { "data-page": "models" } }) + '</div>' + renderSelectedModels(state, true) + '</section>'
    + renderConfigurationDiff(configuration)
    + '<section class="section-card"><div class="section-head"><div><h2>Past configurations</h2><p class="subtle">Read-only snapshot. Saving a new version does not overwrite past configurations.</p></div></div>'
    + renderConfigurationRows(state.baselines, configuration) + '</section>' + renderTechnicalDetails(configuration) + '</div></section>';
}
