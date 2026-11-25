import { html } from "../dom.js";
import { button } from "../components/button.js";
import { section } from "../components/primitives.js";
import { loading, skeletonTable } from "../components/skeleton.js";
import { historyWord } from "../labels.js";
import { renderLiveRun } from "./run-pane.js";
import { taskCta } from "./task-views.js";
import { renderCredit, renderDecomposition, renderInterference, renderKinds, renderConcentration, renderOutreach, renderReferrals, renderSearchDemand, renderShape, renderUptake, type SourceActions } from "./source-sections.js";
import { renderDecoys, renderExperiments, renderFraming, renderHumanCheck, renderPhrasing, renderSchedule, renderStability, renderTier, renderVariance, renderVersions, type FoldCard, type TrustActions } from "./trust-sections.js";
import type { CitedPages, RunAction } from "./home-view.js";
import type { InsightsShape, LoadState, ProjectRow, RunRow } from "../types.js";
import type { MeasurementTask } from "../../../product/topics/next-task.js";
import type { CitationHistory, PageVerdict } from "../../../product/citations/citation-history.js";
import type { ScoreWeights } from "../../../product/topics/visibility-score.js";

type Arg<F extends (...args: never[]) => unknown, N extends number> = Parameters<F>[N];

/** What the shell reads: the insights, the run it offers to start, and which folds are open. */
export interface AnswerPageState {
  answerEngine: InsightsShape | null;
  answerEngineState: LoadState;
  liveRun: RunRow | null;
  lastRun: RunRow | null;
  promptRunning: boolean;
  panelOpen: string[];
  cited: CitedPages | null;
  citedState: LoadState;
  history: CitationHistory | null;
  historyState: LoadState;
}

export interface SourcesState extends AnswerPageState {
  uptake: Arg<typeof renderUptake, 1>;
  uptakeState: LoadState;
  outreach: Arg<typeof renderOutreach, 1>;
  outreachState: LoadState;
  harvesting: boolean;
  searchDemand: Arg<typeof renderSearchDemand, 1>;
  searchDemandState: LoadState;
  pulling: boolean;
  referrals: Arg<typeof renderReferrals, 1>;
  referralsState: LoadState;
  pullingReferrals: boolean;
  credit: Arg<typeof renderCredit, 1>;
  creditState: LoadState;
  kinds: Arg<typeof renderKinds, 1>;
  kindsState: LoadState;
  shape: Arg<typeof renderShape, 1>;
  shapeState: LoadState;
  concentration: Arg<typeof renderConcentration, 1>;
  concentrationState: LoadState;
  interference: Arg<typeof renderInterference, 1>;
  interferenceState: LoadState;
}

export interface TrustPageState extends AnswerPageState {
  check: Arg<typeof renderHumanCheck, 1>;
  checkState: LoadState;
  experiments: Arg<typeof renderExperiments, 1>;
  experimentsState: LoadState;
  schedule: Arg<typeof renderSchedule, 1>;
  scheduleState: LoadState;
  regions: Arg<typeof renderSchedule, 2>;
}

/** The weights the shell hands to a page body. The two floors are always there; the objective only on an archive scored after it existed. */
export interface AnswerPageWeights {
  objective: string;
  weights: Pick<ScoreWeights, "prominenceFloor" | "sentimentFloor"> & Partial<ScoreWeights>;
}

/** The loaders these pages call while idle. Each must be a hoisted function declaration that reads live state. */
export interface AnswerActions {
  loadAnswerEngine(): void;
  loadLiveRun(): void;
}

export interface CitedActions {
  loadCited(): void;
  loadHistory(): void;
}

export type SourcesActions = SourceActions & AnswerActions & CitedActions;
export type TrustPageActions = TrustActions & AnswerActions;

