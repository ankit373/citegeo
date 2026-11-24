import { html } from "../dom.js";
import { percent, score as scoreFigure } from "../format.js";
import type { EntityRow, SplitRow } from "../types.js";

export interface RateReading {
  tooFewAppearances?: boolean | undefined;
  namedIn?: number | undefined;
  appearances?: number | undefined;
}

export interface CreditRow { host: string; url: string; creditedAt: number; citedAt: number; usedAt: number; gap: number }

export interface OutreachTarget {
  url: string;
  title?: string | null | undefined;
  host: string;
  words: number | null;
  why: string;
  prompts: string[];
  rivals: Array<{ name: string }>;
  namesYou: boolean;
  citedBy: number;
  freshness: string;
  ageDays?: number | null | undefined;
}

export interface SearchDemandRow {
  text: string;
  exact: Array<{ query: string }>;
  related: Array<{ query: string }>;
  earnedInSearchAbsentInAnswers?: boolean | undefined;
  impressions: number;
  clicks: number;
  position: number | null;
}

export interface ExperimentArm { rate: number | null; trials: number }

export interface ExperimentRow {
  id: string;
  name: string;
  status: string;
  changed?: string | undefined;
  draftId?: string | undefined;
  changedAt: string;
  treatedPromptIds: string[];
  controlPromptIds: string[];
  result: {
    verdict: string;
    difference: number | null;
    low?: number | null | undefined;
    high?: number | null | undefined;
    detail: string;
    treated: { before: ExperimentArm; after: ExperimentArm };
    control: { before: ExperimentArm; after: ExperimentArm };
  };
}

export function bar(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : '<div class="bar"><i style="width:' + Math.round(value * 100) + '%"></i></div>';
}

export function stat(label: string, value: string | number, note: string, fraction?: number | null): string {
  return '<div class="stat"><span>' + html(label) + '</span><strong>' + value + '</strong><small>' + html(note) + '</small>' + bar(fraction) + '</div>';
}

export function overAppearances(score: RateReading | null | undefined, value: number | null | undefined, words: string) {
  if (!score || score.tooFewAppearances) {
    const named = score ? score.namedIn || score.appearances || 0 : 0;
    return {
      value: named ? 'Too few' : percent(null),
      note: named
        ? named + ' appearance(s) cannot be read as a rate. ' + words
        : 'Nothing named, so nothing judged.',
      fraction: null,
    };
  }
  return { value: percent(value), note: words, fraction: value };
}

export function renderLeaderboard(rows: EntityRow[] | null | undefined): string {
  if (!rows || !rows.length) return '<p class="subtle">No organisation was named in any answer yet.</p>';
  const top = rows.slice(0, 12);
  const most = Math.max(1, ...top.map((row) => row.appearances));
  return '<div class="mtable"><div class="mhead mcols-board"><span>#</span><span>Organisation</span><span>Answers naming them</span><span>Prominence</span></div>'
    + top.map((row, index) => '<div class="mrow mcols-board">'
      + '<span class="mcell mono">' + (index + 1) + '</span>'
      + '<div class="mname"><strong>' + html(row.name) + (row.isTarget ? ' <span class="pill good">You</span>' : row.isTracked ? ' <span class="tag">Rival you track</span>' : ' <span class="tag">Named by the models</span>') + '</strong><span class="mono">' + html(row.domain || "no domain given") + '</span></div>'
      + '<span class="mcell"><span class="sharebar' + (row.isTarget ? " is-target" : "") + '"><i style="width:' + Math.round(row.appearances / most * 100) + '%"></i><b>' + row.appearances + ' · ' + percent(row.shareOfAnswers) + '</b></span></span>'
      + '<span class="mcell">' + percent(row.prominence) + '</span></div>').join("")
    + '</div>';
}

