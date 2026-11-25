import test from "node:test";
import assert from "node:assert/strict";
import {
  answerPage, renderAnswerEngine, renderCitationHistory, renderCitedPages, renderTrustPage,
  type AnswerActions, type AnswerPageWeights, type CitedActions, type SourcesActions, type SourcesState, type TrustPageActions, type TrustPageState,
} from "../src/ui/app/pages/answer-page.js";
import { buildTopicInsights } from "../src/product/topics/topic-insights.js";
import { buildCitationAnalysis } from "../src/product/topics/citation-analysis.js";
import { buildCitationHistory } from "../src/product/citations/citation-history.js";
import { citationStanding, positionReport } from "../src/product/topics/position-metrics.js";
import { emptyTopicSet, type TopicSet } from "../src/product/topics/topic-schema.js";
import type { PromptAnswer, PromptRun } from "../src/product/topics/prompt-run-schema.js";
import type { InsightsShape, ProjectRow, RunRow } from "../src/ui/app/types.js";
import type { FoldCard } from "../src/ui/app/pages/trust-sections.js";

function has(text: string, ...parts: string[]): void {
  for (const part of parts) assert.ok(text.includes(part), `${JSON.stringify(text)} lacks ${part}`);
}
function lacks(text: string, ...parts: string[]): void {
  for (const part of parts) assert.ok(!text.includes(part), `${JSON.stringify(text)} has ${part}`);
}

const at = (day: string) => `2026-11-${day}T10:00:00.000Z`;
const set: TopicSet = {
  ...emptyTopicSet("p1"),
  topics: [{ id: "t1", projectId: "p1", name: "Invoicing", description: "d", source: "authored", status: "active", createdAt: at("01") }],
  prompts: ["a", "b"].map((id) => ({
    id, projectId: "p1", topicId: "t1", text: "Question " + id, normalizedText: "question " + id, intent: "discovery" as const, source: "authored" as const,
    measuresVisibility: true, visibilityExclusionReason: null, status: "active" as const, createdAt: at("01"), activatedAt: at("01"),
  })),
};
let counter = 0;
const answer = (runId: string, promptId: string, day: string, over: Partial<PromptAnswer> = {}): PromptAnswer => ({
  id: "x" + counter++, projectId: "p1", runId, promptId, topicId: "t1", promptText: "Question " + promptId, intent: "discovery", providerId: "openai", modelId: "m1", modelDisplayName: "M1",
  regionId: "global", languageId: "en", status: "completed", text: "Acme is a tool", citationUrls: [], errorCode: null, errorMessage: null, latencyMs: 1, createdAt: at(day),
  mentions: [{ name: "Acme", domain: "acme.com", recommendation: "positive", mentionQuote: "Acme", firstMentionOffset: 0, firstMentionState: "unique", isTarget: true }],
  ...over,
});
const runs: PromptRun[] = ["r1", "r2"].map((id, index) => ({
  id, projectId: "p1", status: "completed", promptIds: [], modelIds: [], regionIds: [], languageIds: [], answersRequested: 2, answersCompleted: 2, answersFailed: 0,
  startedAt: at(index ? "09" : "02"), completedAt: at(index ? "09" : "02"),
} as unknown as PromptRun));
const insightsOf = (answers: PromptAnswer[]): InsightsShape => {
  const insights = buildTopicInsights({ projectId: "p1", set, answers, runs });
  return { ...insights, position: positionReport(insights.topics.flatMap((topic) => topic.prompts)) };
};
const cited = [
  answer("r1", "a", "02", { citationUrls: ["https://acme.com/pricing", "https://rival.com/best"] }),
  answer("r1", "b", "02", { citationUrls: ["https://rival.com/best"], mentions: [] }),
  answer("r2", "a", "09", { citationUrls: ["https://rival.com/best"] }),
];
const analysisOf = (answers: PromptAnswer[]) => {
  const analysis = buildCitationAnalysis({ answers, identity: { host: "acme.com", distinctive: ["Acme"], ambiguous: [], nameMatchingUnreliable: false, caveat: null } });
  return { ...analysis, standing: citationStanding(analysis) };
};

