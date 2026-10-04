import type { AnswerSourceId, ProductProviderId } from "../configuration/provider-id.js";
import type { DiscoveryRecommendation, FirstPositionState } from "../measurements/measurement-schema.js";
import type { PromptIntent } from "./topic-schema.js";
import type { WebSearchUsedMode } from "../../core/types.js";

export const PROMPT_RUN_PROTOCOL_ID = "prompt-run/v1";

export type PromptRunStatus =
  | "running"
  /** Asked to stop; the loop finishes the answer in flight and then stops. */
  | "cancelling"
  | "cancelled"
  /** The process died mid-run. Not a failure of the models, so it is its own state. */
  | "interrupted"
  | "completed"
  | "partial"
  | "failed";

/** A run that is neither finished nor abandoned. */
export function isLive(status: PromptRunStatus): boolean {
  return status === "running" || status === "cancelling";
}
/** A surface that produced nothing is its own state. It is not a failure,
 * and it is not an answer that considered you and left you out. */
export type PromptAnswerStatus = "completed" | "no_answer" | "provider_failed" | "analysis_failed";

/** Whether the answer really names this, checked against the text rather than
 * taken from the model that wrote both the answer and the report. */
export type MentionCorroboration = "measured" | "named_only" | "absent_from_answer";

/** What the provider reported about searching for this answer. Absent on a
 * record written before it was kept, which is not the same as no search. */
export interface AnswerSearch {
  /** Whether the run asked for web search at all. */
  requested: boolean;
  /** Whether the provider is taken to have run one. */
  used: boolean;
  usedMode: WebSearchUsedMode;
  /** What it says it searched for. The evidence for used, kept short because
   * a receipt nobody can read is not one. */
  queries: string[];
}

/** One organisation named in one answer, with the evidence for it. */
export interface AnswerMention {
  name: string;
  domain: string | null;
  recommendation: DiscoveryRecommendation;
  mentionQuote: string | null;
  firstMentionOffset: number | null;
  firstMentionState: FirstPositionState;
  /** True when this mention is the project's own brand. */
  isTarget: boolean;
  /** Absent on a record written before the answer text was checked. */
  corroboration?: MentionCorroboration;
  quoteInAnswer?: boolean;
}

export interface PromptAnswer {
  id: string;
  projectId: string;
  runId: string;
  promptId: string;
  topicId: string;
  promptText: string;
  intent: PromptIntent;
  providerId: AnswerSourceId;
  modelId: string;
  modelDisplayName: string;
  /** What the provider said it actually ran, which is often more specific than
   * what was asked for. Absent where it was never recorded, and equal to the
   * model asked for where the provider only echoes it back. */
  modelVersion?: string | undefined;
  /** The market stated to the model. "global" means none was. */
  regionId: string;
  /** The language the answer was asked for. */
  languageId: string;
  /** Who the question was asked on behalf of. "anyone" means nobody stated. */
  personaId?: string | undefined;
  status: PromptAnswerStatus;
  /** The answer as the model wrote it. Every number here traces back to this. */
  text: string;
  mentions: AnswerMention[];
  /** Provider-native citation URLs from this response only. */
  citationUrls: string[];
  /** Absent on an answer archived before the provider's own account of
   * searching was kept, and on a browser surface, which reports none. */
  search?: AnswerSearch | undefined;
  /** Which pass of the same question this was, from one. Absent on an answer
   * archived before a run could ask more than once. */
  repetition?: number | undefined;
  errorCode: string | null;
  errorMessage: string | null;
  latencyMs: number | null;
  createdAt: string;
}

export interface PromptRun {
  id: string;
  projectId: string;
  status: PromptRunStatus;
  promptIds: string[];
  modelIds: string[];
  regionIds: string[];
  languageIds: string[];
  personaIds?: string[] | undefined;
  /** How many times each question was asked of each model. Absent on a run
   * from before this existed, which asked once. */
  repetitions?: number | undefined;
  answersRequested: number;
  answersCompleted: number;
  answersFailed: number;
  startedAt: string;
  completedAt: string | null;
  /** Models left out because the catalogue says they cannot answer a single
   * request. A saved configuration ages; the catalogue is the live truth. */
  skippedModels?: Array<{ modelId: string; reason: string }> | undefined;
  /** What the run is doing right now, so a long run is legible while it runs. */
  currentPromptText?: string | undefined;
  currentModelId?: string | undefined;
}

/** True when this answer can contribute to a visibility figure. */
export function countsTowardVisibility(answer: PromptAnswer): boolean {
  return answer.status === "completed";
}

/** Work the run got through, as opposed to work that measured something. A
 * surface with no answer finished; it just has nothing to contribute. */
export function countsTowardProgress(answer: PromptAnswer): boolean {
  return answer.status === "completed" || answer.status === "no_answer";
}
