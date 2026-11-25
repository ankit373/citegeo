import test from "node:test";
import assert from "node:assert/strict";
import {
  filteredPrompts, promptBulkInner, promptStandings, renderPrompts, topicStandings, livePrompts, promptResultSummary,
  type PromptsActions, type PromptsState, type PriorityQuestion,
} from "../src/ui/app/pages/prompts-view.js";
import { buildTopicInsights } from "../src/product/topics/topic-insights.js";
import { buildHomeSummary } from "../src/product/alerts/home-summary.js";
import { positionReport } from "../src/product/topics/position-metrics.js";
import { emptyTopicSet, type Prompt, type TopicSet } from "../src/product/topics/topic-schema.js";
import type { PromptAnswer, PromptRun } from "../src/product/topics/prompt-run-schema.js";
import type { ProjectRow } from "../src/ui/app/types.js";

function has(text: string, ...parts: string[]): void {
  for (const part of parts) assert.ok(text.includes(part), `${JSON.stringify(text)} lacks ${part}`);
}

const at = "2026-11-20T10:00:00.000Z";
const prompt = (id: string, over: Partial<Prompt> = {}): Prompt => ({
  id, projectId: "p1", topicId: "t1", text: "Question " + id, normalizedText: "question " + id, intent: "discovery", source: "authored",
  measuresVisibility: true, visibilityExclusionReason: null, status: "active", createdAt: at, activatedAt: at, ...over,
});
const set: TopicSet = {
  ...emptyTopicSet("p1"),
  topics: [
    { id: "t1", projectId: "p1", name: "Topic<", description: "about&", source: "authored", status: "active", createdAt: at },
    { id: "t2", projectId: "p1", name: "Gone", description: "", source: "authored", status: "retired", createdAt: at },
  ],
  prompts: [
    prompt("a"), prompt("b", { status: "proposed" }), prompt("c", { intent: "brand", measuresVisibility: false }),
    prompt("d", { topicId: "t2", status: "retired" }), prompt("e"), prompt("f"), prompt("g"),
  ],
};
const answer = (id: string, promptId: string, named: boolean): PromptAnswer => ({
  id, projectId: "p1", runId: "r1", promptId, topicId: "t1", promptText: "Question " + promptId, intent: "discovery", providerId: "openai", modelId: "m", modelDisplayName: "M",
  regionId: "global", languageId: "en", status: "completed", text: "t", citationUrls: [], errorCode: null, errorMessage: null, latencyMs: 1, createdAt: at,
  mentions: [
    ...(named ? [{ name: "Acme", domain: "acme.example", recommendation: "positive" as const, mentionQuote: "Acme", firstMentionOffset: 0, firstMentionState: "unique" as const, isTarget: true }] : []),
    { name: "Rival", domain: "rival.example", recommendation: "mentioned" as const, mentionQuote: "Rival", firstMentionOffset: named ? 6 : 0, firstMentionState: "unique" as const, isTarget: false },
  ],
});
// a is named once in two answers, e in both, f in neither, and b, c and g have no answer.
const answers = [answer("1", "a", true), answer("2", "a", false), answer("3", "e", true), answer("4", "e", true), answer("5", "f", false), answer("6", "f", false)];
const run: PromptRun = { id: "r1", projectId: "p1", status: "completed", promptIds: ["a"], modelIds: ["m"], regionIds: ["global"], languageIds: ["en"], answersRequested: 2, answersCompleted: 2, answersFailed: 0, startedAt: at, completedAt: at };
const insights = buildTopicInsights({ projectId: "p1", set, answers, runs: [run] });
const engine = { ...insights, position: positionReport(insights.topics.flatMap((topic) => topic.prompts)) };
const home = buildHomeSummary({ projectId: "p1", domain: "acme.example", set, insights, runs: [run], modelCount: 2 });
const project: ProjectRow = { id: "p1", name: "Acme", normalizedDomain: "acme.example", status: "active" };
const priority: PriorityQuestion[] = [{
  promptId: "a", text: "Question a", topicId: "t1", intent: "discovery", measuresVisibility: true,
  contest: { promptId: "a", text: "Question a", answers: 2, named: 2, namedOnce: 1, leaderAgreement: 0.8, usualLeader: "Rival", youNamed: 1, state: "settled", reason: "r" },
  demand: { promptId: "a", text: "Question a", match: { exactTerms: 2, relatedTerms: 5, examples: [] }, shareOfCorpus: 0.1 },
}, {
  promptId: "e", text: "Question e", topicId: "t1", intent: "discovery", measuresVisibility: true,
  contest: { promptId: "e", text: "Question e", answers: 2, named: 2, namedOnce: 1, leaderAgreement: 0.2, usualLeader: null, youNamed: 2, state: "open", reason: "r" }, demand: null,
}, {
  promptId: "f", text: "Question f", topicId: "t1", intent: "discovery", measuresVisibility: true,
  contest: { promptId: "f", text: "Question f", answers: 2, named: 1, namedOnce: 0, leaderAgreement: 0.5, usualLeader: "Rival", youNamed: 0, state: "contested", reason: "r" }, demand: null,
}];

