import type { PromptAnswer } from "./prompt-run-schema.js";

// Published work decomposing what decides a recommendation put the product's
// own parameters at most of the variance and the brand at close to none. The
// same question can be asked of a project's own archive: of everything that
// varies between answers, how much of whether the brand appears goes with each.
//
// These are not independent contributions and do not sum to anything. A model
// that only ran in one market carries that market with it, and the share each
// factor gets includes whatever it is confounded with.

export const VARIANCE_CAVEAT = "Each share is how much of the variation in whether you were named goes with that factor on its own. They are not independent and do not add up: a model that only ran in one market carries that market with it, and both will show the same split. A factor with one level explains nothing because nothing varied, which is not the same as it not mattering.";

/** Levels below this and a share is arithmetic on too little to read. */
export const MIN_ANSWERS = 8;

/** A factor with at least as many levels as there are events can separate them
 * by construction, so its share is an artefact of the grouping rather than a
 * finding: 28 questions put "which question" at 100% of three appearances. */
export function canIsolate(levels: number, events: number): boolean {
  return events <= 0 || levels >= events;
}

export type FactorId = "question" | "wording" | "model" | "market" | "language" | "persona" | "run";

export interface FactorShare {
  factor: FactorId;
  label: string;
  /** Distinct values this factor took. One means nothing varied. */
  levels: number;
  /** Share of the variation in being named that goes with this factor. Null
   * where nothing varied, which is not a share of nought. */
  share: number | null;
  /** The levels at the extremes, so a share can be looked at. */
  best: { level: string; rate: number } | null;
  worst: { level: string; rate: number } | null;
}

export interface VarianceReport {
  answers: number;
  /** Share of answers naming the brand. Null with nothing answered. */
  rate: number | null;
  /** True where the outcome never varied, so nothing can explain it. */
  flat: boolean;
  factors: FactorShare[];
  /** Too few answers for any of it to be read. */
  tooFew: boolean;
  wordingIsTheQuestion: boolean;
  /** The rarer outcome, named or not named. A share is driven by this and not
   * by the number of answers, which can be large while this is three. */
  events: number;
  caveat: string;
}

const FACTORS: Array<{ id: FactorId; label: string; of: (answer: PromptAnswer) => string }> = [
  { id: "question", label: "Which question", of: (answer) => answer.promptId },
  { id: "wording", label: "Which wording", of: (answer) => answer.promptText },
  { id: "model", label: "Which model", of: (answer) => answer.modelId },
  { id: "market", label: "Which market", of: (answer) => answer.regionId },
  { id: "language", label: "Which language", of: (answer) => answer.languageId },
  { id: "persona", label: "Who is asking", of: (answer) => answer.personaId || "anyone" },
  { id: "run", label: "Which run", of: (answer) => answer.runId },
];

/** Between-group variation over total variation, for a binary outcome. Null
 * where the outcome never varied or the factor took one value. */
export function varianceShare(groups: Array<number[]>): number | null {
  const all = groups.flat();
  if (all.length < 2 || groups.length < 2) return null;
  const mean = all.reduce((sum, value) => sum + value, 0) / all.length;
  const total = all.reduce((sum, value) => sum + (value - mean) * (value - mean), 0);
  if (total === 0) return null;
  let between = 0;
  for (const group of groups) {
    if (!group.length) continue;
    const groupMean = group.reduce((sum, value) => sum + value, 0) / group.length;
    between += group.length * (groupMean - mean) * (groupMean - mean);
  }
  return between / total;
}

export function buildVarianceReport(answers: PromptAnswer[]): VarianceReport {
  const completed = answers.filter((answer) => answer.status === "completed");
  const named = (answer: PromptAnswer): number => (answer.mentions.some((mention) => mention.isTarget) ? 1 : 0);
  const outcomes = completed.map(named);
  const rate = outcomes.length ? outcomes.reduce((sum, value) => sum + value, 0) / outcomes.length : null;
  const flat = outcomes.length > 0 && outcomes.every((value) => value === outcomes[0]);

  const appeared = outcomes.reduce((sum, value) => sum + value, 0);
  const events = Math.min(appeared, outcomes.length - appeared);

  const factors: FactorShare[] = FACTORS.map((factor) => {
    const byLevel = new Map<string, number[]>();
    for (const answer of completed) {
      const level = factor.of(answer);
      const rows = byLevel.get(level) || [];
      rows.push(named(answer));
      byLevel.set(level, rows);
    }
    const groups = [...byLevel.values()];
    const rates = [...byLevel.entries()]
      .map(([level, values]) => ({ level, rate: values.reduce((sum, value) => sum + value, 0) / values.length }))
      .sort((left, right) => right.rate - left.rate);
    return {
      factor: factor.id,
      label: factor.label,
      levels: byLevel.size,
      // Not measurable rather than nought: the grouping could explain it all
      // whatever the answers said, so the share would be about the grouping.
      share: canIsolate(byLevel.size, events) ? null : varianceShare(groups),
      best: rates[0] || null,
      worst: rates.length > 1 ? rates[rates.length - 1] || null : null,
    };
  });

  // With no question written more than one way, every wording is its own
  // question and the two factors are the same one. Reporting both reads as two
  // findings agreeing where there is only one.
  const question = factors.find((row) => row.factor === "question");
  const wording = factors.find((row) => row.factor === "wording");
  const sameFactor = Boolean(question && wording && question.levels === wording.levels);
  const reported = sameFactor ? factors.filter((row) => row.factor !== "wording") : factors;

  reported.sort((left, right) => (right.share ?? -1) - (left.share ?? -1));
  return {
    answers: completed.length,
    rate,
    flat,
    factors: reported,
    /** True where no question has a rewording, so the wording factor is the
     * question factor and is left out rather than printed twice. */
    wordingIsTheQuestion: sameFactor,
    tooFew: completed.length < MIN_ANSWERS,
    events,
    caveat: VARIANCE_CAVEAT,
  };
}
