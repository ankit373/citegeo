import test from "node:test";
import assert from "node:assert/strict";
import {
  comparablePercent, insightTable, renderActionPlan, renderCrawlerSection, renderPaste, renderScoreBreakdown, renderSignalHistory, renderVisibility,
  type VisibilityState,
} from "../src/ui/app/pages/visibility-view.js";
import { draftBody, renderBuying, renderClaims, renderConversations, renderDrafts, renderEntity, renderMarketer, type MarketerState } from "../src/ui/app/pages/marketer-view.js";
import { renderEvidence, runFeedBody, type EvidenceState, type RunFeedState } from "../src/ui/app/pages/run-pane.js";
import { actTabs, machineTabs } from "../src/ui/app/components/nav.js";
import { foldCard } from "../src/ui/app/components/primitives.js";
import type { AnswerRow, ProjectRow, RunRow } from "../src/ui/app/types.js";

import { bootShape, renderReport } from "../src/ui/app/components/layout.js";

(globalThis as unknown as { window: unknown }).window = {};

function has(text: string, ...parts: string[]): void {
  for (const part of parts) assert.ok(text.includes(part), `lacks ${JSON.stringify(part)} in ${JSON.stringify(text.slice(0, 600))}`);
}
function lacks(text: string, ...parts: string[]): void {
  for (const part of parts) assert.ok(!text.includes(part), `has ${JSON.stringify(part)}`);
}

const calls: string[] = [];
const loaders = (...names: string[]) => Object.fromEntries(names.map((name) => [name, () => { calls.push(name); }])) as Record<string, () => void>;
const project: ProjectRow = { id: "p1", name: "Acme", normalizedDomain: "acme.example", status: "active" };

const crawlerRow = (over = {}) => ({ name: "GPTBot", engine: "OpenAI", purpose: "training", fetches: 4, pages: 2, errorRate: 0.25, lastSeen: "2026-11-01T10:00:00Z", ...over });
const activity = (over = {}) => ({
  crawlers: [crawlerRow(), crawlerRow({ name: "Perplexity", purpose: "live_fetch", errorRate: null, lastSeen: null }), crawlerRow({ name: "Bing", purpose: "index", errorRate: 0 })],
  allowedButAbsent: ["a", "b"], citedNeverFetched: ["u"], pages: ["p", "q"], fetchedNeverCited: ["z"], totalFetches: 12, ...over,
});
const snapshot = (over = {}) => ({
  capturedAt: "2026-11-01T10:20:00Z",
  changes: [{ direction: "regressed", detail: "d1" }, { direction: "improved", detail: "d2" }, { direction: "same", detail: "d3" }],
  signals: { robots: { blocked: ["a"] }, llmsTxt: { present: true }, structuredData: { organization: true, independent: [1, 2] }, wikidata: { present: true, id: "Q1" } }, ...over,
});
const action = (severity: string, over = {}) => ({ severity, title: "T " + severity, why: "why", evidence: "ev", fix: "fx", ...over });
const insights = () => ({
  runsConsidered: 3, domain: "acme.example",
  citationGap: [{ domain: "g.com", competitors: ["x", "y"], answers: 2, models: ["m1"] }],
  claimAudit: {
    answers: 4, disagreements: [{ field: "f", variants: [{ value: "a", models: ["m"] }, { value: "b", models: ["n", "o"] }] }],
    unsourced: [{ field: "u", count: 2, models: ["m"] }], mismatches: [{ field: "x", asserted: "A", declared: "B" }],
  },
  insights: {
    answered: 9,
    visibility: { score: 0.5, recognized: 3, answered: 6, byModel: [{ displayName: "M<", modelId: "m", recognized: 2, answered: 3, score: 0.66 }, { displayName: "N", modelId: "n", recognized: 0, answered: 0, score: null }] },
    shareOfVoice: { target: { name: "Acme", mentions: 2, share: null, domain: "acme.example" }, competitors: [{ name: "R", mentions: 5, share: 0.7, domain: "" }] },
    citations: { targetCitedIn: 1, domains: [{ domain: "d.com", isTarget: true, answers: 2, models: ["m"] }] }, categories: [{ value: "tool", count: 3 }],
  },
});
const visibilityState = (over: Partial<VisibilityState> = {}): VisibilityState => ({
  insights: insights(), insightsState: "ready", crawlers: { detail: "No log", source: "upload", activity: activity() }, crawlersState: "ready", crawlerUploading: false, crawlerNotice: { text: "", kind: "" },
  paste: { fixes: [{ id: "f<1", title: "Fix<", language: "en", why: "w", evidence: "e", where: "head", snippet: "<s>" }], shortfall: "short", described: [{ title: "D", why: "y", evidence: "z" }], caveat: "cav" }, pasteState: "ready", pasteCount: 2,
  signals: [snapshot(), snapshot({ capturedAt: null, changes: [] })], signalsState: "ready", plan: { probed: true, detail: "d", capturedAt: "2026-11-01T10:20:00Z", changes: [{ direction: "improved", detail: "c" }], actions: [action("critical"), action("high"), action("done", { why: "DONEWHY" }), action("low", { why: "" })] }, planState: "ready", ...over,
});

