// The words and tone classes the interface uses for a state, in one place.

export interface RecognitionCounts {
  received: number;
  complete: number;
  partial: number;
  analysisFailed: number;
  requestLimited: number;
  running: number;
}

export function intentLabel(intent: string): string {
  return intent === "discovery" ? "Discovery" : intent === "comparison" ? "Comparison" : intent === "alternatives" ? "Alternatives" : intent === "brand" ? "Brand" : "Problem";
}

export function kindWords(kind: string): string {
  const words: Record<string, string> = {
    listicle: "Ranked best-of", comparison: "Head to head", guide: "Guide or how-to",
    documentation: "Documentation", review: "Review", forum: "Forum or community",
    video: "Video", reference: "Reference work", article: "Article",
    yours: "Your own site", rival: "A tracked rival", social: "Social", community: "Community",
    corporate: "A company's own site",
  };
  return words[kind] || kind;
}

export function historyWord(verdict: string | null): string {
  if (verdict === "cited") return '<span class="state-ok">still cited</span>';
  if (verdict === "slipping") return '<span class="state-flag">missed one run</span>';
  if (verdict === "dropped") return '<span class="state-bad">stopped</span>';
  if (verdict === "cited_once") return '<span class="state-flag">cited once, never again</span>';
  return '<span class="state-flag">one run only</span>';
}

export function urgencyLabel(urgency: string): string {
  return urgency === "blocking" ? "blocking" : urgency === "limiting" ? "limiting" : "to do";
}

export function urgencyInk(urgency: string): string {
  return urgency === "blocking" ? "state-bad" : urgency === "limiting" ? "state-flag" : "state-ok";
}

export function reachInk(reach: string): string {
  return reach === "drivable" ? "state-ok" : reach === "sign_in" ? "state-flag" : "state-bad";
}

export function reachWords(reach: string): string {
  return reach === "drivable" ? "Can be driven"
    : reach === "sign_in" ? "Asking to sign in"
      : reach === "blocked" ? "Sent elsewhere"
        : "Nothing to drive";
}

export function effectLabel(effect: string): string {
  return effect === "raises_visibility" ? "Raises the score"
    : effect === "unblocks_measurement" ? "Unblocks measurement"
    : "Widens what is measured";
}

export function alertPill(severity: string): string {
  return severity === "critical" ? "bad" : severity === "warning" ? "flat" : "flat";
}

export function recognitionRunStatusText(status: string): string {
  return status === "queued" ? "Waiting to start"
    : status === "running" ? "Running"
    : status === "completed" ? "Completed"
    : status === "partial" ? "Partly complete"
    : "Execution failed";
}

export function recognitionModelStatusText(status: string): string {
  return status === "queued" ? "Waiting to start"
    : status === "running" ? "Calling"
    : status === "response_saved" ? "Answer received"
    : status === "analysis_failed" ? "Local parse failed"
    : status === "completed" ? "Completed"
    : status === "unknown" ? "Model could not confirm"
    : status === "unsupported" ? "Model does not support it"
    : "Provider Call failed";
}

export function recognitionUrlLabel(url: string): string {
  try { const parsed = new URL(url); return parsed.hostname + parsed.pathname + parsed.search; } catch { return url; }
}

export function recognitionCountLabels(summary: RecognitionCounts): Array<[string, number]> {
  return [
    ["Answer received", summary.received],
    ["Fully parsed", summary.complete],
    ["Partly available", summary.partial],
    ["Parsing failed", summary.analysisFailed],
    ["Request throttled or failed", summary.requestLimited],
    ["Still running", summary.running],
  ];
}
