import { html } from "../dom.js";
import { button } from "../components/button.js";
import { remaining } from "../format.js";
import type { AnswerRow, Panel, RunRow } from "../types.js";

export function renderLiveRun(run: RunRow | null): string {
  if (!run) return "";
  const done = run.answersCompleted + run.answersFailed;
  const pctDone = run.answersRequested ? Math.round(done / run.answersRequested * 100) : 0;
  const since = Date.parse(run.startedAt || "");
  // Until one answer lands there is no rate to read, so the run says it is
  // still working that out rather than printing a number nothing supports.
  const left = run.status === "cancelling" || !since ? null : remaining(done, run.answersRequested, Date.now() - since);
  const eta = run.status === "cancelling" ? "" : (left || (done ? "" : "working out how long this takes"));
  const doing = run.currentPromptText
    ? 'Asking ' + html(run.currentModelId || "a model") + ': “' + html(run.currentPromptText) + '”'
    : "Starting up";
  return '<div class="liverun is-clickable" data-open-run="' + html(run.id) + '" role="button" tabindex="0"><div class="liverun-top"><strong>' + (run.status === "cancelling" ? "Stopping" : "Running") + '</strong>'
    + '<span>' + done + ' of ' + run.answersRequested + ' answers</span>'
    + (eta ? '<span class="subtle">' + html(eta) + '</span>' : '')
    + '<span class="spacer"></span>'
    + (run.status === "cancelling"
      ? '<span class="subtle">Finishing the answer in flight.</span>'
      : button({ label: "Stop", tone: "danger", on: { "data-stop-run": true } }))
    + '</div><div class="bar is-live"><i style="width:' + pctDone + '%"></i></div>'
    + '<p class="subtle">' + doing + '. Open this to watch each question and answer as it lands.</p></div>';
}

export function paneRun(panel: Panel | null, liveRun: RunRow | null, lastRun: RunRow | null): RunRow | null {
  if (!panel || panel.kind !== "run") return null;
  if (liveRun && liveRun.id === panel.runId) return liveRun;
  return lastRun && lastRun.id === panel.runId ? lastRun : null;
}

export function runIsLive(run: RunRow | null): boolean {
  return Boolean(run && (run.status === "running" || run.status === "cancelling"));
}

export function runPaneProgress(run: RunRow | null): string {
  if (!run) return '<span class="subtle">Every answer below is archived.</span>';
  if (run.status !== "running" && run.status !== "cancelling") {
    return '<span>' + html(run.status) + ' · ' + run.answersCompleted + ' answered, ' + run.answersFailed + ' failed, of ' + run.answersRequested + ' asked</span>';
  }
  const done = run.answersCompleted + run.answersFailed;
  const share = run.answersRequested ? Math.round(done / run.answersRequested * 100) : 0;
  const since = Date.parse(run.startedAt || "");
  const left = run.status === "cancelling" || !since ? null : remaining(done, run.answersRequested, Date.now() - since);
  return '<span>' + done + ' of ' + run.answersRequested + ' answers · ' + run.answersFailed + ' failed' + (left ? ' · ' + html(left) : '') + '</span>'
    + '<div class="bar is-live"><i style="width:' + share + '%"></i></div>';
}

export function mentionChips(answer: AnswerRow): string {
  const rows = (answer.mentions || []).slice().sort((left, right) => (left.firstMentionOffset === null ? 1 : 0) - (right.firstMentionOffset === null ? 1 : 0) || (left.firstMentionOffset || 0) - (right.firstMentionOffset || 0));
  if (!rows.length) return '<span class="subtle">No organisation was named.</span>';
  return rows.map((row, index) => '<span class="namechip' + (row.isTarget ? ' is-you' : '') + '">'
    + '<b>' + (index + 1) + '</b>' + html(row.name)
    + (row.recommendation && row.recommendation !== "unknown" ? ' <i>' + html(row.recommendation) + '</i>' : '')
    + '</span>').join("");
}
