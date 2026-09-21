import test from "node:test";
import assert from "node:assert/strict";
import { askBrowserEngine } from "../src/product/engines/engine-run.js";
import { parseEngineAnalysisOutput, engineAnalysisPrompt } from "../src/product/engines/engine-answer-protocol.js";
import type { BrowserEngine, EngineOutcome } from "../src/product/engines/browser-engine.js";
import type { BrandIdentity } from "../src/product/topics/brand-identity.js";
import { countsTowardProgress, countsTowardVisibility } from "../src/product/topics/prompt-run-schema.js";

const IDENTITY: BrandIdentity = {
  host: "tradomate.one",
  distinctive: ["tradomate"],
  ambiguous: [],
  nameMatchingUnreliable: false,
  caveat: null,
};

const PROMPT = { id: "q1", topicId: "t", text: "best stock screener", intent: "discovery" as const };

const ENGINE: BrowserEngine = {
  id: "perplexity-web",
  label: "Perplexity (web)",
  caveat: "read from the web app",
  ask: async () => ({ state: "unavailable", detail: "not driven in this test" }),
};

function run(outcome: EngineOutcome, ask: (input: { prompt: string }) => Promise<unknown>) {
  return askBrowserEngine({
    projectId: "p", runId: "r", prompt: PROMPT, engine: ENGINE, identity: IDENTITY,
    regionId: "global", languageId: "en",
    ask: ask as never,
    drive: async () => outcome,
  });
}

const GOOD = async () => ({
  analysisStatus: "completed",
  mentions: [
    { name: "Screener.in", domain: "screener.in", recommendation: "positive", mentionQuote: "best for fundamentals", firstMentionOffset: 0, firstMentionState: "unique" },
    { name: "Tradomate", domain: "tradomate.one", recommendation: "mentioned", mentionQuote: "also exists", firstMentionOffset: 40, firstMentionState: "unique" },
  ],
});

test("an engine that could not be reached is a failure, never an answer that named nobody", async () => {
  const answer = await run({ state: "unavailable", detail: "no tab to drive" }, GOOD);
  assert.equal(answer.status, "provider_failed");
  assert.equal(answer.mentions.length, 0);
  assert.equal(answer.errorCode, "unavailable");
  assert.equal(answer.errorMessage, "no tab to drive");
});

test("a page that changed shape is unreadable, which is not the same as an empty answer", async () => {
  const answer = await run({ state: "unreadable", detail: "selector missing" }, GOOD);
  assert.equal(answer.status, "provider_failed");
  assert.equal(answer.errorCode, "unreadable");
});

test("a surface reached but silent is recorded without becoming a measurement", async () => {
  const answer = await run({ state: "no_answer", detail: "no overview for this query" }, GOOD);
  assert.equal(answer.status, "no_answer");
  assert.equal(answer.text, "");
  assert.equal(answer.errorCode, "no_answer");
});

test("an answered engine carries its citations and is marked against the project's own identity", async () => {
  const answer = await run({
    state: "answered",
    answer: { engineId: "perplexity-web", text: "Screener.in is best. Tradomate also exists.", citationUrls: ["https://screener.in/guide"], capturedAt: "2026-01-01T00:00:00.000Z" },
  }, GOOD);
  assert.equal(answer.status, "completed");
  assert.equal(answer.providerId, "browser");
  assert.equal(answer.modelId, "perplexity-web");
  assert.deepEqual(answer.citationUrls, ["https://screener.in/guide"]);
  assert.deepEqual(answer.mentions.map((row) => [row.name, row.isTarget]), [["Screener.in", false], ["Tradomate", true]]);
});

test("a reading that failed keeps the answer and says the reading failed, not that nobody was named", async () => {
  const answer = await run({
    state: "answered",
    answer: { engineId: "perplexity-web", text: "Screener.in is best.", citationUrls: ["https://screener.in/"], capturedAt: "" },
  }, async () => { throw new Error("no model could read it"); });
  assert.equal(answer.status, "analysis_failed");
  assert.equal(answer.text, "Screener.in is best.");
  assert.deepEqual(answer.citationUrls, ["https://screener.in/"]);
  assert.equal(answer.mentions.length, 0);
});

test("the reader is told to read the answer, not to answer the question", () => {
  const prompt = engineAnalysisPrompt({ question: "best screener", answer: "Screener.in." });
  assert.ok(prompt.includes("Do not answer the question yourself."));
  assert.ok(prompt.includes("Add nothing the answer did not name."));
});

test("an unreported analysis status is unknown, never a completed read of nobody", () => {
  assert.equal(parseEngineAnalysisOutput({ mentions: [] }).analysisStatus, "unknown");
  assert.equal(parseEngineAnalysisOutput({ analysisStatus: "completed", mentions: [] }).analysisStatus, "completed");
});

test("a surface that produced nothing is not an answer that left you out", async () => {
  const answer = await run({ state: "no_answer", detail: "no overview for this query" }, GOOD);
  assert.equal(answer.status, "no_answer");
  assert.equal(countsTowardVisibility(answer), false, "nothing was answered, so nothing can be absent from it");
  assert.equal(countsTowardProgress(answer), true, "the run did get through this unit of work");
  assert.equal(answer.mentions.length, 0);
  assert.equal(answer.errorCode, "no_answer");
});

test("an answer that happened and named nobody still counts against you", async () => {
  const answer = await run({
    state: "answered",
    answer: { engineId: "perplexity-web", text: "Screener.in is best.", citationUrls: [], capturedAt: "" },
  }, async () => ({ analysisStatus: "completed", mentions: [] }));
  assert.equal(answer.status, "completed");
  assert.equal(countsTowardVisibility(answer), true);
});
