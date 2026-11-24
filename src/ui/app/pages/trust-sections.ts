import { html } from "../dom.js";
import { sharePct } from "../format.js";
import { taskCta } from "./task-views.js";
import type { MeasurementTask } from "../../../product/topics/next-task.js";
import type { StabilityReport } from "../../../product/topics/answer-stability.js";

/** A section that opens and shuts, keyed by its id. Passed in because the open set lives in the app state. */
export type FoldCard = (id: string, title: string, blurb: string, body: string, aside?: string) => string;

export function renderStability(report: StabilityReport | null | undefined, tasks: MeasurementTask[], fold: FoldCard): string {
  if (!report) return '';
  if (!report.measured) {
    return fold("trust-stability", "How much the answer moves",
      "Every question here was asked once, so nothing can be said about how much of an answer is the question and how much is the day.",
      taskCta(tasks, "asked-once"));
  }
  // The overlap is a mean over the questions that cited anything, and most
  // of these cited nothing. Printing it against the larger number claims a
  // reading of questions there was nothing to read.
  const overall = report.sourceOverlap === null
    ? 'No pair of passes cited a source between them, so there is no overlap to take.'
    : 'Across the ' + report.withSources + ' of ' + report.measured + ' question(s) asked more than once that cited anything, '
      + sharePct(report.sourceOverlap) + ' of the cited sources survived from one pass to the next.';
  // Never naming you and always naming you are both agreement. Only one of
  // them is good news, and reporting them as one printed your absence as
  // a reassurance about the measurement.
  const naming = report.namingUnstable
    ? report.namingUnstable + ' question(s) named you on one pass and not on another, which means a single pass would have reported either answer.'
    : report.alwaysNamed === 0
      ? 'No pass of any of them named you, so they agree on an absence rather than on a reading.'
      : report.neverNamed === 0
        ? 'Every pass of every question named you.'
        : report.alwaysNamed + ' question(s) named you on every pass and ' + report.neverNamed + ' named you on none. Each agrees with itself.';
  const rows = report.questions.slice(0, 8).map((row) =>
    '<div class="mrow mcols-stability"><div class="mname"><strong>' + html(row.promptText) + '</strong>'
    + '<span class="mono">' + html(row.modelId) + ' · ' + row.passes + ' passes</span></div>'
    + '<span class="mcell ' + (row.naming === "always" ? "state-ok" : row.naming === "split" ? "state-bad" : "subtle") + '">'
    + (row.naming === "always" ? "Every pass" : row.naming === "split" ? row.named + ' of ' + row.passes : "No pass") + '</span>'
    + '<span class="mcell">' + row.sourcesAlways + ' of ' + row.sourcesEver + '</span>'
    + '<span class="mcell">' + (row.sourceOverlap === null ? 'No sources' : sharePct(row.sourceOverlap)) + '</span>'
    + '<span class="mcell subtle">' + (row.spanHours === null ? 'Unknown span' : row.spanHours < 1 ? 'Minutes apart' : row.spanHours < 48 ? Math.round(row.spanHours) + 'h apart' : Math.round(row.spanHours / 24) + 'd apart') + '</span></div>').join("");
  return fold("trust-stability", "How much the answer moves", report.caveat, ''
    + '<p>' + overall + ' ' + naming + '</p>'
    + '<div class="mtable"><div class="mhead mcols-stability"><span>Question</span><span>Named you</span><span>Sources every pass</span><span>Overlap</span><span>Span</span></div>'
    + rows + '</div>'
    + (taskCta(tasks, "naming-unstable") || taskCta(tasks, "sources-turn-over") || taskCta(tasks, "asked-once")));
}