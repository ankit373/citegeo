import { countsTowardVisibility, type PromptAnswer } from "../topics/prompt-run-schema.js";

/** Bumped when a column changes. A file that disagrees is dropped and rescanned. */
export const ANSWER_INDEX_SCHEMA_VERSION = 1;

/**
 * The queryable half of one answer. The answer itself stays in the store and
 * is fetched by key only when the body is wanted.
 */
export interface AnswerIndexEntry {
  key: string;
  /** The collection this key belongs to, which is how a query is scoped. */
  prefix: string;
  projectId: string;
  runId: string;
  promptId: string;
  topicId: string;
  modelId: string;
  providerId: string;
  regionId: string;
  languageId: string;
  /** Null when nobody was stated, which is not the same as a named persona. */
  personaId: string | null;
  status: string;
  createdAt: string;
  /** Null when nothing was parsed. An answer that never arrived named nobody,
   * which is a different fact from an answer that named nobody. */
  mentionCount: number | null;
  targetNamed: boolean | null;
  citationCount: number | null;
}

export function answerIndexEntry(prefix: string, key: string, answer: PromptAnswer): AnswerIndexEntry {
  const parsed = countsTowardVisibility(answer);
  return {
    key,
    prefix,
    projectId: answer.projectId,
    runId: answer.runId,
    promptId: answer.promptId,
    topicId: answer.topicId,
    modelId: answer.modelId,
    providerId: answer.providerId,
    regionId: answer.regionId,
    languageId: answer.languageId,
    personaId: answer.personaId ?? null,
    status: answer.status,
    createdAt: answer.createdAt,
    mentionCount: parsed ? answer.mentions.length : null,
    targetNamed: parsed ? answer.mentions.some((mention) => mention.isTarget) : null,
    citationCount: parsed ? answer.citationUrls.length : null,
  };
}

/** True when the indexed copy no longer says what the stored document says. */
export function answerEntryDiffers(indexed: AnswerIndexEntry, fresh: AnswerIndexEntry): boolean {
  return indexed.prefix !== fresh.prefix
    || indexed.projectId !== fresh.projectId
    || indexed.runId !== fresh.runId
    || indexed.promptId !== fresh.promptId
    || indexed.topicId !== fresh.topicId
    || indexed.modelId !== fresh.modelId
    || indexed.providerId !== fresh.providerId
    || indexed.regionId !== fresh.regionId
    || indexed.languageId !== fresh.languageId
    || indexed.personaId !== fresh.personaId
    || indexed.status !== fresh.status
    || indexed.createdAt !== fresh.createdAt
    || indexed.mentionCount !== fresh.mentionCount
    || indexed.targetNamed !== fresh.targetNamed
    || indexed.citationCount !== fresh.citationCount;
}
