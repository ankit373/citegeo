import type { AnswerSourceId, ProductProviderId } from "../configuration/provider-id.js";
import type { DiscoveryRecommendation, FirstPositionState } from "../measurements/measurement-schema.js";
import type { PromptIntent } from "./topic-schema.js";

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
export type PromptAnswerStatus = "completed" | "provider_failed" | "analysis_failed";

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
  /** The market stated to the model. "global" means none was. */
  regionId: string;
  /** The language the answer was asked for. */
  languageId: string;
  status: PromptAnswerStatus;
  /** The answer as the model wrote it. Every number here traces back to this. */
  text: string;
  mentions: AnswerMention[];
  /** Provider-native citation URLs from this response only. */
  citationUrls: string[];
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
