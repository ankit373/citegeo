import type {
  RecognitionAnalysisRevision,
  RecognitionArchive,
  RecognitionModelRun,
  RecognitionModelRunAttempt,
  RecognitionModelRunPresentation,
} from "./recognition-schema.js";

type ObjectValue = Record<string, unknown>;

function asObject(value: unknown): ObjectValue | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ObjectValue : null;
}

function finishReason(value: unknown): string | null {
  const root = asObject(value);
  const choices = root && Array.isArray(root.choices) ? root.choices : [];
  const firstChoice = choices.length ? asObject(choices[0]) : null;
  const reason = firstChoice?.finish_reason;
  return typeof reason === "string" && reason.trim() ? reason : null;
}

function httpStatus(message: string | undefined): number | null {
  if (!message) return null;
  const marker = "HTTP ";
  const start = message.indexOf(marker);
  if (start === -1) return null;
  const digits = message.slice(start + marker.length, start + marker.length + 3);
  const parsed = Number(digits);
  return Number.isInteger(parsed) ? parsed : null;
}

function batchOnly(message: string | undefined): boolean {
  return Boolean(message) && message!.toLocaleLowerCase().includes("batch api");
}

function mentionsConfirmation(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLocaleLowerCase();
  return lower.includes("confirmation") || lower.includes("age");
}

function responseCompleteness(attempt: RecognitionModelRunAttempt | undefined): RecognitionModelRunPresentation["responseCompleteness"] {
  if (!attempt) return "unavailable";
  if (attempt.rawAnswer === undefined) return attempt.status === "response_saved" ? "empty" : "unavailable";
  if (!attempt.rawAnswer.trim()) return "empty";
  if (finishReason(attempt.rawProviderResponse) === "length") return "incomplete";
  return "complete";
}

function localAnalysis(revision: RecognitionAnalysisRevision | undefined, archive: RecognitionArchive | undefined): RecognitionModelRunPresentation["localAnalysis"] {
  if (revision) return revision.status;
  if (!archive) return "not_started";
  if (archive.result.analysisStatus === "analysis_failed") return "failed";
  return archive.result.fieldIssues?.length ? "partial" : "complete";
}

function statusCopy(input: {
  modelRun: RecognitionModelRun;
  attempt: RecognitionModelRunAttempt | undefined;
  response: RecognitionModelRunPresentation["responseCompleteness"];
  local: RecognitionModelRunPresentation["localAnalysis"];
}): Pick<RecognitionModelRunPresentation, "statusLabel" | "detail" | "primaryAction"> {
  const message = input.modelRun.errorMessage || input.attempt?.errorMessage;
  const status = httpStatus(message);
  // A paid model with no credit reported as a generic provider failure, which
  // gave no hint that the account, not the model, was the problem.
  if (status === 402) return {
    statusLabel: "This provider account has no credit for this model",
    detail: "Every paid model answers HTTP 402 until the account is funded. Models ending in :free and any local gateway model still run. Setup shows the balance.",
    primaryAction: "open_provider_settings",
  };
  if (batchOnly(message)) return {
    statusLabel: "This model is only served through the provider's batch API",
    detail: "It cannot answer a single request, whatever the configuration. Remove it from the configuration and pick a non-batch variant.",
    primaryAction: "check_model_configuration",
  };
  if (status === 404) return {
    statusLabel: "No endpoint is available for the current model and the selected request configuration",
    detail: "No provider serving this model accepts the requested parameters. Native web search is the usual cause, so set this model's web search mode to Offline and request again.",
    primaryAction: "check_model_configuration",
  };
  if (status === 403 && mentionsConfirmation(input.modelRun.errorMessage || input.attempt?.errorMessage)) return {
    statusLabel: "The OpenRouter account must accept the usage terms first",
    detail: "Once the account setup is complete, you can start a new request yourself.",
    primaryAction: "open_provider_settings",
  };
  if (input.modelRun.status === "queued") return { statusLabel: "Waiting to start", detail: null, primaryAction: "none" };
  if (input.modelRun.status === "running") return { statusLabel: "Calling the model", detail: null, primaryAction: "none" };
  if (input.response === "incomplete") return {
    statusLabel: "Incomplete answer: the output hit the length limit",
    detail: "The raw content received is stored. It is never completed or used to draw recognition conclusions.",
    primaryAction: "none",
  };
  if (input.response === "empty") return { statusLabel: "The model returned no usable answer", detail: null, primaryAction: "retry_request" };
  if (input.response === "unavailable" && input.modelRun.status === "unsupported") return { statusLabel: "The current model does not support this request configuration", detail: null, primaryAction: "check_model_configuration" };
  if (input.response === "unavailable" && input.modelRun.status === "failed") return { statusLabel: "Provider Call failed", detail: null, primaryAction: "retry_request" };
  if (input.local === "failed") return {
    statusLabel: "Answer received, local parsing failed",
    detail: "Can be re-parsed from the saved raw answer alone. No model is called again.",
    primaryAction: "reanalyze_saved_answer",
  };
  if (input.local === "partial") return {
    statusLabel: "Answer received, partly usable",
    detail: "Missing or malformed fields are explicitly left empty and never inferred.",
    primaryAction: "none",
  };
  if (input.local === "complete") return { statusLabel: "Answer received and parsed", detail: null, primaryAction: "none" };
  return { statusLabel: "The answer status cannot be confirmed yet", detail: null, primaryAction: "none" };
}

export function buildRecognitionModelRunPresentation(input: {
  modelRun: RecognitionModelRun;
  attempts: RecognitionModelRunAttempt[];
  archive?: RecognitionArchive | undefined;
  currentAnalysis?: RecognitionAnalysisRevision | undefined;
}): RecognitionModelRunPresentation {
  const attempt = input.attempts.length ? input.attempts[input.attempts.length - 1] : undefined;
  const response = responseCompleteness(attempt);
  const local = localAnalysis(input.currentAnalysis, input.archive);
  const copy = statusCopy({ modelRun: input.modelRun, attempt, response, local });
  const activeArchive = input.currentAnalysis?.archive || input.archive;
  return {
    requestExecution: input.modelRun.status === "queued" ? "not_started"
      : input.modelRun.status === "running" ? "running"
        : attempt?.rawAnswer !== undefined ? "response_received"
          : httpStatus(input.modelRun.errorMessage || attempt?.errorMessage) ? "request_rejected"
            : "transport_failed",
    responseCompleteness: response,
    localAnalysis: local,
    domainRecognition: activeArchive?.result.domainRecognition || null,
    primaryAction: copy.primaryAction,
    statusLabel: copy.statusLabel,
    detail: copy.detail,
  };
}
