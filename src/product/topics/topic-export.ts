import { toCsv, type CsvTable } from "../insights/csv.js";
import type { TopicInsights } from "./topic-insights.js";

// Pure mapping, so adding a table is not a change to HTTP code. Every number on
// the answer engine page leaves as a file; a finding nobody can take out of the
// tool is a finding nobody acts on.

export type PromptExportTable = "scores" | "leaderboard" | "topics" | "models" | "markets" | "trend" | "absent";

const NAMES: PromptExportTable[] = ["scores", "leaderboard", "topics", "models", "markets", "trend", "absent"];

export function promptExportNames(): PromptExportTable[] {
  return [...NAMES];
}

export function promptExportTables(insights: TopicInsights): Record<PromptExportTable, CsvTable> {
  const prompts = insights.topics.flatMap((topic) => topic.prompts.map((prompt) => ({ topic, prompt })));
  return {
    scores: {
      columns: ["topic", "prompt", "intent", "measuresVisibility", "answers", "appearances", "presence", "prominence", "sentiment", "score", "rank", "ahead"],
      rows: prompts.map(({ topic, prompt }) => [
        topic.name, prompt.text, prompt.intent, prompt.measuresVisibility,
        prompt.score.answers, prompt.score.appearances, prompt.score.presenceRate,
        prompt.score.prominence, prompt.score.sentiment, prompt.score.score,
        prompt.rank, prompt.ahead.map((row) => row.name),
      ]),
    },
    leaderboard: {
      columns: ["rank", "name", "domain", "isTarget", "appearances", "shareOfAnswers", "prominence", "positive", "negative"],
      rows: insights.leaderboard.map((row, index) => [
        index + 1, row.name, row.domain, row.isTarget, row.appearances, row.shareOfAnswers, row.prominence, row.positive, row.negative,
      ]),
    },
    topics: {
      columns: ["topic", "description", "prompts", "answers", "presence", "score", "rank"],
      rows: insights.topics.map((row) => [
        row.name, row.description, row.prompts.length, row.score.answers, row.score.presenceRate, row.score.score, row.rank,
      ]),
    },
    models: {
      columns: ["model", "modelId", "provider", "answers", "appearances", "presence", "score"],
      rows: insights.byModel.map((row) => [
        row.displayName, row.modelId, row.providerId, row.score.answers, row.score.appearances, row.score.presenceRate, row.score.score,
      ]),
    },
    markets: {
      columns: ["market", "marketId", "answers", "presence", "score", "rank"],
      rows: insights.byRegion.map((row) => [
        row.label, row.regionId, row.score.answers, row.score.presenceRate, row.score.score, row.rank,
      ]),
    },
    trend: {
      columns: ["runId", "at", "answers", "appearances", "presence", "score", "rank", "markets"],
      rows: insights.trend.points.map((row) => [
        row.runId, row.at, row.score.answers, row.score.appearances, row.score.presenceRate, row.score.score, row.rank, row.regionIds,
      ]),
    },
    absent: {
      columns: ["prompt", "intent", "answers", "namedInstead"],
      rows: insights.absentFrom.map((row) => [
        row.text, row.intent, row.score.answers, row.ahead.map((entity) => entity.name),
      ]),
    },
  };
}

/** Null for an unknown name, so a typo is a 404 rather than an empty file. */
export function promptExportTable(insights: TopicInsights, name: string): string | null {
  const wanted = name.endsWith(".csv") ? name.slice(0, -4) : name;
  const tables = promptExportTables(insights);
  const table = (tables as Record<string, CsvTable>)[wanted];
  return table ? toCsv(table) : null;
}
