import { wilsonInterval } from "../src/product/topics/proportion-interval.js";
import { SCORE_WEIGHTS } from "../src/product/topics/visibility-score.js";
import test from "node:test";
import assert from "node:assert/strict";
import { countDrafts, parseDraft, type AgentDraft } from "../src/product/agents/agent-schema.js";
import { AGENT_TEMPLATES, briefFor, briefsFor, templateById } from "../src/product/agents/agent-templates.js";
import { agentPrompt, agentResponseSchema } from "../src/product/agents/agent-protocol.js";
import type { TopicInsights } from "../src/product/topics/topic-insights.js";

const SCORE = { answers: 0, appearances: 0, presenceInterval: wilsonInterval(0, 0), tooFewAnswers: false, presenceRate: null, prominence: null, sentiment: null, score: null, weights: SCORE_WEIGHTS };

function entity(name: string, appearances: number, isTarget = false): any {
  return { name, domain: `${name.toLowerCase()}.com`, isTarget, appearances, shareOfAnswers: null, prominence: null, positive: 0, negative: 0 };
}

function insights(over: Partial<TopicInsights> = {}): TopicInsights {
  return {
    projectId: "p", answers: 0, answersFailed: 0, answersRetired: 0, overall: SCORE as any, rank: null,
    weights: SCORE_WEIGHTS, leaderboard: [], topics: [], byModel: [],
    absentFrom: [], citationsUnavailable: false, trend: { points: [], change: null, since: null, thinPoints: 0, readablePoints: 0 } as any,
    byRegion: [], byLanguage: [], byPersona: [], regionCaveat: "", identityCaveat: null, trackedRivals: [],
    ...over,
  } as TopicInsights;
}

function absent(text: string, answers: number, ahead: any[]): any {
  return { promptId: "q1", topicId: "t", subtopic: null, text, intent: "research", measuresVisibility: true,
    score: { ...SCORE, answers }, rank: null, byModel: [], ahead, standing: ahead, cited: [] };
}

test("every template says what it needs before it is asked for", () => {
  assert.equal(AGENT_TEMPLATES.length, 4);
  for (const template of AGENT_TEMPLATES) {
    assert.ok(template.needs.length > 0, `${template.id} does not say what it needs`);
    assert.ok(template.purpose.length > 0);
  }
});

test("a template with no evidence is blocked with a reason, not an empty brief", () => {
  for (const template of AGENT_TEMPLATES) {
    const brief = briefFor(template.id, insights());
    assert.equal(brief.instruction, null, `${template.id} drafted from nothing`);
    assert.ok(brief.blocked && brief.blocked.length > 10, `${template.id} is blocked with no reason given`);
  }
});

test("a question the brand is never named in becomes a brief carrying its evidence", () => {
  const brief = briefFor("missing_answer", insights({
    absentFrom: [absent("best stock screener", 7, [entity("Screener", 6), entity("TradingView", 5)])],
  }));
  assert.ok(brief.instruction?.includes("best stock screener"));
  assert.ok(brief.instruction?.includes("Screener, TradingView"), "the brief has to name who was named instead");
  assert.equal(brief.sources[0]?.kind, "prompt");
  assert.equal(brief.sources.length, 3, "the prompt and both rivals are recorded as sources");
  assert.ok(brief.rationale.includes("7 answer"));
});

test("a question with no completed answer is not a gap worth writing against", () => {
  const brief = briefFor("missing_answer", insights({ absentFrom: [absent("nobody asked", 0, [])] }));
  assert.equal(brief.instruction, null);
});

test("a prompt that names the brand cannot show it is absent", () => {
  const named = { ...absent("is Tradomate good", 5, []), measuresVisibility: false };
  assert.equal(briefFor("missing_answer", insights({ absentFrom: [named] })).instruction, null);
});

