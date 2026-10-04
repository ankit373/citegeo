import test from "node:test";
import assert from "node:assert/strict";
import { buildVersionReport, MIN_EITHER_SIDE, VERSION_CAVEAT } from "../src/product/topics/model-version.js";
import type { AnswerMention, PromptAnswer } from "../src/product/topics/prompt-run-schema.js";

const TARGET: AnswerMention = {
  name: "X", domain: null, recommendation: "positive", mentionQuote: null,
  firstMentionOffset: 0, firstMentionState: "unique", isTarget: true,
};

function answer(over: Partial<PromptAnswer> = {}): PromptAnswer {
  return {
    id: String(Math.random()), projectId: "p", runId: "r", promptId: "q", topicId: "t",
    promptText: "best screener", intent: "discovery", providerId: "openai", modelId: "gpt-4o",
    modelDisplayName: "M", regionId: "global", languageId: "en", status: "completed", text: "",
    mentions: [], citationUrls: [], errorCode: null, errorMessage: null, latencyMs: 1,
    createdAt: "2026-05-01T00:00:00.000Z", ...over,
  };
}

function run(version: string, named: number, count: number, when: string): PromptAnswer[] {
  return Array.from({ length: count }, (_, index) =>
    answer({ modelVersion: version, createdAt: when, mentions: index < named ? [TARGET] : [] }));
}

test("a provider that never named a version is unconfirmed, not steady", () => {
  // Reading silence as "the version never changed" invents the one fact this
  // whole thing exists to establish.
  const report = buildVersionReport(run("", 5, 20, "2026-05-01T00:00:00.000Z"));
  assert.deepEqual(report.unconfirmed, ["gpt-4o"]);
  assert.equal(report.models[0]?.reported, false);
  assert.deepEqual(report.models[0]?.versions, []);
});

test("a version echoing back the model asked for says nothing either", () => {
  const report = buildVersionReport(run("gpt-4o", 5, 20, "2026-05-01T00:00:00.000Z"));
  assert.deepEqual(report.unconfirmed, ["gpt-4o"]);
});

test("one named version is recorded with no shift to read", () => {
  const report = buildVersionReport(run("gpt-4o-2026-03-01", 10, 20, "2026-05-01T00:00:00.000Z"));
  assert.equal(report.models[0]?.reported, true);
  assert.equal(report.models[0]?.versions.length, 1);
  assert.deepEqual(report.models[0]?.shifts, []);
});

test("a drop across a version boundary is the finding", () => {
  const report = buildVersionReport([
    ...run("gpt-4o-2026-03-01", 36, 40, "2026-05-01T00:00:00.000Z"),
    ...run("gpt-4o-2026-08-01", 4, 40, "2026-09-01T00:00:00.000Z"),
  ]);
  const shift = report.models[0]?.shifts[0];
  assert.equal(shift?.from.version, "gpt-4o-2026-03-01");
  assert.equal(shift?.to.version, "gpt-4o-2026-08-01");
  assert.ok((shift?.change || 0) < -0.7);
  assert.equal(shift?.separated, true);
  assert.equal(report.separatedShifts, 1);
});

test("two rates whose ranges overlap have not been shown to differ", () => {
  const report = buildVersionReport([
    ...run("v1", 10, 20, "2026-05-01T00:00:00.000Z"),
    ...run("v2", 12, 20, "2026-09-01T00:00:00.000Z"),
  ]);
  assert.equal(report.models[0]?.shifts[0]?.separated, false);
  assert.equal(report.separatedShifts, 0);
});

test("a handful either side refuses to call the shift anything", () => {
  const report = buildVersionReport([
    ...run("v1", 3, 3, "2026-05-01T00:00:00.000Z"),
    ...run("v2", 0, 20, "2026-09-01T00:00:00.000Z"),
  ]);
  const shift = report.models[0]?.shifts[0];
  assert.equal(shift?.change, null, "a rate off three answers is not a rate");
  assert.equal(shift?.separated, null);
  assert.ok(MIN_EITHER_SIDE > 3);
});

test("versions are ordered by when they were first seen", () => {
  const report = buildVersionReport([
    ...run("later", 5, 10, "2026-09-01T00:00:00.000Z"),
    ...run("earlier", 5, 10, "2026-05-01T00:00:00.000Z"),
  ]);
  assert.deepEqual(report.models[0]?.versions.map((row) => row.version), ["earlier", "later"]);
});

test("each model is tracked on its own, because they ship apart", () => {
  const report = buildVersionReport([
    ...run("gpt-4o-a", 10, 10, "2026-05-01T00:00:00.000Z"),
    ...run("gpt-4o-b", 0, 10, "2026-09-01T00:00:00.000Z"),
    ...run("sonar-a", 5, 10, "2026-05-01T00:00:00.000Z").map((row) => ({ ...row, modelId: "sonar" })),
  ]);
  assert.equal(report.models.length, 2);
  assert.equal(report.models.find((row) => row.modelId === "sonar")?.shifts.length, 0);
});

test("a failed answer came from no version at all", () => {
  const report = buildVersionReport([
    ...run("v1", 5, 10, "2026-05-01T00:00:00.000Z"),
    answer({ modelVersion: "v2", status: "provider_failed" }),
  ]);
  assert.equal(report.models[0]?.versions.length, 1);
});

test("the caveat refuses to call the new version worse", () => {
  assert.ok(VERSION_CAVEAT.includes("not evidence the new version is worse"));
  assert.ok(VERSION_CAVEAT.includes("unconfirmed rather than as steady"));
  assert.equal(buildVersionReport([]).caveat, VERSION_CAVEAT);
});
