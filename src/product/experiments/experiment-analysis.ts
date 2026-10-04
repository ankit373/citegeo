import { wilsonInterval, type ProportionInterval } from "../topics/proportion-interval.js";
import type { PromptAnswer } from "../topics/prompt-run-schema.js";

// Every figure in this product, and in every tool like it, is an observation.
// The survey of this field is blunt about where that leaves it: no reviewed
// technique shows a stable, cross-platform causal effect, because nobody runs
// the experiment. Watching a number move after you changed something is not
// evidence that your change moved it.
//
// So: change one thing, leave a comparable set of questions alone, and compare
// how both moved. Anything that moved for the control moved for reasons that
// were not the change, including the model shipping a new version, and it is
// subtracted rather than claimed.

/** Answers an arm needs before the arithmetic is worth doing. Below it the
 * interval is wider than any effect worth finding. */
export const MIN_PER_ARM = 10;

/** Two standard errors either side, the same convention the rest of the
 * product reads a proportion with. */
export const INTERVAL_Z = 1.96;

export const EXPERIMENT_CAVEAT = "A difference in differences: how the treated questions moved, less how the control questions moved over the same period. Subtracting the control removes anything that moved for both, including the model changing under you. It cannot remove something that happened to the treated questions alone and was not your change, so this is evidence for the change rather than proof of it, and it is only as good as the control being comparable.";

export type ExperimentVerdict = "moved" | "no_effect_shown" | "too_thin" | "no_control";

export interface ArmResult {
  /** Answers to these questions before the change. */
  before: ProportionInterval;
  after: ProportionInterval;
  /** after minus before. Null where either side has nothing. */
  lift: number | null;
}

export interface ExperimentResult {
  treated: ArmResult;
  control: ArmResult;
  /** Model versions that changed inside the window. The control absorbs a
   * change that hit both sides alike, and nothing absorbs one that did not. */
  versionsChanged: string[];
  /** Treated lift less control lift. Null where either is missing. */
  difference: number | null;
  low: number | null;
  high: number | null;
  verdict: ExperimentVerdict;
  /** Why it says what it says, in words. */
  detail: string;
  caveat: string;
}

/** Taken from the Wilson interval rather than from p times one minus p. At a
 * rate of nought or one that product is nought, which collapses the band and
 * declares certainty from a handful of answers. Wilson never collapses. */
function variance(interval: ProportionInterval): number | null {
  if (interval.rate === null || interval.trials <= 0) return null;
  if (interval.low === null || interval.high === null) return null;
  const error = (interval.high - interval.low) / (2 * INTERVAL_Z);
  return error * error;
}

function arm(answers: PromptAnswer[], promptIds: Set<string>, changedAt: number): ArmResult {
  const mine = answers.filter((answer) => answer.status === "completed" && promptIds.has(answer.promptId));
  const split = (rows: PromptAnswer[]): ProportionInterval =>
    wilsonInterval(rows.filter((row) => row.mentions.some((mention) => mention.isTarget)).length, rows.length);
  const at = (row: PromptAnswer): number => new Date(row.createdAt).getTime();
  const before = split(mine.filter((row) => Number.isFinite(at(row)) && at(row) < changedAt));
  const after = split(mine.filter((row) => Number.isFinite(at(row)) && at(row) >= changedAt));
  return {
    before,
    after,
    lift: before.rate === null || after.rate === null ? null : after.rate - before.rate,
  };
}

/** Models whose reported version differs on the two sides of the change. A
 * version the provider only echoed back is not a change anybody can see. */
function versionsAcross(answers: PromptAnswer[], changedAt: number): string[] {
  const before = new Map<string, Set<string>>();
  const after = new Map<string, Set<string>>();
  for (const answer of answers) {
    if (answer.status !== "completed") continue;
    const version = answer.modelVersion;
    if (!version || version === answer.modelId) continue;
    const at = new Date(answer.createdAt).getTime();
    if (!Number.isFinite(at)) continue;
    const side = at < changedAt ? before : after;
    const seen = side.get(answer.modelId) || new Set<string>();
    seen.add(version);
    side.set(answer.modelId, seen);
  }
  const moved: string[] = [];
  for (const [modelId, early] of before) {
    const late = after.get(modelId);
    if (!late || !late.size) continue;
    if ([...late].some((version) => !early.has(version))) moved.push(modelId);
  }
  return moved.sort();
}

export function analyseExperiment(input: {
  answers: PromptAnswer[];
  treatedPromptIds: string[];
  controlPromptIds: string[];
  changedAt: string;
}): ExperimentResult {
  const changed = new Date(input.changedAt).getTime();
  const treated = arm(input.answers, new Set(input.treatedPromptIds), changed);
  const control = arm(input.answers, new Set(input.controlPromptIds), changed);
  const versionsChanged = versionsAcross(input.answers, changed);

  const thin = [treated.before, treated.after, control.before, control.after]
    .filter((side) => side.trials < MIN_PER_ARM).length;

  if (!input.controlPromptIds.length) {
    return {
      treated, control, versionsChanged, difference: null, low: null, high: null,
      verdict: "no_control",
      detail: "No control questions, so anything that moved for every question would read as the change working. A number moving after you changed something is not evidence your change moved it.",
      caveat: EXPERIMENT_CAVEAT,
    };
  }

  if (thin || treated.lift === null || control.lift === null) {
    return {
      treated, control, versionsChanged, difference: null, low: null, high: null,
      verdict: "too_thin",
      detail: thin === 1
        ? `Each of the four groups needs ${MIN_PER_ARM} answers before the arithmetic says anything, and one of them does not have that yet. Run the questions again on both sides.`
        : `Each of the four groups needs ${MIN_PER_ARM} answers before the arithmetic says anything, and ${thin || "some"} of them do not have that yet. Run the questions again on both sides.`,
      caveat: EXPERIMENT_CAVEAT,
    };
  }

  const difference = treated.lift - control.lift;
  const parts = [treated.before, treated.after, control.before, control.after].map(variance);
  if (parts.some((value) => value === null)) {
    return { treated, control, versionsChanged, difference, low: null, high: null, verdict: "too_thin", detail: "A group had nothing to take a rate from.", caveat: EXPERIMENT_CAVEAT };
  }
  const spread = INTERVAL_Z * Math.sqrt((parts as number[]).reduce((sum, value) => sum + value, 0));
  const low = difference - spread;
  const high = difference + spread;
  // The interval has to clear nought in one direction. A band that straddles
  // it is consistent with the change having done nothing.
  const moved = low > 0 || high < 0;
  const confound = versionsChanged.length
    ? ` A model version changed inside the window for ${versionsChanged.join(", ")}. The control absorbs that where it hit both sides alike and nothing absorbs it where it did not.`
    : "";
  return {
    treated,
    control,
    versionsChanged,
    difference: Math.round(difference * 1000) / 1000,
    low: Math.round(low * 1000) / 1000,
    high: Math.round(high * 1000) / 1000,
    verdict: moved ? "moved" : "no_effect_shown",
    detail: moved
      ? `The treated questions moved ${Math.round(difference * 100)} points more than the control did, and the range that is consistent with does not cross nought.${confound}`
      : `The difference between how the two sides moved is consistent with nought, so nothing here shows the change did anything. That is not the same as showing it did nothing.${confound}`,
    caveat: EXPERIMENT_CAVEAT,
  };
}