test("a brief only counts a rival named in more answers than the brand", () => {
  const behind = insights({ leaderboard: [entity("Us", 9, true), entity("Them", 4)] });
  assert.equal(briefFor("competitor_brief", behind).instruction, null, "a rival behind the brand is not one to brief against");
  const ahead = insights({ leaderboard: [entity("Us", 2, true), entity("Them", 8)] });
  const brief = briefFor("competitor_brief", ahead);
  assert.ok(brief.instruction?.includes("Them"));
  assert.ok(brief.instruction?.includes("not a page to publish"), "a brief is for the team, not copy to ship");
});

test("refresh reports what it would need rather than drafting from one run", () => {
  const brief = briefFor("refresh", insights({ citationsUnavailable: false }));
  assert.equal(brief.instruction, null);
  assert.ok(brief.blocked?.includes("over time"));
  const noCitations = briefFor("refresh", insights({ citationsUnavailable: true }));
  assert.ok(noCitations.blocked?.includes("carried a citation"), "with no citation at all it says that instead");
});

test("a draft without a title or a body is not saved as a draft", () => {
  assert.equal(parseDraft({ analysisStatus: "completed", title: "", body: "x" }).status, "unusable");
  assert.equal(parseDraft({ analysisStatus: "completed", title: "x", body: "  " }).status, "unusable");
  assert.equal(parseDraft({ analysisStatus: "insufficient", title: "x", body: "y" }).status, "unusable");
  assert.equal(parseDraft({ analysisStatus: "completed", title: "x", body: "y" }).status, "completed");
});

test("the draft schema has no field that would publish anything", () => {
  const keys = Object.keys((agentResponseSchema as any).properties);
  assert.deepEqual(keys, ["analysisStatus", "title", "body", "rationale"]);
  for (const forbidden of ["publish", "url", "endpoint", "cms"]) {
    assert.ok(!keys.includes(forbidden), `the draft schema offers to ${forbidden}`);
  }
});

test("the prompt forbids inventing what the pages do not state", () => {
  const prompt = agentPrompt({ brandName: "B", domain: "d.com", instruction: "I", digest: "D" });
  assert.ok(prompt.includes("only source of fact"));
  assert.ok(prompt.includes("Do not invent"));
  assert.ok(prompt.includes("Gaps"), "what the pages do not support has to go somewhere visible");
});

test("drafts are counted by the state they are actually in", () => {
  const rows = [
    { status: "awaiting_review" }, { status: "awaiting_review" }, { status: "approved" },
  ] as AgentDraft[];
  assert.deepEqual(countDrafts(rows), { awaiting_review: 2, approved: 1, rejected: 0, published: 0 });
});

test("approved and live are different states, because only a live page can be measured", () => {
  const rows = [
    { status: "approved" },
    { status: "approved", publishedUrl: "https://example.com/a", publishedAt: "2026-06-01T00:00:00.000Z" },
  ] as AgentDraft[];
  assert.deepEqual(countDrafts(rows), { awaiting_review: 0, approved: 2, rejected: 0, published: 1 });
});

test("an unknown workflow is not silently treated as a known one", () => {
  assert.equal(templateById("publish_everything"), null);
  assert.equal(templateById("faq")?.id, "faq");
});

test("a provider that refused says why, instead of failing as a server error", async () => {
  const { ProductAgentService, AgentUnavailableError } = await import("../src/product/agents/agent-service.js");
  const service = new ProductAgentService(
    { get: async () => ({ brandName: "B", normalizedDomain: "example.invalid" }) } as any,
    async () => insights({ absentFrom: [absent("a question", 4, [entity("Rival", 3)])] }),
    { save: async () => {}, read: async () => null, list: async () => [] } as any,
  );
  // The site read fails on an unroutable domain, which is itself a reason the
  // caller can act on rather than a 500.
  await assert.rejects(
    () => service.draft("p", "missing_answer", async () => { throw new Error("Insufficient credits (HTTP 402)"); }),
    (error: unknown) => error instanceof AgentUnavailableError,
  );
});