test("each section asks for its own read once, and only while it is idle", () => {
  for (const [name, draw, over] of [
    ["loadCrawlers", (state: VisibilityState, a: never) => renderCrawlerSection(state, a), { crawlersState: "idle" }],
    ["loadPaste", (state: VisibilityState, a: never) => renderPaste(state, a), { pasteState: "idle" }],
    ["loadSignals", (state: VisibilityState, a: never) => renderSignalHistory(state, a), { signalsState: "idle" }],
    ["loadPlan", (state: VisibilityState, a: never) => renderActionPlan(state, a), { planState: "idle" }],
  ] as const) {
    calls.length = 0;
    draw(visibilityState(over), loaders(name) as never);
    assert.deepEqual(calls, [name]);
    calls.length = 0;
    draw(visibilityState(), loaders(name) as never);
    assert.deepEqual(calls, []);
  }
});

test("the crawler section says what it could not read, then what the log holds", () => {
  const act = loaders("loadCrawlers") as never;
  has(renderCrawlerSection(visibilityState({ crawlersState: "error" }), act), "Could not read the access log.");
  has(renderCrawlerSection(visibilityState({ crawlersState: "loading" }), act), "Reading the access log…");
  has(renderCrawlerSection(visibilityState({ crawlers: null }), act), "Reading the access log…");
  const nothing = renderCrawlerSection(visibilityState({ crawlers: { detail: "No <log>", activity: null }, crawlerUploading: true }), act);
  has(nothing, "warning-box", "No &lt;log&gt;", "Reading the log…");
  const page = renderCrawlerSection(visibilityState(), act);
  has(page, "Counted from a log you uploaded.", "<strong>12</strong>Crawler fetches", "<strong>3</strong>Bots seen", "<strong>2</strong>Pages fetched", "<strong>1</strong>Fetched, never cited",
    "fetches when asked", "training crawl", "search index", "25%", "n/a", "0%", "2026-11-01", "unknown", "2 allowed crawler(s) never arrived.", "1 cited page(s) were never seen", "Upload an access log");
  has(renderCrawlerSection(visibilityState({ crawlers: { detail: "", source: "/var/log/x", activity: activity() } }), act), "Counted from /var/log/x on this server");
  lacks(renderCrawlerSection(visibilityState({ crawlers: { detail: "", source: "", activity: activity() } }), act), "Counted from");
  has(renderCrawlerSection(visibilityState({ crawlers: { detail: "", activity: activity({ allowedButAbsent: ["w1", "w2", "w3", "w4", "w5", "w6", "w7", "w8", "w9"] }) } }), act), "w8, and more");
  lacks(renderCrawlerSection(visibilityState({ crawlers: { detail: "", activity: activity({ allowedButAbsent: ["w1", "w2", "w3", "w4", "w5", "w6", "w7", "w8", "w9"] }) } }), act), "w9");
  lacks(renderCrawlerSection(visibilityState({ crawlers: { detail: "", activity: activity({ allowedButAbsent: [], citedNeverFetched: [] }) } }), act), "never arrived", "never seen being fetched");
  has(renderCrawlerSection(visibilityState({ crawlers: { detail: "", activity: activity({ crawlers: [] }) } }), act), "No AI crawler appears in this log.");
});