function state(over: Partial<PromptsState> = {}): PromptsState {
  return {
    topicSet: set, topicState: "ready", answerEngine: engine, answerEngineState: "ready", home, homeState: "ready", scheduleState: "ready",
    priority: { questions: priority, corpusIndexed: true }, priorityState: "ready",
    personas: { projectId: "p1", personas: [{ id: "ps", label: "P", describedAs: "x", tracked: true, addedAt: at }], updatedAt: at }, personasState: "ready",
    promptFilters: { query: "", topicId: "", intent: "", status: "" }, promptSort: "topic", promptSelection: [],
    promptDraft: { topicId: "", text: "", intent: "discovery" }, promptNotice: { text: "", kind: "" }, promptRunState: "idle", panelOpen: [], liveRun: null,
    ...over,
  };
}
function actions(calls: string[]): PromptsActions {
  return Object.fromEntries(["Topics", "AnswerEngine", "Home", "Schedule", "Priority", "Personas"].map((name) => ["load" + name, () => { calls.push(name); }])) as unknown as PromptsActions;
}
const runAction = (label: string, enabled?: boolean) => "RUN[" + label + "|" + enabled + "]";

test("the page asks for a project, and loads each read once while idle", () => {
  const calls: string[] = [];
  has(renderPrompts(state(), null, runAction, actions(calls)), "Select a project first");
  assert.deepEqual(calls, []);
  const idle = state({ topicState: "idle", topicSet: null, answerEngineState: "idle", homeState: "idle", scheduleState: "idle", priorityState: "idle" });
  has(renderPrompts(idle, project, runAction, actions(calls)), "The questions your buyers ask.");
  assert.deepEqual(calls, ["Topics", "AnswerEngine", "Home", "Schedule", "Priority"]);
  has(renderPrompts(state({ topicState: "error", topicSet: null }), project, runAction, actions([])), "Could not read the prompt set");
  has(renderPrompts(state({ topicState: "loading", topicSet: null }), project, runAction, actions([])), "the questions");
});

test("a set with nothing live offers a set rather than an empty table", () => {
  const empty = { ...set, prompts: [prompt("d", { status: "retired" })] };
  const out = renderPrompts(state({ topicSet: empty }), project, runAction, actions([]));
  has(out, "Nothing is being asked", "Propose a set");
  assert.equal(out.includes("prompt-results"), false);
});

test("the tiles count live questions, and the forecast needs models, personas and tracked questions", () => {
  const out = renderPrompts(state(), project, runAction, actions([]));
  has(out, "Tracked", "asked on every run", "Needs review", "1 more retired, and left out of every figure", "Measures visibility", "4 of 5", "Has an answer", "3 of 5");
  has(out, "5 question(s) by 2 model(s) on behalf of nobody and 1 persona(s)", ">20<");
  has(renderPrompts(state({ home: { ...home, modelCount: 0 } }), project, runAction, actions([])), "no models are saved");
  const calls: string[] = [];
  has(renderPrompts(state({ personasState: "idle", personas: null }), project, runAction, actions(calls)), "the personas a run covers have not loaded");
  assert.deepEqual(calls, ["Personas"]);
});

test("each row shows its standing, its state and what can be done to it", () => {
  const out = renderPrompts(state(), project, runAction, actions([]));
  has(out, "Question a", "2 answer(s)", "Question b", "proposed, not asked yet", "Track it", "Stop tracking", "Reword it", "names you, so it cannot measure visibility", "Not asked yet", "Topic&lt;", "about&amp;");
  has(out, "Showing all 6 question(s)", "Track all 1");
  assert.equal(out.includes("Question d"), false);
});

test("the proposal's grounding is told, and a blind set is told so", () => {
  const out = (over: Partial<TopicSet>) => renderPrompts(state({ topicSet: { ...set, ...over } }), project, runAction, actions([]));
  has(out({ generatedAt: at }), "proposed before observed demand could ground one");
  has(out({ generatedAt: at, groundedIn: { searchQueries: 0, corpusQuestions: 0, observed: 0 } }), "Nothing observed grounded these questions");
  has(out({ generatedAt: at, groundedIn: { searchQueries: 4, corpusQuestions: 2, observed: 6 } }), "Grounded in 6 question(s)", "4 search quer(ies) and 2 past conversation(s)");
  has(out({ generatedAt: at, generatedWithoutFacts: true }), "proposed without anything established about the business");
  assert.equal(out({ generatedAt: null }).includes("grounded"), false);
});

