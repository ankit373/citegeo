import test from "node:test";
import assert from "node:assert/strict";
import {
  evidenceValue, highlightedRawAnswer, recognitionCountStrip, recognitionEvidenceRows, recognitionMissingText,
  recognitionRunCounts, recognitionRunSummary, renderRecognitionEvidence, renderRecognitionModel, renderRecognitionSummary,
  type RecognitionArchive, type RecognitionModelDetail, type RecognitionModelRun, type RecognitionPresentation,
} from "../src/ui/app/pages/recognition-view.js";

function has(text: string, ...parts: string[]): void {
  for (const part of parts) assert.ok(text.includes(part), `${JSON.stringify(text)} lacks ${part}`);
}

const archive: RecognitionArchive = {
  result: {
    id: "r1",
    domainRecognition: "recognized",
    recognizedBrand: { value: "Acme", evidence: { start: 0, end: 4 } },
    businessDescription: { value: null, evidence: null },
    productCategory: { value: "Tools" },
    fieldIssues: [{ field: "competitors", kind: "missing_field", detail: "none" }],
  },
  competitors: [],
  brandKeywords: [{ id: "k1", keyword: "anvil", evidence: { start: 5, end: 10 } }],
  competitorKeywords: [],
  providerCitations: [{ url: "https://a.example/x", title: "" }],
  answerMentionedUrls: [],
};

const presentation: RecognitionPresentation = {
  requestExecution: "response_received", localAnalysis: "complete", primaryAction: "reanalyze_saved_answer", statusLabel: "Got it", detail: null,
};

const modelRun: RecognitionModelRun = {
  id: "m1", status: "completed", recognitionMode: "native_web_domain_discovery", modelSnapshot: { displayName: "Model <1>", modelId: "v/m" },
};

const detail: RecognitionModelDetail = {
  archive,
  attempts: [{ id: "a1", attemptNumber: 1, status: "response_saved", rawAnswer: "Acme anvil <b>" }],
  presentation,
};

test("only evidence with both ends becomes a highlight row", () => {
  assert.deepEqual(recognitionEvidenceRows(archive).map((row) => row.id), ["r1-brand", "k1"]);
  assert.equal(highlightedRawAnswer("Acme anvil <b>", recognitionEvidenceRows(archive)), '<mark id="r1-brand">Acme</mark> <mark id="k1">anvil</mark> &lt;b&gt;');
  assert.equal(highlightedRawAnswer("abc", [{ id: "x", start: 2, end: 99 }]), "abc");
});

test("a value with no evidence says unconfirmed, and a missing field says so in words", () => {
  has(evidenceValue(null, "i"), "Unconfirmed");
  has(evidenceValue("v", "i"), "v", 'data-evidence-target="i"');
  has(recognitionMissingText(archive, "competitors", "empty", "missing"), "missing");
  assert.equal(recognitionMissingText(archive, "keywords", "empty<", "missing"), "empty&lt;");
});

test("the summary reads an absent answer as absent, never as none", () => {
  assert.equal(renderRecognitionSummary({ ...detail, archive: null }), "");
  const summary = renderRecognitionSummary(detail);
  has(summary, "Model explicitly recognized it", "This answer did not provide this field", "Unconfirmed");
});

test("the evidence block escapes the raw answer and names a missing citation list", () => {
  const block = renderRecognitionEvidence(detail, modelRun);
  has(block, "&lt;b&gt;", "Attempt 1", "https://a.example/x");
  has(renderRecognitionEvidence({ ...detail, archive: null, attempts: [] }, modelRun), "No attempt records created yet.", "This model returned no provider citations in this run.");
});

test("run counts come from the model details, and a model with none is still running", () => {
  const run = { run: { id: "r", status: "running" }, modelRuns: [modelRun, { ...modelRun, id: "m2", status: "queued" }, { ...modelRun, id: "m3", status: "failed" }] };
  const counts = recognitionRunCounts(run, { m1: detail });
  assert.deepEqual(counts, { received: 1, complete: 1, partial: 0, analysisFailed: 0, requestLimited: 0, running: 1 });
  has(recognitionRunSummary(run, { m1: detail }), "Answer received 1", "Still running 1");
  has(recognitionCountStrip(run, { m1: detail }), "countstrip", "count is-zero");
});

test("a model card shows its action, escapes its name and waits for its result", () => {
  const card = renderRecognitionModel(modelRun, detail);
  has(card, "Model &lt;1&gt;", "data-recognition-reanalyze=\"m1\"", "Answer: Got it");
  has(renderRecognitionModel(modelRun, null), "Loading this model's archived result.", "Answer: Completed");
});
