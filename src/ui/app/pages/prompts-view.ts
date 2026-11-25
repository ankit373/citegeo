import { html } from "../dom.js";
import { button } from "../components/button.js";
import { demandBadge, fieldBadge } from "../components/badges.js";
import { section } from "../components/primitives.js";
import { loading, skeletonCard, skeletonTiles } from "../components/skeleton.js";
import { score as scoreText } from "../format.js";
import { intentLabel } from "../labels.js";
import { stat } from "./metric-cells.js";
import { renderLiveRun } from "./run-pane.js";
import type { RunAction } from "./home-view.js";
import type { InsightsShape, LoadState, ProjectRow, RunRow } from "../types.js";
import type { HomeSummary } from "../../../product/alerts/home-summary.js";
import type { PersonaSet } from "../../../product/topics/persona.js";
import type { PromptDemand } from "../../../product/demand/corpus-schema.js";
import type { QuestionContest } from "../../../product/topics/question-contest.js";
import type { PromptStanding, TopicStanding } from "../../../product/topics/topic-insights.js";
import type { Prompt, PromptIntent, TopicSet } from "../../../product/topics/topic-schema.js";

/** A topic set as the page reads it. The page also draws a set that has not loaded, which has no more than topics and prompts. */
export type PromptSet = Pick<TopicSet, "topics" | "prompts"> & Partial<Pick<TopicSet, "generatedAt" | "generatedWithoutFacts" | "groundedIn">>;

/** One question's reading from the question-priority route: its contest and its observed demand. */
export interface PriorityQuestion {
  promptId: string;
  text: string;
  topicId: string;
  intent: PromptIntent;
  measuresVisibility: boolean;
  contest: QuestionContest;
  demand: PromptDemand | null;
}

export interface PromptFilters { query: string; topicId: string; intent: string; status: string }

/** The part of the app state the Questions page reads, so the state itself fits. */
export interface PromptsState {
  topicSet: TopicSet | null;
  topicState: LoadState;
  answerEngine: InsightsShape | null;
  answerEngineState: LoadState;
  home: HomeSummary | null;
  homeState: LoadState;
  scheduleState: LoadState;
  priority: { questions: PriorityQuestion[]; corpusIndexed: boolean } | null;
  priorityState: LoadState;
  personas: PersonaSet | null;
  personasState: LoadState;
  promptFilters: PromptFilters;
  promptSort: string;
  promptSelection: string[];
  promptDraft: { topicId: string; text: string; intent: string };
  promptNotice: { text: string; kind: string };
  promptRunState: string;
  panelOpen: string[];
  liveRun: RunRow | null;
}

/** The loaders the page fires while a read is idle. Each must be a hoisted function declaration that reads live state. */
export interface PromptsActions {
  loadTopics(): void;
  loadAnswerEngine(): void;
  loadHome(): void;
  loadSchedule(): void;
  loadPriority(): void;
  loadPersonas(): void;
}

export const PROMPT_INTENTS: PromptIntent[] = ["discovery", "comparison", "alternatives", "brand", "problem"];
const PROMPT_STATES = [["", "Any state"], ["tracked", "Tracked"], ["proposed", "Needs review"], ["absent", "Never named"], ["unmeasured", "Cannot measure"]];
// Open beats settled, and the reason is on the badge, because the order is
// a judgement and the figures it came from are not.
const FIELD_ORDER: Record<string, number> = { open: 0, contested: 1, settled: 2, unknown: 3 };

function priorityOf(state: Pick<PromptsState, "priority">, promptId: string): PriorityQuestion | null {
  if (!state.priority) return null;
  return state.priority.questions.find((row) => row.promptId === promptId) || null;
}

function sortedPrompts(state: Pick<PromptsState, "promptSort" | "priority">, rows: Prompt[], standings: Map<string, PromptStanding>): Prompt[] {
  if (state.promptSort === "topic") return rows;
  const copy = rows.slice();
  if (state.promptSort === "open") {
    copy.sort((left, right) => {
      const a = priorityOf(state, left.id);
      const b = priorityOf(state, right.id);
      return (FIELD_ORDER[a ? a.contest.state : "unknown"] || 0) - (FIELD_ORDER[b ? b.contest.state : "unknown"] || 0);
    });
    return copy;
  }
  // A question with no answer has no score, so it sorts after the scored
  // ones rather than ahead of them as a zero would.
  copy.sort((left, right) => {
    const a = standings.get(left.id);
    const b = standings.get(right.id);
    const scoreOf = (row: PromptStanding | undefined) => (row && row.score.answers ? (row.score.score === null ? 101 : row.score.score) : 102);
    return scoreOf(a) - scoreOf(b);
  });
  return copy;
}