export function shapeRow(label: string, theirs: number | null, yours: number | null): string {
  const behind = theirs !== null && yours !== null && theirs > yours;
  return '<div class="mrow mcols-shape"><div class="mname"><strong>' + html(label) + '</strong></div>'
    + '<span class="mcell ' + (behind ? "state-flag" : "") + '">' + (theirs === null ? '—' : theirs) + '</span>'
    + '<span class="mcell">' + (yours === null ? '—' : yours) + '</span></div>';
}

export function verdictButtons(item: { id: string; recommendation: string; isTarget: boolean }): string {
  const call = (field: string, agreed: boolean, correction: string, label: string) =>
    '<button type="button" class="card-action" data-verdict-id="' + html(item.id) + '" data-verdict-field="' + field
    + '" data-verdict-agreed="' + String(agreed) + '" data-verdict-correction="' + html(correction) + '">' + html(label) + '</button>';
  const others = ["positive", "negative", "mentioned", "uncertain"].filter((value) => value !== item.recommendation);
  return '<div class="move-actions"><span class="subtle">Called it ' + html(item.recommendation) + '</span>'
    + call("recommendation", true, "", "Right")
    + others.map((value) => call("recommendation", false, value, "No, " + value)).join("")
    + '</div>'
    + '<div class="move-actions"><span class="subtle">' + (item.isTarget ? "Called it you" : "Called it somebody else") + '</span>'
    + call("isTarget", true, "", "Right")
    + call("isTarget", false, item.isTarget ? "false" : "true", item.isTarget ? "No, not you" : "No, that is you")
    + '</div>';
}

export function creditRows(rows: CreditRow[], kind: string): string {
  // Ranked against the pages that could be read, with the place it really
  // held in the citation list beside it where the two differ.
  return rows.slice(0, 5).map((row) => '<div class="mrow mcols-credit"><div class="mname"><strong>' + html(row.host) + '</strong>'
    + '<span class="mono">' + html(row.url.slice(0, 64)) + '</span></div>'
    + '<span class="mcell">#' + row.creditedAt + (row.citedAt !== row.creditedAt ? '<small> of ' + row.citedAt + ' cited</small>' : '') + '</span>'
    + '<span class="mcell">#' + row.usedAt + '</span>'
    + '<span class="mcell ' + kind + '">' + (row.gap > 0 ? '+' : '') + row.gap + '</span></div>').join("");
}

export function ageCell(target: { freshness: string; ageDays?: number | null | undefined }): string {
  if (target.freshness === "unread") return '<span class="mcell subtle">Not read</span>';
  if (target.freshness === "undated") return '<span class="mcell subtle">No date given</span>';
  const tone = target.freshness === "fresh" ? "state-ok" : target.freshness === "ageing" ? "state-flag" : "state-bad";
  return '<span class="mcell ' + tone + '">' + target.ageDays + ' days</span>';
}

export function outreachRow(target: OutreachTarget): string {
  const rivals = target.rivals.length
    ? '<span class="namechips">' + target.rivals.slice(0, 8).map((named, index) => '<span class="namechip"><b>' + (index + 1) + '</b>' + html(named.name) + '</span>').join("") + '</span>'
    : '<span class="subtle">Nobody the answers named is on this page.</span>';
  return '<div class="mrow mcols-source">'
    + '<div class="mname"><strong><a href="' + html(target.url) + '" target="_blank" rel="noreferrer">' + html(target.title || target.url) + '</a></strong>'
    + '<span class="mono">' + html(target.host) + (target.words === null ? '' : ' · ' + target.words + ' words') + '</span>'
    + '<span class="subtle">' + html(target.why) + '</span>'
    + '<span class="subtle">Cited answering: ' + html(target.prompts.slice(0, 2).join(" · ")) + '</span>' + rivals + '</div>'
    + '<span class="mcell ' + (target.namesYou ? "state-ok" : "state-bad") + '">' + (target.namesYou ? "You are on it" : "You are not") + '</span>'
    + '<span class="mcell">' + target.citedBy + ' answer(s)</span>'
    + ageCell(target) + '</div>';
}

