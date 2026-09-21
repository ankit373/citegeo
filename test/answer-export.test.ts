import test from "node:test";
import assert from "node:assert/strict";
import { answerExportNames, answerExportTable, answerExportTables } from "../src/product/topics/answer-export.js";
import type { AnswerMention, PromptAnswer } from "../src/product/topics/prompt-run-schema.js";

function mention(name: string, overrides: Partial<AnswerMention> = {}): AnswerMention {
  return { name, domain: null, recommendation: "positive", mentionQuote: "said so", firstMentionOffset: 0, firstMentionState: "unique", isTarget: false, ...overrides };
}

function answer(overrides: Partial<PromptAnswer> = {}): PromptAnswer {
  return {
    id: "a1", projectId: "p", runId: "r1", promptId: "q1", topicId: "t1", promptText: "best screener",
    intent: "discovery", providerId: "anthropic", modelId: "m", modelDisplayName: "M",
    regionId: "in", languageId: "en", status: "completed", text: "an answer",
    mentions: [mention("Screener.in"), mention("You", { isTarget: true })],
    citationUrls: ["https://example.com/a"], errorCode: null, errorMessage: null, latencyMs: 900,
    createdAt: "2026-01-01T00:00:00.000Z", ...overrides,
  };
}

test("every table is named, and a typo returns nothing rather than an empty file", () => {
  assert.deepEqual(answerExportNames(), ["answers", "mentions", "citations"]);
  assert.equal(answerExportTable([answer()], "nonsense"), null);
  assert.ok(answerExportTable([answer()], "answers")?.startsWith("answerId,"));
  // The route passes the path segment through, so the suffix has to survive it.
  assert.equal(answerExportTable([answer()], "answers.csv"), answerExportTable([answer()], "answers"));
});

test("a failed answer did not fail to name you, so the column is blank rather than false", () => {
  const tables = answerExportTables([answer({ status: "provider_failed", mentions: [], errorCode: "402" })]);
  const row = tables.answers.rows[0] || [];
  const namedYou = row[tables.answers.columns.indexOf("namedYou")];
  const names = row[tables.answers.columns.indexOf("namesInAnswer")];
  assert.equal(namedYou, null);
  assert.equal(names, null);
});

test("one row per mention, carrying the model's own words as the evidence", () => {
  const tables = answerExportTables([answer()]);
  assert.equal(tables.mentions.rows.length, 2);
  const quote = tables.mentions.rows[0]?.[tables.mentions.columns.indexOf("quote")];
  assert.equal(quote, "said so");
  const isTarget = tables.mentions.rows[1]?.[tables.mentions.columns.indexOf("isTarget")];
  assert.equal(isTarget, true);
});

test("a failed answer contributes no mentions or citations, because it measured nothing", () => {
  const tables = answerExportTables([answer({ status: "analysis_failed", mentions: [], citationUrls: ["https://example.com/x"] })]);
  assert.equal(tables.mentions.rows.length, 0);
  assert.equal(tables.citations.rows.length, 0);
  assert.equal(tables.answers.rows.length, 1, "the attempt is still in the archive");
});

test("each source is a row against the answer that carried it", () => {
  const tables = answerExportTables([answer({ citationUrls: ["https://a.test/1", "https://b.test/2"] })]);
  assert.equal(tables.citations.rows.length, 2);
  assert.equal(tables.citations.rows[1]?.[tables.citations.columns.indexOf("url")], "https://b.test/2");
});
