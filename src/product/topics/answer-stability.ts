import { canonicalKey } from "../citations/canonical-url.js";
import type { PromptAnswer } from "./prompt-run-schema.js";

// The same question asked twice does not come back the same. Published work
// puts the day to day overlap of cited sources near a third, which makes a
// single pass close to a coin.
//
// Nothing here can be said from one answer, so every figure is null until a
// question has been asked at least twice under identical conditions.

/** One question, one model, one market, one language, one persona. Anything
 * else varying would make a difference between passes mean two things. */
function groupKey(answer: PromptAnswer): string {
  return [answer.promptId, answer.providerId, answer.modelId, answer.regionId, answer.languageId, answer.personaId || "anyone"].join("\u0000");
}

export const STABILITY_CAVEAT = "Measured between answers to one question under identical conditions, so it is the surface moving rather than the question changing. Passes are grouped wherever the conditions matched, which may be minutes apart inside one run or weeks apart across several, and the span of each is reported beside it because a figure over minutes and one over weeks are not the same claim.";

/** Overlap of two sets, one where they are identical and nought where they
 * share nothing. Two empty sets are not similar, they are unmeasurable. */
export function jaccard(left: Set<string>, right: Set<string>): number | null {
  if (!left.size && !right.size) return null;
  let shared = 0;
  for (const value of left) if (right.has(value)) shared += 1;
  return shared / (left.size + right.size - shared);
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export interface QuestionStability {
  promptId: string;
  promptText: string;
  modelId: string;
  /** Completed answers to this question under these conditions. */
  passes: number;
  /** How many of them named the brand. */
  named: number;
  /** Which of the three a question is. Agreement on never naming the brand is
   * the brand's absence, and a boolean that cannot tell it from agreement on
   * always naming it reports the absence as a reassurance. */
  naming: "always" | "never" | "split";
  /** True where every pass agreed, either always naming it or never. Kept
   * because the sort and the published shape both read it. */
  namingAgreed: boolean;
  /** Mean overlap of the cited source sets over every pair of passes. Null
   * where no pair had a source between them. */
  sourceOverlap: number | null;
  /** Sources cited in every pass, over sources cited in any. */
  sourcesAlways: number;
  sourcesEver: number;
  /** Hours from the first pass to the last. Null where a pass carried no
   * readable time, because an unknown span cannot be reported as none. */
  spanHours: number | null;
}

export interface StabilityReport {
  /** Condition groups asked at least twice: one question, one model, one
   * market, one language, one persona. Not questions. A question asked by ten
   * models is ten groups, and counting them as questions multiplied this
   * project's twenty eight into a hundred and thirty four. */
  measured: number;
  /** Condition groups asked once, which say nothing about stability. */
  askedOnce: number;
  /** Distinct questions behind those groups, and how many of them have been
   * asked twice under some condition. This is the figure somebody acts on:
   * which of my questions still need running again. */
  distinctQuestions: number;
  questionsRepeated: number;
  /** Mean source overlap across every measured question. Null with none. */
  sourceOverlap: number | null;
  /** Measured questions where a pair of passes had a source between them, so
   * an overlap could be taken. The mean above is over these, not over
   * everything measured, and printing it against the larger number claims a
   * reading of questions that cited nothing. */
  withSources: number;
  /** Questions where the passes disagreed about whether the brand appears. */
  namingUnstable: number;
  /** Measured questions no pass named the brand in, and ones every pass did.
   * The first is an absence and the second is a presence; both are agreement. */
  neverNamed: number;
  alwaysNamed: number;
  questions: QuestionStability[];
  caveat: string;
}

export function buildStabilityReport(answers: PromptAnswer[]): StabilityReport {
  const groups = new Map<string, PromptAnswer[]>();
  for (const answer of answers) {
    if (answer.status !== "completed") continue;
    const key = groupKey(answer);
    const rows = groups.get(key) || [];
    rows.push(answer);
    groups.set(key, rows);
  }

  const questions: QuestionStability[] = [];
  const everyQuestion = new Set<string>();
  const repeatedQuestions = new Set<string>();
  let askedOnce = 0;
  for (const rows of groups.values()) {
    const prompt = (rows[0] as PromptAnswer).promptId;
    everyQuestion.add(prompt);
    if (rows.length < 2) { askedOnce += 1; continue; }
    repeatedQuestions.add(prompt);
    const sets = rows.map((row) => new Set(row.citationUrls.map(canonicalKey).filter((key): key is string => Boolean(key))));
    const pairs: number[] = [];
    for (let left = 0; left < sets.length; left += 1) {
      for (let right = left + 1; right < sets.length; right += 1) {
        const overlap = jaccard(sets[left] as Set<string>, sets[right] as Set<string>);
        if (overlap !== null) pairs.push(overlap);
      }
    }
    const ever = new Set<string>();
    for (const set of sets) for (const value of set) ever.add(value);
    let always = 0;
    for (const value of ever) if (sets.every((set) => set.has(value))) always += 1;
    const named = rows.filter((row) => row.mentions.some((mention) => mention.isTarget)).length;
    const first = rows[0] as PromptAnswer;
    const times = rows.map((row) => new Date(row.createdAt).getTime()).filter((value) => Number.isFinite(value));
    const spanHours = times.length === rows.length
      ? Math.round(((Math.max(...times) - Math.min(...times)) / 3600000) * 10) / 10
      : null;
    const naming = named === 0 ? "never" : named === rows.length ? "always" : "split";
    questions.push({
      promptId: first.promptId,
      promptText: first.promptText,
      modelId: first.modelId,
      passes: rows.length,
      named,
      naming,
      namingAgreed: naming !== "split",
      sourceOverlap: mean(pairs),
      sourcesAlways: always,
      sourcesEver: ever.size,
      spanHours,
    });
  }

  // Least stable first, because that is the question whose number means least.
  questions.sort((left, right) => (left.sourceOverlap ?? 2) - (right.sourceOverlap ?? 2));
  const overlaps = questions.map((row) => row.sourceOverlap).filter((value): value is number => value !== null);
  return {
    measured: questions.length,
    askedOnce,
    distinctQuestions: everyQuestion.size,
    questionsRepeated: repeatedQuestions.size,
    sourceOverlap: mean(overlaps),
    withSources: overlaps.length,
    namingUnstable: questions.filter((row) => row.naming === "split").length,
    neverNamed: questions.filter((row) => row.naming === "never").length,
    alwaysNamed: questions.filter((row) => row.naming === "always").length,
    questions,
    caveat: STABILITY_CAVEAT,
  };
}
