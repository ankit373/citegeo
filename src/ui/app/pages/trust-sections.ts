import { html } from "../dom.js";
import { button } from "../components/button.js";
import { loading, skeletonText } from "../components/skeleton.js";
import { sharePct } from "../format.js";
import { bar, experimentCard, verdictButtons } from "./metric-cells.js";
import { taskCta } from "./task-views.js";
import type { MeasurementTask } from "../../../product/topics/next-task.js";
import type { LoadState } from "../types.js";
import type { PhrasingReport } from "../../../product/topics/phrasing-sensitivity.js";
import type { DecoyReport } from "../../../product/topics/decoy-check.js";
import type { FactorShare, VarianceReport } from "../../../product/topics/variance-share.js";
import type { SentimentVolatility } from "../../../product/topics/sentiment-volatility.js";
import type { BrandTier, TierComparison } from "../../../product/topics/visibility-tier.js";
import type { VersionReport } from "../../../product/topics/model-version.js";
import type { AgreementReport } from "../../../product/topics/human-check.js";
import type { HumanCheckService } from "../../../product/topics/human-check-service.js";
import type { ExperimentReport } from "../../../product/experiments/experiment-service.js";
import type { PromptSchedule } from "../../../product/topics/prompt-schedule.js";
import type { Region } from "../../../product/topics/region.js";
import type { StabilityReport } from "../../../product/topics/answer-stability.js";

/** A section that opens and shuts, keyed by its id. Passed in because the open set lives in the app state. */
export type FoldCard = (id: string, title: string, blurb: string, body: string, aside?: string) => string;

type HumanCheckData = Awaited<ReturnType<HumanCheckService["queue"]>> & { agreement: AgreementReport };

/** The loaders these sections call while idle. Each must be a hoisted function declaration that reads live state. */
export interface TrustActions {
  loadCheck(): void;
  loadExperiments(): void;
  loadSchedule(): void;
}

const TIERS: Array<[BrandTier, string]> = [["unstated", "Not said"], ["household", "Global household name"], ["mid_market", "Mid-market or regional"], ["niche", "Niche or small"]];

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

// Repetition holds the wording and varies the day. This holds the day and
// varies the wording, so the two read together and neither alone.
export function renderPhrasing(report: PhrasingReport | null | undefined, fold: FoldCard): string {
  if (!report) return '';
  if (!report.measured) {
    return fold("trust-phrasing", "How much the wording decides",
      "Every question here is written down one way, so nothing says whether you are visible for what was asked or for the exact words it was asked in. Add a rewording to a question and the next run compares them.",
      '<div class="inline-actions">' + button({ label: "Open questions", kind: "quiet", on: { "data-page": "prompts" } }) + '</div>');
  }
  const lead = report.spread === null
    ? 'No pair of wordings produced an answer to compare.'
    : 'Across ' + report.measured + ' question(s) written more than one way, the widest gap between two wordings averages ' + sharePct(report.spread) + '.';
  const naming = report.unstable
    ? ' ' + report.unstable + ' question(s) named you under one wording and not another, so that figure is about the words rather than about you.'
    : report.alwaysNamed === 0
      ? ' No wording of any of them named you, so they agree on an absence rather than on a reading.'
      : report.neverNamed === 0
        ? ' Every wording of every question named you.'
        : ' ' + report.alwaysNamed + ' question(s) named you under every wording and ' + report.neverNamed + ' under none.';
  const named = report.namesTheBrand
    ? ' ' + report.namesTheBrand + ' wording(s) name you and are left out, because the model discusses a brand the question names whatever it thinks.'
    : '';
  const rows = report.questions.slice(0, 6).map((row) => '<div class="mrow mcols-phrasing"><div class="mname"><strong>' + html(row.rootText) + '</strong>'
    + '<span class="mono">' + html(row.modelId) + ' \u00b7 ' + row.wordings.length + ' wordings</span>'
    + row.wordings.slice(0, 4).map((wording) => '<span class="subtle">' + (wording.named ? '\u2713' : '\u2717') + ' ' + html(wording.text) + '</span>').join("")
    + '</div>'
    + '<span class="mcell ' + (row.naming === "always" ? "state-ok" : row.naming === "split" ? "state-bad" : "subtle") + '">'
    + (row.naming === "always" ? "Every wording" : row.naming === "split" ? row.namedIn + ' of ' + row.wordings.length : "No wording") + '</span>'
    + '<span class="mcell">' + (row.spread === null ? "Not measurable" : sharePct(row.spread)) + '</span></div>').join("");
  return fold("trust-phrasing", "How much the wording decides", report.caveat, ''
    + '<p>' + html(lead + naming + named) + '</p>'
    + '<div class="mtable"><div class="mhead mcols-phrasing"><span>Question and its wordings</span><span>Named you</span><span>Widest gap</span></div>'
    + rows + '</div>');
}

