import { html } from "../dom.js";
import { button } from "../components/button.js";
import { urgencyInk, urgencyLabel } from "../labels.js";
import type { MeasurementTask } from "../../../product/topics/next-task.js";

// One list, two places: the listing at the top of a page and the button
// on the panel that measured it both read the same task.
/** The tasks the answer-engine read carries, or none before it has arrived. */
export function answerTasks(data: { tasks?: MeasurementTask[] | null | undefined } | null | undefined): MeasurementTask[] {
  return data && Array.isArray(data.tasks) ? data.tasks : [];
}

export function taskFor(tasks: MeasurementTask[], id: string): MeasurementTask | null {
  return tasks.find((task) => task.id === id) || null;
}

/** Attached to the panel that measured it, so the action is where the
 * finding is and nobody has to scroll back to the list to act on it. */
export function taskCta(tasks: MeasurementTask[], id: string): string {
  const task = taskFor(tasks, id);
  if (!task) return '';
  return '<div class="task-cta"><span class="' + urgencyInk(task.urgency) + '">' + html(urgencyLabel(task.urgency)) + '</span>'
    + '<span><strong>' + html(task.title) + '</strong></span>'
    + button({ label: task.action, kind: task.urgency === "blocking" ? "primary" : "quiet", on: { "data-page": task.page } }) + '</div>';
}

export function taskRow(task: MeasurementTask): string {
  // Not "done": that greys the label, and work still to do is not done.
  return '<li class="step task-step" data-state="' + (task.urgency === "blocking" ? "warn" : task.urgency === "limiting" ? "next" : "work") + '">'
    + '<span class="step-index ' + urgencyInk(task.urgency) + '">' + html(urgencyLabel(task.urgency)) + '</span>'
    + '<span class="step-label"><strong>' + html(task.title) + '</strong>'
    + '<br><span class="step-why">' + html(task.why) + '</span>'
    + '<br><span class="step-note">Observed: ' + html(task.evidence) + '</span></span>'
    + '<span class="step-action">' + button({ label: task.action, kind: task.urgency === "blocking" ? "primary" : "quiet", on: { "data-page": task.page } }) + '</span></li>';
}

// Absent on an archive scored before tasks existed, which is not the same
// as a project with nothing to do, so neither is drawn for the other.
export function renderTasks(rows: MeasurementTask[], limit?: number): string {
  if (!rows.length) return '';
  const blocking = rows.filter((task) => task.urgency === "blocking").length;
  const shown = limit ? rows.slice(0, limit) : rows;
  const rest = rows.length - shown.length;
  const blurb = blocking
    ? blocking + ' of these ' + (blocking === 1 ? 'stops' : 'stop') + ' a number being produced at all. Nothing below it can be read until it is cleared.'
    : 'Ordered by what is holding the measurement back, then by what the measurement says to do.';
  return '<section class="section-card"><div class="section-head"><div class="headmain"><h2>What to do next</h2>'
    + '<p class="subtle">' + html(blurb) + '</p></div></div>'
    + '<ol class="steps">' + shown.map(taskRow).join("") + '</ol>'
    + (rest > 0 ? '<p class="mlegend">' + rest + ' more on the full report.</p>' : '') + '</section>';
}
