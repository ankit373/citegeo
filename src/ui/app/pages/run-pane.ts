import { html } from "../dom.js";
import { button } from "../components/button.js";
import { percent, remaining } from "../format.js";
import { loading, skeletonText } from "../components/skeleton.js";
import type { AnswerRow, LoadState, Panel, RunRow, Unshaped } from "../types.js";

export function renderLiveRun(run: RunRow | null): string {
  if (!run) return "";
  const done = run.answersCompleted + run.answersFailed;
  const pctDone = run.answersRequested ? Math.round(done / run.answersRequested * 100) : 0;
  const since = Date.parse(run.startedAt || "");
  // Until one answer lands there is no rate to read, so the run says it is
  // still working that out rather than printing a number nothing supports.
  const left = run.status === "cancelling" || !since ? null : remaining(done, run.answersRequested, Date.now() - since);
  const eta = run.status === "cancelling" ? "" : (left || (done ? "" : "working out how long this takes"));
  const doing = run.currentPromptText
    ? 'Asking ' + html(run.currentModelId || "a model") + ': “' + html(run.currentPromptText) + '”'
    : "Starting up";
  return '<div class="liverun is-clickable" data-open-run="' + html(run.id) + '" role="button" tabindex="0"><div class="liverun-top"><strong>' + (run.status === "cancelling" ? "Stopping" : "Running") + '</strong>'
    + '<span>' + done + ' of ' + run.answersRequested + ' answers</span>'
    + (eta ? '<span class="subtle">' + html(eta) + '</span>' : '')
    + '<span class="spacer"></span>'
    + (run.status === "cancelling"
      ? '<span class="subtle">Finishing the answer in flight.</span>'
      : button({ label: "Stop", tone: "danger", on: { "data-stop-run": true } }))
    + '</div><div class="bar is-live"><i style="width:' + pctDone + '%"></i></div>'
    + '<p class="subtle">' + doing + '. Open this to watch each question and answer as it lands.</p></div>';
}

export function paneRun(panel: Panel | null, liveRun: RunRow | null, lastRun: RunRow | null): RunRow | null {
  if (!panel || panel.kind !== "run") return null;
  if (liveRun && liveRun.id === panel.runId) return liveRun;
  return lastRun && lastRun.id === panel.runId ? lastRun : null;
}

export function runIsLive(run: RunRow | null): boolean {
  return Boolean(run && (run.status === "running" || run.status === "cancelling"));
}

export function runPaneProgress(run: RunRow | null): string {
  if (!run) return '<span class="subtle">Every answer below is archived.</span>';
  if (run.status !== "running" && run.status !== "cancelling") {
    return '<span>' + html(run.status) + ' · ' + run.answersCompleted + ' answered, ' + run.answersFailed + ' failed, of ' + run.answersRequested + ' asked</span>';
  }
  const done = run.answersCompleted + run.answersFailed;
  const share = run.answersRequested ? Math.round(done / run.answersRequested * 100) : 0;
  const since = Date.parse(run.startedAt || "");
  const left = run.status === "cancelling" || !since ? null : remaining(done, run.answersRequested, Date.now() - since);
  return '<span>' + done + ' of ' + run.answersRequested + ' answers · ' + run.answersFailed + ' failed' + (left ? ' · ' + html(left) : '') + '</span>'
    + '<div class="bar is-live"><i style="width:' + share + '%"></i></div>';
}

export function mentionChips(answer: AnswerRow): string {
  const rows = (answer.mentions || []).slice().sort((left, right) => (left.firstMentionOffset === null ? 1 : 0) - (right.firstMentionOffset === null ? 1 : 0) || (left.firstMentionOffset || 0) - (right.firstMentionOffset || 0));
  if (!rows.length) return '<span class="subtle">No organisation was named.</span>';
  return rows.map((row, index) => '<span class="namechip' + (row.isTarget ? ' is-you' : '') + '">'
    + '<b>' + (index + 1) + '</b>' + html(row.name)
    + (row.recommendation && row.recommendation !== "unknown" ? ' <i>' + html(row.recommendation) + '</i>' : '')
    + '</span>').join("");
}

export interface PaneRunState { panel: Panel | null; liveRun: RunRow | null; lastRun: RunRow | null }
export interface RunFeedState extends PaneRunState {
  runFeed: AnswerRow[]; runFeedState: LoadState;
  regions: Array<{ id: string; label: string }>; languages: Array<{ id: string; label: string }>;
}
export interface BriefState { brief: Unshaped; briefState: LoadState }
export interface EvidenceState extends RunFeedState, BriefState { panelState: LoadState; panelAnswers: AnswerRow[]; selectedId: string }