// The error rate every other figure here should be read against. It sits
// with the score rather than in a corner, because that is what it qualifies.
export function renderDecoys(report: DecoyReport | null | undefined, fold: FoldCard): string {
  if (!report) return '';
  if (!report.decoys.length) {
    return fold("trust-decoys", "A brand that should never appear",
      "Nothing here measures how often this product finds a name that is not there. Declare a brand you know is irrelevant to these questions and every run carries it, so the share it turns up in becomes the figure yours has to beat.",
      '<div class="inline-actions">' + button({ label: "Add a decoy", kind: "quiet", on: { "data-add-decoy": "true" } }) + '</div>');
  }
  const floor = sharePct(report.noiseFloor);
  const verdict = report.clearsFloor === null
    ? 'Nothing answered yet, so there is nothing to compare.'
    : report.clearsFloor
      ? 'Your ' + sharePct(report.presenceRate) + ' clears it.'
      : 'Your ' + sharePct(report.presenceRate) + ' does not clear it, so it has not been told apart from a name that should never have been there.';
  const add = '<div class="inline-actions" style="margin-top:12px">'
    + button({ label: "Add a decoy", kind: "quiet", on: { "data-add-decoy": "true" } }) + '</div>';
  const errors = report.matcherErrors
    ? '<div class="warning-box"><strong>' + report.matcherErrors + ' reported mention(s) of a decoy are not in the answer that was said to contain them.</strong> That is this product reading a name that is not there, not a model writing one. Every figure built on reported mentions carries that error.</div>'
    : '';
  const rows = report.decoys.map((row) => '<div class="mrow mcols-decoy"><div class="mname"><strong>' + html(row.name) + '</strong>'
    + '<span class="subtle">' + (row.absentFromText ? row.absentFromText + ' read into an answer that does not contain it' : 'never read into an answer that does not contain it') + '</span></div>'
    + '<span class="mcell">' + row.namedIn + ' of ' + report.considered + '</span>'
    + '<span class="mcell ' + (row.namedIn ? "state-flag" : "state-ok") + '">' + (row.share === null ? '\u2014' : sharePct(row.share)) + '</span>'
    + '<span class="mcell">' + (row.high === null ? '\u2014' : sharePct(row.high)) + '</span></div>').join("");
  return fold("trust-decoys", "A brand that should never appear", report.caveat, ''
    + '<p><strong>Anything under ' + floor + ' is not a finding.</strong> ' + html(verdict) + '</p>' + errors
    + '<div class="mtable"><div class="mhead mcols-decoy"><span>Decoy</span><span>Named in</span><span>Share</span><span>Consistent with up to</span></div>'
    + rows + '</div>' + add);
}