const calls: string[] = [];
const spy = (...names: string[]) => Object.fromEntries(names.map((name) => [name, () => { calls.push(name); }]));
const answerActions = () => spy("loadAnswerEngine", "loadLiveRun") as unknown as AnswerActions;
const citedActions = () => spy("loadCited", "loadHistory") as unknown as CitedActions;
const sourceActions = () => spy("loadAnswerEngine", "loadLiveRun", "loadCited", "loadHistory", "loadInterference", "loadConcentration", "loadShape", "loadCredit", "loadKinds", "loadOutreach", "loadSearchDemand", "loadReferrals", "loadUptake") as unknown as SourcesActions;
const trustActions = () => spy("loadAnswerEngine", "loadLiveRun", "loadCheck", "loadExperiments", "loadSchedule") as unknown as TrustPageActions;
const fold: FoldCard = (id, title, _blurb, body) => `<fold ${id}>${title}${body}</fold>`;
const runAction = (label: string) => `RUN[${label}]`;
const project: ProjectRow = { id: "p1", name: "Acme", normalizedDomain: "acme.com", status: "active" };
const failedRun = { id: "r2", status: "completed", answersRequested: 4, answersCompleted: 2, answersFailed: 2, startedAt: at("09"), completedAt: at("09") } as RunRow;

function sourcesState(over: Partial<SourcesState> = {}): SourcesState {
  return {
    answerEngine: insightsOf(cited), answerEngineState: "ready", liveRun: null, lastRun: null, promptRunState: "idle", panelOpen: [],
    cited: analysisOf(cited), citedState: "ready", history: buildCitationHistory(cited), historyState: "ready",
    uptake: null, uptakeState: "ready", outreach: null, outreachState: "ready", harvesting: false, searchDemand: null, searchDemandState: "ready", pulling: false,
    referrals: null, referralsState: "ready", pullingReferrals: false, credit: null, creditState: "ready", kinds: null, kindsState: "ready", shape: null, shapeState: "ready",
    concentration: null, concentrationState: "ready", interference: null, interferenceState: "ready", ...over,
  };
}
function trustState(over: Partial<TrustPageState> = {}): TrustPageState {
  const { answerEngine, answerEngineState, liveRun, lastRun, promptRunState, panelOpen, cited: citedPages, citedState, history, historyState } = sourcesState();
  return {
    answerEngine, answerEngineState, liveRun, lastRun, promptRunState, panelOpen, cited: citedPages, citedState, history, historyState,
    check: null, checkState: "ready", experiments: null, experimentsState: "ready", schedule: null, scheduleState: "ready", regions: [], ...over,
  };
}
const shell = (state: SourcesState, selected: ProjectRow | null = project, body: (data: InsightsShape, page: AnswerPageWeights) => string = () => "BODY") =>
  answerPage(state, selected, [], runAction, answerActions(), "Title<", "Sub&", body);

test("no project selected shows the prompt and loads nothing", () => {
  calls.length = 0;
  const out = shell(sourcesState({ answerEngineState: "idle" }), null);
  has(out, "Select a project first");
  assert.deepEqual(calls, []);
});

test("an idle read asks for the insights and the run, once each", () => {
  calls.length = 0;
  const out = shell(sourcesState({ answerEngineState: "idle", answerEngine: null }));
  has(out, "Title&lt;", "Sub&amp;", "Reading the archived answers");
  assert.deepEqual(calls, ["loadAnswerEngine", "loadLiveRun"]);
  calls.length = 0;
  shell(sourcesState({ answerEngineState: "loading", answerEngine: null }));
  assert.deepEqual(calls, []);
});

test("a read that failed says so instead of waiting", () => {
  const out = shell(sourcesState({ answerEngineState: "error", answerEngine: null }));
  has(out, "Could not");
  lacks(out, "Reading the archived answers");
});

test("an archive with no answers points at the prompts, and draws no body", () => {
  const empty = insightsOf([]);
  const out = shell(sourcesState({ answerEngine: empty }));
  has(out, "No answers yet", "Set up prompts");
  lacks(out, "BODY");
});