// Score and rank come from the answer engine, so a question shows whether
// it is working rather than only that it is tracked.
export function promptStandings(data: InsightsShape | null): Map<string, PromptStanding> {
  const rows = new Map<string, PromptStanding>();
  if (!data || !data.topics) return rows;
  for (const topic of data.topics) {
    for (const prompt of topic.prompts) rows.set(prompt.promptId, prompt);
  }
  return rows;
}

export function topicStandings(data: InsightsShape | null): Map<string, TopicStanding> {
  const rows = new Map<string, TopicStanding>();
  if (!data || !data.topics) return rows;
  for (const topic of data.topics) rows.set(topic.topicId, topic);
  return rows;
}

export function livePrompts(set: PromptSet): Prompt[] { return set.prompts.filter((prompt) => prompt.status !== "retired"); }

/** Every tile on this row counts live prompts, and the topic tile counted
 * every topic ever generated, so a project regenerated against the right
 * category read as having eight groups of questions and twenty five
 * questions in five of them. */
function liveTopics(set: PromptSet) { return set.topics.filter((topic) => topic.status !== "retired"); }

export function filteredPrompts(state: Pick<PromptsState, "promptFilters">, set: PromptSet, standings: Map<string, PromptStanding>): Prompt[] {
  const filters = state.promptFilters;
  const query = filters.query.trim().toLocaleLowerCase();
  return livePrompts(set).filter((prompt) => {
    if (filters.topicId && prompt.topicId !== filters.topicId) return false;
    if (filters.intent && prompt.intent !== filters.intent) return false;
    if (filters.status === "tracked" && prompt.status !== "active") return false;
    if (filters.status === "proposed" && prompt.status !== "proposed") return false;
    if (filters.status === "unmeasured" && prompt.measuresVisibility) return false;
    if (filters.status === "absent") {
      const standing = standings.get(prompt.id);
      if (!standing || standing.score.answers === 0 || standing.score.appearances > 0) return false;
    }
    return !query || prompt.text.toLocaleLowerCase().includes(query);
  });
}

export function promptResultSummary(shown: number, total: number): string {
  return shown === total ? "Showing all " + total + " question(s)" : "Showing " + shown + " of " + total + " question(s)";
}

// A forecast of one run at the saved model set, in one market and one
// language. An unknown model count says so rather than standing in as one.
function runForecast(state: Pick<PromptsState, "home" | "personas" | "personasState">, tracked: number, actions: Pick<PromptsActions, "loadPersonas">) {
  const models = state.home && typeof state.home.modelCount === "number" ? state.home.modelCount : null;
  if (models === null) return { value: "Unknown", note: "the saved model count has not loaded" };
  if (!models) return { value: "None", note: "no models are saved, so a run cannot ask anything" };
  if (!tracked) return { value: "None", note: "nothing is tracked, so a run has nothing to ask" };
  // A run covers nobody in particular plus every tracked persona, so a
  // forecast that leaves them out is short by exactly that multiple.
  if (state.personasState === "idle") { actions.loadPersonas(); }
  if (state.personasState !== "ready" || !state.personas) {
    return { value: "Unknown", note: "the personas a run covers have not loaded" };
  }
  const personas = state.personas.personas.filter((row) => row.tracked).length;
  const arms = personas + 1;
  const note = tracked + " question(s) by " + models + " model(s)"
    + (personas ? " on behalf of nobody and " + personas + " persona(s)" : "")
    + ", one market, one language";
  return { value: String(tracked * models * arms), note };
}

