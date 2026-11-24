import test from "node:test";
import assert from "node:assert/strict";
import { buildMatrix, dashboardView, renderHome, type HomeActions, type HomeState } from "../src/ui/app/pages/home-view.js";
import { buildTopicInsights } from "../src/product/topics/topic-insights.js";
import { buildHomeSummary } from "../src/product/alerts/home-summary.js";
import { buildRankingPlan } from "../src/product/topics/ranking-plan.js";
import { buildCitationAnalysis } from "../src/product/topics/citation-analysis.js";
import { citationStanding, positionReport } from "../src/product/topics/position-metrics.js";
import { emptyTopicSet, type Prompt, type TopicSet } from "../src/product/topics/topic-schema.js";
import type { PromptAnswer, PromptRun } from "../src/product/topics/prompt-run-schema.js";
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
  topics: [{ id: "t1", projectId: "p1", name: "Topic<", description: "", source: "authored", status: "active", createdAt: at }],
  prompts: [prompt("a"), prompt("b")],
};
const answer = (id: string, promptId: string, named: boolean): PromptAnswer => ({
  id, projectId: "p1", runId: "r1", promptId, topicId: "t1", promptText: "Question " + promptId, intent: "discovery", providerId: "openai", modelId: "m", modelDisplayName: "M",
  regionId: "global", languageId: "en", status: "completed", text: "Acme, Rival One", citationUrls: [], errorCode: null, errorMessage: null, latencyMs: 1, createdAt: at,
  mentions: [
    ...(named ? [{ name: "Acme", domain: "acme.example", recommendation: "positive" as const, mentionQuote: "Acme", firstMentionOffset: 0, firstMentionState: "unique" as const, isTarget: true }] : []),
    { name: "Rival One", domain: "rival.example", recommendation: "mentioned" as const, mentionQuote: "Rival One", firstMentionOffset: named ? 6 : 0, firstMentionState: "unique" as const, isTarget: false },
  ],
});
const answers = [answer("1", "a", true), answer("2", "a", false), answer("3", "b", true)];
const run: PromptRun = {
  id: "r1", projectId: "p1", status: "completed", promptIds: ["a", "b"], modelIds: ["m"], regionIds: ["global"], languageIds: ["en"],
  answersRequested: 3, answersCompleted: 3, answersFailed: 0, startedAt: at, completedAt: at,
};
const insights = buildTopicInsights({ projectId: "p1", set, answers, runs: [run] });
const engine = { ...insights, position: positionReport(insights.topics.flatMap((topic) => topic.prompts)) };
const home = buildHomeSummary({ projectId: "p1", domain: "acme.example", set, insights, runs: [run], modelCount: 1 });
const plan = buildRankingPlan({ insights, set });
const analysis = buildCitationAnalysis({ answers, identity: { distinctive: ["acme"], ambiguous: [], host: "acme.example", nameMatchingUnreliable: false, caveat: null } });
const project: ProjectRow = { id: "p1", name: "Acme<", normalizedDomain: "acme.example", status: "active" };

function state(over: Partial<HomeState> = {}): HomeState {
  return {
    home, homeState: "ready", answerEngine: engine, answerEngineState: "ready",
    outreach: {
      answersWithCitations: 2, answersConsidered: 3, read: 1, cited: 4, reachable: 1, rivalOwned: 0, unavailable: false,
      freshness: { pages: [], fresh: 0, ageing: 0, stale: 0, undated: 0, datedPages: 0, medianAgeDays: null, caveat: "" },
      targets: [],
    },
    rankPlan: plan, rankPlanState: "ready",
    referrals: {
      configured: true, propertyId: "1", detail: "d",
      report: { propertyId: "1", from: "a", to: "b", fetchedAt: "c", empty: false, totalSessions: 9, assistants: [{ source: "chat", sessions: 6, engaged: null }] },
    },
    searchDemand: {
      configured: true, siteUrl: "https://acme.example", detail: "d",
      report: {
        siteUrl: "https://acme.example", fetchedAt: at, queries: 2, totalImpressions: 50, window: { from: "a", to: "b" },
        prompts: [{ promptId: "a", text: "Question a", exact: [], related: [], impressions: 40, clicks: 3, position: 4, earnedInSearchAbsentInAnswers: true }, { promptId: "b", text: "b", exact: [], related: [], impressions: 0, clicks: 0, position: null, earnedInSearchAbsentInAnswers: false }],
      },
    },
    cited: { ...analysis, standing: citationStanding(analysis) },
    brandIcons: { "rival.example": "mark.png" }, matrixOpen: ["t:t1"], matrixHidden: [],
    outreachState: "ready", digest: { headline: "Moved<", newsworthy: true, lines: ["line one"], builtAt: at }, digestState: "ready",
    searchDemandState: "ready", referralsState: "ready", editingBoard: false, panelViews: {}, liveRun: null,
    ...over,
  };
}

test("the board waits for both reads, and for a project", () => {
  assert.equal(dashboardView(state(), null), null);
  assert.equal(dashboardView(state({ home: null }), project), null);
  assert.equal(dashboardView(state({ answerEngine: null }), project), null);
  assert.equal(dashboardView(state({ homeState: "loading" }), project), null);
  assert.equal(dashboardView(state({ answerEngineState: "error" }), project), null);
});

