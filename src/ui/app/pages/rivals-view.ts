import { html } from "../dom.js";
import { trendChart } from "../components/chart.js";
import { button } from "../components/button.js";
import { emptyState, notice, section } from "../components/primitives.js";
import { loading, skeletonTable, skeletonTiles } from "../components/skeleton.js";
import { percent, score as scoreText } from "../format.js";
import { effectLabel, intentLabel } from "../labels.js";
import { dashboardBody, dashboardPanels } from "./dashboard-view.js";
import { dashboardView, type DashboardState, type HomeActions, type RunAction } from "./home-view.js";
import { renderLeaderboard, renderPersonaRows } from "./metric-cells.js";
import { renderLiveRun } from "./run-pane.js";
import { taskCta } from "./task-views.js";
import type { InsightsShape, LoadState, ProjectRow, RunRow } from "../types.js";
import type { ModelStanding, PromptStanding, RegionStanding, TopicInsights, TopicStanding } from "../../../product/topics/topic-insights.js";
import type { VisibilityScore } from "../../../product/topics/visibility-score.js";
import type { MeasurementTask } from "../../../product/topics/next-task.js";
import type { RankingPlan, RankingMove } from "../../../product/topics/ranking-plan.js";
import type { ActionEffect, ActionState } from "../../../product/topics/action-log.js";
import type { TakenActionView } from "../../../product/topics/action-http.js";
import type { PersonaSet } from "../../../product/topics/persona.js";
import type { CompetitorSet } from "../../../product/topics/competitor-set.js";
import type { DemandReport } from "../../../product/demand/corpus-schema.js";

/** The part of the app state the plan reads. */
export interface RankingPlanState {
  rankPlan: RankingPlan | null;
  rankPlanState: LoadState;
  actions: TakenActionView[];
  actionsState: LoadState;
}

/** The part of the app state the rival cards read, so the state itself fits. */
export interface RivalsState extends RankingPlanState {
  answerEngine: InsightsShape | null;
  answerEngineState: LoadState;
  panelOpen: string[];
  personas: PersonaSet | null;
  personasState: LoadState;
  rivals: CompetitorSet | null;
  rivalsState: LoadState;
  demand: DemandReport | null;
  demandState: LoadState;
}

export interface BrandVisibilityState extends DashboardState, RivalsState {
  outreachState: LoadState;
  liveRun: RunRow | null;
}

/** The loaders the rival cards fire while idle. Each must be a hoisted function declaration that reads live state. */
export interface RivalsActions {
  loadRankingPlan(): void;
  loadActions(): void;
  loadPersonas(): void;
  loadRivals(): void;
  loadDemand(): void;
}

export type BrandVisibilityActions = Pick<HomeActions, "loadHome" | "loadAnswerEngine" | "loadOutreach"> & RivalsActions;

// What the page answers stays open. The eight cards that explain it fold.
const RIVAL_LEAD = ["rival-plan", "rival-leaderboard"];

/** One board for everything about how the brand appears, rather than four
 * pages each holding one panel. */
export function renderBrandVisibility(state: BrandVisibilityState, selected: ProjectRow | null, tasks: MeasurementTask[], runAction: RunAction, actions: BrandVisibilityActions): string {
  if (!selected) return '<section class="view">' + emptyState("Create a project first", "Everything here reports on one domain.") + '</section>';
  if (state.homeState === "idle") { actions.loadHome(); }
  if (state.answerEngineState === "idle") { actions.loadAnswerEngine(); }
  if (state.outreachState === "idle") { actions.loadOutreach(); }
  if (state.rankPlanState === "idle") { actions.loadRankingPlan(); }
  const heading = '<section class="view"><div class="heading"><div class="headmain"><h1>Rivals</h1>'
    + '<p class="subtle">Who the models name instead of you, and where. Counted once per answer however often a name appears in it, and how often anyone asks.</p></div>'
    // A page that offers a run has to show the run, or starting one from
    // here looked like nothing happened.
    + '<div class="inline-actions">' + button({ label: "Full report", on: { "data-page": "answer-engine" } }) + runAction("Run prompts") + '</div></div>' + renderLiveRun(state.liveRun);
  if (state.answerEngineState === "error") return heading + notice("Could not read this project.", "error") + '</section>';
  const view = dashboardView(state, selected);
  if (!view) return heading + dashboardBody({ status: "loading" }) + '</section>';
  const wanted = ["trend", "named", "described", "sources"];
  const panels = dashboardPanels(view).filter((panel) => wanted.includes(panel.id));
  const body = panels.map((panel) => section({
    id: panel.id,
    title: panel.title,
    blurb: panel.blurb,
    body: panel.body,
    wide: true,
    open: panel.id,
  })).join("");
  // The board first, then what sits behind it. One destination, one page.
  return heading + '<div class="dgrid">' + body + '</div>' + renderDemand(state.demandState, state.demand, actions) + rivalDetail(state, tasks, actions) + '</section>';
}