// The mentions the model reported, marked in its own words. This is the
// receipt the whole product claims to keep.
function markMentions(text: string, mentions: any) {
  const names = ((mentions || []) as any[]).map((row: any) => row.name).filter(Boolean).sort((a: string, b: string) => b.length - a.length);
  let out = html(text);
  for (const name of names) {
    const needle = html(name);
    const at = out.toLowerCase().indexOf(needle.toLowerCase());
    if (at < 0) continue;
    out = out.slice(0, at) + "<mark>" + out.slice(at, at + needle.length) + "</mark>" + out.slice(at + needle.length);
  }
  return out;
}

// Answers archived before markets and languages existed carry neither, and
// printing the raw field showed "undefined", which reads as a value.
function labelFor(rows: any[], id: string | undefined, fallback: string) {
  if (!id) return fallback;
  const found = (rows || []).find((row) => row.id === id);
  return found ? found.label : id;
}

export function runAnswerCard(answer: AnswerRow, state: RunFeedState): string {
  const failed = answer.status !== "completed";
  const target = (answer.mentions || []).find((row) => row.isTarget);
  const badge = answer.status === "no_answer"
    ? '<span class="pill flat">no answer from this surface</span>'
    : failed
      ? '<span class="pill bad">' + html(answer.status.split("_").join(" ")) + '</span>'
      : target ? '<span class="pill good">named you</span>' : '<span class="pill flat">did not name you</span>';
  const came = failed
    ? '<p class="runtext state-bad">' + html(answer.errorMessage || answer.errorCode || "The model returned nothing usable.") + '</p>'
    : '<p class="runtext">' + (answer.text ? markMentions(answer.text, answer.mentions) : html("This answer returned no text.")) + '</p>';
  const sources = (answer.citationUrls || []).length
    ? answer.citationUrls.slice(0, 6).map((url) => '<a href="' + html(url) + '" target="_blank" rel="noreferrer">' + html(url) + '</a>').join("")
    : '<span class="subtle">No source was cited.</span>';
  return '<article class="evidence"><div class="evidence-head"><strong>' + html(answer.modelDisplayName || answer.modelId) + '</strong>' + badge
    + '<span>' + html(labelFor(state.regions, answer.regionId, "No stated market")) + ' · ' + html(labelFor(state.languages, answer.languageId, "English")) + '</span>'
    + '<span class="spacer"></span><span>' + (answer.latencyMs === null || answer.latencyMs === undefined ? "no timing" : Math.round(answer.latencyMs / 100) / 10 + 's') + '</span></div>'
    + '<div class="runfield"><span>Sent</span><p class="runtext">' + html(answer.promptText) + '</p></div>'
    + '<div class="runfield"><span>Came back</span>' + came + '</div>'
    + '<div class="runfield"><span>Named, in order</span><div class="namechips">' + mentionChips(answer) + '</div></div>'
    + '<div class="evidence-foot">' + sources + '</div></article>';
}

function runInFlightCard(state: PaneRunState): string {
  const current = paneRun(state.panel, state.liveRun, state.lastRun);
  const run = runIsLive(current) ? current : null;
  if (!run || !run.currentPromptText) return "";
  return '<article class="evidence is-live"><div class="evidence-head"><strong>' + html(run.currentModelId || "a model") + '</strong>'
    + '<span class="pill flat">asking now</span><span class="spacer"></span><span>waiting for the answer</span></div>'
    + '<div class="runfield"><span>Sent</span><p class="runtext">' + html(run.currentPromptText) + '</p></div></article>';
}

export function runFeedBody(state: RunFeedState): string {
  if (state.runFeedState === "loading" && !state.runFeed.length) return loading("what this run has archived", skeletonText(3) + skeletonText(4));
  if (state.runFeedState === "error") return '<p class="subtle">Could not read this run.</p>';
  const cards = state.runFeed.map((answer) => runAnswerCard(answer, state)).join("");
  const flight = runInFlightCard(state);
  if (!cards && !flight) return '<p class="subtle">No answer has come back yet. The first one appears here as soon as it does.</p>';
  return flight + cards;
}

