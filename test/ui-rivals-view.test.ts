import test from "node:test";
import assert from "node:assert/strict";
import {
  renderAbsent, renderBrandVisibility, renderDemand, renderModelRows, renderPersonas, renderPromptTrend, renderRankingPlan, renderRegionRows,
  renderRivals, renderTopicRows, rivalDetail, type BrandVisibilityActions, type BrandVisibilityState,
} from "../src/ui/app/pages/rivals-view.js";
import { buildTopicInsights } from "../src/product/topics/topic-insights.js";
import { buildHomeSummary } from "../src/product/alerts/home-summary.js";
import { buildRankingPlan } from "../src/product/topics/ranking-plan.js";
import { positionReport } from "../src/product/topics/position-metrics.js";
import { emptyTopicSet, type Prompt, type TopicSet } from "../src/product/topics/topic-schema.js";
import type { PromptAnswer, PromptRun } from "../src/product/topics/prompt-run-schema.js";
import type { Competitor } from "../src/product/topics/competitor-set.js";
import type { TakenActionView } from "../src/product/topics/action-http.js";
import type { DemandReport } from "../src/product/demand/corpus-schema.js";
import type { ProjectRow } from "../src/ui/app/types.js";

function has(text: string, ...parts: string[]): void {
  for (const part of parts) assert.ok(text.includes(part), `${JSON.stringify(text)} lacks ${part}`);
}

const at = "2026-11-20T10:00:00.000Z";
const prompt = (id: string): Prompt => ({
  id, projectId: "p1", topicId: "t1", text: "Question " + id, normalizedText: "question " + id, intent: "discovery", source: "authored",
  measuresVisibility: true, visibilityExclusionReason: null, status: "active", createdAt: at, activatedAt: at,
});
const set: TopicSet = {
  ...emptyTopicSet("p1"),
  topics: [{ id: "t1", projectId: "p1", name: "Topic<", description: "about&", source: "authored", status: "active", createdAt: at }],
  prompts: [prompt("a"), prompt("b")],
};
const answer = (id: string, promptId: string, named: boolean): PromptAnswer => ({
  id, projectId: "p1", runId: "r1", promptId, topicId: "t1", promptText: "Question " + promptId, intent: "discovery", providerId: "openai", modelId: "m", modelDisplayName: "M<",
  regionId: "global", languageId: "en", status: "completed", text: "Acme, Rival One", citationUrls: [], errorCode: null, errorMessage: null, latencyMs: 1, createdAt: at,
  mentions: [
    ...(named ? [{ name: "Acme", domain: "acme.example", recommendation: "positive" as const, mentionQuote: "Acme", firstMentionOffset: 0, firstMentionState: "unique" as const, isTarget: true }] : []),
    { name: "Rival One", domain: "rival.example", recommendation: "mentioned" as const, mentionQuote: "Rival One", firstMentionOffset: named ? 6 : 0, firstMentionState: "unique" as const, isTarget: false },
  ],
});
const answers = [answer("1", "a", true), answer("2", "a", false), answer("3", "b", false)];
const run: PromptRun = {
  id: "r1", projectId: "p1", status: "completed", promptIds: ["a", "b"], modelIds: ["m"], regionIds: ["global"], languageIds: ["en"],
  answersRequested: 3, answersCompleted: 3, answersFailed: 0, startedAt: at, completedAt: at,
};
const rivals: Competitor[] = [
  { id: "rival-1", name: "Rival One", domain: "rival.example", source: "declared", tracked: true, addedAt: at },
  { id: "rival-2", name: "Ghost<", domain: null, source: "declared", tracked: true, addedAt: at },
];
const insights = buildTopicInsights({ projectId: "p1", set, answers, runs: [run], competitors: rivals });
const engine = { ...insights, position: positionReport(insights.topics.flatMap((topic) => topic.prompts)) };
const plan = buildRankingPlan({ insights, set });
const home = buildHomeSummary({ projectId: "p1", domain: "acme.example", set, insights, runs: [run], modelCount: 1 });
const project: ProjectRow = { id: "p1", name: "Acme", normalizedDomain: "acme.example", status: "active" };