/** How often anyone actually asks the questions being tracked. A corpus
 * figure is a historical sample, so it says so wherever it appears. */
export function renderDemand(status: LoadState, report: DemandReport | null | undefined, actions: Pick<RivalsActions, "loadDemand">): string {
  if (status === "idle") { actions.loadDemand(); }
  const head = '<section class="section-card"><div class="section-head"><div class="headmain"><h2>Prompt volume</h2>'
    + '<p class="subtle">How often anyone asked something like each tracked question, in an openly licensed corpus of real conversations.</p></div></div>';
  if (status === "loading") return head + loading("the corpus report", skeletonTiles(3) + skeletonTable({ rows: 4 })) + '</section>';
  if (!report || !report.prompts) {
    // Not built is not zero demand, and the difference matters here.
    return head + '<div class="warning-box"><strong>No corpus is indexed.</strong>'
      + '<p>Nothing has been counted, which is not the same as nobody asking. Index a corpus and the counts fill in; see '
      + '<span class="mono">docs/prompt-demand.md</span>.</p></div></section>';
  }
  const rows = report.prompts
    .slice()
    .sort((left, right) => (right.match.relatedTerms || 0) - (left.match.relatedTerms || 0))
    .slice(0, 12)
    .map((row) => '<div class="mrow mcols-demand"><div class="mname"><strong>' + html(row.text) + '</strong>'
      + ((row.match.examples || []).length ? '<span class="subtle">' + html(String(row.match.examples[0])) + '</span>' : '')
      + '</div><span class="mcell">' + row.match.exactTerms + '</span><span class="mcell">' + row.match.relatedTerms + '</span>'
      + '<span class="mcell">' + (row.shareOfCorpus === null ? "not comparable" : percent(row.shareOfCorpus)) + '</span></div>').join("");
  const uncovered = (report.uncoveredTerms || []).slice(0, 12);
  return head
    + '<p class="subtle">' + html(String(report.caveat || "")) + '</p>'
    + '<div class="mtable"><div class="mhead mcols-demand"><span>Question</span><span>Asked exactly</span><span>Asked similarly</span><span>Share of corpus</span></div>' + rows + '</div>'
    + (uncovered.length
      ? '<h3 class="mt-lg">Asked about, and not tracked</h3><p class="subtle">Words common in the corpus that no tracked question covers.</p>'
        + '<div class="tagrow">' + uncovered.map((row) => '<span class="tag">' + html(row.term) + ' \u00b7 ' + row.questions + '</span>').join("") + '</div>'
      : '')
    + '</section>';
}

/** The detail behind the board: who was named, under which topic, and
 * which questions never named you at all. */
