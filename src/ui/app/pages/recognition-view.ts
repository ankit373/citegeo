import { html } from "../dom.js";
import { button } from "../components/button.js";
import { evidenceJump } from "../components/badges.js";
import type {
  AnswerMentionedUrl, BrandKeywordRecognition, CompetitorKeywordRecognition, CompetitorRecognition, ProviderCitation,
  RecognitionAnalysisRevision, RecognitionModelRun, RecognitionModelRunAttempt, RecognitionModelRunPresentation,
  RecognitionResult, RecognitionRun,
  AnswerEvidenceLocation, RecognitionFieldIssue,
} from "../../../product/recognition/recognition-schema.js";
import { recognitionCountLabels, recognitionModelStatusText, recognitionUrlLabel, type RecognitionCounts } from "../labels.js";

// Only the fields this page reads, picked from the schema the server writes.
export type RecognitionArchive = {
  result: Pick<RecognitionResult, "id" | "domainRecognition" | "recognizedBrand" | "businessDescription" | "productCategory" | "detailedDescription" | "fieldIssues">;
  competitors: Array<Pick<CompetitorRecognition, "id" | "name" | "evidence" | "businessDescription" | "productCategory">>;
  brandKeywords: Array<Pick<BrandKeywordRecognition, "id" | "keyword" | "evidence">>;
  competitorKeywords: Array<Pick<CompetitorKeywordRecognition, "id" | "keyword" | "competitorRecognitionId" | "evidence">>;
  providerCitations: Array<Pick<ProviderCitation, "url" | "title">>;
  answerMentionedUrls: Array<Pick<AnswerMentionedUrl, "url">>;
};

export type RecognitionModelDetail = {
  archive?: RecognitionArchive | null | undefined;
  attempts: Array<Pick<RecognitionModelRunAttempt, "id" | "attemptNumber" | "status" | "errorMessage" | "rawAnswer">>;
  analysisRevisions?: Array<Pick<RecognitionAnalysisRevision, "status">> | undefined;
  presentation: Pick<RecognitionModelRunPresentation, "requestExecution" | "localAnalysis" | "primaryAction" | "statusLabel" | "detail">;
};

export type RecognitionModelRunView = Pick<RecognitionModelRun, "id" | "status" | "recognitionMode" | "errorMessage"> & {
  modelSnapshot: Pick<RecognitionModelRun["modelSnapshot"], "displayName" | "modelId">;
};

export type RecognitionRunDetail = {
  run: Pick<RecognitionRun, "id" | "status">;
  modelRuns: RecognitionModelRunView[];
};

interface EvidenceRow { id: string; start: number; end: number }

export function recognitionLink(url: string, label: string): string {
  return '<a href="' + html(url) + '" target="_blank" rel="noreferrer">' + html(label) + '</a>';
}

export function recognitionEvidenceRows(archive: RecognitionArchive): EvidenceRow[] {
  const rows: EvidenceRow[] = [];
  const add = (id: string, evidence: AnswerEvidenceLocation | null | undefined) => {
    if (evidence && typeof evidence.start === "number" && typeof evidence.end === "number") rows.push({ id, start: evidence.start, end: evidence.end });
  };
  add(archive.result.id + "-brand", archive.result.recognizedBrand.evidence);
  add(archive.result.id + "-business", archive.result.businessDescription.evidence);
  add(archive.result.id + "-detail", archive.result.detailedDescription?.evidence);
  add(archive.result.id + "-category", archive.result.productCategory.evidence);
  for (const competitor of archive.competitors) {
    add(competitor.id, competitor.evidence);
    add(competitor.id + "-business", competitor.businessDescription.evidence);
    add(competitor.id + "-category", competitor.productCategory.evidence);
  }
  for (const keyword of archive.brandKeywords) add(keyword.id, keyword.evidence);
  for (const keyword of archive.competitorKeywords) add(keyword.id, keyword.evidence);
  return rows;
}