test("the paste, signal and plan sections draw their own states and rows", () => {
  const paste = loaders("loadPaste") as never;
  has(renderPaste(visibilityState({ pasteState: "error" }), paste), "Could not generate anything.");
  has(renderPaste(visibilityState({ pasteState: "loading" }), paste), "Generating from the last site probe.");
  has(renderPaste(visibilityState(), paste), "How many", "Fix&lt;", "data-copy-fix=\"f&lt;1\"", "id=\"fix-f&lt;1\"", "&lt;s&gt;", "short", "1 that cannot be generated correctly", "cav");
  has(renderPaste(visibilityState({ paste: { fixes: [], described: [], shortfall: "", caveat: "" } }), paste), "Nothing outstanding can be generated from the last probe.");
  lacks(renderPaste(visibilityState({ paste: { fixes: [], described: [], shortfall: "", caveat: "" } }), paste), "technical-details", "warning-box");

  const signals = loaders("loadSignals") as never;
  has(renderSignalHistory(visibilityState({ signalsState: "error" }), signals), "Could not read the probe history.");
  has(renderSignalHistory(visibilityState({ signalsState: "loading" }), signals), "Reading the probe history…");
  has(renderSignalHistory(visibilityState({ signals: [] }), signals), "No probe yet.");
  const history = renderSignalHistory(visibilityState(), signals);
  has(history, "2026-11-01 10:20", "unknown", "1 crawler(s) blocked", "llms.txt published", "Organization markup", "2 independent record(s)", "Wikidata Q1", "state-bad", "state-ok", "state-flag", "No change from the probe before it.");
  has(renderSignalHistory(visibilityState({ signals: [snapshot({ signals: { robots: { blocked: [] }, llmsTxt: { present: false }, structuredData: { organization: false, independent: [] }, wikidata: { present: false } } })] }), signals), "all crawlers allowed", "no llms.txt", "no Organization markup", "no Wikidata entity");

  const plan = loaders("loadPlan") as never;
  has(renderActionPlan(visibilityState({ planState: "error" }), plan), "Could not build a plan.");
  has(renderActionPlan(visibilityState({ planState: "loading" }), plan), "Building the plan…");
  has(renderActionPlan(visibilityState({ plan: { probed: false, detail: "" } }), plan), "No site probe yet.");
  const drawn = renderActionPlan(visibilityState(), plan);
  has(drawn, "Changed since the previous probe", "T critical", "T high", "1 already in place", "Fix: fx", "Observed: ev", "Probed 2026-11-01 10:20.", "data-state=\"warn\"", "data-state=\"next\"", "data-state=\"done\"");
  lacks(drawn, "DONEWHY");
  has(drawn, "T low");
  assert.equal(drawn.split("step-why").length, 3);
  has(renderActionPlan(visibilityState({ plan: { probed: true, changes: [], capturedAt: null, actions: [] } }), plan), "Nothing outstanding.", "Probed never.");
});

test("the Visibility page needs a project and its evidence, then draws every card", () => {
  const actions = loaders("loadInsights", "loadPaste", "loadPlan", "loadCrawlers", "loadSignals") as never;
  calls.length = 0;
  has(renderVisibility(visibilityState({ insightsState: "idle" }), project, actions), "Reading every archived answer");
  assert.deepEqual(calls, ["loadInsights"]);
  has(renderVisibility(visibilityState(), null, actions), "Select a project first");
  has(renderVisibility(visibilityState({ insightsState: "error" }), project, actions), "Could not read the evidence");
  has(renderVisibility(visibilityState({ insights: null }), project, actions), "Reading every archived answer");
  const page = renderVisibility(visibilityState(), project, actions);
  has(page, "Pooled from 3 run(s) and 9 parsed answer(s) for acme.example", "data-reload-insights", "Ready to paste", "What to fix on the site", "AI crawlers", "Site signal history",
    "<strong>50%</strong>Visibility", "Answers citing you", "1</strong>Citation gaps", "M&lt;", "<strong>66%</strong>", "not comparable", "your domain", "<span class=\"state-ok\">you</span>", "cited alongside x, y",
    "Models disagree on f", "a (1) vs b (2)", "u asserted with no source", "x shares nothing with what you declare", "they say \"A\", you say \"B\"", "How the models categorise you", "tool");
  const empty = renderVisibility(visibilityState({ insights: { ...insights(), citationGap: [], claimAudit: { answers: 0, disagreements: [], unsourced: [], mismatches: [] }, insights: { ...insights().insights, visibility: { score: null, recognized: 0, answered: 0, byModel: [] }, citations: { targetCitedIn: 0, domains: [] }, categories: [] } } }), project, actions);
  has(empty, "<strong>n/a</strong>Visibility", "No parsed answers yet.", "No gap yet.", "No citations captured yet.", "Nothing flagged across 0 answer(s).", "No category returned yet.");
});