export function rivalDetail(state: RivalsState, tasks: MeasurementTask[], actions: RivalsActions): string {
  const data = state.answerEngine;
  if (state.answerEngineState !== "ready" || !data || !data.answers) return '';
  const card = (id: string, title: string, blurb: string, body: string) => section({
    id, title, blurb, body, wide: true,
    ...(RIVAL_LEAD.includes(id) ? {} : { folded: !state.panelOpen.includes(id) }),
  });
  return ''
    + card("rival-plan", "What would move this", "Read off the archived answers, strongest lever first. None of it is an opinion about your marketing.", renderRankingPlan(state, actions))
    + card("rival-leaderboard", "Competitors named in the answers", "Organisations the assistants named while answering your questions. Not the assistants themselves. Ranked by how many answers named them, then by how early.", renderLeaderboard(data.leaderboard))
    + card("rival-absent", "Questions you never appear in", "Answered, and you were not named once. Open one to read what the models credited the winners with, which is the standard that question is answered against.", renderAbsent(data.absentFrom) + taskCta(tasks, "absent-questions"))
    + card("rival-topics", "Topics, weakest first", "Where you are losing, in the order worth fixing. Every question opens its answers.", renderTopicRows(data.topics))
    + card("rival-named", "Rivals you name", "Name a competitor here and it is tracked whether or not an answer mentions it. A tracked rival nobody named reads as zero, which is a finding; leaving it out would hide it.", renderRivals(state, data, actions))
    + card("rival-trend", "Movement", "One point per run. A run where everything failed is left out rather than drawn as a drop.", renderPromptTrend(data.trend))
    + card("rival-region", "By market", "The same questions, asked for a different buyer.", renderRegionRows(data.byRegion, data.regionCaveat))
    + card("rival-persona", "By persona", "The same questions, asked on behalf of someone else. A market says where a buyer is; a persona says what they are, which moves the answer further.", renderPersonaRows(data.byPersona))
    + card("rival-personas", "Who is asking", "Add a persona and every run asks on their behalf as well.", renderPersonas(state.personasState, state.personas, actions))
    + card("rival-model", "By AI assistant", "The models you picked in Choose models, each answering the same questions. These are who was asked, not who you compete with.", renderModelRows(data.byModel));
}

export function renderAbsent(rows: PromptStanding[] | null | undefined): string {
  if (!rows || !rows.length) return '<p class="subtle">Every prompt with an answer named you at least once.</p>';
  return '<ul class="protocol-list">' + rows.slice(0, 12).map((row) => '<li class="is-clickable" data-evidence="' + html(row.promptId) + '" data-evidence-title="' + html(row.text) + '" tabindex="0" role="button"><strong>' + html(row.text) + '</strong><br><span class="subtle">' + row.score.answers + ' answer(s), none named you. '
    + (row.ahead.length ? 'Named instead: ' + row.ahead.map((entity) => html(entity.name)).join(", ") + '.' : 'No competitor was named either, so this question may not be about a product at all.')
    + '</span><br><span class="linklike">Open the brief</span></li>').join("") + '</ul>';
}

export function renderModelRows(rows: ModelStanding[] | null | undefined): string {
  if (!rows || !rows.length) return '<p class="subtle">No model has answered yet.</p>';
  // A model is a proportion like any other here. One appearance in twenty
  // four answers reads as 4% and is consistent with anything from under one
  // per cent to twenty, so the range goes beside it rather than nowhere.
  const asked = rows.filter((row) => row.score.answers > 0);
  const silent = rows.length - asked.length;
  const band = (score: VisibilityScore) => score.presenceInterval && score.presenceInterval.low !== null && score.presenceInterval.high !== null
    ? '<small>' + Math.round(score.presenceInterval.low * 100) + ' to ' + Math.round(score.presenceInterval.high * 100) + '%</small>'
    : '';
  return '<div class="mtable"><div class="mhead mcols-aemodel"><span>AI assistant</span><span>Score</span><span>Presence</span><span>Answers</span></div>'
    + asked.map((row) => '<div class="mrow mcols-aemodel">'
      + '<div class="mname"><strong>' + html(row.displayName) + '</strong><span class="mono">' + html(row.providerId) + ' · ' + html(row.modelId) + '</span></div>'
      + '<span class="mcell">' + scoreText(row.score.score) + '</span>'
      + '<span class="mcell">' + percent(row.score.presenceRate) + band(row.score) + '</span>'
      + '<span class="mcell">' + row.score.answers + '</span></div>').join("")
    + '</div>'
    + (silent ? '<p class="subtle">' + silent + ' more model(s) are saved or have been seen and have never produced an answer, so there is nothing to read for them.</p>' : '');
}