export function evidenceValue(value: string | null | undefined, id: string): string {
  return value ? html(value) + evidenceJump(id) : '<span class="state-flag">Unconfirmed</span>';
}

export function recognitionIssue(archive: RecognitionArchive, field: string): RecognitionFieldIssue | null {
  return (archive.result.fieldIssues || []).find((item) => item.field === field) || null;
}

export function recognitionMissingText(archive: RecognitionArchive, field: string, emptyText: string, missingText: string): string {
  const issue = recognitionIssue(archive, field);
  return issue && issue.kind === "missing_field" ? '<span class="state-flag">' + html(missingText) + '</span>' : html(emptyText);
}

export function highlightedRawAnswer(answer: string, rows: EvidenceRow[]): string {
  const sorted = rows.slice().sort((left, right) => left.start - right.start || left.end - right.end);
  const parts: string[] = [];
  let cursor = 0;
  for (const row of sorted) {
    if (row.start < cursor || row.end <= row.start || row.end > answer.length) continue;
    parts.push(html(answer.slice(cursor, row.start)));
    parts.push('<mark id="' + html(row.id) + '">' + html(answer.slice(row.start, row.end)) + '</mark>');
    cursor = row.end;
  }
  parts.push(html(answer.slice(cursor)));
  return parts.join("");
}

export function renderRecognitionEvidence(detail: RecognitionModelDetail, modelRun: RecognitionModelRunView): string {
  const archive = detail.archive;
  const attempts = detail.attempts || [];
  const latest = attempts.length ? attempts[attempts.length - 1] : null;
  const providerCitations = archive && archive.providerCitations.length
    ? '<ul>' + archive.providerCitations.map((item) => '<li>' + recognitionLink(item.url, item.title || recognitionUrlLabel(item.url)) + '</li>').join("") + '</ul>'
    : '<p class="subtle">' + (modelRun.recognitionMode === "unaided_domain_recognition" ? "Provider-native web search was not used in this run." : "This model returned no provider citations in this run.") + '</p>';
  const answerUrls = archive && archive.answerMentionedUrls.length
    ? '<ul>' + archive.answerMentionedUrls.map((item) => '<li>' + recognitionLink(item.url, recognitionUrlLabel(item.url)) + '</li>').join("") + '</ul>'
    : '<p class="subtle">The answer body has no URLs outside the confirmed citations.</p>';
  const history = attempts.length
    ? attempts.map((item) => '<div class="attempt-row"><strong>Attempt ' + item.attemptNumber + ' · ' + html(recognitionModelStatusText(item.status)) + '</strong>' + (item.errorMessage ? '<span>' + html(item.errorMessage) + '</span>' : '') + '</div>').join("")
    : '<p class="subtle">No attempt records created yet.</p>';
  const revisions = detail.analysisRevisions && detail.analysisRevisions.length
    ? '<ul>' + detail.analysisRevisions.map((revision, index) => '<li>Local parse version ' + (index + 1) + ' · ' + (revision.status === "complete" ? "Parsed" : revision.status === "partial" ? "Partly available" : "Parsing failed") + ' · No model was called</li>').join("") + '</ul>'
    : '<p class="subtle">No new local parse has been created yet.</p>';
  const raw = latest && latest.rawAnswer
    ? '<pre class="raw-answer">' + highlightedRawAnswer(latest.rawAnswer, archive ? recognitionEvidenceRows(archive) : []) + '</pre>'
    : '<p class="subtle">This model has not returned a raw answer to show yet.</p>';
  return '<details class="evidence-details"><summary>View raw answer and evidence</summary>'
    + '<div class="evidence-group"><h4>Provider Citation</h4>' + providerCitations + '</div>'
    + '<div class="evidence-group"><h4>Plain URLs in the answer</h4>' + answerUrls + '</div>'
    + '<div class="evidence-group"><h4>Raw answer</h4>' + raw + '</div>'
    + '<div class="evidence-group"><h4>Attempt records</h4>' + history + '</div>'
    + '<div class="evidence-group"><h4>Local parse version</h4>' + revisions + '</div></details>';
}