// One shell for the two pages built on the same archive: the loading,
// the empty state and every notice live here once rather than three times.
export function answerPage(state: AnswerPageState, selected: ProjectRow | null, tasks: MeasurementTask[], runAction: RunAction, actions: AnswerActions,
  title: string, subtitle: string, body: (data: InsightsShape, page: AnswerPageWeights) => string): string {
  if (!selected) return '<section class="view"><div class="empty"><div class="empty-copy"><h2>Select a project first</h2></div></div></section>';
  if (state.answerEngineState === "idle") { actions.loadAnswerEngine(); actions.loadLiveRun(); }
  if (state.answerEngineState !== "ready") {
    return '<section class="view"><div class="heading"><div><h1>' + html(title) + '</h1><p class="subtle">' + html(subtitle) + '</p></div></div><div class="empty"><div class="empty-copy"><h2>' + (state.answerEngineState === "error" ? "Could not read the answers" : "Reading the archived answers") + '</h2></div></div></section>';
  }
  const data = state.answerEngine;
  if (!data || data.answers === 0) {
    return '<section class="view"><div class="heading"><div><h1>' + html(title) + '</h1><p class="subtle">' + html(subtitle) + '</p></div><div class="inline-actions">' + button({ label: "Set up prompts", kind: "primary", on: { "data-page": "prompts" } }) + '</div></div>'
      + '<div class="empty"><div class="empty-copy"><h2>No answers yet</h2><p class="subtle">Generate a prompt set, activate the questions worth tracking, then run them. Every number on this page traces back to an archived answer.</p></div></div></section>';
  }
  const weights: AnswerPageWeights["weights"] = data.weights || { prominenceFloor: 0, sentimentFloor: 0 };
  const objective = weights.objective
    ? '<p class="subtle"><strong>What it is built to maximise.</strong> ' + html(weights.objective) + '</p>'
      + '<p class="subtle"><strong>What it cannot be used for.</strong> ' + html(weights.limits || "") + '</p>'
    : '';
  // Asking everything again is the wrong price for a retry, so the button
  // asks only the combinations that failed, where they failed.
  const retryButton = state.lastRun && state.lastRun.answersFailed && !state.liveRun
    ? '<div class="inline-actions">' + button({ label: (state.promptRunning ? "Asking\u2026" : "Ask the " + state.lastRun.answersFailed + " that failed again"), kind: "quiet", disabled: state.promptRunning, on: { "data-retry-run": state.lastRun.id } }) + '</div>'
    : '';
  // Two codes can share one wording, and printing both reads as a bug.
  const byWords = new Map<string, { count: number; models: string[] }>();
  for (const reason of data.failureReasons || []) {
    if (!reason.count) continue;
    const held = byWords.get(reason.label) || { count: 0, models: [] };
    held.count += reason.count;
    for (const name of reason.models || []) {
      if (!held.models.includes(name)) held.models.push(name);
    }
    byWords.set(reason.label, held);
  }
  const causes = [...byWords.entries()].map(([label, held]) => ({ label, ...held })).sort((left, right) => right.count - left.count);
  const causeList = causes.length
    ? '<details class="technical-details"><summary>What failed, and why (' + causes.length + ')</summary><ul class="protocol-list">'
      + causes.map((reason) => '<li>' + reason.count + ' to ' + html(reason.label)
        + (reason.models.length ? '<br><span class="subtle">' + html(reason.models.slice(0, 3).join(", ")) + '</span>' : '')
        + '</li>').join("")
      + '</ul></details>'
    : '';
  const failedNote = data.answersFailed ? '<div class="warning-box">' + data.answersFailed + ' answer(s) failed and are excluded. They are not counted as answers that did not name you.' + causeList + taskCta(tasks, "answers-failed") + retryButton + '</div>' : '';
  // A question you retired is one you said is not your business. Its old
  // answers stay archived and stop supplying the figures, and the reader
  // is told rather than left wondering where the count went.
  const retiredNote = data.answersRetired
    ? '<div class="warning-box">' + data.answersRetired + ' archived answer(s) belong to questions since retired, and are left out of every figure here. They are still in the archive. A retired question is not this brand\u2019s category, so it does not get to say who the rivals are.</div>'
    : '';
  const identityNote = data.identityCaveat ? '<div class="warning-box"><strong>Your name is a word in your own category.</strong> ' + html(data.identityCaveat) + '</div>' : '';
  const corr = data.corroboration;
  // Absent on an archive answered before the check existed, so nothing is
  // claimed about those rather than counting them as unverified.
  const corroborationNote = corr && corr.reported
    ? '<div class="warning-box"><strong>What the model said it named, checked against what it wrote.</strong> '
      + corr.measured + ' of ' + corr.reported + ' mentions were found in the answer and their position measured from it'
      + (corr.absentFromAnswer ? ', and ' + corr.absentFromAnswer + ' named nothing the answer actually contains' : '')
      + '. ' + (corr.quotesChecked ? corr.quotesFound + ' of ' + corr.quotesChecked + ' quoted lines are really in the answer.' : '')
      + '<details class="technical-details"><summary>What that does and does not prove</summary><p>' + html(corr.caveat) + '</p></details>'
      + taskCta(tasks, "quotes-not-found") + taskCta(tasks, "mentions-absent") + '</div>'
    : '';
  // Naming the cause matters more than naming the symptom. Telling somebody
  // to get a provider with web search is wrong when they have one, switched off.
  const act0 = data.activation;
  const citationCause = !act0 || !act0.considered
    ? 'A provider with web search will produce them.'
    : act0.notRequested && !act0.activated
      ? act0.notRequested + ' answer(s) came from a model that can search the web and was told not to. Web search is off in Choose models, so no run could have produced a citation.'
      : act0.unavailable === act0.considered
        ? 'None of the models that ran can search the web at all, so no citation was ever possible.'
        : 'A provider with web search will produce them.';
  const citationFix = taskCta(tasks, "search-switched-off") || taskCta(tasks, "no-model-can-search") || taskCta(tasks, "no-sources-returned");
  const citationNote = data.citationsUnavailable
    ? '<div class="warning-box">No answer carried a citation, so there are no sources to analyse. That is a property of the models you ran, not evidence that nobody cites you. '
      + html(citationCause) + citationFix + '</div>'
    : '';
  // An action stays where it can be taken. An explanation folds, because
  // five amber boxes above a page is two screens before any content.
  const notes = [identityNote, failedNote, retiredNote, citationNote, corroborationNote].filter(Boolean);
  const acts = notes.filter((note) => note.indexOf("task-cta") >= 0 || note.indexOf("data-retry-run") >= 0);
  const explains = notes.filter((note) => acts.indexOf(note) < 0);
  const caveats = explains.length
    ? '<details class="caveats" data-fold="answer-caveats"' + (state.panelOpen.indexOf("answer-caveats") >= 0 ? " open" : "")
      + '><summary>What these numbers do and do not cover (' + explains.length + ')</summary>' + explains.join("") + '</details>'
    : '';
  return '<section class="view"><div class="heading"><div><h1>' + html(title) + '</h1>'
    + '<p class="subtle">' + html(subtitle) + '</p></div><div class="inline-actions">' + runAction("Ask the questions") + '</div></div>'
    + renderLiveRun(state.liveRun)
    + acts.join("") + caveats
    + body(data, { objective, weights })
    + '</section>';
}