export function renderPromptTrend(trend: TopicInsights["trend"] | null | undefined): string {
  if (!trend || !trend.points.length) return '<p class="subtle">One run is a snapshot. Run the set again and this becomes a trend.</p>';
  const points = trend.points.map((point) => ({
    at: point.at,
    value: point.score.score,
    thin: point.score.tooFewAnswers,
    note: point.score.answers + (point.score.answers === 1 ? " answer" : " answers"),
    display: point.score.score === null ? "Not measurable" : point.score.score + " / 100",
    format: (value: number) => Math.round(value) + "",
    axisMax: 100,
  }));
  const change = trend.change === null
    ? '<span class="subtle">' + (trend.readablePoints < 2
        ? 'Not comparable yet: ' + trend.readablePoints + ' of ' + trend.points.length + ' run(s) asked enough to read a figure off'
        : 'Not comparable yet') + '</span>'
    : '<span class="' + (trend.change > 0 ? "state-ok" : trend.change < 0 ? "state-bad" : "") + '">' + (trend.change > 0 ? "+" : "") + trend.change + ' since ' + html((trend.since || "").slice(0, 10)) + '</span>';
  // Named rather than only drawn faintly, because a chart whose shape comes
  // from run size reads as a finding to anybody who does not hover a dot.
  const thin = trend.thinPoints
    ? '<p class="subtle">' + trend.thinPoints + ' of ' + trend.points.length + ' run(s) asked too few answers to read a score off. They are plotted where they fell, and the line is not drawn through them.</p>'
    : '';
  return '<div class="trend-head">' + change + '</div>' + trendChart(points, "answer engine score") + thin;
}

export function renderRegionRows(rows: RegionStanding[] | null | undefined, caveat: string): string {
  if (!rows || !rows.length) return '<p class="subtle">Only one market has been asked, so there is nothing to compare. Pick more when you run.</p>';
  return '<p class="subtle">' + html(caveat) + '</p><div class="mtable"><div class="mhead mcols-aemodel"><span>Market</span><span>Score</span><span>Presence</span><span>Rank</span></div>'
    + rows.map((row) => '<div class="mrow mcols-aemodel">'
      + '<div class="mname"><strong>' + html(row.label) + '</strong></div>'
      + '<span class="mcell">' + scoreText(row.score.score) + '</span>'
      + '<span class="mcell">' + percent(row.score.presenceRate) + '</span>'
      + '<span class="mcell">' + (row.rank === null ? "Not named" : "#" + row.rank) + '</span></div>').join("")
    + '</div>';
}

export function renderTopicRows(topics: TopicStanding[] | null | undefined): string {
  if (!topics || !topics.length) return '<p class="subtle">No topic has been answered yet.</p>';
  return topics.map((topic) => {
    const stateClass = topic.score.score === null ? "" : topic.score.score >= 50 ? "state-ok" : topic.score.score > 0 ? "state-flag" : "state-bad";
    const prompts = topic.prompts.map((prompt) => '<div class="mrow mcols-prompt is-clickable" data-evidence="' + html(prompt.promptId) + '" data-evidence-title="' + html(prompt.text) + '" tabindex="0" role="button">'
      + '<div class="mname"><strong>' + html(prompt.text) + '</strong><span class="subtle">' + intentLabel(prompt.intent) + ' · ' + prompt.score.answers + ' answer(s)' + (prompt.measuresVisibility ? '' : ' · names you') + '</span></div>'
      + '<span class="mcell ' + (prompt.score.score === null ? "" : prompt.score.score > 0 ? "state-ok" : "state-bad") + '">' + scoreText(prompt.score.score) + '</span>'
      + '<span class="mcell">' + (prompt.rank === null ? "Not named" : "#" + prompt.rank) + ' <span class="chev">›</span></span></div>').join("");
    return '<section class="section-card"><div class="section-head"><div><h2>' + html(topic.name) + '</h2><p class="subtle">' + html(topic.description || "") + '</p></div>'
      + '<div class="scorehead"><span style="font-family:var(--font-display);font-size:26px" class="' + stateClass + '">' + scoreText(topic.score.score) + '</span><span class="subtle">' + (topic.rank === null ? "Not named" : "rank #" + topic.rank) + '</span></div></div>'
      + '<div class="mtable"><div class="mhead mcols-prompt"><span>Question</span><span>Score</span><span>Rank</span></div>' + prompts + '</div></section>';
  }).join("");
}