test("the body gets the insights and the weights, and a missing objective is passed on as empty", () => {
  let page: AnswerPageWeights | undefined;
  let seen: InsightsShape | undefined;
  const state = sourcesState();
  const out = shell(state, project, (data, weights) => { seen = data; page = weights; return "BODY"; });
  has(out, "BODY", "RUN[Ask the questions]");
  assert.equal(seen, state.answerEngine);
  has(page?.objective ?? "", "What it is built to maximise", "What it cannot be used for");
  assert.equal(page?.weights, state.answerEngine?.weights);
  const bare = { ...insightsOf(cited), weights: { prominenceFloor: 0.3, sentimentFloor: 0.4 } } as unknown as InsightsShape;
  shell(sourcesState({ answerEngine: bare }), project, (_data, weights) => { page = weights; return ""; });
  assert.equal(page?.objective, "");
  const missing = { ...insightsOf(cited), weights: undefined } as unknown as InsightsShape;
  shell(sourcesState({ answerEngine: missing }), project, (_data, weights) => { page = weights; return ""; });
  assert.deepEqual(page?.weights, { prominenceFloor: 0, sentimentFloor: 0 });
});

test("the retry button asks only for the failures, and goes while a run is live or starting", () => {
  const failing = { ...insightsOf(cited), answersFailed: 2 } as InsightsShape;
  const withFailed = sourcesState({ answerEngine: failing, lastRun: failedRun });
  has(shell(withFailed), "Ask the 2 that failed again", "data-retry-run");
  has(shell(sourcesState({ answerEngine: failing, lastRun: failedRun, promptRunState: "running" })), "Asking");
  lacks(shell(sourcesState({ answerEngine: failing, lastRun: { ...failedRun, answersFailed: 0 } })), "that failed again");
  lacks(shell(sourcesState({ answerEngine: failing, lastRun: failedRun, liveRun: { ...failedRun, status: "running" } })), "that failed again");
});

test("failures are listed by wording once, summing counts and models, largest first", () => {
  const data = {
    ...insightsOf(cited), answersFailed: 5,
    failureReasons: [
      { code: "a", count: 2, label: "Same", models: ["m1", "m2"] }, { code: "b", count: 3, label: "Same", models: ["m2", "m3", "m4", "m5"] },
      { code: "c", count: 9, label: "Big", models: [] }, { code: "d", count: 0, label: "Zero", models: [] },
    ],
  } as InsightsShape;
  const out = shell(sourcesState({ answerEngine: data }));
  has(out, "What failed, and why (2)", "9 to Big", "5 to Same", "m1, m2, m3");
  lacks(out, "Zero", "m4");
  assert.ok(out.indexOf("9 to Big") < out.indexOf("5 to Same"));
});

test("an explanation folds and an action stays out, and the fold stays open when the reader opened it", () => {
  const data = { ...insightsOf(cited), answersRetired: 3, identityCaveat: "Acme is a word." } as InsightsShape;
  const closed = shell(sourcesState({ answerEngine: data }));
  has(closed, 'data-fold="answer-caveats"', "What these numbers do and do not cover (2)", "3 archived answer(s)", "Acme is a word.");
  lacks(closed, 'data-fold="answer-caveats" open');
  has(shell(sourcesState({ answerEngine: data, panelOpen: ["answer-caveats"] })), 'data-fold="answer-caveats" open');
  const action = { id: "answers-failed", urgency: "blocking", title: "Fix", why: "w", evidence: "e", page: "reports", action: "Do" };
  const failed = { ...data, answersFailed: 1 } as InsightsShape;
  const out = answerPage(sourcesState({ answerEngine: failed }), project, [action as never], runAction, answerActions(), "T", "S", () => "");
  assert.ok(out.indexOf("task-cta") >= 0 && out.indexOf("task-cta") < out.indexOf('data-fold="answer-caveats"'));
});

test("the cause of missing citations is named: switched off, none can search, or nothing says", () => {
  const none = insightsOf(cited.map((row) => ({ ...row, citationUrls: [] })));
  const split = (over: object) => ({ considered: 4, activated: 0, unavailable: 0, notRequested: 0, unknown: 0, rate: 0, low: 0, high: 0, caveat: "c", ...over });
  const text = (activation: object) => shell(sourcesState({ answerEngine: { ...none, citationsUnavailable: true, activation } as InsightsShape }));
  has(text(split({ notRequested: 3 })), "Web search is off in Choose models");
  has(text(split({ notRequested: 3, activated: 1 })), "A provider with web search will produce them.");
  has(text(split({ unavailable: 4 })), "None of the models that ran can search the web at all");
  has(text(split({ considered: 0 })), "A provider with web search will produce them.");
  lacks(shell(sourcesState()), "No answer carried a citation");
});

