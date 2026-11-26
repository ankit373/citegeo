import { button } from "../components/button.js";
import { crawlerUpload, pasteCountPicker } from "../components/pickers.js";
import { html } from "../dom.js";
import { percent } from "../format.js";
import { overAppearances, stat } from "./metric-cells.js";
import type { LoadState, Notice, ProjectRow, Unshaped } from "../types.js";

/** Each draws from the fields it names, so a page can be rendered from nothing else. */
export interface CrawlerState { crawlers: Unshaped; crawlersState: LoadState; crawlerUploading: boolean; crawlerNotice: Notice }
export interface PasteState { paste: Unshaped; pasteState: LoadState; pasteCount: number }
export interface SignalState { signals: Unshaped; signalsState: LoadState }
export interface PlanState { plan: Unshaped; planState: LoadState }
export interface VisibilityState extends CrawlerState, PasteState, SignalState, PlanState { insights: Unshaped; insightsState: LoadState }
export interface VisibilityActions { loadInsights(): void; loadPaste(): void; loadPlan(): void; loadCrawlers(): void; loadSignals(): void }

export function comparablePercent(value: any) { return value === null || value === undefined ? '<span class="state-flag">not comparable</span>' : '<strong>' + Math.round(value * 100) + '%</strong>'; }

export function insightTable(columns: any, head: any, rows: any[], empty: string) {
  if (!rows.length) return '<p class="subtle">' + html(empty) + '</p>';
  return '<div class="mtable"><div class="mhead ' + columns + '">' + (head as any).map((label: any) => '<span>' + html(label) + '</span>').join("") + '</div>' + rows.join("") + '</div>';
}

// Prominence and framing are means over the answers that named the brand,
// which on a handful of them cannot be told from a coin. The counts are the
// finding there, and a percentage beside "Not named" is the old bug.
export function renderScoreBreakdown(score: any): string {
  if (!score || score.answers === 0) return '<p class="subtle">Nothing has been answered yet, so there is nothing to score. This is not a zero.</p>';
  const band = score.presenceInterval;
  // Absent on an archive scored before the range existed, so nothing is
  // claimed about how precise those figures were.
  const presenceNote = band && band.low !== null
    ? score.appearances + ' of ' + score.answers + ', consistent with ' + percent(band.low) + ' to ' + percent(band.high)
    : score.appearances + ' of ' + score.answers + ' answers named you';
  const width = score.tooFewAnswers
    ? '<div class="warning-box"><strong>Too few answers to read this as a rate.</strong> '
      + score.answers + ' answer(s) leave the presence rate anywhere from ' + percent(band.low) + ' to ' + percent(band.high)
      + ', which decides nothing. Track more questions, or more models, before acting on the number. ' + html(band.caveat) + '</div>'
    : '';
  const prom = overAppearances(score, score.prominence, 'Full marks means always named first.');
  const sent = overAppearances(score, score.sentiment, 'Full marks means always recommended.');
  return '<div class="statgrid">'
    + stat("Presence", percent(score.presenceRate), presenceNote, score.presenceRate)
    + stat("Prominence", prom.value, score.prominence === null && !score.namedIn ? 'No answer gave a readable order' : prom.note, prom.fraction)
    + stat("Sentiment", sent.value, sent.note, sent.fraction)
    + '</div>' + width;
}