export function renderRecognitionSummary(detail: RecognitionModelDetail): string {
  const archive = detail.archive;
  if (!archive) return '';
  const noField = "This answer did not provide this field";
  const competitors = archive.competitors.length
    ? archive.competitors.map((item) => evidenceValue(item.name, item.id)).join(", ")
    : recognitionMissingText(archive, "competitors", "This answer listed no competitors", noField);
  const keywords = archive.brandKeywords.length
    ? archive.brandKeywords.map((item) => evidenceValue(item.keyword, item.id)).join(", ")
    : recognitionMissingText(archive, "brandKeywords", "This answer listed no associated keywords", noField);
  const competitorKeywords = archive.competitors.length
    ? archive.competitors.map((item) => {
      const values = archive.competitorKeywords.filter((keyword) => keyword.competitorRecognitionId === item.id).map((keyword) => evidenceValue(keyword.keyword, keyword.id));
      return html(item.name) + ": " + (values.length ? values.join(", ") : noField);
    }).join("; ")
    : recognitionMissingText(archive, "competitors", "This answer listed no competitors", noField);
  const domainRecognition = archive.result.domainRecognition === null
    ? recognitionMissingText(archive, "domainRecognition", "This field does not match the required format", "This answer did not clearly return a recognition status")
    : archive.result.domainRecognition === "recognized" ? '<span class="state-ok">Model explicitly recognized it</span>'
    : archive.result.domainRecognition === "not_recognized" ? '<span class="state-bad">Model explicitly did not recognize it</span>'
    : '<span class="state-flag">Model said it could not confirm</span>';
  const detailDescription = archive.result.detailedDescription?.value;
  const detailText = detailDescription ? evidenceValue(detailDescription, archive.result.id + "-detail") : '<span class="state-flag">This answer gave no detailed description</span>';
  const issues = archive.result.fieldIssues && archive.result.fieldIssues.length
    ? '<details class="technical-details"><summary>Field parsing notes</summary><ul class="protocol-list">' + archive.result.fieldIssues.map((item) => '<li>' + html(item.field + " · " + item.kind + " · " + item.detail) + '</li>').join("") + '</ul></details>'
    : "";
  return '<div class="recognition-summary">'
    + '<div><span>Brand the model recognized in this run</span><strong>' + evidenceValue(archive.result.recognizedBrand.value, archive.result.id + "-brand") + '</strong></div>'
    + '<div><span>Recognition status</span><strong>' + domainRecognition + '</strong></div>'
    + '<div><span>Business description</span><strong>' + evidenceValue(archive.result.businessDescription.value, archive.result.id + "-business") + '</strong></div>'
    + '<div><span>Detailed description</span><strong>' + detailText + '</strong></div>'
    + '<div><span>Product category</span><strong>' + evidenceValue(archive.result.productCategory.value, archive.result.id + "-category") + '</strong></div>'
    + '<div><span>Recognized competitors</span><strong>' + competitors + '</strong></div>'
    + '<div><span>Associated keywords</span><strong>' + keywords + '</strong></div>'
    + '<div><span>Keywords per competitor</span><strong>' + competitorKeywords + '</strong></div></div>' + issues;
}

export function recognitionRunCounts(detail: RecognitionRunDetail, modelDetails: Record<string, RecognitionModelDetail | undefined>): RecognitionCounts {
  const summary = { received: 0, complete: 0, partial: 0, analysisFailed: 0, requestLimited: 0, running: 0 };
  for (const modelRun of detail.modelRuns) {
    const presentation = modelDetails[modelRun.id]?.presentation;
    if (!presentation) {
      if (modelRun.status === "queued" || modelRun.status === "running") summary.running += 1;
      continue;
    }
    if (presentation.requestExecution === "response_received") summary.received += 1;
    if (presentation.localAnalysis === "complete") summary.complete += 1;
    else if (presentation.localAnalysis === "partial") summary.partial += 1;
    else if (presentation.localAnalysis === "failed") summary.analysisFailed += 1;
    if (presentation.requestExecution === "request_rejected" || presentation.requestExecution === "transport_failed") summary.requestLimited += 1;
    if (presentation.requestExecution === "running" || presentation.requestExecution === "not_started") summary.running += 1;
  }
  return summary;
}

