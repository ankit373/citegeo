import test from "node:test";
import assert from "node:assert/strict";
import { buildRecognitionModelRunPresentation } from "../src/product/recognition/recognition-presentation.js";
import type { RecognitionModelRun } from "../src/product/recognition/recognition-schema.js";

function failedRun(errorMessage: string): RecognitionModelRun {
  return {
    id: "model-run",
    projectId: "project",
    runId: "run",
    baselineId: "baseline",
    modelSnapshot: {
      selectionId: "selection",
      providerId: "openrouter",
      modelId: "vendor/model",
      displayName: "Vendor: Model",
      webSearchMode: "provider_native",
      nativeWebSearchSupported: true,
      capabilityCheckedAt: "2026-01-01T00:00:00.000Z",
    },
    recognitionMode: "unaided_domain_recognition",
    status: "failed",
    errorMessage,
    createdAt: "2026-01-01T00:00:00.000Z",
  } as RecognitionModelRun;
}

const presentationFor = (errorMessage: string) =>
  buildRecognitionModelRunPresentation({ modelRun: failedRun(errorMessage), attempts: [] });

test("an empty balance reads as an account problem, not a generic provider failure", () => {
  const presentation = presentationFor("OpenRouter request failed with HTTP 402: Insufficient credits. This account never purchased credits.");
  assert.ok(presentation.statusLabel.includes("no credit"));
  assert.equal(presentation.primaryAction, "open_provider_settings");
  assert.ok(presentation.detail?.includes(":free"));
});

test("a batch-only model says so instead of looking retryable", () => {
  const presentation = presentationFor("This model is only available through the Batch API. Use the /api/v1/batches endpoint instead.");
  assert.ok(presentation.statusLabel.includes("batch"));
  assert.equal(presentation.primaryAction, "check_model_configuration");
  // Retrying can never help, so the copy must not invite it.
  assert.ok(!presentation.statusLabel.toLowerCase().includes("retry"));
});

test("no usable endpoint names web search as the thing to change", () => {
  const presentation = presentationFor("OpenRouter request failed with HTTP 404: No endpoints found that can handle the requested parameters.");
  assert.equal(presentation.primaryAction, "check_model_configuration");
  assert.ok(presentation.detail?.includes("Offline"));
});

test("an ordinary transport failure still reads as a provider failure", () => {
  const presentation = presentationFor("socket hang up");
  assert.equal(presentation.statusLabel, "Provider Call failed");
  assert.equal(presentation.primaryAction, "retry_request");
});