const taken = (moveId: string, state: TakenActionView["state"], promptId: string | null = null): TakenActionView => ({
  id: promptId ? moveId + ":" + promptId : moveId, projectId: "p1", moveId, promptId, state, note: "", createdAt: at, updatedAt: at,
  startedFrom: { at, score: 10, rank: null, answers: 3, appearances: 1 },
  effect: { since: at, answersAdded: 2, scoreThen: 10, scoreNow: 20, scoreChange: 10, rankThen: null, rankNow: 2, appearancesAdded: 1, nothingRunSince: false },
});
const demand: DemandReport = {
  sourceId: "s", caveat: "cav<", uncoveredTerms: [{ term: "term<", questions: 4 }],
  index: { sourceId: "s", questions: 20, vocabulary: 100, from: null, to: null, builtAt: at },
  prompts: [
    { promptId: "a", text: "Q<", match: { exactTerms: 3, relatedTerms: 9, examples: ["ex&"] }, shareOfCorpus: 0.1 },
    { promptId: "b", text: "R", match: { exactTerms: 0, relatedTerms: 20, examples: [] }, shareOfCorpus: null },
  ],
};

function state(over: Partial<BrandVisibilityState> = {}): BrandVisibilityState {
  return {
    home, homeState: "ready", answerEngine: engine, answerEngineState: "ready", outreach: null, outreachState: "ready", rankPlan: plan, rankPlanState: "ready",
    referrals: null, searchDemand: null, cited: null, brandIcons: {}, matrixOpen: [], matrixHidden: [], liveRun: null, panelOpen: [],
    actions: [taken(plan.moves[0]?.id || "none", "doing", plan.moves[0]?.promptId ?? null)], actionsState: "ready",
    personas: { projectId: "p1", personas: [{ id: "ps", label: "Persona<", describedAs: "a beginner", tracked: true, addedAt: at }, { id: "old", label: "Old", describedAs: "x", tracked: false, addedAt: at }], updatedAt: at },
    personasState: "ready", rivals: { projectId: "p1", competitors: rivals, updatedAt: at }, rivalsState: "ready", demand, demandState: "ready",
    ...over,
  };
}
function actions(calls: string[]): BrandVisibilityActions {
  return Object.fromEntries(["Home", "AnswerEngine", "Outreach", "RankingPlan", "Actions", "Personas", "Rivals", "Demand"].map((name) => ["load" + name, () => { calls.push(name); }])) as unknown as BrandVisibilityActions;
}
const runAction = (label: string) => "RUN[" + label + "]";

test("Rivals with no project asks for one and loads nothing", () => {
  const calls: string[] = [];
  has(renderBrandVisibility(state(), null, [], runAction, actions(calls)), "Create a project first");
  assert.deepEqual(calls, []);
});

test("Rivals loads its first reads while idle, and shows its error or loading board", () => {
  const calls: string[] = [];
  const idle = state({ homeState: "idle", answerEngineState: "idle", outreachState: "idle", rankPlanState: "idle" });
  has(renderBrandVisibility(idle, project, [], runAction, actions(calls)), "Rivals", "RUN[Run prompts]");
  assert.deepEqual(calls, ["Home", "AnswerEngine", "Outreach", "RankingPlan"]);
  has(renderBrandVisibility(state({ answerEngineState: "error" }), project, [], runAction, actions([])), "Could not read this project.");
  assert.equal(renderBrandVisibility(state({ homeState: "loading" }), project, [], runAction, actions([])).includes("rival-leaderboard"), false);
});

test("Rivals loads the cards' own reads once the board is ready", () => {
  const calls: string[] = [];
  const idle = state({ demandState: "idle", demand: null, rivalsState: "idle", rivals: null, personasState: "idle", personas: null, actionsState: "idle", actions: [] });
  has(renderBrandVisibility(idle, project, [], runAction, actions(calls)), "Prompt volume", "Who is asking");
  assert.deepEqual(calls.sort(), ["Actions", "Demand", "Personas", "Rivals"]);
});

test("Rivals draws the board, the plan and the competitor figures from the answers", () => {
  const out = renderBrandVisibility(state({ panelOpen: ["rival-absent", "rival-topics", "rival-named", "rival-trend", "rival-region", "rival-persona", "rival-personas", "rival-model"] }), project, [], runAction, actions([]));
  has(out, "What would move this", "Competitors named in the answers", "Rival One", "Questions you never appear in", "Question b", "Topics, weakest first", "Topic&lt;", "about&amp;");
  has(out, "Ghost&lt;", "Stop tracking", "data-retire-rival=\"rival-1\"", "Persona&lt;", "data-retire-persona=\"ps\"", "M&lt;");
  has(out, "One run is a snapshot", "Only one market has been asked");
});