export function recognitionRunSummary(detail: RecognitionRunDetail, modelDetails: Record<string, RecognitionModelDetail | undefined>): string {
  return recognitionCountLabels(recognitionRunCounts(detail, modelDetails)).map((entry) => entry[0] + " " + entry[1]).join(" · ");
}

export function recognitionCountStrip(detail: RecognitionRunDetail, modelDetails: Record<string, RecognitionModelDetail | undefined>): string {
  return '<div class="countstrip">'
    + recognitionCountLabels(recognitionRunCounts(detail, modelDetails)).map((entry) => '<span class="count' + (entry[1] ? "" : " is-zero") + '"><strong>' + entry[1] + '</strong>' + html(entry[0]) + '</span>').join("")
    + '</div>';
}

export function renderRecognitionModel(modelRun: RecognitionModelRunView, detail: RecognitionModelDetail | null): string {
  const latest = detail && detail.attempts.length ? detail.attempts[detail.attempts.length - 1] : null;
  const presentation = detail ? detail.presentation : null;
  // Delivery, not recognition outcome. The report shows the other axis.
  const mode = modelRun.recognitionMode === "native_web_domain_discovery" ? "Provider Native web findings" : "Offline domain recognition";
  const visibleStatus = "Answer: " + (presentation ? presentation.statusLabel : recognitionModelStatusText(modelRun.status));
  const tagClass = presentation && presentation.localAnalysis === "complete" ? "ready"
    : presentation && (presentation.requestExecution === "response_received" || presentation.requestExecution === "running") ? "warning"
    : modelRun.status === "completed" || modelRun.status === "unknown" ? "ready" : "deleted";
  const reanalyzeAction = presentation && presentation.primaryAction === "reanalyze_saved_answer" && latest
    ? button({ label: "Re-analyze existing answer", kind: "quiet", on: { "data-recognition-reanalyze": modelRun.id, "data-recognition-attempt": latest.id } }) : '';
  const retryAction = presentation && presentation.primaryAction === "retry_request"
    ? button({ label: "Retry this model", kind: "quiet", on: { "data-recognition-retry": modelRun.id } }) : '';
  const configurationAction = presentation && presentation.primaryAction === "check_model_configuration"
    ? button({ label: "Check model configuration", kind: "quiet", on: { "data-page": "models" } }) : '';
  const settingsAction = presentation && presentation.primaryAction === "open_provider_settings"
    ? '<a class="card-action" href="https://openrouter.ai/settings/preferences" target="_blank" rel="noreferrer">Open OpenRouter settings</a>' : '';
  const detailText = presentation && presentation.detail ? '<p class="subtle model-run-detail">' + html(presentation.detail) + '</p>' : '';
  const technicalError = modelRun.errorMessage ? '<details class="technical-details"><summary>Technical details</summary><p>' + html(modelRun.errorMessage) + '</p></details>' : '';
  return '<article class="model-run-card ' + html(modelRun.status) + '" data-testid="recognition-model-run"><div class="model-run-head"><div><h3>' + html(modelRun.modelSnapshot.displayName) + '</h3><p class="subtle">' + html(modelRun.modelSnapshot.modelId) + ' · ' + html(mode) + '</p></div>'
    + '<div class="inline-actions"><span class="tag ' + tagClass + '">' + html(visibleStatus) + '</span>' + reanalyzeAction + retryAction + configurationAction + settingsAction + '</div></div>'
    + detailText
    + (detail ? renderRecognitionSummary(detail) + renderRecognitionEvidence(detail, modelRun) : '<p class="subtle">Loading this model\'s archived result.</p>')
    + technicalError + '</article>';
}