function renderPromptStats(state: Pick<PromptsState, "home" | "personas" | "personasState">, set: PromptSet, standings: Map<string, PromptStanding>, actions: Pick<PromptsActions, "loadPersonas">): string {
  const live = livePrompts(set);
  const tracked = live.filter((prompt) => prompt.status === "active");
  const proposed = live.filter((prompt) => prompt.status === "proposed").length;
  const measuring = tracked.filter((prompt) => prompt.measuresVisibility).length;
  const answered = tracked.filter((prompt) => { const row = standings.get(prompt.id); return row !== undefined && row.score.answers > 0; }).length;
  const forecast = runForecast(state, tracked.length, actions);
  return '<div class="statgrid">'
    + stat("Tracked", String(tracked.length), tracked.length ? "asked on every run" : "nothing is being asked", live.length ? tracked.length / live.length : null)
    + stat("Needs review", String(proposed), proposed ? "proposed, never asked until tracked" : "nothing waiting on you", null)
    + stat("Topics", String(liveTopics(set).length),
        (set.topics.length - liveTopics(set).length)
          ? (set.topics.length - liveTopics(set).length) + " more retired, and left out of every figure"
          : liveTopics(set).length + " group(s) of questions", null)
    + stat("Answers per run", forecast.value, forecast.note, null)
    + stat("Measures visibility", measuring + " of " + tracked.length, "the rest name you, so presence is not earned", tracked.length ? measuring / tracked.length : null)
    + stat("Has an answer", answered + " of " + tracked.length, answered ? "tracked question(s) with archived answers" : "no tracked question has been answered yet", tracked.length ? answered / tracked.length : null)
    + '</div>';
}

function renderPromptCoverage(state: Pick<PromptsState, "promptFilters" | "panelOpen">, set: PromptSet): string {
  const live = livePrompts(set);
  const tracked = live.filter((prompt) => prompt.status === "active");
  // Tracked over proposed, because a chip reading 0 that filters to rows
  // looked like a contradiction rather than a blind spot.
  const chips = PROMPT_INTENTS.map((intent) => {
    const count = tracked.filter((prompt) => prompt.intent === intent).length;
    const total = live.filter((prompt) => prompt.intent === intent).length;
    const active = state.promptFilters.intent === intent ? ' active' : '';
    return '<button type="button" class="tag' + (count ? '' : ' warning') + active + '" data-prompt-intent="' + intent + '">' + intentLabel(intent) + ' · ' + count + ' of ' + total + ' tracked</button>';
  }).join("");
  const thin = set.topics.filter((topic) => !tracked.some((prompt) => prompt.topicId === topic.id));
  const note = thin.length
    ? thin.length + ' topic(s) have nothing tracked: ' + thin.map((topic) => html(topic.name)).join(", ") + '.'
    : 'Every topic has at least one tracked question.';
  return section({
    id: "prompt-coverage", title: "Coverage", wide: true,
    blurb: "A buyer arrives five ways. An intent with nothing tracked is a blind spot, not a zero.",
    body: '<div class="coverage">' + chips + '</div><p class="subtle">' + note + '</p>',
    folded: state.panelOpen.indexOf("prompt-coverage") < 0,
  });
}

function promptToolbar(state: Pick<PromptsState, "promptFilters" | "promptSort">, set: PromptSet, shown: number): string {
  const filters = state.promptFilters;
  const topics = set.topics.map((topic) => '<option value="' + html(topic.id) + '"' + (filters.topicId === topic.id ? ' selected' : '') + '>' + html(topic.name) + '</option>').join("");
  const intents = PROMPT_INTENTS.map((intent) => '<option value="' + intent + '"' + (filters.intent === intent ? ' selected' : '') + '>' + intentLabel(intent) + '</option>').join("");
  const states = PROMPT_STATES.map((row) => '<option value="' + row[0] + '"' + (filters.status === row[0] ? ' selected' : '') + '>' + row[1] + '</option>').join("");
  return '<div class="promptbar">'
    + '<input id="prompt-search" type="search" placeholder="Search questions" aria-label="Search questions" value="' + html(filters.query) + '">'
    + '<select data-prompt-filter="topicId" aria-label="Filter by topic"' + (filters.topicId ? ' class="is-set"' : '') + '><option value="">All topics</option>' + topics + '</select>'
    + '<select data-prompt-filter="intent" aria-label="Filter by intent"' + (filters.intent ? ' class="is-set"' : '') + '><option value="">Any intent</option>' + intents + '</select>'
    + '<select data-prompt-filter="status" aria-label="Filter by state"' + (filters.status ? ' class="is-set"' : '') + '>' + states + '</select>'
    + '<select data-prompt-sort aria-label="Order" class="is-set"><option value="topic"' + (state.promptSort === "topic" ? " selected" : "") + '>Group by topic</option><option value="open"' + (state.promptSort === "open" ? " selected" : "") + '>Open fields first</option><option value="worst"' + (state.promptSort === "worst" ? " selected" : "") + '>Worst score first</option></select>'
    + '<span class="prompt-result-summary subtle">' + promptResultSummary(shown, livePrompts(set).length) + '</span></div>';
}