// Published work decomposing what decides a recommendation put the product's
// own parameters at most of it and the brand at close to none. This asks
// the same of one project's archive rather than taking that on trust.
export function renderVariance(report: VarianceReport | null | undefined, fold: FoldCard): string {
  if (!report || !report.answers) return '';
  if (report.flat) {
    return fold("trust-variance", "What decides whether you appear",
      "Every answer said the same thing about you, so nothing here varies and nothing can explain it. That is a finding about the brand rather than a gap in the measurement.", '');
  }
  const measured = report.factors.filter((row): row is FactorShare & { share: number } => row.share !== null);
  if (!measured.length) return '';
  // The rarer outcome is what every share is taken over, and saying the
  // answer count here would point at the larger, reassuring number.
  const few = report.tooFew
    ? '<div class="warning-box">' + (report.events === undefined ? report.answers + ' answers' : report.events + ' of ' + report.answers + ' answers are the outcome these shares are taken over, which') + ' is too few for them to be read as anything but a direction. ' + html(report.caveat) + '</div>'
    : '';
  const rows = measured.map((row) => '<div class="mrow mcols-variance"><div class="mname"><strong>' + html(row.label) + '</strong>'
    + (row.best && row.worst ? '<span class="subtle">' + html(String(row.best.level).slice(0, 40)) + ' ' + Math.round(row.best.rate * 100) + '% against ' + html(String(row.worst.level).slice(0, 40)) + ' ' + Math.round(row.worst.rate * 100) + '%</span>' : '')
    + '</div>'
    + '<span class="mcell">' + row.levels + '</span>'
    + '<span class="mcell ' + (row.share >= 0.4 ? "state-flag" : "") + '">' + Math.round(row.share * 100) + '%</span>'
    + '<span class="mcell">' + bar(row.share) + '</span></div>').join("");
  const unvaried = report.factors.filter((row) => row.share === null);
  const nothing = unvaried.length
    ? '<p class="subtle">' + unvaried.map((row) => html(row.label)).join(", ") + ' took one value, so nothing varied for them to explain.</p>'
    : '';
  return fold("trust-variance", "What decides whether you appear", report.caveat, few
    + '<div class="mtable"><div class="mhead mcols-variance"><span>Factor</span><span>Values</span><span>Goes with</span><span></span></div>' + rows + '</div>'
    + nothing);
}

// The more volatile half of the score, and the half that had no stability
// figure. Published work puts framing flipping far more often than naming.
export function renderFraming(report: SentimentVolatility | null | undefined, fold: FoldCard): string {
  if (!report) return '';
  if (!report.measured) {
    return fold("trust-framing", "How steady the framing is",
      'No question named you more than once under identical conditions, so nothing says whether the way you are described holds still. Published work puts framing flipping about '
      + report.publishedRatio + ' times as often as whether you are named at all, so this is the half of the score most likely to be moving.', '');
  }
  const lead = report.flipped
    ? report.flipped + ' of ' + report.measured + ' question(s) described you more than one way across passes that all named you.'
    : 'Every question that named you more than once described you the same way each time.';
  const against = report.ratio === null
    ? ' Whether you are named never flipped here, so there is nothing to compare the framing against.'
    : ' Framing flipped ' + report.ratio + ' times as often as naming did, against the ' + report.publishedRatio + ' published.';
  const rows = report.questions.slice(0, 6).map((row) => '<div class="mrow mcols-framing"><div class="mname"><strong>' + html(row.promptText) + '</strong>'
    + '<span class="mono">' + html(row.modelId) + ' \u00b7 named in ' + row.named + ' passes</span></div>'
    + '<span class="mcell ' + (row.steady ? "state-ok" : "state-bad") + '">' + (row.steady ? "Steady" : row.framings.length + ' ways') + '</span>'
    + '<span class="mcell subtle">' + html(row.framings.join(", ")) + '</span></div>').join("");
  return fold("trust-framing", "How steady the framing is", report.caveat, ''
    + '<p>' + html(lead + against) + '</p>'
    + '<div class="mtable"><div class="mhead mcols-framing"><span>Question</span><span>Framing</span><span>Called it</span></div>' + rows + '</div>');
}

// A rate on its own answers nothing: the same figure is poor for a
// household name and ordinary for a brand nobody has heard of.
export function renderTier(report: TierComparison | null | undefined, fold: FoldCard): string {
  if (!report) return '';
  const picker = '<label class="picker"><span class="subtle">This brand is</span><select data-brand-tier>'
    + TIERS.map(([value, label]) => '<option value="' + value + '"' + (report.tier === value ? " selected" : "") + '>' + html(label) + '</option>').join("")
    + '</select></label>';
  if (!report.baseline) {
    return fold("trust-tier", "Against brands like yours",
      "A visibility figure on its own answers nothing. The same number is poor for a household name and ordinary for a brand nobody has heard of. Say which this is and the figure gets something to be read against.",
      '', '<div class="inline-actions">' + picker + '</div>');
  }
  const yours = report.presence.rate === null
    ? 'Nothing answered yet, so there is nothing of yours to compare.'
    : 'You are named in ' + sharePct(report.presence.rate) + ' of answers, consistent with ' + sharePct(report.presence.low) + ' to ' + sharePct(report.presence.high) + '.';
  const verdict = report.standing === null
    ? ''
    : report.standing === "typical"
      ? ' That range covers the ' + sharePct(report.baseline.rate) + ' brands of this kind tended to get, so you are doing what your kind does.'
      : report.standing === "above"
        ? ' That is clear of the ' + sharePct(report.baseline.rate) + ' brands of this kind tended to get.'
        : ' That falls short of the ' + sharePct(report.baseline.rate) + ' brands of this kind tended to get.';
  const ink = report.standing === "above" ? "state-ok" : report.standing === "below" ? "state-bad" : "state-flag";
  return fold("trust-tier", "Against brands like yours", report.caveat, ''
    + '<div class="countstrip"><span class="count ' + ink + '"><strong>' + (report.presence.rate === null ? '\u2014' : sharePct(report.presence.rate)) + '</strong>yours</span>'
    + '<span class="count"><strong>' + sharePct(report.baseline.rate) + '</strong>' + html(report.baseline.label) + '</span></div>'
    + '<p>' + html(yours + verdict) + '</p>', '<div class="inline-actions">' + picker + '</div>');
}