test("corroboration is reported only where it was measured", () => {
  const corroboration = { reported: 6, measured: 4, namedOnly: 1, absentFromAnswer: 1, quotesChecked: 5, quotesFound: 3, caveat: "Caveat<" };
  const out = shell(sourcesState({ answerEngine: { ...insightsOf(cited), corroboration } as InsightsShape }));
  has(out, "4 of 6 mentions were found", "and 1 named nothing the answer actually contains", "3 of 5 quoted lines", "Caveat&lt;");
  const silent = shell(sourcesState({ answerEngine: { ...insightsOf(cited), corroboration: { ...corroboration, reported: 0 } } as InsightsShape }));
  lacks(silent, "mentions were found");
});

test("Sources keeps the pages and the uptake open, and folds the other cards unless the reader opened them", () => {
  const out = renderAnswerEngine(sourcesState(), project, [], runAction, fold, sourceActions());
  has(out, "Cited, or actually used", "Who gets the credit", "Someone else is working on this answer");
  has(out, 'data-panel="source-pages" draggable', 'data-panel="source-uptake" draggable');
  has(out, 'data-fold="source-credit"', 'data-fold="source-interference"');
  lacks(out, 'data-fold="source-pages"', 'data-fold="source-uptake"', 'data-fold="source-credit" open');
  has(renderAnswerEngine(sourcesState({ panelOpen: ["source-credit"] }), project, [], runAction, fold, sourceActions()), 'data-fold="source-credit" open');
});

test("a retry button is an action, so it stays above the fold and does not wait for a task", () => {
  const failing = { ...insightsOf(cited), answersFailed: 2 } as InsightsShape;
  const out = shell(sourcesState({ answerEngine: failing, lastRun: failedRun }));
  has(out, "data-retry-run", "2 answer(s) failed and are excluded");
  lacks(out, 'data-fold="answer-caveats"');
});

test("every Sources section asks for its own read while idle", () => {
  calls.length = 0;
  renderAnswerEngine(sourcesState({ uptakeState: "idle", creditState: "idle", historyState: "idle", history: null }), project, [], runAction, fold, sourceActions());
  for (const name of ["loadUptake", "loadCredit", "loadHistory"]) assert.ok(calls.includes(name), name);
});

test("Trust draws the score through the function it is given, and the formula from the weights", () => {
  calls.length = 0;
  const out = renderTrustPage(trustState({ checkState: "idle", experimentsState: "idle", scheduleState: "idle" }), project, [], runAction, fold, (score) => `SCORE[${score ? score.answers : "none"}]`, trustActions());
  has(out, "How the score is built", "SCORE[", "The formula, and the judgement in it", "score = presence", "Check the machine", "Keep it running");
  for (const name of ["loadCheck", "loadExperiments", "loadSchedule"]) assert.ok(calls.includes(name), name);
});

test("Pages cited are tabled, and an unreadable or empty read says so", () => {
  const out = renderCitedPages(sourcesState(), [], fold, citedActions());
  has(out, "3 of 3 answers carried a source", "Your page", "acme.com/pricing", "rival.com", "Without you", "sources-own", "sources-history");
  has(renderCitedPages(sourcesState({ citedState: "error" }), [], fold, citedActions()), "Could not read the archived sources.");
  has(renderCitedPages(sourcesState({ cited: analysisOf(cited.map((row) => ({ ...row, citationUrls: [] }))) }), [], fold, citedActions()), "No answer carried a source");
  has(renderCitedPages(sourcesState({ cited: { ...analysisOf(cited), answersWithCitations: 0, unavailable: false } }), [], fold, citedActions()), "Nothing has been answered with a source yet.");
  has(renderCitedPages(sourcesState({ cited: { ...analysisOf(cited), ownPages: [] } }), [], fold, citedActions()), "No answer cited a page of yours.");
  has(renderCitedPages(sourcesState({ cited: { ...analysisOf(cited), openings: [] } }), [], fold, citedActions()), "No page won a question you were absent from.");
});