export function promptBulkInner(state: Pick<PromptsState, "promptSelection" | "topicSet" | "liveRun">): string {
  const ids = state.promptSelection;
  if (!ids.length) return '';
  const set = state.topicSet || { topics: [], prompts: [] };
  const chosen = set.prompts.filter((prompt) => ids.indexOf(prompt.id) >= 0);
  const proposed = chosen.filter((prompt) => prompt.status === "proposed").length;
  const tracked = chosen.filter((prompt) => prompt.status === "active").length;
  return '<div class="bulkbar"><strong>' + chosen.length + ' selected</strong>'
    + (proposed ? button({ label: "Track " + (proposed), on: { "data-bulk-activate": true } }) : '')
    + (tracked ? button({ label: "Stop tracking " + (tracked), on: { "data-bulk-retire": true } }) : '')
    + (tracked && !state.liveRun ? button({ label: "Run these " + (tracked), kind: "primary", on: { "data-bulk-run": true } }) : '')
    + '<span class="spacer"></span>' + button({ label: "Clear", kind: "link", on: { "data-bulk-clear": true } }) + '</div>';
}

function promptRow(state: Pick<PromptsState, "promptSelection" | "priority">, prompt: Prompt, standing: PromptStanding | undefined): string {
  const checked = state.promptSelection.indexOf(prompt.id) >= 0;
  const notes = [intentLabel(prompt.intent)];
  if (prompt.status === "proposed") notes.push("proposed, not asked yet");
  if (!prompt.measuresVisibility) notes.push("names you, so it cannot measure visibility");
  const priority = priorityOf(state, prompt.id);
  const answers = standing ? standing.score.answers : 0;
  const label = answers
    ? button({ label: prompt.text, kind: "title", on: { "data-evidence": prompt.id, "data-evidence-title": prompt.text } })
    : html(prompt.text);
  const scoreClass = !standing || standing.score.score === null ? "" : standing.score.score > 0 ? "state-ok" : "state-bad";
  return '<div class="mrow mcols-promptrow">'
    + '<input type="checkbox" data-prompt-checkbox="' + html(prompt.id) + '"' + (checked ? ' checked' : '') + ' aria-label="Select this question">'
    + '<div class="mname"><strong>' + label + '</strong><span class="subtle">' + html(notes.join(" · ")) + (answers ? ' · ' + answers + ' answer(s)' : '') + '</span>'
    + (priority ? '<span class="rowtags">' + fieldBadge(priority) + demandBadge(priority) + '</span>' : '') + '</div>'
    + '<span class="mcell ' + scoreClass + '">' + (standing && answers ? scoreText(standing.score.score) : "Not asked yet") + '</span>'
    + '<span class="mcell">' + (standing && answers ? (standing.rank === null ? "Not named" : "#" + standing.rank) : "") + '</span>'
    + '<span class="mcell">'
    + (prompt.variantOf ? '<span class="subtle">a rewording</span>' : button({ label: "Reword it", kind: "link", on: { "data-reword-prompt": prompt.id, "data-reword-text": prompt.text } }))
    + '</span>'
    + '<span class="mcell">' + (prompt.status === "active"
      ? button({ label: "Stop tracking", kind: "link", tone: "danger", on: { "data-retire-prompt": prompt.id } })
      : button({ label: "Track it", kind: "link", on: { "data-activate-prompt": prompt.id } })) + '</span></div>';
}