test("the board counts questions, assistants and the moves that raise visibility", () => {
  const view = dashboardView(state(), project);
  assert.ok(view);
  assert.equal(view.domain, "acme.example");
  assert.equal(view.questions, 2);
  assert.equal(view.measurable, 2);
  assert.equal(view.assistants, 1);
  assert.equal(view.assistantsConfigured, engine.byModel.length);
  assert.equal(view.alerts, home.alerts.length);
  assert.equal(view.citedPages, 4);
  assert.equal(view.missingFrom, 0);
  assert.deepEqual(view.moves, plan.moves.filter((move) => move.effect === "raises_visibility"));
  assert.equal(view.leaderboard.find((row) => row.name === "Rival One")?.icon, "mark.png");
  assert.equal(view.leaderboard.find((row) => row.isTarget)?.icon, null);
  assert.equal(view.asked?.unbranded.prompts, 2);
  assert.equal(view.asked?.branded.sentiment, null);
  assert.deepEqual(view.demand, { configured: true, pulled: true, impressions: 40, clicks: 3, gaps: 1, top: [{ text: "Question a", impressions: 40, position: 4 }] });
  assert.deepEqual(view.arrivals, { configured: true, pulled: true, sessions: 6, assistants: [{ source: "chat", sessions: 6, engaged: 0 }] });
  assert.equal(view.link, undefined);
});

test("a plan still being built is null, and one that failed is none", () => {
  assert.equal(dashboardView(state({ rankPlanState: "loading", rankPlan: null }), project)?.moves, null);
  assert.deepEqual(dashboardView(state({ rankPlanState: "error", rankPlan: null }), project)?.moves, []);
  assert.equal(dashboardView(state({ outreach: null }), project)?.citedPages, null);
  assert.equal(dashboardView(state({ searchDemand: null, referrals: null }), project)?.demand, undefined);
});

test("the matrix keeps the reader's own column and caps the rivals", () => {
  assert.equal(buildMatrix(null, "acme.example", {}), undefined);
  assert.equal(buildMatrix({ ...engine, topics: [] }, "acme.example", {}), undefined);
  const matrix = buildMatrix(engine, "acme.example", { "rival.example": "mark.png" });
  assert.ok(matrix);
  assert.deepEqual(matrix.columns.map((column) => column.name), ["Acme", "Rival One"]);
  assert.equal(matrix.columns[1]?.icon, "mark.png");
  assert.equal(matrix.rows[0]?.key, "t:t1");
  assert.equal(matrix.rows.length, 3);
  const unnamed = buildMatrix({ ...engine, leaderboard: engine.leaderboard.filter((row) => !row.isTarget) }, "acme.example", {});
  assert.equal(unnamed?.columns[0]?.name, "acme.example");
});

function actions(calls: string[]): HomeActions {
  return Object.fromEntries(["Home", "AnswerEngine", "Outreach", "RankingPlan", "Digest", "SearchDemand", "Referrals"].map((name) => ["load" + name, () => { calls.push(name); }])) as unknown as HomeActions;
}
const runAction = (label: string) => "RUN[" + label + "]";

test("Home with no project asks for one, and loads nothing", () => {
  const calls: string[] = [];
  has(renderHome(state(), null, [], runAction, actions(calls)), "Create a project first");
  assert.deepEqual(calls, []);
});

test("Home fires each read's loader only while that read is idle", () => {
  const calls: string[] = [];
  const idle = state({ homeState: "idle", answerEngineState: "idle", outreachState: "idle", rankPlanState: "idle", digestState: "idle", searchDemandState: "idle", referralsState: "idle" });
  has(renderHome(idle, project, [], runAction, actions(calls)), "Acme&lt;", "RUN[Run prompts]");
  assert.deepEqual(calls, ["Home", "AnswerEngine", "Outreach", "RankingPlan", "Digest", "SearchDemand", "Referrals"]);
  calls.length = 0;
  renderHome(state(), project, [], runAction, actions(calls));
  assert.deepEqual(calls, []);
});

test("Home shows a read error, a loading board, or the setup steps before any answer", () => {
  const noop = actions([]);
  has(renderHome(state({ homeState: "error" }), project, [], runAction, noop), "Could not read this project.");
  has(renderHome(state({ answerEngineState: "error" }), project, [], runAction, noop), "Could not read this project.");
  assert.equal(renderHome(state({ homeState: "loading" }), project, [], runAction, noop).includes("scorebig"), false);
  const todo = [{ id: "models" as const, label: "Choose<", detail: "none yet", done: false }, ...home.setup.slice(1)];
  const setup = renderHome(state({ home: { ...home, showSetupOnly: true, setup: todo } }), project, [], runAction, noop);
  has(setup, "mcols-step", "Choose&lt;", 'data-page="models"', "state-ok");
  assert.equal(setup.includes("scorebig"), false);
});

test("Home draws the hero, the next tasks, what changed and what needs attention", () => {
  const task = { id: "t", urgency: "blocking" as const, title: "Fix<", why: "w", evidence: "e", page: "reports", action: "Do it" };
  const out = renderHome(state(), project, [task], runAction, actions([]));
  has(out, "scorebig", "What to do next", "Fix&lt;", "What changed", "Moved&lt;", "line one", "Needs attention", "Arrange board", "Full report", "RUN[Run prompts]");
  has(renderHome(state({ editingBoard: true }), project, [], runAction, actions([])), "Done arranging");
  has(renderHome(state({ digestState: "loading" }), project, [], runAction, actions([])), "what changed");
  has(renderHome(state({ digest: null }), project, [], runAction, actions([])), "Nothing has moved since the previous run.");
});