test("a table says what is absent, a percent says when it cannot be compared, and a score keeps its counts", () => {
  has(insightTable("mcols-x", ["A<", "B"], [], "none<"), "none&lt;");
  lacks(insightTable("mcols-x", ["A<", "B"], [], "none<"), "mtable");
  has(insightTable("mcols-x", ["A<", "B"], ["<r>"], "none"), "mhead mcols-x", "<span>A&lt;</span>", "<r>");
  has(comparablePercent(null), "not comparable");
  has(comparablePercent(undefined), "not comparable");
  assert.equal(comparablePercent(0), "<strong>0%</strong>");
  assert.equal(comparablePercent(0.456), "<strong>46%</strong>");
  const score = (over = {}) => ({ answers: 10, appearances: 4, presenceRate: 0.4, presenceInterval: { low: 0.2, high: 0.7, caveat: "cav<" }, tooFewAnswers: false, prominence: 0.5, sentiment: 0.7, namedIn: 4, ...over });
  has(renderScoreBreakdown(null), "Nothing has been answered yet");
  has(renderScoreBreakdown(score({ answers: 0 })), "This is not a zero.");
  const drawn = renderScoreBreakdown(score());
  has(drawn, "4 of 10, consistent with", "Presence", "Prominence", "Sentiment");
  lacks(drawn, "Too few answers");
  has(renderScoreBreakdown(score({ tooFewAnswers: true })), "Too few answers to read this as a rate.", "cav&lt;");
  has(renderScoreBreakdown(score({ presenceInterval: null })), "4 of 10 answers named you");
  has(renderScoreBreakdown(score({ presenceInterval: { low: null, high: null, caveat: "c" } })), "4 of 10 answers named you");
  has(renderScoreBreakdown(score({ prominence: null, namedIn: 0 })), "No answer gave a readable order");
});

const marketerState = (over: Partial<MarketerState> = {}): MarketerState => ({
  marketerState: "ready", marketerNotice: { text: "", kind: "" }, marketer: null, drafts: { offers: [], drafts: [{ id: "d1", title: "Title", body: "Body", templateId: "t", rationale: "r", status: "awaiting_review", sources: [], createdAt: "2026-11-01T10:00:00Z", reviewNote: null, publishedUrl: null, publishedAt: null }] }, claims: null, buying: null, conversations: [], entity: null, ...over,
});

test("every Act page draws its title and tabs, asks for its read while idle, and shows notices", () => {
  const act = loaders("loadMarketer") as never;
  const tabs = "TABS";
  const pages = [
    ["Act", renderMarketer, ""], ["Drafts", renderDrafts, ""], ["Claims", renderClaims, "data-run-factcheck"], ["Buying", renderBuying, "data-run-shopping"],
    ["Conversations", renderConversations, "data-page=\"prompts\""], ["Entity", renderEntity, "data-probe-signals"],
  ] as const;
  for (const [title, draw, button] of pages) {
    calls.length = 0;
    const idle = draw(marketerState({ marketerState: "idle" }), act, tabs);
    assert.deepEqual(calls, ["loadMarketer"], title);
    has(idle, `<h1>${title}</h1>`, "TABS", "sk-wrap");
    calls.length = 0;
    const ready = draw(marketerState(), act, tabs);
    assert.deepEqual(calls, [], title);
    has(ready, `<h1>${title}</h1>`, "TABS", button);
    has(draw(marketerState({ marketerState: "error" }), act, tabs), "Could not read this project.");
    has(draw(marketerState({ marketerNotice: { text: "n<", kind: "success" } }), act, tabs), "success-box", "n&lt;");
    has(draw(marketerState({ marketerNotice: { text: "n", kind: "error" } }), act, tabs), "warning-box");
  }
  assert.doesNotThrow(() => renderConversations(marketerState({ conversations: null as never }), act, tabs));
  has(renderEntity(marketerState({ entity: { alignment: { domain: "acme.example", corroborated: 2, anchors: [{ kind: "social_profile", value: "x<", independent: false }], missing: [], risks: [] }, llms: null } as never }), act, tabs), "Whether a model can resolve acme.example", "social profile", "the brand controls it");
  assert.equal(draftBody({ drafts: [{ id: "d1", title: "Title", body: "Body" }] }, "d1"), "# Title\n\nBody");
  assert.equal(draftBody({ drafts: [] }, "d1"), "");
  assert.equal(draftBody(null, "d1"), "");
});