export function renderPromptGroups(state: Pick<PromptsState, "promptSort" | "priority" | "promptSelection">, set: PromptSet, rows: Prompt[], standings: Map<string, PromptStanding>, topics: Map<string, TopicStanding>): string {
  if (!set.topics.length) return '<p class="subtle">No topics yet.</p>';
  if (!rows.length) return '<p class="subtle">No question matches these filters.</p>';
  return set.topics.filter((topic) => rows.some((prompt) => prompt.topicId === topic.id)).map((topic) => {
    const mine = rows.filter((prompt) => prompt.topicId === topic.id);
    const proposed = mine.filter((prompt) => prompt.status === "proposed").length;
    const tracked = mine.filter((prompt) => prompt.status === "active").length;
    const standing = topics.get(topic.id);
    const score = standing && standing.score.answers
      ? '<div class="scorehead"><span class="scoremid">' + scoreText(standing.score.score) + '</span><span class="subtle">' + (standing.rank === null ? "not named" : "rank #" + standing.rank) + '</span></div>'
      : '';
    const bulk = proposed ? button({ label: "Track all " + (proposed), kind: "quiet", on: { "data-activate-topic": topic.id } }) : '';
    const description = topic.description ? html(topic.description) + ' · ' : '';
    return '<section class="section-card"><div class="section-head"><div class="headmain"><h2>' + html(topic.name) + '</h2><p class="subtle">' + description + tracked + ' of ' + mine.length + ' shown tracked</p></div><div class="headaside">' + bulk + score + '</div></div>'
      + '<div class="mtable"><div class="mhead mcols-promptrow"><span></span><span>Question</span><span>Score</span><span>Rank</span><span>Wordings</span><span></span></div>'
      + sortedPrompts(state, mine, standings).map((prompt) => promptRow(state, prompt, standings.get(prompt.id))).join("") + '</div></section>';
  }).join("");
}

function promptAddForms(state: Pick<PromptsState, "promptDraft" | "panelOpen">, set: PromptSet, folds = true): string {
  if (!set.topics.length) return '';
  const topics = set.topics.map((topic) => '<option value="' + html(topic.id) + '">' + html(topic.name) + '</option>').join("");
  const intents = PROMPT_INTENTS.map((intent) => '<option value="' + intent + '">' + intentLabel(intent) + '</option>').join("");
  const body = ''
    + '<form id="add-prompt-form" class="inline-form"><select name="topicId" aria-label="Topic">' + topics + '</select><input name="text" type="text" value="' + html(state.promptDraft.text) + '" placeholder="best stock screener for indian markets" aria-label="Question"><select name="intent" aria-label="Intent">' + intents + '</select>' + button({ label: "Add", submit: true }) + '</form>'
    + '<details class="technical-details" style="margin-top:14px"><summary>Paste a list</summary>'
    + '<form id="bulk-prompt-form" class="inline-form"><select name="topicId" aria-label="Topic for the pasted questions">' + topics + '</select><select name="intent" aria-label="Intent for the pasted questions">' + intents + '</select><textarea name="text" rows="6" placeholder="One question per line" aria-label="Questions, one per line"></textarea>' + button({ label: "Add them all", submit: true }) + '</form>'
    + '<p class="subtle">One question per line, all under the same topic and intent. A question already in the set is skipped rather than added twice.</p></details>';
  return section({
    id: "prompt-add", title: "Add your own", body, wide: true,
    blurb: "A question you know buyers ask. It starts tracked.",
    ...(folds ? { folded: state.panelOpen.indexOf("prompt-add") < 0 } : {}),
  });
}

// What a proposal was grounded in decides how much of it is observation
// and how much is supposition, which does not show on the questions.
function grounding(set: PromptSet | null): string {
  if (!set || !set.generatedAt) return '';
  const held = set.groundedIn;
  if (!held) {
    return '<div class="warning-box"><strong>This set was proposed before observed demand could ground one.</strong> What anyone really asks was not read when these were written, so they are the model\'s supposition about what buyers type. Propose again to ground the next set in what has been observed.</div>';
  }
  if (!held.observed) {
    return '<div class="warning-box"><strong>Nothing observed grounded these questions.</strong> No search queries and no conversations were available when they were proposed, so every one is the model\'s supposition about what buyers type. Connect Search Console on Setup and propose again.</div>';
  }
  const parts = [];
  if (held.searchQueries) parts.push(held.searchQueries + ' search quer(ies)');
  if (held.corpusQuestions) parts.push(held.corpusQuestions + ' past conversation(s)');
  return '<div class="success-box"><strong>Grounded in ' + held.observed + ' question(s) people really asked</strong>, drawn from ' + parts.join(' and ')
    + '. Those are search and conversation records, not a measure of how often anyone asks an assistant, and a subject missing from them is not a subject nobody asks about.</div>';
}

