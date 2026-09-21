import { toCsv, type CsvTable } from "../insights/csv.js";
import type { PromptAnswer } from "./prompt-run-schema.js";

// The grain a warehouse wants: one row per archived answer. Every aggregate in
// this product is built from these rows, so exporting them is what lets
// somebody check an aggregate rather than take it.

export type AnswerExportTable = "answers" | "mentions" | "citations";

const NAMES: AnswerExportTable[] = ["answers", "mentions", "citations"];

export function answerExportNames(): AnswerExportTable[] {
  return [...NAMES];
}

export function answerExportTables(answers: PromptAnswer[]): Record<AnswerExportTable, CsvTable> {
  const completed = answers.filter((answer) => answer.status === "completed");
  return {
    answers: {
      columns: ["answerId", "runId", "createdAt", "promptId", "prompt", "topicId", "intent", "source", "model", "modelName", "market", "language", "status", "namedYou", "namesInAnswer", "citations", "latencyMs", "errorCode", "characters"],
      rows: answers.map((answer) => [
        answer.id, answer.runId, answer.createdAt, answer.promptId, answer.promptText, answer.topicId, answer.intent,
        answer.providerId, answer.modelId, answer.modelDisplayName, answer.regionId, answer.languageId, answer.status,
        // An answer that did not happen did not fail to name you.
        answer.status === "completed" ? answer.mentions.some((row) => row.isTarget) : null,
        answer.status === "completed" ? answer.mentions.length : null,
        answer.citationUrls.length, answer.latencyMs, answer.errorCode, answer.text.length,
      ]),
    },
    mentions: {
      columns: ["answerId", "createdAt", "promptId", "prompt", "model", "market", "language", "name", "domain", "isTarget", "recommendation", "position", "positionState", "quote"],
      rows: completed.flatMap((answer) => answer.mentions.map((mention) => [
        answer.id, answer.createdAt, answer.promptId, answer.promptText, answer.modelId, answer.regionId, answer.languageId,
        mention.name, mention.domain, mention.isTarget, mention.recommendation,
        mention.firstMentionOffset, mention.firstMentionState, mention.mentionQuote,
      ])),
    },
    citations: {
      columns: ["answerId", "createdAt", "promptId", "prompt", "model", "url", "namedYou"],
      rows: completed.flatMap((answer) => answer.citationUrls.map((url) => [
        answer.id, answer.createdAt, answer.promptId, answer.promptText, answer.modelId, url,
        answer.mentions.some((row) => row.isTarget),
      ])),
    },
  };
}

export function answerExportTable(answers: PromptAnswer[], name: string): string | null {
  const wanted = name.endsWith(".csv") ? name.slice(0, -4) : name;
  const tables = answerExportTables(answers);
  const table = (NAMES as string[]).includes(wanted) ? tables[wanted as AnswerExportTable] : null;
  return table ? toCsv(table) : null;
}
