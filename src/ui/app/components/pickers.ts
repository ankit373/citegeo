import { html } from "../dom.js";
import type { Notice } from "../types.js";

// Asking twice is the only way to see how much of an answer is the day
// rather than the question, and every extra pass is another paid call.
export function repetitionPicker(repetitions: number): string {
  const options = [1, 2, 3, 5].map((value) =>
    '<option value="' + value + '"' + (repetitions === value ? ' selected' : '') + '>'
    + (value === 1 ? 'Ask once' : 'Ask ' + value + ' times') + '</option>').join("");
  return '<select class="filter" data-repetitions aria-label="How many times to ask each question">' + options + '</select>';
}

// The same question in another language is a different question to a model,
// and until this existed there was no way to ask one from here at all.
export function languagePicker(languages: Array<{ id: string; label: string }> | null | undefined, selectedId: string): string {
  const rows = languages || [];
  if (rows.length < 2) return '';
  const options = rows.map((row) =>
    '<option value="' + html(row.id) + '"' + (selectedId === row.id ? ' selected' : '') + '>'
    + html(row.id === "en" ? "Answer in English" : "Answer in " + row.label) + '</option>').join("");
  return '<select class="filter" data-run-language aria-label="Which language to answer in">' + options + '</select>';
}

export function pasteCountPicker(pasteCount: number): string {
  const options = [1, 2, 3, 5, 10, 20].map((count) =>
    '<option value="' + count + '"' + (pasteCount === count ? " selected" : "") + '>' + count + ' a day</option>').join("");
  return '<label class="picker"><span class="subtle">How many</span><select data-paste-count>' + options + '</select></label>';
}

/** The log could only be named by an environment variable on the server, so
 * anyone without a shell there could not use this feature at all. */
export function crawlerUpload(uploading: boolean, notice: Notice): string {
  return '<div class="inline-actions" style="margin-top:14px">'
    + '<label class="button quiet" for="crawler-log-file">' + (uploading ? "Reading the log…" : "Upload an access log") + '</label>'
    + '</div>'
    + (notice.text ? '<p class="' + (notice.kind === "bad" ? "warning-box" : "subtle") + '">' + html(notice.text) + '</p>' : '')
    + '<p class="mlegend">A combined-format access log, or a CloudFront one with its #Fields header. It is read for crawler user agents and paths and nothing else, and the same file counted twice is counted once.</p>';
}

/** Mounted once outside the re-rendered tree, so a render cannot detach it between the pick and its change event. */
export function mountCrawlerLogInput(): void {
  const input = document.createElement("input");
  input.type = "file";
  input.id = "crawler-log-file";
  input.accept = ".log,.txt,text/plain";
  input.hidden = true;
  input.setAttribute("data-crawler-log", "");
  document.body.appendChild(input);
}
