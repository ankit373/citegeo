import { canonicalUrl } from "../citations/canonical-url.js";
import {
  classifyPageType, PAGE_TYPE_DEFINITIONS, PAGE_TYPES,
  type PageType, type PageTypeDefinition, type PageTypeReading,
} from "../citations/page-type.js";
import type { PromptAnswer, PromptRun } from "./prompt-run-schema.js";
import type { Topic } from "./topic-schema.js";

// Which kind of page wins each topic, per run. A citation is one page in one
// answer, so a page cited twice in the same answer counts once.

export const PAGE_TYPE_CAVEAT = "Read off the cited address alone, not the page behind it. Each page lists the rule that typed it, so a wrong one can be found and argued with. Unknown means the address said nothing, not that the page is of no kind.";

export interface TypeCount {
  type: PageType;
  citations: number;
  /** Null where the run cited nothing on this topic, which is not a zero share. */
  share: number | null;
}

export interface RunSplit {
  runId: string;
  startedAt: string;
  /** Completed answers on this topic in this run. */
  answers: number;
  citations: number;
  types: TypeCount[];
}

export interface TypeChange {
  type: PageType;
  previous: number | null;
  latest: number | null;
  /** Latest share less the previous one. Null unless both runs cited something. */
  change: number | null;
}

export interface TypedPage {
  url: string;
  host: string;
  citations: number;
  reading: PageTypeReading;
}

export interface TopicPageTypes {
  topicId: string;
  topicName: string;
  /** Oldest first, and only runs that answered this topic. */
  runs: RunSplit[];
  /** The latest run against the one before it. Null with fewer than two runs. */
  changes: TypeChange[] | null;
  /** The most cited type in the latest run that cited anything; ties are all kept. */
  leaders: PageType[];
  pages: TypedPage[];
}

export interface PageTypeReport {
  definitions: PageTypeDefinition[];
  topics: TopicPageTypes[];
  /** Completed answers in scope, and how many of them cited anything. */
  answers: number;
  answersWithCitations: number;
  caveat: string;
}

function emptyCounts(): Map<PageType, number> {
  return new Map(PAGE_TYPES.map((type) => [type, 0]));
}

function splitOf(counts: Map<PageType, number>, total: number): TypeCount[] {
  return PAGE_TYPES.map((type) => {
    const citations = counts.get(type) || 0;
    return { type, citations, share: total ? citations / total : null };
  });
}

interface RunTally {
  runId: string;
  startedAt: string;
  answers: number;
  citations: number;
  counts: Map<PageType, number>;
}

export function buildPageTypeReport(input: {
  answers: PromptAnswer[];
  topics: Topic[];
  runs: PromptRun[];
  /** Your domain and tracked rivals' domains, for the vendor rule. */
  companyDomains?: string[];
}): PageTypeReport {
  const completed = input.answers.filter((answer) => answer.status === "completed");
  const runStart = new Map(input.runs.map((run) => [run.id, run.startedAt]));
  const names = new Map(input.topics.map((topic) => [topic.id, topic.name]));
  const context = { companyDomains: input.companyDomains || [] };
  const readings = new Map<string, PageTypeReading>();

  const byTopic = new Map<string, { runs: Map<string, RunTally>; pages: Map<string, TypedPage> }>();
  let withCitations = 0;

  for (const answer of completed) {
    const topic = byTopic.get(answer.topicId) || { runs: new Map(), pages: new Map() };
    byTopic.set(answer.topicId, topic);
    // A run missing from the list still orders by its first answer.
    const run = topic.runs.get(answer.runId) || {
      runId: answer.runId, startedAt: runStart.get(answer.runId) || answer.createdAt,
      answers: 0, citations: 0, counts: emptyCounts(),
    };
    topic.runs.set(answer.runId, run);
    run.answers += 1;

    const seen = new Set<string>();
    for (const raw of answer.citationUrls) {
      const url = canonicalUrl(raw);
      const key = url ? url.key : raw.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const reading = readings.get(key) || classifyPageType(raw, context);
      readings.set(key, reading);
      run.citations += 1;
      run.counts.set(reading.type, (run.counts.get(reading.type) || 0) + 1);
      const page = topic.pages.get(key) || { url: key, host: url ? url.host : "", citations: 0, reading };
      page.citations += 1;
      topic.pages.set(key, page);
    }
    if (seen.size) withCitations += 1;
  }

  const topics: TopicPageTypes[] = [...byTopic.entries()].map(([topicId, topic]) => {
    const ordered = [...topic.runs.values()].sort((left, right) => left.startedAt.localeCompare(right.startedAt));
    const runs: RunSplit[] = ordered.map((run) => ({
      runId: run.runId, startedAt: run.startedAt, answers: run.answers, citations: run.citations,
      types: splitOf(run.counts, run.citations),
    }));
    return {
      topicId,
      topicName: names.get(topicId) || topicId,
      runs,
      changes: changesOf(runs),
      leaders: leadersOf(runs),
      pages: [...topic.pages.values()].sort((left, right) => right.citations - left.citations || left.url.localeCompare(right.url)),
    };
  });
  topics.sort((left, right) => left.topicName.localeCompare(right.topicName));

  return {
    definitions: PAGE_TYPE_DEFINITIONS,
    topics,
    answers: completed.length,
    answersWithCitations: withCitations,
    caveat: PAGE_TYPE_CAVEAT,
  };
}

function changesOf(runs: RunSplit[]): TypeChange[] | null {
  if (runs.length < 2) return null;
  const latest = runs[runs.length - 1] as RunSplit;
  const previous = runs[runs.length - 2] as RunSplit;
  return PAGE_TYPES.map((type, index) => {
    const before = previous.types[index]?.share ?? null;
    const after = latest.types[index]?.share ?? null;
    return { type, previous: before, latest: after, change: before === null || after === null ? null : after - before };
  });
}

function leadersOf(runs: RunSplit[]): PageType[] {
  const latest = [...runs].reverse().find((run) => run.citations > 0);
  if (!latest) return [];
  const top = Math.max(...latest.types.map((row) => row.citations));
  return latest.types.filter((row) => row.citations === top).map((row) => row.type);
}
