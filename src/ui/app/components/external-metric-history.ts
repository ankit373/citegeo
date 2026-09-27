import { html } from "../dom.js";
import { button } from "./button.js";

export interface ExternalMetricSnapshotView {
  id: string;
  source: "google_search_console" | "google_analytics" | "ahrefs" | "semrush";
  observedAt: string;
  dataFreshThrough: string;
}

export interface ExternalMetricHistoryInput {
  projectSelected: boolean;
  state: "idle" | "loading" | "ready" | "error";
  snapshots: ExternalMetricSnapshotView[];
  connected: string[];
  pulling: "" | "ahrefs" | "semrush";
  notice: { text: string; kind: string };
}

const SOURCES = [
  { id: "google_search_console", label: "Google Search Console", detail: "Query, impression and click snapshots are saved when search demand is refreshed." },
  { id: "google_analytics", label: "GA4", detail: "Session and assistant-referral snapshots are saved when Analytics is refreshed." },
  { id: "ahrefs", label: "Ahrefs", detail: "Provider estimates only; this is not Analytics traffic." },
  { id: "semrush", label: "Semrush", detail: "Provider estimates only; this is not Analytics traffic." },
] as const;

function latest(snapshots: ExternalMetricSnapshotView[]): ExternalMetricSnapshotView | null {
  return snapshots.slice().sort((left, right) => right.observedAt.localeCompare(left.observedAt))[0] || null;
}

/** Shared data-history block: every source is a dated snapshot, not a mutable
 * "current" value. Keeping it here prevents integrations from inventing
 * different freshness language or silently mixing provider estimates. */
export function externalMetricHistory(input: ExternalMetricHistoryInput): string {
  const notice = input.notice.text
    ? '<div class="' + (input.notice.kind === "error" ? "warning-box" : "success-box") + '">' + html(input.notice.text) + "</div>"
    : "";
  if (!input.projectSelected) {
    return '<section class="section-card"><div class="section-head"><div><h2>Data history</h2><p class="subtle">Choose a project to collect a comparable history for its domain.</p></div></div></section>';
  }
  if (input.state !== "ready") {
    return '<section class="section-card"><div class="section-head"><div><h2>Data history</h2><p class="subtle">' + (input.state === "error" ? "Could not read data history." : "Reading saved snapshots…") + "</p></div></div></section>";
  }
  const rows = SOURCES.map((source) => {
    const snapshots = input.snapshots.filter((snapshot) => snapshot.source === source.id);
    const newest = latest(snapshots);
    const canPull = source.id === "ahrefs" || source.id === "semrush";
    const connected = input.connected.includes(source.id);
    const action = !canPull
      ? '<span class="step-note">Refresh from its data page</span>'
      : !connected
        ? '<span class="step-note">Connect above first</span>'
        : button({ label: input.pulling === source.id ? "Pulling…" : "Pull estimate", disabled: Boolean(input.pulling), on: { "data-pull-external-metrics": source.id } });
    return '<div class="mrow mcols-external-metrics"><div class="mname"><strong>' + html(source.label) + '</strong><span class="subtle">' + html(source.detail) + "</span></div>"
      + '<span class="mcell">' + snapshots.length + " saved</span>"
      + '<span class="mcell">' + (newest ? html(new Date(newest.observedAt).toLocaleDateString()) : "Not collected") + "</span>"
      + '<span class="mcell">' + action + "</span></div>";
  }).join("");
  const dates = input.snapshots.map((snapshot) => snapshot.observedAt).sort();
  const history = dates.length
    ? dates.length + " snapshot" + (dates.length === 1 ? "" : "s") + " saved; oldest observation " + new Date(dates[0]!).toLocaleDateString() + "."
    : "No snapshots yet. Collect one comparable weekly point at a time.";
  return '<section class="section-card" data-testid="external-metric-history"><div class="section-head"><div><h2>Data history</h2><p class="subtle">One dated, scoped record per pull. It is a timeline, not a live counter.</p></div><span class="tag">' + input.snapshots.length + " points</span></div>"
    + notice
    + '<p class="subtle">' + html(history) + "</p>"
    + '<div class="mtable"><div class="mhead mcols-external-metrics"><span>Source</span><span>History</span><span>Latest</span><span>Update</span></div>' + rows + "</div>"
    + '<p class="evidence-note">Correlation unlocks only after 12 aligned weekly observations. Compare 0, 7, 14 and 28-day lags as association—not proof that one metric caused another.</p></section>';
}
