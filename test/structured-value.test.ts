import test from "node:test";
import assert from "node:assert/strict";
import { readStructuredValue } from "../src/product/topics/structured-value.js";
import { parsePromptSetProposal } from "../src/product/topics/prompt-generation-protocol.js";

// A correct prompt set was produced by the model and thrown away, because
// structuredOutput.value was a JSON string and the parser read it as an object:
// every field came back absent and the payload looked empty rather than wrong.

test("a provider that returns the payload as a string is read, not discarded", () => {
  const value = readStructuredValue('{"analysisStatus":"completed","topics":[],"unknowns":["a"]}');
  assert.deepEqual(value, { analysisStatus: "completed", topics: [], unknowns: ["a"] });
});

test("a provider that returns an object is passed through untouched", () => {
  const object = { analysisStatus: "completed" };
  assert.equal(readStructuredValue(object), object);
});

test("a markdown code fence around the JSON is removed", () => {
  const value = readStructuredValue('```json\n{"analysisStatus":"completed"}\n```');
  assert.deepEqual(value, { analysisStatus: "completed" });
});

test("something that is not JSON is null rather than a throw mid-run", () => {
  assert.equal(readStructuredValue("I could not answer that."), null);
});

test("a stringified proposal parses end to end", () => {
  const payload = JSON.stringify({
    analysisStatus: "completed",
    topics: [{ name: "Screening", description: "", prompts: [{ text: "best screener", intent: "discovery" }] }],
    unknowns: [],
  });
  const parsed = parsePromptSetProposal(readStructuredValue(payload));
  assert.equal(parsed.analysisStatus, "completed");
  assert.equal(parsed.topics.length, 1);
});