// What the page answers stays open. The eight cards that explain it fold.
const SOURCE_LEAD = ["source-pages", "source-uptake"];

export function renderAnswerEngine(state: SourcesState, selected: ProjectRow | null, tasks: MeasurementTask[], runAction: RunAction, fold: FoldCard, actions: SourcesActions): string {
  const card = (id: string, title: string, blurb: string, body: string) => section({
    id, title, blurb, body, wide: true,
    ...(SOURCE_LEAD.includes(id) ? {} : { folded: !state.panelOpen.includes(id) }),
  });
  return answerPage(state, selected, tasks, runAction, actions, "Sources", "What the answers cited, and whether the answer used it. A citation is an address until the page behind it is read.", () => ''
    + card("source-pages", "Sources", "A domain says you are cited. A page says which one to write more of.", renderCitedPages(state, tasks, fold, actions))
    + card("source-uptake", "Cited, or actually used", "A citation says a page was listed. This says how much of the answer came from it. A page cited and used for nothing is the finding worth having.", renderUptake(state.uptakeState, state.uptake, tasks, actions))
    + card("source-outreach", "Pages the models read", "Each cited page, fetched and read back: who is on it, in what order, and whether you are. A page cited on a question you lose, without you on it, is the most specific thing here.", renderOutreach(state.outreachState, state.outreach, state.harvesting, actions))
    + card("source-demand", "What people search for", "Search Console, joined to the questions you track. Not AI prompt volume, but real demand for the same subject.", renderSearchDemand(state.searchDemandState, state.searchDemand, state.pulling, actions))
    + card("source-referrals", "Who arrived from an assistant", "Analytics sessions by referring assistant. Being named is one claim; somebody arriving because of it is another.", renderReferrals(state.referralsState, state.referrals, state.pullingReferrals, actions))
    + card("source-credit", "Who gets the credit", "Where a page was cited against how much of the answer it actually accounts for. A page credited first that the answer took nothing from was credited for something other than its content.", renderCredit(state.creditState, state.credit, actions))
    + card("source-kinds", "What kind of page gets cited", "The ranked best-of listicle was the most cited format in published work, at about a fifth of everything. What wins here is a different question, and this is the answer to it.", renderKinds(state.kindsState, state.kinds, actions))
    + card("source-shape", "How the pages that beat you are built", "The same facts rendered as structure instead of prose were measured to take citation credit from the page that stayed prose. This is the one lever here with a causal test behind it.", renderShape(state.shapeState, state.shape, actions))
    + card("source-concentration", "Who supplies these answers", "A category where a handful of domains account for most citations is one where getting onto those domains is the whole game. A long tail is one where a new page can still get in.", renderConcentration(state.concentrationState, state.concentration, actions))
    + card("source-interference", "Someone else is working on this answer", "A document rewritten to match what an engine likes to cite stays factually consistent with the original, so nothing that checks facts will catch one. What is left is shape.", renderInterference(state.interferenceState, state.interference, actions))
  );
}