export function renderCrawlerSection(state: CrawlerState, actions: { loadCrawlers(): void }): string {
  if (state.crawlersState === "idle") { actions.loadCrawlers(); }
  const head = '<section class="section-card"><div class="section-head"><div><h2>AI crawlers</h2><p class="subtle">Whether a bot actually fetched your pages. Permission is not arrival.</p></div></div>';
  if (state.crawlersState !== "ready" || !state.crawlers) {
    return head + '<p class="subtle">' + (state.crawlersState === "error" ? "Could not read the access log." : "Reading the access log…") + '</p></section>';
  }
  const report = state.crawlers;
  // The guard tested for a state this endpoint has never returned, so the
  // table below it has never been drawn: every reader got the warning box
  // and nothing else, whatever was in the log. What decides is whether
  // there is any activity to show.
  if (!report.activity) {
    return head + '<div class="warning-box">' + html(report.detail) + '</div>' + crawlerUpload(state.crawlerUploading, state.crawlerNotice) + '</section>';
  }
  const activity = report.activity;
  const rows = activity.crawlers.map((row: any) => '<div class="mrow mcols-crawler"><div class="mname"><strong>' + html(row.name) + '</strong><span>' + html(row.engine) + ' · ' + html(row.purpose === "live_fetch" ? "fetches when asked" : row.purpose === "training" ? "training crawl" : "search index") + '</span></div><span class="mcell">' + row.fetches + '</span><span class="mcell">' + row.pages + '</span><span class="mcell ' + (row.errorRate ? "state-flag" : "") + '">' + (row.errorRate === null ? "n/a" : Math.round(row.errorRate * 100) + "%") + '</span><span class="mcell mono">' + html(row.lastSeen ? row.lastSeen.slice(0, 10) : "unknown") + '</span></div>').join("");
  const absent = activity.allowedButAbsent.length
    ? '<div class="warning-box"><strong>' + activity.allowedButAbsent.length + ' allowed crawler(s) never arrived.</strong> Nothing links to you where they crawl: ' + html(activity.allowedButAbsent.slice(0, 8).join(", ")) + (activity.allowedButAbsent.length > 8 ? ", and more" : "") + '</div>'
    : '';
  const orphan = activity.citedNeverFetched.length
    ? '<p class="mlegend">' + activity.citedNeverFetched.length + ' cited page(s) were never seen being fetched, so those citations came from a cache, a training set or a third party.</p>'
    : '';
  // Whose log this is. A path set on the server is that server's log and
  // every project on it reads the same traffic; an uploaded one is this
  // project's. Saying which is the difference between a figure a reader
  // can act on and one they cannot place.
  const whose = report.source === "upload"
    ? '<p class="subtle">Counted from a log you uploaded.</p>'
    : report.source
      ? '<p class="subtle">Counted from ' + html(report.source) + ' on this server, which is the same log for every project here. Upload your own to count only your traffic.</p>'
      : '';
  return head
    + '<div class="countstrip"><span class="count"><strong>' + activity.totalFetches + '</strong>Crawler fetches</span><span class="count"><strong>' + activity.crawlers.length + '</strong>Bots seen</span><span class="count"><strong>' + activity.pages.length + '</strong>Pages fetched</span><span class="count"><strong>' + activity.fetchedNeverCited.length + '</strong>Fetched, never cited</span></div>'
    + whose
    + absent
    + insightTable("mcols-crawler", ["Crawler", "Fetches", "Pages", "Errors", "Last seen"], rows ? [rows] : [], "No AI crawler appears in this log.")
    + orphan + crawlerUpload(state.crawlerUploading, state.crawlerNotice) + '</section>';
}

function pasteFixCard(fix: any) {
  return '<div class="fix"><div class="fix-top"><strong>' + html(fix.title) + '</strong><span class="tag">' + html(fix.language) + '</span>'
    + '<button type="button" class="card-action" data-copy-fix="' + html(fix.id) + '">Copy</button></div>'
    + '<p class="why">' + html(fix.why) + '</p>'
    + '<p class="evidence-note">Observed: ' + html(fix.evidence) + '</p>'
    + '<p class="evidence-note">Goes in: ' + html(fix.where) + '</p>'
    + '<pre class="fix-snippet" id="fix-' + html(fix.id) + '">' + html(fix.snippet) + '</pre></div>';
}