test("an unknown workflow is refused before any model is asked", async () => {
  const { ProductAgentService, AgentUnavailableError } = await import("../src/product/agents/agent-service.js");
  let asked = false;
  const service = new ProductAgentService(
    { get: async () => ({ brandName: "B", normalizedDomain: "example.invalid" }) } as any,
    async () => insights(),
    { save: async () => {}, read: async () => null, list: async () => [] } as any,
  );
  await assert.rejects(
    () => service.draft("p", "publish_everything", async () => { asked = true; return {}; }),
    (error: unknown) => error instanceof AgentUnavailableError,
  );
  assert.equal(asked, false, "an unknown workflow reached a model");
});

test("a batch builds one brief per gap, not just the first", () => {
  const rows = insights({
    absentFrom: [
      absent("question one", 4, [entity("Rival", 3)]),
      absent("question two", 6, [entity("Rival", 5)]),
      absent("not asked", 0, []),
    ],
  });
  const briefs = briefsFor("missing_answer", rows, 10);
  assert.equal(briefs.length, 2, "the question with no completed answer is not a gap");
  assert.ok(briefs[0]?.instruction?.includes("question one"));
  assert.ok(briefs[1]?.instruction?.includes("question two"));
});

test("a batch brief and a single brief agree about the same gap", () => {
  const rows = insights({ absentFrom: [absent("only question", 4, [entity("Rival", 3)])] });
  assert.equal(briefsFor("missing_answer", rows, 5)[0]?.instruction, briefFor("missing_answer", rows).instruction);
});

test("a batch honours its limit and never runs away", () => {
  const many = Array.from({ length: 80 }, (_, n) => absent(`question ${n}`, 3, []));
  assert.equal(briefsFor("missing_answer", insights({ absentFrom: many }), 3).length, 3);
  assert.equal(briefsFor("missing_answer", insights({ absentFrom: many }), 999).length, 50, "capped, whatever is asked for");
});

test("a batch names every rival ahead of the brand, one brief each", () => {
  const rows = insights({ leaderboard: [entity("Us", 1, true), entity("A", 9), entity("B", 5), entity("Behind", 0)] });
  const briefs = briefsFor("competitor_brief", rows, 10);
  assert.equal(briefs.length, 2);
  assert.ok(briefs[0]?.instruction?.includes("A"));
  assert.ok(briefs[1]?.instruction?.includes("B"));
});

test("a batch of a blocked template yields nothing to draft", () => {
  assert.deepEqual(briefsFor("refresh", insights(), 5), []);
  assert.deepEqual(briefsFor("missing_answer", insights(), 5), []);
});

test("one gap failing does not discard the drafts already written", async () => {
  const { ProductAgentService } = await import("../src/product/agents/agent-service.js");
  const saved: any[] = [];
  const service = new ProductAgentService(
    { get: async () => ({ brandName: "B", normalizedDomain: "example.com" }) } as any,
    async () => insights({ absentFrom: [absent("one", 3, []), absent("two", 3, []), absent("three", 3, [])] }),
    { save: async (d: any) => { saved.push(d); }, read: async () => null, list: async () => [] } as any,
    async () => ({ digest: "the brand's pages", detail: null }),
  );
  let call = 0;
  const outcome = await service.draftBatch("p", "missing_answer", async () => {
    call += 1;
    if (call === 2) throw new Error("provider refused this one");
    return { analysisStatus: "completed", title: `T${call}`, body: "B", rationale: "R" };
  }, 3);

  assert.equal(outcome.considered, 3);
  assert.equal(outcome.drafts.length, 2, "two succeeded and are kept");
  assert.equal(outcome.skipped.length, 1, "the one that failed is named, not hidden");
  assert.ok(outcome.skipped[0]?.reason.includes("provider refused"));
  assert.ok(outcome.drafts.every((draft: any) => draft.status === "awaiting_review"));
  assert.equal(saved.length, 2, "only what was written is stored");
});

