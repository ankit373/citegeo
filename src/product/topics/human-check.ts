import { sha256 } from "../../utils/hash.js";
import { wilsonInterval, type ProportionInterval } from "./proportion-interval.js";
import type { PromptAnswer } from "./prompt-run-schema.js";

// Every figure in this product rests on a model classifying what another model
// wrote, and nothing has ever asked a person whether it got it right. The
// standard protocol for this field names human validation alongside repeated
// measurement and controls, and this is the leg that was missing.
//
// The sample is random rather than the cases the classifier was least sure
// about. Reviewing the hard ones improves the classifier and tells you nothing
// about how often it is right.

export const CHECK_CAVEAT = "Drawn at random from every mention, not from the ones the classifier found hard, because reviewing the hard ones tells you how to improve it rather than how often it is right. The agreement rate is reported with the range it is consistent with, since a handful of reviews is a sample like any other.";

export type CheckField = "recommendation" | "isTarget";

export const CHECK_FIELDS: CheckField[] = ["recommendation", "isTarget"];

/** Characters either side of the mention, which is enough to judge how a brand
 * was described without reading the whole answer. */
export const EXCERPT_CHARS = 320;

export interface ReviewItem {
  id: string;
  answerId: string;
  promptText: string;
  modelId: string;
  name: string;
  /** What the product decided. */
  recommendation: string;
  isTarget: boolean;
  /** The answer around the mention, so the verdict is about evidence. */
  excerpt: string;
  /** False where the answer does not contain the name at all, so the excerpt
   * is the head of the answer rather than the place being judged. A reviewer
   * told that is judging a different question from one who is not. */
  excerptHasName: boolean;
}

export interface Verdict {
  id: string;
  field: CheckField;
  agreed: boolean;
  /** What it should have said. Absent when the reviewer agreed. */
  correction?: string | undefined;
  at: string;
}

export interface FieldAgreement {
  field: CheckField;
  checked: number;
  agreed: number;
  /** agreed over checked, with the range it is consistent with. Null trials
   * give a null rate, because nothing checked is not perfect agreement. */
  interval: ProportionInterval;
  /** What reviewers said it should have been instead, most common first. */
  corrections: Array<{ value: string; count: number }>;
}

export interface AgreementReport {
  /** Mentions available to draw from. */
  population: number;
  byField: FieldAgreement[];
  caveat: string;
}

/** Centred on the name in the answer as written. The stored offset indexes the
 * tokenised answer, which has more entries than the text has words, so using it
 * here ran the window off the end and gave an empty excerpt. */
export function excerptAround(text: string, name: string): string {
  if (!text) return "";
  const at = text.toLocaleLowerCase().indexOf(name.trim().toLocaleLowerCase());
  if (at < 0 || !name.trim()) return text.slice(0, EXCERPT_CHARS * 2);
  const from = Math.max(0, at - EXCERPT_CHARS);
  return text.slice(from, at + EXCERPT_CHARS);
}

/** Whether the answer contains the name the excerpt was meant to centre on.
 * A model reports naming something its answer never spells, and the window
 * then falls back to the opening of the answer without saying so. */
export function answerNames(text: string, name: string): boolean {
  const wanted = name.trim().toLocaleLowerCase();
  return Boolean(text && wanted) && text.toLocaleLowerCase().includes(wanted);
}

export function mentionId(answerId: string, name: string): string {
  return sha256(answerId + "\u0000" + name).slice(0, 24);
}

/** Every mention this project has, as something a person could judge. */
export function reviewable(answers: PromptAnswer[]): ReviewItem[] {
  const items: ReviewItem[] = [];
  for (const answer of answers) {
    if (answer.status !== "completed" || !answer.text) continue;
    for (const mention of answer.mentions) {
      items.push({
        id: mentionId(answer.id, mention.name),
        answerId: answer.id,
        promptText: answer.promptText,
        modelId: answer.modelId,
        name: mention.name,
        recommendation: mention.recommendation,
        isTarget: mention.isTarget,
        excerpt: excerptAround(answer.text, mention.name),
        excerptHasName: answerNames(answer.text, mention.name),
      });
    }
  }
  return items;
}

/** A stable random order. The same project draws the same sample every time,
 * so a reviewer returning sees the queue they left rather than a new one. */
export function sampleFor(items: ReviewItem[], size: number, seed = ""): ReviewItem[] {
  return [...items]
    .map((item) => ({ item, at: sha256(seed + "\u0000" + item.id) }))
    .sort((left, right) => left.at.localeCompare(right.at))
    .slice(0, Math.max(0, size))
    .map((row) => row.item);
}

export function buildAgreement(input: { items: ReviewItem[]; verdicts: Verdict[] }): AgreementReport {
  const known = new Set(input.items.map((item) => item.id));
  const byField: FieldAgreement[] = CHECK_FIELDS.map((field) => {
    // A verdict on a mention this project no longer has cannot be checked
    // against anything, so it is left out rather than counted either way.
    const mine = input.verdicts.filter((verdict) => verdict.field === field && known.has(verdict.id));
    const agreed = mine.filter((verdict) => verdict.agreed).length;
    const corrections = new Map<string, number>();
    for (const verdict of mine) {
      if (verdict.agreed || !verdict.correction) continue;
      corrections.set(verdict.correction, (corrections.get(verdict.correction) || 0) + 1);
    }
    return {
      field,
      checked: mine.length,
      agreed,
      interval: wilsonInterval(agreed, mine.length),
      corrections: [...corrections.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((left, right) => right.count - left.count),
    };
  });
  return { population: input.items.length, byField, caveat: CHECK_CAVEAT };
}