function takenAction(taken: TakenActionView[], moveId: string, promptId: string | null | undefined) {
  const id = promptId ? moveId + ":" + promptId : moveId;
  return taken.find((row) => row.id === id) || null;
}

function actionControls(move: RankingMove, taken: TakenActionView | null): string {
  const current = taken ? taken.state : "open";
  const moveAction = (value: ActionState, label: string) => '<button type="button" class="card-action' + (current === value ? " is-on" : "") + '" data-action-move="' + html(move.id) + '" data-action-prompt="' + html(move.promptId || "") + '" data-action-state="' + value + '">' + label + '</button>';
  const effect = taken && taken.effect ? '<p class="evidence-note">Since you started: ' + html(effectText(taken.effect)) + '</p>' : '';
  return '<div class="move-actions">' + moveAction("doing", "Doing") + moveAction("done", "Done") + moveAction("dismissed", "Not doing")
    + (current === "open" ? '' : moveAction("open", "Reopen")) + '</div>' + effect;
}

export function renderRankingPlan(state: RankingPlanState, actions: Pick<RivalsActions, "loadRankingPlan" | "loadActions">): string {
  if (state.rankPlanState === "idle") { actions.loadRankingPlan(); }
  if (state.actionsState === "idle") { actions.loadActions(); }
  if (state.rankPlanState !== "ready" || !state.rankPlan) {
    return '<p class="subtle">' + (state.rankPlanState === "error" ? "Could not build a plan from the archived answers." : "Reading the answers to work out what would move this.") + '</p>';
  }
  const plan = state.rankPlan;
  const moves = plan.moves.length
    ? '<div class="plan">' + plan.moves.map((move) => {
      const taken = takenAction(state.actions, move.id, move.promptId);
      return '<div class="move ' + html(move.effect) + '">'
        + '<div class="move-top"><strong>' + html(move.title) + '</strong><span class="tag">' + html(effectLabel(move.effect)) + '</span>'
        + (taken ? '<span class="pill good">' + html(taken.state) + '</span>' : '')
        + (move.answers === null ? '' : '<span class="subtle">' + move.answers + ' answer(s)</span>') + '</div>'
        + '<p class="why">' + html(move.why) + '</p>'
        + '<p class="evidence-note">' + html(move.evidence) + '</p>'
        + actionControls(move, taken) + '</div>';
    }).join("") + '</div>'
    : '<p class="subtle">Nothing in the archived answers points at a specific move.</p>';
  return '<p class="subtle"><strong>' + html(plan.verdict) + '</strong></p>' + moves
    + '<details class="technical-details" style="margin-top:14px"><summary>Would tracking more questions make me rank higher?</summary><p class="subtle">' + html(plan.promptsNote) + '</p></details>';
}

