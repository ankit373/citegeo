import type { PromptAnswer } from "./prompt-run-schema.js";

// A study of 100k responses across 100+ brands found that whether a brand is
// framed well or badly flips far more often than whether it is named at all,
// by roughly a factor of seven. Naming has a stability figure in this product
// and framing, which is the more volatile half of the score, had none.
//
// Measured the same way: answers to one question under identical conditions,
// so what moved is the surface rather than the question.

/** Published ratio of how much more often framing flips than naming. Carried
 * so a project can see whether its own answers behave like the population. */
export const PUBLISHED_FLIP_RATIO = 6.7;

export const SENTIMENT_CAVEAT = "Measured between answers to one question under identical conditions, counting only the passes that named the brand, because a pass that never named it did not frame it either. Framing is the model's own word and nothing here can check whether it is fair, only whether it is steady.";

function groupKey(answer: PromptAnswer): string {
  return [answer.promptId, answer.providerId, answer.modelId, answer.regionId, answer.languageId, answer.personaId || "anyone"].join("\u0000");
}

export interface QuestionFraming {
  promptId: string;
  promptText: string;
  modelId: string;
  /** Passes that named the brand, which are the only ones that framed it. */
  named: number;
  /** Distinct framings across those passes. One is steady. */
  framings: string[];
  steady: boolean;
}

export interface SentimentVolatility {
  /** Questions named more than once under identical conditions. */
  measured: number;
  /** Of those, how many used more than one framing. */
  flipped: number;
  /** flipped over measured. Null with nothing measured. */
  flipRate: number | null;
  /** Questions whose naming disagreed across passes, for the comparison the
   * published ratio is about. */
  namingFlipped: number;
  namingFlipRate: number | null;
  /** How much more often framing flipped than naming did, here. Null where
   * naming never flipped, because that is a division by nought and not a
   * very large ratio. */
  ratio: number | null;
  publishedRatio: number;
  questions: QuestionFraming[];
  caveat: string;
}

export function buildSentimentVolatility(answers: PromptAnswer[]): SentimentVolatility {
  const groups = new Map<string, PromptAnswer[]>();
  for (const answer of answers) {
    if (answer.status !== "completed") continue;
    const key = groupKey(answer);
    const rows = groups.get(key) || [];
    rows.push(answer);
    groups.set(key, rows);
  }

  const questions: QuestionFraming[] = [];
  let namingMeasured = 0;
  let namingFlipped = 0;
  for (const rows of groups.values()) {
    if (rows.length < 2) continue;
    namingMeasured += 1;
    const naming = rows.filter((row) => row.mentions.some((mention) => mention.isTarget));
    if (naming.length && naming.length !== rows.length) namingFlipped += 1;
    // Only the passes that named it framed it. Counting the rest as a framing
    // would make a brand that vanished look like one that was described badly.
    if (naming.length < 2) continue;
    const framings = [...new Set(naming.map((row) => {
      const mine = row.mentions.find((mention) => mention.isTarget);
      return mine ? mine.recommendation : "";
    }).filter(Boolean))].sort();
    const first = naming[0] as PromptAnswer;
    questions.push({
      promptId: first.promptId,
      promptText: first.promptText,
      modelId: first.modelId,
      named: naming.length,
      framings,
      steady: framings.length <= 1,
    });
  }

  // Least steady first: that is the question whose framing means least.
  questions.sort((left, right) => right.framings.length - left.framings.length);
  const measured = questions.length;
  const flipped = questions.filter((row) => !row.steady).length;
  const flipRate = measured ? flipped / measured : null;
  const namingFlipRate = namingMeasured ? namingFlipped / namingMeasured : null;
  return {
    measured,
    flipped,
    flipRate,
    namingFlipped,
    namingFlipRate,
    ratio: flipRate !== null && namingFlipRate ? Math.round((flipRate / namingFlipRate) * 10) / 10 : null,
    publishedRatio: PUBLISHED_FLIP_RATIO,
    questions,
    caveat: SENTIMENT_CAVEAT,
  };
}