test("filters narrow the rows and the summary says how many remain", () => {
  const standings = promptStandings(engine);
  const filter = (promptFilters: PromptsState["promptFilters"]) => filteredPrompts(state({ promptFilters }), set, standings).map((row) => row.id);
  assert.deepEqual(filter({ query: "", topicId: "", intent: "", status: "" }), ["a", "b", "c", "e", "f", "g"]);
  assert.deepEqual(filter({ query: "", topicId: "", intent: "", status: "proposed" }), ["b"]);
  assert.deepEqual(filter({ query: "", topicId: "", intent: "", status: "tracked" }), ["a", "c", "e", "f", "g"]);
  assert.deepEqual(filter({ query: "", topicId: "", intent: "", status: "absent" }), ["f"]);
  assert.deepEqual(filter({ query: "", topicId: "", intent: "", status: "unmeasured" }), ["c"]);
  assert.deepEqual(filter({ query: "", topicId: "", intent: "brand", status: "" }), ["c"]);
  assert.deepEqual(filter({ query: " QUESTION b ", topicId: "", intent: "", status: "" }), ["b"]);
  assert.deepEqual(filter({ query: "", topicId: "t2", status: "", intent: "" }), []);
  assert.equal(promptResultSummary(3, 3), "Showing all 3 question(s)");
  assert.equal(promptResultSummary(1, 3), "Showing 1 of 3 question(s)");
  assert.equal(livePrompts(set).length, 6);
  assert.deepEqual([...topicStandings(engine).keys()], ["t1"]);
  assert.equal(promptStandings(null).size, 0);
});

test("the bulk bar offers only what the selection allows", () => {
  assert.equal(promptBulkInner(state()), "");
  const mixed = promptBulkInner(state({ promptSelection: ["a", "b"] }));
  has(mixed, "2 selected", "Track 1", "Stop tracking 1", "Run these 1", "Clear");
  const running = promptBulkInner(state({ promptSelection: ["a"], liveRun: { id: "r", status: "running", answersRequested: 1, answersCompleted: 0, answersFailed: 0, startedAt: at, completedAt: null } }));
  assert.equal(running.includes("Run these"), false);
});

test("the toolbar keeps its filters, and a notice and the draft are echoed back", () => {
  const out = renderPrompts(state({
    promptFilters: { query: "q<", topicId: "t1", intent: "brand", status: "tracked" }, promptSort: "open",
    promptDraft: { topicId: "t1", text: 'a "draft"', intent: "brand" }, promptNotice: { text: "saved<", kind: "success" },
  }), project, runAction, actions([]));
  has(out, 'value="q&lt;"', '<option value="t1" selected>', '<option value="brand" selected>', '<option value="tracked" selected>', '<option value="open" selected>', "success-box", "saved&lt;", "a &quot;draft&quot;");
  has(renderPrompts(state({ promptRunState: "generating" }), project, runAction, actions([])), "Proposing…");
});

function rowOf(out: string, text: string): string {
  const rows = out.split('<div class="mrow mcols-promptrow">').slice(1);
  const found = rows.find((row) => row.includes(">" + text + "<") || row.includes(text + "</"));
  assert.ok(found, "no row for " + text);
  return found;
}

function order(out: string, ids: string[]): number[] {
  return ids.map((id) => out.indexOf("Question " + id));
}

test("a question nobody has answered says so and shows no score and no rank", () => {
  // g is tracked and measures visibility, and the read carries a standing for it with no answers behind it.
  const topic = engine.topics[0];
  const seen = topic?.prompts.find((row) => row.promptId === "f");
  assert.ok(topic && seen);
  const empty = { ...seen, promptId: "g", text: "Question g", rank: null, score: { ...seen.score, answers: 0, appearances: 0, score: null } };
  const withEmpty = { ...engine, topics: [{ ...topic, prompts: [...topic.prompts, empty] }] };
  assert.equal(promptStandings(withEmpty).get("g")?.score.answers, 0);
  const out = renderPrompts(state({ answerEngine: withEmpty }), project, runAction, actions([]));
  for (const id of ["g", "c"]) {
    const unanswered = rowOf(out, "Question " + id);
    has(unanswered, "Not asked yet");
    assert.equal(unanswered.includes("Not named"), false);
    assert.equal(unanswered.includes("#"), false);
  }
  const answered = rowOf(out, "Question a");
  has(answered, "2 answer(s)", "#");
  assert.equal(answered.includes("Not asked yet"), false);
  // Answered and never named is a rank of nothing, which is said in words.
  has(rowOf(out, "Question f"), "2 answer(s)", "Not named");
});

