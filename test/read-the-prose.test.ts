import test from "node:test";
import assert from "node:assert/strict";
import { PromptRunService } from "../src/product/topics/prompt-run-service.js";
import type { AnswerResult } from "../src/core/types.js";

const PROSE = "For Indian equity-only trading, Zerodha and Groww are the usual choices.";
const CUT_OFF = '{\n  "analysisStatus": "completed",\n  "answer": "For Indian equity",\n  "mentions": [{ "name": "Zerodha", "mentionQuote';

function result(over: Partial<AnswerResult> = {}): AnswerResult {
  return {
    providerId: "openrouter", providerName: "x", sourceType: "model_api", sourceLabel: "x",
    resultCaveat: "c", model: "m", modelVersion: "m", text: PROSE,
    citations: [], webQueries: [], latencyMs: 9, createdAt: "2026-10-05T00:00:00.000Z",
    ...over,
  } as AnswerResult;
}

function service(input: { result: AnswerResult; read?: unknown }) {
  const executor = { execute: async () => input.result };
  const read = input.read === undefined
    ? async () => ({ analysisStatus: "completed", mentions: [{ name: "Zerodha", domain: "zerodha.com", recommendation: "positive", mentionQuote: "the usual choices", firstMentionOffset: 0, firstMentionState: "unique" }] })
    : input.read;
  return new PromptRunService(
    {} as never, {} as never, {} as never, {} as never, executor as never,
    undefined, undefined, undefined, undefined, undefined, read as never,
  );
}

const ASK = {
  run: { id: "r", projectId: "p" },
  baseline: { id: "b" },
  model: { providerId: "openrouter", modelId: "a-model", displayName: "A", webSearchMode: "off" },
  prompt: { id: "q", topicId: "t", text: "equity only platforms", intent: "discovery" },
  identity: { host: "tradomate.one", distinctive: ["tradomate"], ambiguous: [], nameMatchingUnreliable: false, caveat: null },
  market: { id: "global", label: "Global", instruction: "" },
  tongue: { id: "en", label: "English", instruction: "" },
  who: { id: "none", label: "Nobody", instruction: "" },
};

async function ask(service: PromptRunService) {
  return (service as unknown as { ask: (input: unknown) => Promise<Record<string, unknown>> }).ask(ASK);
}

test("a model that answers in prose instead of the schema has still answered", async () => {
  // Live: four answers from one free model and one from a local model were
  // discarded for this, each of them a complete answer to the question.
  const answer = await ask(service({ result: result() }));
  assert.equal(answer.status, "completed");
  assert.equal(answer.text, PROSE);
  assert.equal((answer.mentions as unknown[]).length, 1);
});

test("a payload cut off mid-way is not prose, and is never read as an answer", async () => {
  // Handing the reader a half-written JSON object would have it read the
  // protocol as if it were what the model said.
  const answer = await ask(service({ result: result({ text: CUT_OFF, structuredOutput: { transport: "response_json_schema", value: CUT_OFF } }) }));
  assert.equal(answer.status, "analysis_failed");
  assert.equal(answer.errorCode, "truncated_payload");
  assert.ok(String(answer.errorMessage).includes("larger output budget"));
  assert.deepEqual(answer.mentions, []);
});

test("nothing written at all is still nothing", async () => {
  const answer = await ask(service({ result: result({ text: "   " }) }));
  assert.equal(answer.status, "analysis_failed");
  assert.equal(answer.errorCode, "no_structured_output");
});

test("a reader that fails keeps the answer rather than discarding it", async () => {
  const answer = await ask(service({ result: result(), read: async () => { throw new Error("no reader"); } }));
  assert.equal(answer.status, "analysis_failed");
  assert.equal(answer.text, PROSE);
});