function renderRunPane(state: RunFeedState): string {
  return '<div class="panel-scrim" data-close-panel></div><aside class="panel" role="dialog" aria-label="Live run">'
    + '<div class="panel-head"><div><h2>' + (runIsLive(paneRun(state.panel, state.liveRun, state.lastRun)) ? "Live run" : "Finished run") + '</h2>'
    + '<p class="subtle">What went to each model and what came back, newest first.</p>'
    + '<div class="runpane-progress">' + runPaneProgress(paneRun(state.panel, state.liveRun, state.lastRun)) + '</div></div>'
    + '<div class="panel-actions">'
    + (runIsLive(paneRun(state.panel, state.liveRun, state.lastRun)) && state.liveRun && state.liveRun.status !== "cancelling" ? button({ label: "Stop", tone: "danger", on: { "data-stop-run": true } }) : '')
    + '<button type="button" class="close" data-close-panel aria-label="Close">×</button></div></div>'
    + '<div class="panel-body">' + runFeedBody(state) + '</div></aside>';
}

function briefVoice(voice: Unshaped): string {
  const spread = voice.answers + ' answer(s)'
    + (voice.positive ? ' · ' + voice.positive + ' recommended' : '')
    + (voice.negative ? ' · ' + voice.negative + ' warned against' : '')
    + (voice.prominence === null ? '' : ' · named ' + percent(voice.prominence) + ' of the way to first');
  const quotes = voice.quotes.length
    ? '<ul class="quotes">' + voice.quotes.map((quote: any) => '<li>' + html(quote) + '</li>').join("") + '</ul>'
    : '<p class="subtle">Named without a reason given.</p>';
  return '<div class="voice' + (voice.isTarget ? ' is-you' : '') + '"><div class="voice-top"><strong>' + html(voice.name) + '</strong>'
    + (voice.isTarget ? '<span class="pill good">You</span>' : '') + '<span class="subtle">' + html(spread) + '</span></div>' + quotes + '</div>';
}

function renderBrief(state: BriefState): string {
  if (state.briefState === "loading") return loading("what the models credited", skeletonText(3));
  if (state.briefState === "error" || !state.brief) return '';
  const brief = state.brief;
  if (!brief.answers) return '<div class="brief"><p class="why">' + html(brief.verdict) + '</p></div>';
  const rivals = brief.voices.filter((voice: any) => !voice.isTarget).slice(0, 5);
  const you = brief.voices.find((voice: any) => voice.isTarget);
  const coverage = brief.namedBy.length
    ? '<p class="evidence-note">Named you: ' + html(brief.namedBy.join(", ")) + '.'
      + (brief.missedBy.length ? ' Did not: ' + html(brief.missedBy.join(", ")) + '.' : '') + '</p>'
    : '<p class="evidence-note">Not named by ' + html(brief.missedBy.join(", ")) + '.'
      + (brief.namesYouElsewhere.length ? ' These name you elsewhere: ' + html(brief.namesYouElsewhere.join(", ")) + '.' : '') + '</p>';
  const contest = brief.contest;
  const contestClass = contest.state === "open" ? "ready" : contest.state === "settled" ? "warning" : "";
  const contestLine = '<p class="evidence-note">'
    + (contest.state === "unknown" ? '' : '<span class="tag ' + contestClass + '">'
      + (contest.state === "open" ? "Open field" : contest.state === "settled" ? "Settled field" : "Contested field") + '</span> ')
    + html(contest.reason)
    + ' Being absent from a settled question is a harder problem than being absent from an open one.</p>';
  const demand = brief.demand
    ? '<p class="evidence-note">Asked ' + brief.demand.match.exactTerms + ' time(s) in the indexed corpus, '
      + brief.demand.match.relatedTerms + ' loosely. A historical sample of real conversations, not live volume.</p>'
    : '<p class="evidence-note">No corpus is indexed, so how often anyone asks this is unknown. That is not zero demand.</p>';
  const sources = brief.sources.length
    ? '<h3>What these answers read</h3><div class="evidence-foot">' + brief.sources.slice(0, 8).map((url: any) => '<a href="' + html(url) + '" target="_blank" rel="noreferrer">' + html(url) + '</a>').join("") + '</div>'
    : '<p class="evidence-note">These answers cited no source, so nothing here says which page to write. That is a property of the models that ran.</p>';
  return '<div class="brief"><p class="why">' + html(brief.verdict) + '</p>' + coverage + contestLine + demand
    + (rivals.length
      ? '<h3>What the models credited, in their own words</h3>'
        + '<p class="evidence-note">This is the standard this question is answered against. A model repeats what its sources say about a product, so these lines are the claims you would have to be credited with, somewhere it reads.</p>'
        + rivals.map(briefVoice).join("")
      : '')
    + (you && you.quotes.length ? '<h3>What they said about you</h3>' + briefVoice(you) : '')
    + sources + '</div>';
}