export function renderPaste(state: PasteState, actions: { loadPaste(): void }): string {
  if (state.pasteState === "idle") { actions.loadPaste(); }
  const head = '<section class="section-card"><div class="section-head"><div><h2>Ready to paste</h2>'
    + '<p class="subtle">Generated from what was observed on your site, so every snippet can be checked against the evidence beside it. Asking for more a day does not invent any.</p></div>'
    + '<div class="inline-actions">' + pasteCountPicker(state.pasteCount) + '</div></div>';
  if (state.pasteState !== "ready" || !state.paste) {
    return head + '<p class="subtle">' + (state.pasteState === "error" ? "Could not generate anything." : "Generating from the last site probe.") + '</p></section>';
  }
  const list = state.paste;
  const fixes = (list.fixes || []).map(pasteFixCard).join("");
  const shortfall = list.shortfall ? '<div class="warning-box">' + html(list.shortfall) + '</div>' : '';
  const described = (list.described || []).length
    ? '<details class="technical-details"><summary>' + list.described.length + ' that cannot be generated correctly, so they are described instead</summary>'
      + list.described.map((row: any) => '<div class="move"><div class="move-top"><strong>' + html(row.title) + '</strong></div>'
        + '<p class="why">' + html(row.why) + '</p><p class="evidence-note">Observed: ' + html(row.evidence) + '</p></div>').join("")
      + '</details>'
    : '';
  return head + shortfall + (fixes || '<p class="subtle">Nothing outstanding can be generated from the last probe.</p>') + described
    + (list.caveat ? '<p class="mlegend">' + html(list.caveat) + '</p>' : '') + '</section>';
}

function signalFacts(signals: any) {
  const blocked = signals.robots.blocked.length;
  return [
    blocked ? blocked + " crawler(s) blocked" : "all crawlers allowed",
    signals.llmsTxt.present ? "llms.txt published" : "no llms.txt",
    signals.structuredData.organization ? "Organization markup" : "no Organization markup",
    signals.structuredData.independent.length + " independent record(s)",
    signals.wikidata.present ? "Wikidata " + signals.wikidata.id : "no Wikidata entity",
  ].join(" · ");
}

export function renderSignalHistory(state: SignalState, actions: { loadSignals(): void }): string {
  if (state.signalsState === "idle") { actions.loadSignals(); }
  const head = '<section class="section-card"><div class="section-head"><div><h2>Site signal history</h2><p class="subtle">What each probe saw, and what moved between them. A snapshot says the state; two say the story.</p></div></div>';
  if (state.signalsState !== "ready" || !state.signals) {
    return head + '<p class="subtle">' + (state.signalsState === "error" ? "Could not read the probe history." : "Reading the probe history…") + '</p></section>';
  }
  const snapshots = state.signals;
  if (!snapshots.length) {
    return head + '<p class="subtle">No probe yet. Use "Probe the site" above, or let the worker run one.</p></section>';
  }
  const rows = snapshots.map((snapshot: any) => {
    const when = snapshot.capturedAt ? snapshot.capturedAt.slice(0, 16).split("T").join(" ") : "unknown";
    const changes = (snapshot.changes || []).length
      ? '<ul class="protocol-list">' + snapshot.changes.map((change: any) => '<li><span class="' + (change.direction === "regressed" ? "state-bad" : change.direction === "improved" ? "state-ok" : "state-flag") + '">' + html(change.direction) + '</span> ' + html(change.detail) + '</li>').join("") + '</ul>'
      : '<span class="step-note">No change from the probe before it.</span>';
    return '<div class="mrow mcols-signal"><span class="mcell mono">' + html(when) + '</span><div class="mname"><span class="step-note">' + html(signalFacts(snapshot.signals)) + '</span>' + changes + '</div></div>';
  }).join("");
  return head + '<div class="mtable"><div class="mhead mcols-signal"><span>Probed</span><span>What it saw, and what moved</span></div>' + rows + '</div></section>';
}

