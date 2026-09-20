import type { AnswerMention, PromptAnswer } from "./prompt-run-schema.js";

// Named late and grudgingly still beats not named, so prominence and sentiment
// scale presence rather than replacing it. These floors are that judgement.
export const PROMINENCE_FLOOR = 0.6;
export const SENTIMENT_FLOOR = 0.5;

export interface ScoreWeights {
  prominenceFloor: number;
  sentimentFloor: number;
}

export const SCORE_WEIGHTS: ScoreWeights = {
  prominenceFloor: PROMINENCE_FLOOR,
  sentimentFloor: SENTIMENT_FLOOR,
};

export interface VisibilityScore {
  /** Completed answers considered. A failed answer is not a zero. */
  answers: number;
  /** Answers that named the brand. */
  appearances: number;
  /** appearances / answers. Null with nothing answered. */
  presenceRate: number | null;
  /** 1 when always named first, approaching 0 when always named last. */
  prominence: number | null;
  /** 1 when always recommended, 0 when always rejected. */
  sentiment: number | null;
  /** 0 to 100. Null when nothing could be measured. */
  score: number | null;
  weights: ScoreWeights;
}

const RECOMMENDATION_WEIGHT: Record<AnswerMention["recommendation"], number> = {
  positive: 1,
  mentioned: 0.5,
  uncertain: 0.25,
  negative: 0,
};

export function emptyScore(): VisibilityScore {
  return {
    answers: 0,
    appearances: 0,
    presenceRate: null,
    prominence: null,
    sentiment: null,
    score: null,
    weights: SCORE_WEIGHTS,
  };
}

/** Ranked within the answer, because a raw offset means nothing on its own:
 * 400 is early in a long answer and last in a short one. */
export function positionWeight(mentions: AnswerMention[]): number | null {
  const target = mentions.find((mention) => mention.isTarget);
  if (!target) return null;
  const ordered = mentions
    .filter((mention) => mention.firstMentionOffset !== null)
    .sort((left, right) => (left.firstMentionOffset || 0) - (right.firstMentionOffset || 0));
  if (ordered.length && target.firstMentionOffset !== null) {
    const index = ordered.findIndex((mention) => mention === target);
    if (index >= 0) return 1 - index / ordered.length;
  }
  // No usable offsets. An unambiguous first position is still evidence; anything
  // else is unknown and must not be scored as if it were middling.
  if (target.firstMentionState === "unique") return 1;
  return null;
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function scoreAnswers(answers: PromptAnswer[]): VisibilityScore {
  const completed = answers.filter((answer) => answer.status === "completed");
  if (!completed.length) return emptyScore();

  const naming = completed.filter((answer) => answer.mentions.some((mention) => mention.isTarget));
  const presenceRate = naming.length / completed.length;

  const prominence = mean(
    naming.map((answer) => positionWeight(answer.mentions)).filter((value): value is number => value !== null),
  );
  const sentiment = mean(
    naming.flatMap((answer) => {
      const target = answer.mentions.find((mention) => mention.isTarget);
      return target ? [RECOMMENDATION_WEIGHT[target.recommendation]] : [];
    }),
  );

  // Never named is a real zero: it was measured, and the answer is none.
  if (!naming.length) {
    return { answers: completed.length, appearances: 0, presenceRate: 0, prominence: null, sentiment: null, score: 0, weights: SCORE_WEIGHTS };
  }

  const prominenceFactor = prominence === null ? 1 : PROMINENCE_FLOOR + (1 - PROMINENCE_FLOOR) * prominence;
  const sentimentFactor = sentiment === null ? 1 : SENTIMENT_FLOOR + (1 - SENTIMENT_FLOOR) * sentiment;

  return {
    answers: completed.length,
    appearances: naming.length,
    presenceRate,
    prominence,
    sentiment,
    score: Math.round(presenceRate * prominenceFactor * sentimentFactor * 1000) / 10,
    weights: SCORE_WEIGHTS,
  };
}