test("only the first twelve own pages and domains are tabled", () => {
  const base = analysisOf(cited);
  const page = (index: number) => ({ url: `https://acme.com/p${index}`, path: `/p${index}`, answers: 1, prompts: ["a"] });
  const domain = (index: number) => ({ domain: `d${index}.example`, answers: 1, pages: 1, isTarget: false, answersWithoutYou: 0 });
  const many = { ...base, ownPages: Array.from({ length: 13 }, (_, index) => page(index)), domains: Array.from({ length: 13 }, (_, index) => domain(index)) };
  const out = renderCitedPages(sourcesState({ cited: many as never }), [], fold, citedActions());
  has(out, "/p11", "d11.example");
  lacks(out, "/p12", "d12.example");
});

test("loading cited pages asks once while idle and not while loading", () => {
  calls.length = 0;
  renderCitedPages(sourcesState({ citedState: "idle", cited: null }), [], fold, citedActions());
  assert.deepEqual(calls.filter((name) => name === "loadCited"), ["loadCited"]);
  calls.length = 0;
  renderCitedPages(sourcesState({ citedState: "loading", cited: null }), [], fold, citedActions());
  assert.ok(!calls.includes("loadCited"));
});

test("history lists only pages that dropped, slipped or were cited once, and needs two runs", () => {
  const rich = buildCitationHistory([...cited, answer("r3", "a", "15", { citationUrls: ["https://acme.com/pricing"] }), answer("r4", "a", "20", { citationUrls: ["https://rival.com/best"] })]);
  const out = renderCitationHistory(sourcesState({ history: rich }), citedActions());
  has(out, "Across 4 run(s) that cited something", "Last cited");
  const one = renderCitationHistory(sourcesState({ history: buildCitationHistory(cited.slice(0, 2)) }), citedActions());
  has(one, "1 run(s) carried a citation. Two are needed");
  has(renderCitationHistory(sourcesState({ historyState: "error" }), citedActions()), "Could not read what each page did over time.");
  calls.length = 0;
  renderCitationHistory(sourcesState({ historyState: "idle", history: null }), citedActions());
  assert.deepEqual(calls, ["loadHistory"]);
});

test("the history says how many runs it set aside", () => {
  const base = buildCitationHistory(cited);
  has(renderCitationHistory(sourcesState({ history: { ...base, measurableRuns: 2, silentRuns: 1 } }), citedActions()), ", ignoring 1 that cited nothing at all");
  lacks(renderCitationHistory(sourcesState({ history: { ...base, measurableRuns: 2, silentRuns: 0 } }), citedActions()), "ignoring");
});

test("the score formula is written from the floors it was given", () => {
  let page: AnswerPageWeights | undefined;
  shell(sourcesState(), project, (_data, weights) => { page = weights; return ""; });
  const out = renderTrustPage(trustState(), project, [], runAction, fold, () => "", trustActions());
  const floor = page?.weights.prominenceFloor ?? 0;
  has(out, `score = presence \u00d7 (${floor} + ${(1 - floor).toFixed(1)} \u00d7 prominence)`);
});

test("only your own domain wears the badge, and only the first eight openings are listed", () => {
  const out = renderCitedPages(sourcesState(), [], fold, citedActions());
  has(out, '<strong>acme.com <span class="pill good">You</span></strong>', "<strong>rival.com</strong>");
  const openings = Array.from({ length: 9 }, (_, index) => ({ url: `https://o${index}.example/x`, domain: `o${index}.example`, prompt: `win ${index}` }));
  const many = renderCitedPages(sourcesState({ cited: { ...analysisOf(cited), openings } }), [], fold, citedActions());
  has(many, 'won "win 7"');
  lacks(many, 'won "win 8"');
});

test("a history where every page still holds says so", () => {
  const base = buildCitationHistory(cited);
  const held = { ...base, measurableRuns: 2, pages: base.pages.map((row) => ({ ...row, verdict: "cited" as const })) };
  has(renderCitationHistory(sourcesState({ history: held }), citedActions()), "Every page cited before is still being cited.");
});
