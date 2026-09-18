import type { AuditMetrics, AuditRun, GeoGapAnalysis } from "../core/types.js";

export interface ReportQualityResult {
  ok: boolean;
  errors: string[];
}

function requiredSections(): string[] {
  return [
    "## Summary",
    "## How AI Sees You",
    "## Who Competes With You",
    "## Competitive Differences",
    "## Sources",
  ];
}

function forbiddenTerms(): string[] {
  return [
    "Mention Rate",
    "Citation Rate",
    "Recommendation Rate",
    "Share of Voice",
    "SOV",
    "Average Rank",
    "Prompt Wins",
    "Token Usage",
    "API Cost",
    "Cost:",
    "Latency",
    "Prompt ID",
    "Run ID",
    "Raw JSON",
    "Provider Annotation",
    "Citation Slice",
    "Prompt Matrix",
    "Metric Formulas",
    "Scorecard",
    "Technical Evidence",
  ];
}

function firstParagraphAfter(markdown: string, heading: string): string {
  const start = markdown.indexOf(heading);
  if (start < 0) return "";
  const rest = markdown.slice(start + heading.length);
  const lines = rest.split("\n");
  for (const line of lines) {
    const text = line.trim();
    if (!text || text.startsWith("|") || text.startsWith("---")) continue;
    return text;
  }
  return "";
}

function removeDetailsBlocks(markdown: string): string {
  let output = "";
  let cursor = 0;
  while (cursor < markdown.length) {
    const open = markdown.indexOf("<details>", cursor);
    if (open < 0) {
      output += markdown.slice(cursor);
      break;
    }
    output += markdown.slice(cursor, open);
    const close = markdown.indexOf("</details>", open);
    if (close < 0) break;
    cursor = close + "</details>".length;
  }
  return output;
}

export function validateReport(markdown: string, audit: AuditRun, metrics: AuditMetrics, gaps?: GeoGapAnalysis): ReportQualityResult {
  void gaps;
  const errors: string[] = [];
  for (const section of requiredSections()) {
    if (!markdown.includes(section)) errors.push(`Missing user-facing report section: ${section}`);
  }
  const lower = markdown.toLowerCase();
  if (lower.includes("mock")) {
    errors.push("Report contains forbidden mock wording.");
  }
  const answerMarker = "<summary>View Actual AI Answers</summary>";
  const answerIndex = markdown.indexOf(answerMarker);
  const mainSurface = answerIndex >= 0 ? markdown.slice(0, answerIndex) : markdown;
  const visibleMainSurface = removeDetailsBlocks(mainSurface);
  for (const term of forbiddenTerms()) {
    if (visibleMainSurface.includes(term)) errors.push(`Report contains forbidden technical report term: ${term}`);
  }
  const hasAnswerEvidence = markdown.includes("Actual AI answer");
  if (!hasAnswerEvidence) {
    errors.push("Report lacks actual AI answers.");
  }
  const hasSourceCaveat = markdown.includes("Data source: the AI provider APIs selected for this run");
  if (!hasSourceCaveat) {
    errors.push("Report lacks API-source caveat.");
  }
  if (metrics.validResponses === 0) {
    errors.push("Report has no completed provider responses.");
  }
  return { ok: errors.length === 0, errors };
}
