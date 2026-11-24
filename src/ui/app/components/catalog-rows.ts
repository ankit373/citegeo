import { html } from "../dom.js";
import type { CatalogModel, LoadState, SelectionRow } from "../types.js";
import type { ProviderRow } from "../pages/setup-view.js";

type ModelFacts = { providerId?: string | undefined; available?: boolean | undefined; unavailableReason?: string | undefined };

export interface SelectedRow {
  model: CatalogModel | SelectionRow;
  inCatalog: boolean;
  modelId: string;
  webSearchMode: string;
}

export function selectedRows(catalog: CatalogModel[], selections: SelectionRow[], draftSelections: Map<string, string>, catalogState: LoadState): SelectedRow[] {
  const byId = new Map(catalog.map((item) => [item.modelId, item]));
  return Array.from(draftSelections.entries())
    .map(([modelId, webSearchMode]) => ({ model: byId.get(modelId) || selections.find((item) => item.modelId === modelId), inCatalog: catalogState !== "ready" || byId.has(modelId), modelId, webSearchMode }))
    .filter((item): item is SelectedRow => Boolean(item.model));
}

export function providerShortLabel(providers: ProviderRow[], providerId: string): string {
  const row = providers.find((provider) => provider.providerId === providerId);
  return row ? row.label : String(providerId);
}

export function openRouterOutOfCredit(providers: ProviderRow[]): boolean {
  return providers.some((provider) => provider.providerId === "openrouter" && provider.balance && !provider.balance.paidModelsRunnable);
}

export function modelIsBlocked(model: ModelFacts | null | undefined, modelId: string, providers: ProviderRow[]): boolean {
  return Boolean(model) && model?.providerId === "openrouter" && !modelId.endsWith(":free") && openRouterOutOfCredit(providers);
}

export function runsNowCell(model: ModelFacts | null | undefined, modelId: string, providers: ProviderRow[]): string {
  if (model && model.available === false) return '<span class="mcell state-bad" title="' + html(model.unavailableReason || "") + '">Never</span>';
  return modelIsBlocked(model, modelId, providers) ? '<span class="mcell state-flag">No credit</span>' : '<span class="mcell state-ok">Yes</span>';
}

export function blockedSelection(row: { inCatalog: boolean; model?: { available?: boolean | undefined } | null | undefined }): boolean {
  return !row.inCatalog || Boolean(row.model && row.model.available === false);
}

export function catalogVendor(item: { vendor?: string | undefined; displayName?: string | undefined; modelId?: string | undefined }): string {
  const supplied = typeof item.vendor === "string" ? item.vendor.trim() : "";
  if (supplied) return supplied;
  const name = String(item.displayName || "");
  const separator = name.indexOf(":");
  if (separator > 0) return name.slice(0, separator).trim();
  const modelId = String(item.modelId || "");
  const namespaceEnd = modelId.indexOf("/");
  return namespaceEnd > 0 ? modelId.slice(0, namespaceEnd) : modelId;
}

export function catalogReleasedAt(item: { releasedAt?: string | number | null | undefined }): number | null {
  if (typeof item.releasedAt !== "string" || !item.releasedAt) return null;
  const timestamp = new Date(item.releasedAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function catalogResultSummary(count: number): string {
  return 'Show ' + count + '  models. When sorting by release date, models with no date in the catalog are listed last.';
}

export function catalogHead(): string {
  return '<div class="mhead mcols-catalog"><span></span><span>Model</span><span>Vendor</span><span>Runs now</span><span>Web search</span></div>';
}