const answer = (over: Partial<AnswerRow> = {}): AnswerRow => ({
  id: "a1", status: "completed", mentions: [{ name: "Acme", isTarget: true, recommendation: "recommended", firstMentionOffset: 3 }], text: "Acme is named", errorMessage: null, errorCode: null,
  citationUrls: ["http://a.example/x"], modelDisplayName: "GPT", modelId: "g", regionId: "us", languageId: "en", latencyMs: 1234, promptText: "Q?", createdAt: "2026-11-01T10:20:00Z", ...over,
} as unknown as AnswerRow);
const run = (over: Partial<RunRow> = {}): RunRow => ({ id: "r1", status: "running", answersRequested: 10, answersCompleted: 3, answersFailed: 1, startedAt: "2026-11-01T10:00:00Z", currentPromptText: "now?", currentModelId: "m1", ...over } as unknown as RunRow);
const feedState = (over: Partial<RunFeedState> = {}): RunFeedState => ({
  panel: { kind: "run", runId: "r1" } as never, liveRun: run(), lastRun: null, runFeed: [answer()], runFeedState: "ready", regions: [{ id: "us", label: "US" }], languages: [{ id: "en", label: "English" }], ...over,
});

test("the run feed shows what is in flight, what came back, and why it has nothing", () => {
  const live = runFeedBody(feedState());
  has(live, "is-live", "asking now", "now?", "named you", "<mark>Acme</mark>", "US · English", "1.2s", "http://a.example/x", "Q?");
  has(runFeedBody(feedState({ runFeedState: "loading", runFeed: [] })), "sk-wrap");
  has(runFeedBody(feedState({ runFeedState: "loading" })), "named you");
  has(runFeedBody(feedState({ runFeedState: "error" })), "Could not read this run.");
  has(runFeedBody(feedState({ runFeed: [], liveRun: null, lastRun: null })), "No answer has come back yet.");
  has(runFeedBody(feedState({ runFeed: [], liveRun: run({ currentPromptText: "" }) })), "No answer has come back yet.");
  const flightOnly = runFeedBody(feedState({ runFeed: [] }));
  has(flightOnly, "asking now");
  lacks(flightOnly, "No answer has come back yet.");
  lacks(runFeedBody(feedState({ liveRun: run({ status: "completed" }), runFeed: [answer()] })), "asking now");
  const urls = Array.from({ length: 9 }, (_, index) => "http://u" + index + ".example");
  const many = runFeedBody(feedState({ runFeed: [answer({ citationUrls: urls })] }));
  has(many, "u5.example");
  lacks(many, "u6.example");
  has(runFeedBody(feedState({ runFeed: [answer({ text: "ACME is here", mentions: [{ name: "Acme", isTarget: true, recommendation: "x", firstMentionOffset: 0 }] } as never)] })), "<mark>ACME</mark> is here");
  has(runFeedBody(feedState({ runFeed: [answer({ text: "Acme", mentions: [{ name: "Ac", isTarget: false, recommendation: "x", firstMentionOffset: 0 }, { name: "Acme", isTarget: true, recommendation: "x", firstMentionOffset: 0 }] } as never)] })), "<mark><mark>Ac</mark>me</mark>");
  const odd = runFeedBody(feedState({
    runFeed: [answer({ status: "no_answer", mentions: [], citationUrls: [], latencyMs: null, text: "" }), answer({ status: "error_x", errorMessage: "boom" }), answer({ status: "error_y", errorMessage: "", errorCode: "c" }), { ...answer({ mentions: [] }), regionId: undefined, languageId: undefined } as unknown as AnswerRow],
  }));
  has(odd, "no answer from this surface", "error x", "boom", "state-bad", "c</p>", "did not name you", "No source was cited.", "no timing", "No stated market", "English");
});