test("the rival cards stay out until the read has answers", () => {
  assert.equal(rivalDetail(state({ answerEngineState: "loading" }), [], actions([])), "");
  assert.equal(rivalDetail(state({ answerEngine: null }), [], actions([])), "");
  assert.equal(rivalDetail(state({ answerEngine: { ...engine, answers: 0 } }), [], actions([])), "");
});

test("prompt volume says no corpus is not zero demand, then lists the counts", () => {
  const calls: string[] = [];
  const load = { loadDemand: () => { calls.push("demand"); } };
  has(renderDemand("idle", null, load), "Prompt volume", "No corpus is indexed.");
  assert.deepEqual(calls, ["demand"]);
  has(renderDemand("loading", null, load), "the corpus report");
  const out = renderDemand("ready", demand, load);
  has(out, "cav&lt;", "Q&lt;", "ex&amp;", "10%", "not comparable", "term&lt;");
  assert.ok(out.indexOf(">R<") < out.indexOf(">Q&lt;<"), "the larger related count comes first");
  assert.equal(calls.length, 1);
});

test("the plan loads its reads while idle and marks a move that has been taken up", () => {
  const calls: string[] = [];
  const load = { loadRankingPlan: () => { calls.push("plan"); }, loadActions: () => { calls.push("actions"); } };
  has(renderRankingPlan({ rankPlan: null, rankPlanState: "idle", actions: [], actionsState: "idle" }, load), "Reading the answers to work out");
  assert.deepEqual(calls, ["plan", "actions"]);
  has(renderRankingPlan({ rankPlan: null, rankPlanState: "error", actions: [], actionsState: "ready" }, load), "Could not build a plan");
  const move = plan.moves[0];
  assert.ok(move);
  const out = renderRankingPlan(state({ actions: [taken(move.id, "doing", move.promptId ?? null)] }), load);
  has(out, html(plan.verdict), 'class="pill good">doing<', "Since you started: 2 answer(s) since", "score +10", "now ranked #2", "Reopen");
  has(renderRankingPlan(state({ actions: [] }), load), "Doing", "Not doing");
  assert.equal(renderRankingPlan(state({ actions: [] }), load).includes("Reopen"), false);
});

function html(text: string): string {
  return text.split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;");
}

test("personas and rivals load while idle and offer the way to stop", () => {
  const calls: string[] = [];
  const load = { loadPersonas: () => { calls.push("personas"); }, loadRivals: () => { calls.push("rivals"); } };
  has(renderPersonas("idle", null, load), "Reading the personas.");
  has(renderPersonas("error", null, load), "Could not read the personas.");
  has(renderPersonas("ready", { projectId: "p1", personas: [], updatedAt: at }, load), "No persona yet");
  has(renderPersonas("ready", state().personas, load), "Persona&lt;", "a beginner", "Stop asking");
  assert.equal(renderPersonas("ready", state().personas, load).includes("Old"), false);
  has(renderRivals({ rivals: null, rivalsState: "idle" }, engine, load), "Adopt the ones already named");
  assert.deepEqual(calls, ["personas", "rivals"]);
  const out = renderRivals(state(), engine, load);
  has(out, 'data-retire-rival="rival-1"', "Ghost&lt;", "no domain");
  has(renderRivals(state(), { ...engine, trackedRivals: [] }, load), "No rival is tracked yet");
});

test("the plain rows say what is empty and print what is there", () => {
  has(renderAbsent([]), "Every prompt with an answer named you at least once.");
  has(renderAbsent(engine.absentFrom), "Open the brief", "Question b");
  has(renderModelRows([]), "No model has answered yet.");
  has(renderModelRows(engine.byModel), "M&lt;", "openai");
  has(renderRegionRows([], "c"), "Only one market has been asked");
  has(renderTopicRows([]), "No topic has been answered yet.");
  has(renderTopicRows(engine.topics), "Topic&lt;", "Question a", "answer(s)");
  has(renderPromptTrend(null), "One run is a snapshot.");
  has(renderPromptTrend(engine.trend), "Not comparable yet", "trend-head");
});
