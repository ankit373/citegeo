import test from "node:test";
import assert from "node:assert/strict";
import { PromptRunService } from "../src/product/topics/prompt-run-service.js";
import type { AnswerResult } from "../src/core/types.js";

function answer(overrides: Partial<AnswerResult> = {}): AnswerResult {
  return {
    providerId: "azure-openai", providerName: "Azure", sourceType: "model_api", sourceLabel: "x",
    resultCaveat: "c", model: "gpt-4o", modelVersion: "gpt-4o-2026-01", text: "Screener.in is the usual answer.",
    citations: [{ url: "https://screener.in/guide", title: "A guide", index: 1 }],
    webQueries: [], latencyMs: 12, createdAt: "2026-10-04T00:00:00.000Z",
    ...overrides,
  } as AnswerResult;
}

/** Only the two collaborators the grounded path touches. */
function service(input: { result: AnswerResult; read?: unknown; captured?: Array<Record<string, unknown>> }) {
  const executor = {
    execute: async (request: Record<string, unknown>) => {
      input.captured?.push(request);
      return input.result;
    },
  };
  const read = input.read === undefined
    ? async () => ({ analysisStatus: "completed", mentions: [{ name: "Screener.in", domain: "screener.in", recommendation: "positive", mentionQuote: "the usual answer", firstMentionOffset: 0, firstMentionState: "unique" }] })
    : input.read;
  return new PromptRunService(
    {} as never, {} as never, {} as never, {} as never, executor as never,
    undefined, undefined, undefined, undefined, undefined, read as never,
  );
}

const ASK = {
  run: { id: "r", projectId: "p" },
  baseline: { id: "b" },
  model: { providerId: "azure-openai", modelId: "gpt-4o", displayName: "GPT-4o", webSearchMode: "provider_native" },
  prompt: { id: "q", topicId: "t", text: "best stock screener", intent: "discovery" },
  identity: { host: "tradomate.one", distinctive: ["tradomate"], ambiguous: [], nameMatchingUnreliable: false, caveat: null },
  market: { id: "global", label: "Global", instruction: "" },
  tongue: { id: "en", label: "English", instruction: "" },
  who: { id: "none", label: "Nobody", instruction: "" },
};

async function ask(service: PromptRunService) {
  return (service as unknown as { ask: (input: unknown) => Promise<Record<string, unknown>> }).ask(ASK);
}

test("a grounded answer is asked for without a schema, because a schema costs the citations", async () => {
  const captured: Array<Record<string, unknown>> = [];
  const result = await ask(service({ result: answer(), captured }));
  assert.equal(captured[0]?.unstructured, true);
  assert.equal(result.status, "completed");
  assert.deepEqual(result.citationUrls, ["https://screener.in/guide"]);
  assert.equal((result.mentions as unknown[]).length, 1);
});

test("a reading that fails keeps the answer and its sources", async () => {
  // The answer happened and the sources are real. Only the reading failed,
  // and throwing those away would lose a measurement that was paid for.
  const result = await ask(service({ result: answer(), read: async () => { throw new Error("no reader available"); } }));
  assert.equal(result.status, "analysis_failed");
  assert.equal(result.text, "Screener.in is the usual answer.");
  assert.deepEqual(result.citationUrls, ["https://screener.in/guide"]);
  assert.deepEqual(result.mentions, []);
});

test("a grounded provider that searched and said nothing is no answer, not an answer naming nobody", async () => {
  const result = await ask(service({ result: answer({ text: "   " }) }));
  assert.equal(result.status, "no_answer");
  assert.deepEqual(result.mentions, []);
});

test("an unfinished reading counts as nothing rather than as an absence of mentions", async () => {
  const result = await ask(service({ result: answer(), read: async () => ({ analysisStatus: "unknown", mentions: [] }) }));
  assert.equal(result.status, "analysis_failed");
  assert.equal(result.errorCode, "unreadable_answer");
});

test("a grounded question is put the way a buyer puts it, with no mention of JSON", async () => {
  // Seen live: the schema instruction survived into the answer text as
  // "Here is the answer to your question, followed by the requested JSON",
  // and that text is what the reader then has to read.
  const captured: Array<Record<string, unknown>> = [];
  await ask(service({ result: answer(), captured }));
  const prompt = String(captured[0]?.prompt);
  assert.ok(prompt.includes("best stock screener"));
  assert.ok(prompt.includes("Answer in prose"));
  assert.equal(prompt.toLocaleLowerCase().includes("json schema"), false);
  assert.equal(prompt.includes("Return only the requested JSON"), false);
});