export function renderPersonas(status: LoadState, personas: PersonaSet | null | undefined, actions: Pick<RivalsActions, "loadPersonas">): string {
  if (status === "idle") { actions.loadPersonas(); }
  if (status !== "ready" || !personas) {
    return '<p class="subtle">' + (status === "error" ? "Could not read the personas." : "Reading the personas.") + '</p>';
  }
  const tracked = personas.personas.filter((row) => row.tracked);
  const rows = tracked.length
    ? '<div class="mtable"><div class="mhead mcols-persona"><span>Persona</span><span>Told to the model as</span><span></span></div>'
      + tracked.map((row) => '<div class="mrow mcols-persona">'
        + '<div class="mname"><strong>' + html(row.label) + '</strong></div>'
        + '<span class="mcell">' + html(row.describedAs) + '</span>'
        + '<span class="mcell">' + button({ label: "Stop asking", kind: "link", tone: "danger", on: { "data-retire-persona": row.id } }) + '</span></div>').join("")
      + '</div>'
    : '<p class="subtle">No persona yet, so every question is asked on nobody\u2019s behalf. That is a real answer and stays comparable with every run so far.</p>';
  return rows
    + '<form id="add-persona-form" class="inline-form"><input name="label" type="text" placeholder="Beginner retail trader" aria-label="Persona name"><input name="describedAs" type="text" placeholder="someone new to investing, with a small account, who has never used a screener" aria-label="How the model is told to see them">' + button({ label: "Add", submit: true }) + '</form>'
    + '<p class="evidence-note">Each persona multiplies a run: every question is asked once per persona per model per market. The forecast on Prompts counts them.</p>';
}

export function renderRivals(state: Pick<RivalsState, "rivals" | "rivalsState">, data: InsightsShape | null, actions: Pick<RivalsActions, "loadRivals">): string {
  if (state.rivalsState === "idle") { actions.loadRivals(); }
  const tracked = data && data.trackedRivals ? data.trackedRivals : [];
  const body = tracked.length
    ? '<div class="mtable"><div class="mhead mcols-aemodel"><span>Who</span><span>Answers</span><span>Share</span><span></span></div>'
      + tracked.map((row) => '<div class="mrow mcols-aemodel">'
        + '<div class="mname"><strong>' + html(row.name) + '</strong><span class="mono">' + html(row.domain || "no domain") + '</span></div>'
        + '<span class="mcell ' + (row.appearances ? "" : "state-bad") + '">' + row.appearances + '</span>'
        + '<span class="mcell">' + percent(row.shareOfAnswers) + '</span>'
        + '<span class="mcell">' + button({ label: "Stop tracking", kind: "link", tone: "danger", on: { "data-retire-rival": declaredIdFor(state.rivals, row.name) } }) + '</span></div>').join("") + '</div>'
    : '<p class="subtle">No rival is tracked yet. Adopt the ones your site and your answers already name, or add one by hand.</p>';
  return body
    + '<div class="inline-actions" style="margin-top:14px">' + button({ label: "Adopt the ones already named", on: { "data-adopt-rivals": true } }) + '</div>'
    + '<form id="add-rival-form" class="inline-form"><input name="name" type="text" placeholder="Competitor name" aria-label="Competitor name"><input name="domain" type="text" placeholder="domain.com (optional)" aria-label="Competitor domain">' + button({ label: "Add", submit: true }) + '</form>'
    + '<p class="subtle">A rival you track and never see reads as zero rather than disappearing, because that is the finding.</p>';
}

function declaredIdFor(rivals: CompetitorSet | null, name: string): string {
  const rows = rivals ? rivals.competitors : [];
  const found = rows.find((row) => row.name.toLowerCase() === String(name).toLowerCase());
  return found ? found.id : "";
}

function effectText(effect: ActionEffect | null): string {
  if (!effect) return "";
  if (effect.nothingRunSince) return "No answer has been archived since, so nothing can have moved yet.";
  const score = effect.scoreChange === null
    ? "the score could not be measured at both ends"
    : "score " + (effect.scoreChange > 0 ? "+" : "") + effect.scoreChange;
  const rank = effect.rankNow === null
    ? "still not named"
    : effect.rankThen === null ? "now ranked #" + effect.rankNow : "rank " + effect.rankThen + " to " + effect.rankNow;
  return effect.answersAdded + " answer(s) since · " + score + " · " + rank
    + (effect.appearancesAdded ? " · " + effect.appearancesAdded + " more answer(s) named you" : "");
}