export function searchDemandRow(row: SearchDemandRow): string {
  const matched = row.exact.concat(row.related).slice(0, 4);
  return '<div class="mrow mcols-search">'
    + '<div class="mname"><strong>' + html(row.text) + '</strong>'
    + (matched.length ? '<span class="subtle">' + html(matched.map((match) => match.query).join(" · ")) + '</span>' : '<span class="subtle">No query in the window shares its words.</span>')
    + (row.earnedInSearchAbsentInAnswers ? '<span class="tag warning">Found in search, absent from the answers</span>' : '') + '</div>'
    + '<span class="mcell">' + row.impressions + '</span>'
    + '<span class="mcell">' + row.clicks + '</span>'
    + '<span class="mcell">' + (row.position === null ? "Not ranked" : "#" + (Math.round(row.position * 10) / 10)) + '</span></div>';
}

export function renderPersonaRows(rows: SplitRow[] | null | undefined): string {
  if (!rows || !rows.length) return '<p class="subtle">One audience is the overall figure under another name, so this fills in once a run asks on behalf of more than one.</p>';
  return '<div class="mtable"><div class="mhead mcols-rank"><span>Persona</span><span>Score</span><span>Rank</span></div>'
    + rows.map((row) => '<div class="mrow mcols-rank">'
      + '<div class="mname"><strong>' + html(row.label) + '</strong><span class="subtle">' + row.score.answers + ' answer(s)</span></div>'
      + '<span class="mcell">' + scoreFigure(row.score.score) + '</span>'
      + '<span class="mcell">' + (row.rank === null ? "Not named" : "#" + row.rank) + '</span></div>').join("")
    + '</div>';
}

export function armCell(label: string, side: ExperimentArm): string {
  return '<span class="count"><strong>' + (side.rate === null ? '—' : Math.round(side.rate * 100) + '%') + '</strong>' + html(label) + ' (' + side.trials + ')</span>';
}

export function experimentCard(row: ExperimentRow): string {
  const result = row.result;
  const ink = result.verdict === "moved" ? "state-ok" : result.verdict === "no_effect_shown" ? "state-flag" : "state-bad";
  const words = result.verdict === "moved" ? "Moved" : result.verdict === "no_effect_shown" ? "Nothing shown" : result.verdict === "no_control" ? "No control" : "Too thin yet";
  const band = result.difference === null
    ? ''
    : '<p><strong>' + (result.difference > 0 ? '+' : '') + Math.round(result.difference * 100) + ' points</strong> more than the control moved, consistent with '
      + Math.round((result.low || 0) * 100) + ' to ' + Math.round((result.high || 0) * 100) + ' points.</p>';
  return '<div class="fix"><div class="fix-top"><strong>' + html(row.name) + '</strong>'
    + '<span class="tag ' + ink + '">' + html(words) + '</span>'
    + (row.status === "running" ? '<button type="button" class="card-action" data-stop-experiment="' + html(row.id) + '">Stop</button>' : '<span class="subtle">stopped</span>')
    + '</div>'
    + (row.changed ? '<p class="evidence-note">Changed: ' + html(row.changed) + '</p>' : '')
    + (row.draftId ? '<p class="evidence-note">Started from a draft, against the questions it was written for.</p>' : '')
    + '<p class="evidence-note">Measured from ' + html(row.changedAt.slice(0, 10)) + ' · ' + row.treatedPromptIds.length + ' treated, ' + row.controlPromptIds.length + ' control</p>'
    + band
    + '<div class="countstrip">' + armCell("treated before", result.treated.before) + armCell("treated after", result.treated.after)
    + armCell("control before", result.control.before) + armCell("control after", result.control.after) + '</div>'
    + '<p class="subtle">' + html(result.detail) + '</p></div>';
}