const evidenceState = (over: Partial<EvidenceState> = {}): EvidenceState => ({
  ...feedState(), brief: { answers: 5, verdict: "v<", namedBy: ["a"], missedBy: ["b"], namesYouElsewhere: ["c"], contest: { state: "open", reason: "r" }, demand: { match: { exactTerms: 1, relatedTerms: 2 } }, sources: ["http://s/1"],
    voices: [{ name: "Rival", isTarget: false, answers: 3, positive: 1, negative: 1, prominence: 0.5, quotes: ["q"] }, { name: "Acme", isTarget: true, answers: 2, positive: 0, negative: 0, prominence: null, quotes: ["me"] }, { name: "Quiet", isTarget: false, answers: 1, positive: 0, negative: 0, prominence: null, quotes: [] }] },
  briefState: "ready", panelState: "ready", panelAnswers: [answer()], selectedId: "p\"1", ...over,
});

test("the evidence panel is closed, a run, a free panel or the archived answers behind a question", () => {
  has(renderEvidence(evidenceState({ panel: null })), "aria-hidden=\"true\"");
  const live = renderEvidence(evidenceState());
  has(live, "Live run", "data-stop-run", "runpane-progress", "asking now");
  has(renderEvidence(evidenceState({ liveRun: run({ status: "cancelling" }) })), "Live run");
  lacks(renderEvidence(evidenceState({ liveRun: run({ status: "cancelling" }) })), "data-stop-run");
  const done = renderEvidence(evidenceState({ liveRun: null, lastRun: run({ status: "completed" }) }));
  has(done, "Finished run");
  lacks(done, "data-stop-run");
  const free = renderEvidence(evidenceState({ panel: { kind: "panel", title: "T<", blurb: "b", body: "<p>x</p>" } as never }));
  has(free, "is-wide-panel", "T&lt;", "data-panel-search", "data-panel-export", "<p>x</p>");
  has(renderEvidence(evidenceState({ panel: { kind: "panel", title: "T" } as never })), "<div class=\"panel-body\"></div>");
  const archived = renderEvidence(evidenceState({ panel: { kind: "prompt", title: "T", promptId: "p&1" } as never }));
  has(archived, "Archived answers", "The answers themselves", "named you · recommended", "Asked", "Q?", "<mark>Acme</mark>", "Take the brief", "/api/projects/p&quot;1/prompt-brief.md?promptId=p%261", "What these answers read", "Open field",
    "Asked 1 time(s) in the indexed corpus", "What the models credited, in their own words", "What they said about you", "Named without a reason given.");
  const wide = renderEvidence(evidenceState({ panel: { kind: "prompt", title: "T", promptId: "p" } as never, panelAnswers: [answer({ citationUrls: Array.from({ length: 9 }, (_, index) => "http://c" + index + ".example") })] }));
  has(wide, "c7.example");
  lacks(wide, "c8.example");
  has(renderEvidence(evidenceState({ panel: { kind: "brand", title: "T", promptId: "p" } as never })), "Every archived answer that named this brand.");
  lacks(renderEvidence(evidenceState({ panel: { kind: "evidence", title: "T", promptId: "p" } as never })), "evidence-asked");
  has(renderEvidence(evidenceState({ panel: { kind: "prompt", title: "T", promptId: "p" } as never, panelState: "loading" })), "sk-wrap");
  has(renderEvidence(evidenceState({ panel: { kind: "prompt", title: "T", promptId: "p" } as never, panelState: "error" })), "Could not read the answers for this question.");
  has(renderEvidence(evidenceState({ panel: { kind: "prompt", title: "T", promptId: "p" } as never, panelAnswers: [] })), "No answer has been archived for this question yet.");
  has(renderEvidence(evidenceState({ panel: { kind: "brand", title: "T", promptId: "p" } as never, panelAnswers: [] })), "No archived answer names this brand that way.");
  has(renderEvidence(evidenceState({ panel: { kind: "prompt", title: "T", promptId: "p" } as never, panelAnswers: [answer({ status: "error_z", mentions: [], citationUrls: [], text: "", errorMessage: "bad" })] })), "error z", "This answer cited no sources.", "bad");
  has(renderEvidence(evidenceState({ panel: { kind: "prompt", title: "T", promptId: "p" } as never, panelAnswers: [answer({ mentions: [] })] })), "did not name you");
});