export function renderTrustPage(state: TrustPageState, selected: ProjectRow | null, tasks: MeasurementTask[], runAction: RunAction, fold: FoldCard,
  scoreBreakdown: (score: InsightsShape["overall"]) => string, actions: TrustPageActions): string {
  return answerPage(state, selected, tasks, runAction, actions, "Trust", "The instrument rather than the brand. Every figure on the other pages is worth what this page says it is.", (data, page) => ''
    + section({ id: "trust-score", title: "How the score is built", wide: true,
      blurb: "Presence scaled by where you appear and how you are described.",
      body: scoreBreakdown(data.overall)
        + '<details class="technical-details"><summary>The formula, and the judgement in it</summary>' + page.objective + '<p class="subtle">score = presence \u00d7 (' + page.weights.prominenceFloor + ' + ' + (1 - page.weights.prominenceFloor).toFixed(1) + ' \u00d7 prominence) \u00d7 (' + page.weights.sentimentFloor + ' + ' + (1 - page.weights.sentimentFloor).toFixed(1) + ' \u00d7 sentiment) \u00d7 100.</p><p class="subtle">The two floors are a judgement, not a measurement: being named late and grudgingly is still better than not being named, so prominence and sentiment scale presence rather than replacing it. Every component above is reported separately so you can ignore the composite entirely.</p></details>' })
    + renderTier(data.tier, fold)
    + renderVersions(data.versions, fold)
    + renderDecoys(data.decoys, fold)
    + renderVariance(data.variance, fold)
    + taskCta(tasks, "too-few-answers")
    + renderStability(data.stability, tasks, fold)
    + renderPhrasing(data.phrasing, fold)
    + renderFraming(data.framing, fold)
    + fold("trust-check", "Check the machine", "Every figure here rests on a model classifying what another model wrote. Judge a few yourself and the agreement rate becomes the confidence in the whole column.", renderHumanCheck(state.checkState, state.check, actions))
    + fold("trust-experiments", "Did your change do anything", "Everything else here watches. This tests. Change something, leave a comparable set of questions alone, and whatever moved for both is subtracted rather than claimed.", renderExperiments(state.experimentsState, state.experiments, actions))
    + fold("trust-schedule", "Keep it running", "A tracker that is run by hand is a snapshot.", renderSchedule(state.scheduleState, state.schedule, state.regions, actions))
  );
}

