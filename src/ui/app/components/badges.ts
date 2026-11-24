import { html } from "../dom.js";

export interface PromptContest { state: string; reason: string }
export interface PromptDemand { match: { exactTerms: number; relatedTerms: number } }

export function deltaPill(trend: { change: number | null } | null | undefined): string {
  if (!trend || trend.change === null) return '<span class="pill flat">No movement yet</span>';
  const cls = trend.change > 0 ? "good" : trend.change < 0 ? "bad" : "flat";
  const arrow = trend.change > 0 ? "↑" : trend.change < 0 ? "↓" : "→";
  return '<span class="pill ' + cls + '">' + arrow + " " + Math.abs(trend.change) + '</span>';
}

export function fieldBadge(row: { contest: PromptContest } | null | undefined): string {
  if (!row || row.contest.state === "unknown") return '';
  const field = row.contest.state;
  const tone = field === "open" ? "ready" : field === "settled" ? "warning" : "";
  const label = field === "open" ? "Open field" : field === "settled" ? "Settled" : "Contested";
  return '<span class="tag ' + tone + '" title="' + html(row.contest.reason) + '">' + label + '</span>';
}

export function demandBadge(row: { demand?: PromptDemand | null | undefined } | null | undefined): string {
  if (!row || !row.demand) return '';
  const match = row.demand.match;
  if (!match.exactTerms && !match.relatedTerms) return '<span class="tag">Nobody asked it in the corpus</span>';
  return '<span class="tag">Asked ' + match.exactTerms + ' · ' + match.relatedTerms + ' loosely</span>';
}

export function evidenceJump(id: string): string {
  return '<button type="button" class="evidence-jump" data-evidence-target="' + html(id) + '">View evidence</button>';
}