// Every trend line here assumes the thing being measured held still while
// the brand changed. A model shipping is the confound that breaks that.
export function renderVersions(report: VersionReport | null | undefined, fold: FoldCard): string {
  if (!report || (!report.models.length && !report.unconfirmed.length)) return '';
  const shifts = report.models.flatMap((row) => row.shifts.filter((shift) => shift.separated));
  const lead = shifts.length
    ? shifts.length + ' model version change(s) moved your presence by more than the noise on either side. Nothing you did caused those, and no trend drawn across them compares like with like.'
    : report.models.some((row) => row.reported)
      ? 'No model version change here moved your presence by more than the noise either side of it.'
      : 'No provider here names the version it ran, so a change would be invisible rather than absent.';
  const rows = report.models.filter((row) => row.reported).flatMap((row) => row.shifts.map((shift) => {
    const ink = shift.separated ? "state-bad" : shift.separated === null ? "state-flag" : "state-ok";
    const words = shift.change === null ? "Too thin" : (shift.change > 0 ? "+" : "") + Math.round(shift.change * 100) + " points";
    return '<div class="mrow mcols-version"><div class="mname"><strong>' + html(shift.modelId) + '</strong>'
      + '<span class="mono">' + html(shift.from.version) + ' \u2192 ' + html(shift.to.version) + '</span></div>'
      + '<span class="mcell ' + ink + '">' + html(words) + '</span>'
      + '<span class="mcell subtle">' + (shift.separated === null ? 'not readable' : shift.separated ? 'beyond the noise' : 'within the noise') + '</span></div>';
  })).join("");
  const blind = report.unconfirmed.length
    ? '<p class="subtle">' + report.unconfirmed.map((id: string) => html(id)).join(", ") + ' never named a version, so a change there cannot be seen. That is unconfirmed, not steady.</p>'
    : '';
  return fold("trust-versions", "Was it you, or did the model ship", report.caveat, ''
    + '<p>' + html(lead) + '</p>'
    + (rows ? '<div class="mtable"><div class="mhead mcols-version"><span>Change</span><span>Presence moved</span><span>Reading</span></div>' + rows + '</div>' : '')
    + blind);
}