test("the brief reads as nothing, a verdict alone, or the full account", () => {
  const draw = (over: Partial<EvidenceState>) => renderEvidence(evidenceState({ panel: { kind: "prompt", title: "T", promptId: "p" } as never, ...over }));
  has(draw({ briefState: "loading" }), "sk-wrap");
  lacks(draw({ briefState: "error" }), "class=\"brief\"");
  lacks(draw({ brief: null }), "class=\"brief\"");
  const brief = evidenceState().brief;
  has(draw({ brief: { ...brief, answers: 0 } }), "<div class=\"brief\"><p class=\"why\">v&lt;</p></div>");
  has(draw({ brief: { ...brief, contest: { state: "settled", reason: "r" }, demand: null, sources: [], namedBy: [] } }), "Settled field", "No corpus is indexed", "These answers cited no source", "Not named by b.", "These name you elsewhere: c.");
  has(draw({ brief: { ...brief, contest: { state: "contested", reason: "r" } } }), "Contested field");
  lacks(draw({ brief: { ...brief, contest: { state: "unknown", reason: "r" } } }), "Open field", "Settled field", "Contested field");
  lacks(draw({ brief: { ...brief, voices: [brief.voices[1]] } }), "in their own words");
  const many = { ...brief, voices: Array.from({ length: 7 }, (_, index) => ({ name: "Rival" + index, isTarget: false, answers: 1, positive: 0, negative: 0, prominence: null, quotes: ["q"] })).concat([brief.voices[1]]), sources: Array.from({ length: 9 }, (_, index) => "http://s" + index + ".example") };
  const crowded = draw({ brief: many });
  has(crowded, "Rival4", "s7.example");
  lacks(crowded, "Rival5", "s8.example");
  has(draw({ brief: { ...brief, contest: { state: "open", reason: "r" } } }), "tag ready");
  has(draw({ brief: { ...brief, contest: { state: "settled", reason: "r" } } }), "tag warning");
  has(draw({ brief: { ...brief, contest: { state: "contested", reason: "r" } } }), "<span class=\"tag \">");
  lacks(draw({ brief: { ...brief, voices: [brief.voices[0], { ...brief.voices[1], quotes: [] }] } }), "What they said about you");
  assert.equal(draw({}).split("of the way to first").length, 2);
  assert.equal(draw({}).split("Named without a reason given.").length, 2);
  has(draw({}), "<ul class=\"quotes\">", "1 recommended", "1 warned against", "named 50% of the way to first", "is-you", "You</span>");
});

test("the tabs light the page that is open, and the shell pieces read nothing else", () => {
  has(machineTabs("recognition"), "Models and surfaces", "Results", "Current report", "Configuration", "data-page=\"recognition\" aria-current=\"page\"");
  assert.equal(machineTabs("recognition").split("aria-current").length, 2);
  assert.equal(machineTabs("recognition").split("filter active").length, 2);
  assert.equal(actTabs("claims").split("filter active").length, 2);
  assert.equal(machineTabs("nope").split("aria-current").length, 1);
  has(actTabs("claims"), "What to do", "Drafts", "Claims", "Buying", "Conversations", "Entity", "data-page=\"claims\" aria-current=\"page\"");
  assert.equal(actTabs("claims").split("aria-current").length, 2);
  has(bootShape("prompts", "Prod"), "<h1>Questions</h1>", "sk-wrap");
  has(bootShape("claims", "Prod"), "<h1>Act</h1>");
  has(bootShape("nope", "Prod"), "<h1>Prod</h1>");
  has(renderReport("TABS"), "Current report", "TABS", "The report is still loading");
  const win = (globalThis as unknown as { window: Record<string, unknown> }).window;
  win.__citegeoPhase4 = { body: () => "<p>four</p>" };
  assert.equal(renderReport("TABS"), "<p>four</p>");
  win.__citegeoPhase4 = { body: "no" };
  has(renderReport("TABS"), "The report is still loading");
  delete win.__citegeoPhase4;
  has(foldCard(["a"], "a", "T", "b", "<p>x</p>", "aside"), "T", "aside");
  assert.notEqual(foldCard(["a"], "a", "T", "b", "x"), foldCard([], "a", "T", "b", "x"));
});