export function renderActionPlan(state: PlanState, actions: { loadPlan(): void }): string {
  if (state.planState === "idle") { actions.loadPlan(); }
  const head = '<section class="section-card"><div class="section-head"><div><h2>What to fix on the site</h2><p class="subtle">Ordered by what decides whether a model can cite you at all. Every line names the observation behind it. What to do about the answers themselves is on the report.</p></div><div class="inline-actions">' + button({ label: "Probe the site", on: { "data-probe-signals": true } }) + '</div></div>';
  if (state.planState !== "ready" || !state.plan) {
    return head + '<p class="subtle">' + (state.planState === "error" ? "Could not build a plan." : "Building the plan…") + '</p></section>';
  }
  const plan = state.plan;
  if (!plan.probed) {
    return head + '<div class="warning-box">' + html(plan.detail || "No site probe yet.") + '</div></section>';
  }
  const changes = (plan.changes || []).length
    ? '<div class="warning-box"><strong>Changed since the previous probe</strong><ul class="protocol-list">' + plan.changes.map((change: any) => '<li><span class="' + (change.direction === "regressed" ? "state-bad" : change.direction === "improved" ? "state-ok" : "state-flag") + '">' + html(change.direction) + '</span> ' + html(change.detail) + '</li>').join("") + '</ul></div>'
    : '';
  const open = plan.actions.filter((action: any) => action.severity !== "done");
  const done = plan.actions.filter((action: any) => action.severity === "done");
  const row = (action: any) => '<li class="step plan-step" data-state="' + (action.severity === "critical" ? "warn" : action.severity === "done" ? "done" : "next") + '">'
    + '<span class="step-index ' + (action.severity === "critical" ? "state-bad" : action.severity === "high" ? "state-flag" : "") + '">' + html(action.severity === "done" ? "ok" : action.severity) + '</span>'
    + '<span class="step-label"><strong>' + html(action.title) + '</strong>'
    + (action.severity === "done" || !action.why ? '' : '<br><span class="step-why">' + html(action.why) + '</span>')
    + '<br><span class="step-note">Observed: ' + html(action.evidence) + '</span>'
    + (action.severity === "done" ? '' : '<br><span class="step-note state-ok">Fix: ' + html(action.fix) + '</span>')
    + '</span></li>';
  return head + changes
    + (open.length ? '<ol class="steps">' + open.map(row).join("") + '</ol>' : '<p class="subtle">Nothing outstanding.</p>')
    + (done.length ? '<details class="technical-details"><summary>' + done.length + ' already in place</summary><ol class="steps">' + done.map(row).join("") + '</ol></details>' : '')
    + '<p class="mlegend">Probed ' + html(plan.capturedAt ? plan.capturedAt.slice(0, 16).split("T").join(" ") : "never") + '.</p></section>';
}