export function renderEvidence(state: EvidenceState): string {
  if (!state.panel) return '<div class="panel-scrim" data-close-panel></div><aside class="panel" aria-hidden="true"></aside>';
  if (state.panel.kind === "run") return renderRunPane(state);
  if (state.panel.kind === "panel") {
    return '<div class="panel-scrim" data-close-panel></div><aside class="panel is-wide-panel" role="dialog" aria-label="' + html(state.panel.title) + '">'
      + '<div class="panel-head"><div><h2>' + html(state.panel.title) + '</h2><p class="subtle">' + html(String(state.panel.blurb || "")) + '</p></div>'
      + '<div class="panel-actions">'
      + '<input type="search" class="panel-search" data-panel-search placeholder="Search this panel" aria-label="Search this panel">'
      + '<span class="panel-filter-note subtle" data-panel-filter-note aria-live="polite"></span>'
      + button({ label: "Export CSV", kind: "quiet", on: { "data-panel-export": true } })
      + button({ label: "Close", kind: "quiet", on: { "data-close-panel": true } }) + '</div></div>'
      + '<div class="panel-body">' + String(state.panel.body || "") + '</div></aside>';
  }
  const body = state.panelState === "loading"
    ? loading("the archived answers", skeletonText(4) + skeletonText(3))
    : state.panelState === "error"
      ? '<p class="subtle">Could not read the answers for this question.</p>'
      : !state.panelAnswers.length
        ? '<p class="subtle">' + (state.panel.kind === "brand" ? "No archived answer names this brand that way." : "No answer has been archived for this question yet.") + '</p>'
        : state.panelAnswers.map((answer) => {
            const target = (answer.mentions || []).find((row) => row.isTarget);
            const badge = answer.status !== "completed"
              ? '<span class="pill bad">' + html(answer.status.split("_").join(" ")) + '</span>'
              : target
                ? '<span class="pill good">named you · ' + html(target.recommendation) + '</span>'
                : '<span class="pill flat">did not name you</span>';
            const sources = (answer.citationUrls || []).length
              ? '<div class="evidence-foot">' + answer.citationUrls.slice(0, 8).map((url) => '<a href="' + html(url) + '" target="_blank" rel="noreferrer">' + html(url) + '</a>').join("") + '</div>'
              : '<div class="evidence-foot">This answer cited no sources.</div>';
            return '<article class="evidence"><div class="evidence-head"><strong>' + html(answer.modelDisplayName) + '</strong>'
              + badge
              + '<span>' + html(labelFor(state.regions, answer.regionId, "No stated market")) + ' · ' + html(labelFor(state.languages, answer.languageId, "English")) + '</span>'
              + '<span class="spacer"></span><span>' + html((answer.createdAt || "").slice(0, 16).replace("T", " ")) + '</span></div>'
              // An answer without the question it answered is not evidence
              // of anything. The prompt pane is already headed by its own.
              + (state.panel && state.panel.kind !== "evidence" && answer.promptText
                ? '<p class="evidence-asked"><span>Asked</span>' + html(String(answer.promptText)) + '</p>'
                : '')
              + '<div class="evidence-text">' + (answer.text ? markMentions(answer.text, answer.mentions) + (answer.errorMessage ? '' : '') : html(answer.errorMessage || "This answer returned no text.")) + '</div>'
              + sources + '</article>';
          }).join("");
  return '<div class="panel-scrim" data-close-panel></div><aside class="panel" role="dialog" aria-label="Archived answers">'
    + '<div class="panel-head"><div><h2>' + html(state.panel.title) + '</h2><p class="subtle">'
    + (state.panel.kind === "brand"
      ? 'Every archived answer that named this brand. The figures on the dashboard are counts of these.'
      : 'What the models rewarded here, and every archived answer behind it.') + '</p></div>'
    + '<div class="panel-actions">'
    + (state.brief ? '<a class="button" href="/api/projects/' + html(state.selectedId) + '/prompt-brief.md?promptId=' + encodeURIComponent(state.panel.promptId) + '" download>Take the brief</a>' : '')
    + '<button type="button" class="close" data-close-panel aria-label="Close">×</button></div></div>'
    + '<div class="panel-body">' + renderBrief(state) + '<h3 class="panel-section">The answers themselves</h3>' + body + '</div></aside>';
}