test("a row carries its field and demand badges", () => {
  const out = renderPrompts(state(), project, runAction, actions([]));
  has(rowOf(out, "Question a"), "Settled", "Asked 2 · 5 loosely");
  has(rowOf(out, "Question e"), "Open field");
  has(rowOf(out, "Question f"), "Contested");
  assert.equal(rowOf(out, "Question b").includes("rowtags"), false);
});

test("the open sort puts the open fields first and the worst-score sort puts the weakest first", () => {
  const byField = order(renderPrompts(state({ promptSort: "open" }), project, runAction, actions([])), ["e", "f", "a", "b"]);
  assert.ok(byField.every((at) => at >= 0));
  assert.deepEqual([...byField].sort((left, right) => left - right), byField, "open, then contested, then settled, then unknown");
  const topicOrder = order(renderPrompts(state({ promptSort: "topic" }), project, runAction, actions([])), ["a", "b", "c", "e", "f", "g"]);
  assert.deepEqual([...topicOrder].sort((left, right) => left - right), topicOrder, "grouped by topic keeps the set's order");

  const standings = promptStandings(engine);
  const scoreOf = (id: string) => { const row = standings.get(id); return row && row.score.answers ? (row.score.score ?? 101) : 102; };
  const scored = ["a", "e", "f"].map((id) => scoreOf(id));
  assert.equal(new Set(scored).size, 3, "the three answered questions have three different scores");
  const expected = ["a", "b", "c", "e", "f", "g"].sort((left, right) => scoreOf(left) - scoreOf(right));
  const worst = order(renderPrompts(state({ promptSort: "score" }), project, runAction, actions([])), expected);
  assert.deepEqual([...worst].sort((left, right) => left - right), worst, "weakest first, unanswered last");
  assert.equal(["b", "c", "g"].includes(expected[expected.length - 1] || ""), true);
});

test("the coverage chips count tracked questions over live ones, and the note names a topic with nothing tracked", () => {
  const out = renderPrompts(state(), project, runAction, actions([]));
  has(out, "Discovery · 4 of 5 tracked", "Comparison · 0 of 0 tracked", "Brand · 1 of 1 tracked", "Problem · 0 of 0 tracked");
  const empty = { ...set, topics: [set.topics[0] as TopicSet["topics"][number], { id: "t3", projectId: "p1", name: "Empty<", description: "", source: "authored" as const, status: "active" as const, createdAt: at }] };
  has(renderPrompts(state({ topicSet: empty }), project, runAction, actions([])), "1 topic(s) have nothing tracked: Empty&lt;.");
  const covered = { ...set, topics: [set.topics[0] as TopicSet["topics"][number]] };
  has(renderPrompts(state({ topicSet: covered }), project, runAction, actions([])), "Every topic has at least one tracked question.");
});

test("what only explains folds into one line, and what can be acted on stays above the list", () => {
  const told = { ...set, generatedAt: at, generatedWithoutFacts: true, groundedIn: { searchQueries: 3, corpusQuestions: 0, observed: 3 } };
  const out = renderPrompts(state({ topicSet: told }), project, runAction, actions([]));
  has(out, '<details class="caveats" data-fold="prompt-caveats">', "How this set was written (2)");
  const fold = out.slice(out.indexOf('<details class="caveats"'), out.indexOf("</details>", out.indexOf('<details class="caveats"')));
  has(fold, "proposed without anything established", "Grounded in 3 question(s)");
  assert.equal(fold.includes("Show only those"), false);
  assert.ok(out.indexOf("Show only those") >= 0 && out.indexOf("Show only those") < out.indexOf('<details class="caveats"'));
  has(renderPrompts(state({ topicSet: told, panelOpen: ["prompt-caveats"] }), project, runAction, actions([])), 'data-fold="prompt-caveats" open');
  assert.equal(renderPrompts(state(), project, runAction, actions([])).includes('class="caveats"'), false);
});

test("a retired topic is not a gap in the coverage note, and is not offered in either topic menu", () => {
  const out = renderPrompts(state(), project, runAction, actions([]));
  has(out, "Every topic has at least one tracked question.", '<option value="t1"');
  assert.equal(out.includes("Gone"), false);
  assert.equal(out.includes('<option value="t2"'), false);
  assert.equal(out.includes("nothing tracked: Gone"), false);
});

test("a set whose topics are all retired offers no add form, rather than one that adds to a retired topic", () => {
  const retired = { ...set, topics: set.topics.map((topic) => ({ ...topic, status: "retired" as const })), prompts: [prompt("d", { topicId: "t2", status: "retired" })] };
  const out = renderPrompts(state({ topicSet: retired }), project, runAction, actions([]));
  has(out, "Nothing is being asked");
  assert.equal(out.includes("add-prompt-form"), false);
});