export function renderCitedPages(state: Pick<AnswerPageState, "cited" | "citedState" | "history" | "historyState">, tasks: MeasurementTask[], fold: FoldCard, actions: CitedActions): string {
  if (state.citedState === "idle") { actions.loadCited(); }
  if (state.citedState === "error") return '<p class="subtle">Could not read the archived sources.</p>';
  if (state.citedState !== "ready" || !state.cited) return loading("the archived sources", skeletonTable({ rows: 5, columns: "minmax(0,1fr) 96px 82px 90px" }));
  const data = state.cited;
  if (data.unavailable) {
    return '<div class="warning-box">No answer carried a source, so there are no pages to analyse. That is a property of the models you ran, not evidence that nobody cites you.</div>';
  }
  if (!data.answersWithCitations) return '<p class="subtle">Nothing has been answered with a source yet.</p>';

  const own = data.ownPages.length
    ? '<div class="mtable"><div class="mhead mcols-aemodel"><span>Your page</span><span>Answers</span><span>Questions</span><span></span></div>'
      + data.ownPages.slice(0, 12).map((page) => '<div class="mrow mcols-aemodel">'
        + '<div class="mname"><strong>' + html(page.path) + '</strong><span class="mono">' + html(page.url) + '</span></div>'
        + '<span class="mcell">' + page.answers + '</span>'
        + '<span class="mcell">' + page.prompts.length + '</span>'
        + '<span class="mcell"><a href="' + html(page.url) + '" target="_blank" rel="noreferrer">Open</a></span></div>').join("") + '</div>'
    : '<p class="subtle">No answer cited a page of yours. Every source below belongs to somebody else.</p>';

  const rivals = '<div class="mtable"><div class="mhead mcols-aemodel"><span>Domain</span><span>Answers</span><span>Pages</span><span>Without you</span></div>'
    + data.domains.slice(0, 12).map((row) => '<div class="mrow mcols-aemodel">'
      + '<div class="mname"><strong>' + html(row.domain) + (row.isTarget ? ' <span class="pill good">You</span>' : '') + '</strong></div>'
      + '<span class="mcell">' + row.answers + '</span>'
      + '<span class="mcell">' + row.pages + '</span>'
      + '<span class="mcell">' + row.answersWithoutYou + '</span></div>').join("") + '</div>';

  const openings = data.openings.length
    ? '<ul class="protocol-list">' + data.openings.slice(0, 8).map((row) => '<li><strong>' + html(row.domain) + '</strong><br><span class="subtle">won "' + html(row.prompt) + '"</span><br><span class="mono">' + html(row.url) + '</span></li>').join("") + '</ul>'
    : '<p class="subtle">No page won a question you were absent from.</p>';

  // Four tables stacked under one heading was five screens. What the page
  // is for stays open; each table folds.
  return '<p class="subtle">' + data.answersWithCitations + ' of ' + data.answersConsidered + ' answers carried a source.</p>'
    + renderDecomposition(data.decomposition, tasks)
    + fold("sources-own", "Pages of yours the models reached for",
      "The pages that did the work, so you know which ones to keep.", own)
    + fold("sources-domains", "Every domain cited",
      "Who else is in the answer, and how often without you.", rivals)
    + fold("sources-openings", "Pages that won a question you are absent from",
      "A question somebody else answered. This is the shortest list to act on.", openings)
    + fold("sources-history", "Pages that stopped being cited",
      "A page cited before and not now, which is a change rather than a level.", renderCitationHistory(state, actions));
}

// Pages that stopped being cited, which is a claim no single run can make.
export function renderCitationHistory(state: Pick<AnswerPageState, "history" | "historyState">, actions: Pick<CitedActions, "loadHistory">): string {
  if (state.historyState === "idle") { actions.loadHistory(); }
  if (state.historyState === "error") return '<p class="subtle">Could not read what each page did over time.</p>';
  if (state.historyState !== "ready" || !state.history) return loading("the citation history", skeletonTable({ rows: 4, columns: "minmax(0,1fr) 96px 110px 96px" }));
  const data = state.history;
  if (data.measurableRuns < 2) {
    return '<p class="subtle">' + data.measurableRuns + ' run(s) carried a citation. Two are needed before a page can be shown to have changed either way.</p>';
  }
  const worth: PageVerdict[] = ["dropped", "slipping", "cited_once"];
  const rows = (data.pages || []).filter((row) => worth.indexOf(row.verdict) >= 0).slice(0, 12);
  const table = rows.length
    ? '<div class="mtable"><div class="mhead mcols-aemodel"><span>Page</span><span>Answers</span><span>Last cited</span><span>State</span></div>'
      + rows.map((row) => '<div class="mrow mcols-aemodel">'
        + '<div class="mname"><strong>' + html(row.host) + '</strong><span class="mono">' + html(row.url) + '</span></div>'
        + '<span class="mcell">' + row.answers + '</span>'
        + '<span class="mcell mono">' + html(row.lastCitedAt ? row.lastCitedAt.slice(0, 10) : "never") + '</span>'
        + '<span class="mcell">' + historyWord(row.verdict) + '</span></div>').join("") + '</div>'
    : '<p class="subtle">Every page cited before is still being cited.</p>';
  return '<p class="subtle">Across ' + data.measurableRuns + ' run(s) that cited something'
    + (data.silentRuns ? ', ignoring ' + data.silentRuns + ' that cited nothing at all' : '') + '.</p>'
    + table + '<p class="subtle">' + html(data.caveat) + '</p>';
}
