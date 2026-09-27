import { html } from "../dom.js";
import { button } from "./button.js";

export type ModelWebSearchMode = "off" | "provider_native";

export interface SelectedModelView {
  modelId: string;
  displayName: string;
  providerLabel: string;
  webSearchMode: ModelWebSearchMode;
  nativeWebSearchSupported: boolean;
  runnable: string;
  unavailable?: boolean;
}

/** One control for the same per-model mode in the catalogue and selection list. */
export function webSearchModeControl(input: {
  modelId: string;
  mode: ModelWebSearchMode;
  supported: boolean;
  attribute: "model-mode" | "selected-model-mode";
}): string {
  return '<select data-' + input.attribute + '="' + html(input.modelId) + '" ' + (input.supported ? "" : "disabled")
    + ' aria-label="Web search mode for ' + html(input.modelId) + '"><option value="off" ' + (input.mode === "off" ? "selected" : "") + '>Offline</option>'
    + '<option value="provider_native" ' + (input.mode === "provider_native" ? "selected" : "") + '>Native web search</option></select>';
}

/** The selected-model table deliberately owns removal. A catalogue checkbox is
 * useful for adding, but should never be the sole way to undo a selection. */
export function selectedModelTable(input: { rows: SelectedModelView[]; readOnly?: boolean }): string {
  if (!input.rows.length) return '<p class="subtle">No models selected yet.</p>';
  const readOnly = input.readOnly === true;
  const columns = readOnly ? "mcols-readonly" : "mcols-selected";
  const head = '<div class="mhead ' + columns + '"><span>Model</span><span>Provider</span>'
    + (readOnly ? "" : "<span>Runs now</span>") + '<span>Web search</span>' + (readOnly ? "" : "<span>Selection</span>") + "</div>";
  const body = input.rows.map((row) => {
    const search = readOnly
      ? '<span class="mcell">' + html(row.webSearchMode === "provider_native" ? "Provider Native web search" : "Offline") + "</span>"
      : webSearchModeControl({ modelId: row.modelId, mode: row.webSearchMode, supported: row.nativeWebSearchSupported, attribute: "selected-model-mode" });
    const availability = row.unavailable
      ? '<span class="mcell state-bad" title="The provider no longer lists this model.">No longer offered</span>'
      : '<span class="mcell">' + row.runnable + "</span>";
    return '<div class="mrow selection-row ' + columns + '"><div class="mname"><strong>' + html(row.displayName) + '</strong><span class="mono">' + html(row.modelId) + '</span></div>'
      + '<span class="mcell">' + html(row.providerLabel) + "</span>"
      + (readOnly ? "" : availability) + search
      + (readOnly ? "" : button({ label: "Remove", kind: "quiet", tone: "danger", on: { "data-remove-selected-model": row.modelId } }))
      + "</div>";
  }).join("");
  return '<div class="mtable">' + head + body + "</div>" + (readOnly ? "" : '<p class="mlegend">Web search is selectable only when this configured endpoint can execute it.</p>');
}