export function renderHumanCheck(status: LoadState, report: HumanCheckData | null | undefined, actions: Pick<TrustActions, "loadCheck">): string {
  if (status === "idle") { actions.loadCheck(); }
  if (status !== "ready" || !report) {
    return '<p class="subtle">' + (status === "error" ? "Could not read the review queue." : "Drawing a sample to review.") + '</p>';
  }
  const agreement = report.agreement;
  const rows = agreement.byField.map((row) => '<div class="mrow mcols-check"><div class="mname"><strong>' + html(row.field === "isTarget" ? "Is it you" : "How you were described") + '</strong>'
    + (row.corrections.length ? '<span class="subtle">should have been ' + row.corrections.map((c) => html(c.value) + ' \u00d7' + c.count).join(", ") + '</span>' : '')
    + '</div>'
    + '<span class="mcell">' + row.checked + '</span>'
    + '<span class="mcell ' + (row.interval.rate === null ? "" : row.interval.rate >= 0.9 ? "state-ok" : "state-flag") + '">'
    + (row.interval.rate === null ? 'Not checked' : Math.round(row.interval.rate * 100) + '%') + '</span>'
    + '<span class="mcell subtle">' + (row.interval.low === null || row.interval.high === null ? "Not measurable" : Math.round(row.interval.low * 100) + ' to ' + Math.round(row.interval.high * 100) + '%') + '</span></div>').join("");
  const next = report.items[0];
  const judging = next
    ? '<div class="fix"><div class="fix-top"><strong>' + html(next.name) + '</strong><span class="tag">' + html(next.modelId) + '</span></div>'
      + '<p class="evidence-note">Asked: ' + html(next.promptText) + '</p>'
      // The window centres on the name. Where the answer never spells it,
      // this is the opening of the answer instead, which is a different
      // thing to be judging and the reviewer is told so.
      + (next.excerptHasName === false
        ? '<p class="warning-box">The answer does not contain this name anywhere, so what follows is its opening rather than the place being judged. The model reported a mention its own answer does not carry.</p>'
        : '')
      + '<p class="why">\u2026' + html(next.excerpt) + '\u2026</p>'
      + verdictButtons(next)
      + '<p class="mlegend">' + report.remaining + ' left in this sample, drawn from ' + agreement.population + ' mention(s).</p></div>'
    : '<p class="subtle">Nothing left in this sample. Every mention drawn has been judged.</p>';
  return '<div class="mtable"><div class="mhead mcols-check"><span>What was classified</span><span>Checked</span><span>Agreed</span><span>Consistent with</span></div>' + rows + '</div>'
    + judging + '<p class="mlegend">' + html(agreement.caveat) + '</p>';
}

export function renderExperiments(status: LoadState, data: { experiments: ExperimentReport[] } | null | undefined, actions: Pick<TrustActions, "loadExperiments">): string {
  if (status === "idle") { actions.loadExperiments(); }
  const start = '<div class="inline-actions">' + button({ label: "Start one against the selected questions", kind: "quiet", on: { "data-start-experiment": "true" } }) + '</div>';
  if (status !== "ready" || !data) {
    return start + (status === "error" ? '<p class="subtle">Could not read the experiments.</p>' : '');
  }
  const rows = data.experiments || [];
  const first = rows[0];
  if (!first) {
    return '<p class="subtle">Nothing is being tested. Select the questions a change should move and the ones it should not on the Prompts page, then start one here. Everything else in this product watches; this is the only part that tests.</p>' + start;
  }
  return rows.map(experimentCard).join("") + start
    + '<p class="mlegend">' + html(first.result.caveat) + '</p>';
}

export function renderSchedule(status: LoadState, schedule: PromptSchedule | null | undefined, regions: Array<Pick<Region, "id" | "label">> | null | undefined, actions: Pick<TrustActions, "loadSchedule">): string {
  if (status === "idle") { actions.loadSchedule(); }
  if (!schedule) return loading("the schedule", skeletonText(2));
  const options = ["daily", "weekly", "monthly"].map((value) => '<option value="' + value + '"' + (schedule.rule.frequency === value ? " selected" : "") + '>' + value.charAt(0).toUpperCase() + value.slice(1) + '</option>').join("");
  const markets = (regions || []).map((row) => '<label class="checkline"><input type="checkbox" name="regionIds" value="' + html(row.id) + '"' + (schedule.regionIds.indexOf(row.id) >= 0 ? " checked" : "") + '> ' + html(row.label) + '</label>').join("");
  const next = schedule.enabled && schedule.nextRunAt ? 'Next run ' + html(schedule.nextRunAt.slice(0, 16).replace("T", " ")) + ' UTC.' : 'Not scheduled.';
  const failure = schedule.lastError ? '<div class="warning-box">The last scheduled run did not happen: ' + html(schedule.lastError) + '</div>' : '';
  return failure + '<form id="schedule-form" class="inline-form">'
    + '<label class="checkline"><input type="checkbox" name="enabled"' + (schedule.enabled ? " checked" : "") + '> Run automatically</label>'
    + '<select name="frequency" aria-label="How often">' + options + '</select>'
    + '' + button({ label: "Save schedule", submit: true }) + '</form>'
    + '<p class="subtle">' + next + ' The worker must be running: <span class="mono">npm run monitor:worker</span>.</p>'
    + '<details class="technical-details"><summary>Markets to ask in</summary><div class="checkgrid">' + markets + '</div></details>';
}