export function renderPrompts(state: PromptsState, selected: ProjectRow | null, runAction: RunAction, actions: PromptsActions): string {
  if (!selected) return '<section class="view"><div class="empty"><div class="empty-copy"><h2>Select a project first</h2></div></div></section>';
  if (state.topicState === "idle") { actions.loadTopics(); }
  if (state.answerEngineState === "idle") { actions.loadAnswerEngine(); }
  if (state.homeState === "idle") { actions.loadHome(); }
  if (state.scheduleState === "idle") { actions.loadSchedule(); }
  if (state.priorityState === "idle") { actions.loadPriority(); }
  if (state.topicState !== "ready") {
    const head = '<section class="view"><div class="heading"><div><h1>Questions</h1><p class="subtle">The questions your buyers ask.</p></div></div>';
    // An error is a sentence. A wait is the shape of what is coming, which
    // holds the space the figures and the table are about to take.
    if (state.topicState === "error") {
      return head + '<div class="empty"><div class="empty-copy"><h2>Could not read the prompt set</h2></div></div></section>';
    }
    return head + loading("the questions", skeletonTiles(6)
      + skeletonCard({ rows: 6, columns: "minmax(0,1fr) 96px 82px 96px 104px" })) + '</section>';
  }
  const set: PromptSet = state.topicSet || { topics: [], prompts: [] };
  const notice = state.promptNotice.text ? '<div class="' + (state.promptNotice.kind === "error" ? "warning-box" : "success-box") + '">' + html(state.promptNotice.text) + '</div>' : '';
  const live = livePrompts(set);
  const active = live.filter((prompt) => prompt.status === "active").length;
  const head = '<section class="view"><div class="heading"><div><h1>Questions</h1><p class="subtle">The questions buyers type, grouped by topic. Every other number in this tool is these questions, asked and archived.</p></div><div class="inline-actions">' + button({ label: (state.promptRunState === "generating" ? "Proposing…" : "Propose a set"), on: { "data-generate-prompts": true } }) + '' + runAction("Run all " + active, active > 0) + '</div></div>' + notice + renderLiveRun(state.liveRun);
  if (!live.length) {
    // Retiring the last question must not remove the only way to add one.
    return head + '<div class="empty"><div class="empty-copy"><h2>Nothing is being asked</h2><p class="subtle">Propose a set and a model will suggest the questions buyers ask about what you do, grouped into topics. Nothing runs until you have read them and chosen which to track, because what buyers ask is not something this tool can observe.</p></div></div>' + promptAddForms(state, set, false) + '</section>';
  }
  const standings = promptStandings(state.answerEngine);
  const rows = filteredPrompts(state, set, standings);
  const proposed = live.filter((prompt) => prompt.status === "proposed").length;
  const review = proposed
    ? '<div class="warning-box"><strong>' + proposed + ' question(s) are proposed and not tracked.</strong> A proposed question is never asked. Read them and track the ones buyers actually type. ' + button({ label: "Show only those", kind: "link", on: { "data-prompt-review": true } }) + '</div>'
    : '';
  // A set proposed with nothing established about the business was written
  // off the domain name. Read it that way or it reads like a finding.
  const blind = set.generatedWithoutFacts
    ? '<div class="warning-box"><strong>These were proposed without anything established about the business.</strong> The site read returned no description and no category, so the model had the brand name and the domain and guessed from them. Read every one before tracking it, and say what the company does on Setup to propose a better set.</div>'
    : '';
  // The same rule the answer pages use: what can be acted on stays, what
  // only explains folds into one line above the list.
  const said = [blind, grounding(set), review].filter(Boolean);
  const doable = said.filter((note) => note.indexOf("<button") >= 0);
  const toldOnly = said.filter((note) => doable.indexOf(note) < 0);
  const folded = toldOnly.length
    ? '<details class="caveats" data-fold="prompt-caveats"' + (state.panelOpen.indexOf("prompt-caveats") >= 0 ? " open" : "")
      + '><summary>How this set was written (' + toldOnly.length + ')</summary>' + toldOnly.join("") + '</details>'
    : '';
  return head
    + renderPromptStats(state, set, standings, actions)
    + doable.join("") + folded
    + renderPromptCoverage(state, set)
    + promptToolbar(state, set, rows.length)
    + '<div class="prompt-bulk">' + promptBulkInner(state) + '</div>'
    + '<div class="prompt-results">' + renderPromptGroups(state, set, rows, standings, topicStandings(state.answerEngine)) + '</div>'
    + promptAddForms(state, set)
    + '</section>';
}