test("a batch where every gap fails saves nothing and says why", async () => {
  const { ProductAgentService, AgentUnavailableError } = await import("../src/product/agents/agent-service.js");
  const service = new ProductAgentService(
    { get: async () => ({ brandName: "B", normalizedDomain: "example.com" }) } as any,
    async () => insights({ absentFrom: [absent("one", 3, [])] }),
    { save: async () => {}, read: async () => null, list: async () => [] } as any,
    async () => ({ digest: "pages", detail: null }),
  );
  await assert.rejects(
    () => service.draftBatch("p", "missing_answer", async () => { throw new Error("no credits"); }, 3),
    (error: unknown) => error instanceof AgentUnavailableError && String((error as Error).message).includes("no credits"),
  );
});

test("pages that cannot be read stop a batch before any model is asked", async () => {
  const { ProductAgentService } = await import("../src/product/agents/agent-service.js");
  let asked = false;
  const service = new ProductAgentService(
    { get: async () => ({ brandName: "B", normalizedDomain: "example.com" }) } as any,
    async () => insights({ absentFrom: [absent("one", 3, [])] }),
    { save: async () => {}, read: async () => null, list: async () => [] } as any,
    async () => ({ digest: "", detail: "The site is behind a login." }),
  );
  await assert.rejects(() => service.draftBatch("p", "missing_answer", async () => { asked = true; return {}; }, 3));
  assert.equal(asked, false, "a model was asked to write from pages nobody could read");
});

test("a brief the pages only partly cover is still written, with the gaps named", () => {
  const prompt = agentPrompt({ brandName: "B", domain: "d.com", instruction: "I", digest: "D" });
  // Writing a Gaps section and declaring insufficiency at once is the
  // contradiction that made every draft refuse.
  assert.ok(prompt.includes("Return completed whenever the pages support anything at all"));
  assert.ok(prompt.includes("Return insufficient only when the pages support nothing"));
  assert.ok(prompt.includes("is a contradiction"));
});

test("the pages that won a question tell the draft what ground to cover", () => {
  const prompt = absent("best stock screener", 7, [entity("Screener", 6)]);
  prompt.cited = [{ url: "https://invezz.com/best", answers: 5 }, { url: "https://unread.example/x", answers: 2 }];
  const brief = briefFor("missing_answer", insights({ absentFrom: [prompt] }), (url) => (
    url === "https://invezz.com/best"
      ? { url, host: "invezz.com", title: "Best screeners", headings: ["What to look for", "Pricing"], namesYou: false }
      : null
  ));
  assert.ok(brief.instruction?.includes("invezz.com"));
  assert.ok(brief.instruction?.includes("What to look for / Pricing"), "the headings are the ground to cover");
  assert.ok(brief.instruction?.includes("Take no fact from them"), "a cited page is what was asked for, not a source");
  const citations = brief.sources.filter((row) => row.kind === "citation");
  assert.equal(citations.length, 1);
  assert.equal(citations[0]?.reference, "https://invezz.com/best");
  assert.ok(citations[0]?.detail.includes("5 answer(s)"));
});

test("a cited page nobody has read is counted, not quietly dropped", () => {
  const prompt = absent("best stock screener", 7, [entity("Screener", 6)]);
  prompt.cited = [{ url: "https://a.example/x", answers: 3 }, { url: "https://b.example/y", answers: 1 }];
  const brief = briefFor("missing_answer", insights({ absentFrom: [prompt] }), () => null);
  assert.ok(brief.instruction?.includes("2 more page(s) were cited and have not been read"));
  assert.equal(brief.sources.filter((row) => row.kind === "citation").length, 0);
});

test("a question nothing cited drafts exactly as it did before", () => {
  const brief = briefFor("missing_answer", insights({
    absentFrom: [absent("best stock screener", 7, [entity("Screener", 6)])],
  }));
  assert.ok(!brief.instruction?.includes("were cited"));
  assert.equal(brief.sources.filter((row) => row.kind === "citation").length, 0);
});