export function renderVisibility(state: VisibilityState, selected: ProjectRow | null, actions: VisibilityActions): string {
  if (state.insightsState === "idle") { actions.loadInsights(); }
  if (!selected) return '<section class="view"><div class="empty"><div class="empty-copy"><h2>Select a project first</h2></div></div></section>';
  if (state.insightsState !== "ready" || !state.insights) {
    return '<section class="view"><div class="heading"><div><h1>Visibility</h1><p class="subtle">What the models know, who they name instead, and what they cite.</p></div></div><div class="empty"><div class="empty-copy"><h2>' + (state.insightsState === "error" ? "Could not read the evidence" : "Reading every archived answer") + '</h2></div></div></section>';
  }
  const data = state.insights;
  const core = data.insights;
  const v = core.visibility;
  const sov = core.shareOfVoice;
  const modelRows = v.byModel.map((row: any) => '<div class="mrow mcols-vis"><div class="mname"><strong>' + html(row.displayName) + '</strong><span class="mono">' + html(row.modelId) + '</span></div><span class="mcell">' + row.recognized + ' / ' + row.answered + '</span><span class="mcell">' + comparablePercent(row.score) + '</span></div>').join("");
  const voiceRow = (row: any, isTarget: any) => '<div class="mrow mcols-voice"><div class="mname"><strong>' + html(row.name) + (isTarget ? ' <span class="state-ok">you</span>' : '') + '</strong>' + (row.domain ? '<span class="mono">' + html(row.domain) + '</span>' : '') + '</div><span class="mcell">' + row.mentions + '</span><span class="mcell">' + comparablePercent(row.share) + '</span></div>';
  const voiceRows = [voiceRow(sov.target, true)].concat(sov.competitors.map((row: any) => voiceRow(row, false))).join("");
  const citedRows = core.citations.domains.map((row: any) => '<div class="mrow mcols-cited"><div class="mname"><strong class="mono">' + html(row.domain) + '</strong>' + (row.isTarget ? '<span class="state-ok">your domain</span>' : '') + '</div><span class="mcell">' + row.answers + '</span><span class="mcell">' + html(row.models.join(", ")) + '</span></div>').join("");
  const gapRows = data.citationGap.map((row: any) => '<div class="mrow mcols-cited"><div class="mname"><strong class="mono">' + html(row.domain) + '</strong><span>cited alongside ' + html(row.competitors.join(", ")) + '</span></div><span class="mcell">' + row.answers + '</span><span class="mcell">' + html(row.models.join(", ")) + '</span></div>').join("");
  const audit = data.claimAudit;
  const auditRows = [].concat(
    audit.disagreements.map((row: any) => '<li><strong>Models disagree on ' + html(row.field) + '</strong><br><span class="subtle">' + row.variants.map((variant: any) => html(variant.value) + ' (' + variant.models.length + ')').join(" vs ") + '</span></li>'),
    audit.unsourced.map((row: any) => '<li><strong class="state-flag">' + html(row.field) + ' asserted with no source</strong><br><span class="subtle">' + row.count + ' answer(s) from ' + html(row.models.join(", ")) + '</span></li>'),
    audit.mismatches.map((row: any) => '<li><strong class="state-bad">' + html(row.field) + ' shares nothing with what you declare</strong><br><span class="subtle">they say "' + html(row.asserted) + '", you say "' + html(row.declared) + '"</span></li>'),
  ).join("");
  const categoryRows = core.categories.map((row: any) => '<li>' + html(row.value) + ' <span class="subtle">' + row.count + '</span></li>').join("");
  return '<section class="view"><div class="heading"><div><h1>Visibility</h1><p class="subtle">Pooled from ' + data.runsConsidered + ' run(s) and ' + core.answered + ' parsed answer(s) for ' + html(data.domain) + '.</p></div><div class="inline-actions">' + button({ label: "Recompute", on: { "data-reload-insights": true } }) + '</div></div>'
    + renderPaste(state, actions)
    + renderActionPlan(state, actions)
    + '<div class="countstrip"><span class="count"><strong>' + (v.score === null ? "n/a" : Math.round(v.score * 100) + "%") + '</strong>Visibility</span><span class="count"><strong>' + v.recognized + '</strong>Recognised</span><span class="count"><strong>' + v.answered + '</strong>Answers</span><span class="count"><strong>' + core.citations.targetCitedIn + '</strong>Answers citing you</span><span class="count"><strong>' + data.citationGap.length + '</strong>Citation gaps</span></div>'
    + '<section class="section-card"><div class="section-head"><div><h2>Visibility by model</h2><p class="subtle">Answers where the model said it recognised the domain.</p></div></div>' + insightTable("mcols-vis", ["Model", "Recognised", "Visibility"], v.byModel.length ? [modelRows] : [], "No parsed answers yet.") + '</section>'
    + '<section class="section-card"><div class="section-head"><div><h2>Share of voice</h2><p class="subtle">Counted once per answer. A share needs a competitor to be a share of.</p></div></div>' + insightTable("mcols-voice", ["Brand", "Mentions", "Share"], [voiceRows], "Nothing named yet.") + '</section>'
    + '<section class="section-card"><div class="section-head"><div><h2>Citation gap</h2><p class="subtle">Cited when a competitor is named, never when you are. This is the shortest list of places to get into.</p></div></div>' + insightTable("mcols-cited", ["Domain", "Answers", "Models"], gapRows ? [gapRows] : [], "No gap yet. It fills in once answers name competitors, which needs web search enabled.") + '</section>'
    + '<section class="section-card"><div class="section-head"><div><h2>Cited sources</h2><p class="subtle">Every domain the answers cited.</p></div></div>' + insightTable("mcols-cited", ["Domain", "Answers", "Models"], citedRows ? [citedRows] : [], "No citations captured yet.") + '</section>'
    + '<section class="section-card"><div class="section-head"><div><h2>Claim audit</h2><p class="subtle">Disagreement, assertions with no source, and claims unlike your own description.</p></div></div>' + (auditRows ? '<ul class="protocol-list">' + auditRows + '</ul>' : '<p class="subtle">Nothing flagged across ' + audit.answers + ' answer(s).</p>') + '</section>'
    + renderCrawlerSection(state, actions) + renderSignalHistory(state, actions) + '<section class="section-card"><div class="section-head"><div><h2>How the models categorise you</h2><p class="subtle">Their words, counted.</p></div></div>' + (categoryRows ? '<ul class="protocol-list">' + categoryRows + '</ul>' : '<p class="subtle">No category returned yet.</p>') + '</section></section>';
}
