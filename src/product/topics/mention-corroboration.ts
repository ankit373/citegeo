import { tokenize } from "./prompt-identity.js";
import type { AnswerMention, MentionCorroboration } from "./prompt-run-schema.js";

// The model writes the answer and then reports which organisations its answer
// named, in one call. The reading is not independent of the writing, so every
// part of the report that can be checked against the text is checked here.
//
// What cannot be checked stays as the model's own word, and says so.

export const CORROBORATION_CAVEAT = "Names are checked against the answer text and positions are measured from it. Whether a mention recommends or rejects stays the model's own word, because nothing here can check it. Where a provider answered, one call both wrote the answer and reported what it named, so that reading is not independent of the writing. An answer read off a browser surface was reported on by a different model, which is independent of the one that wrote it.";

/** Whole tokens, the same rule the rest of the product matches names by. */
function positionOf(tokens: string[], name: string): number {
  const needle = tokenize(name);
  if (!needle.length || needle.length > tokens.length) return -1;
  for (let start = 0; start <= tokens.length - needle.length; start += 1) {
    let all = true;
    for (let step = 0; step < needle.length; step += 1) {
      if (tokens[start + step] !== needle[step]) { all = false; break; }
    }
    if (all) return start;
  }
  return -1;
}

export interface CorroboratedMention extends AnswerMention {
  corroboration: MentionCorroboration;
  /** True where the quote given as evidence is really in the answer. */
  quoteInAnswer: boolean;
}

/** Positions are recounted from the answer rather than taken from the model,
 * which reports an order it is not reading off anything. */
export function corroborateMentions(input: { answer: string; mentions: AnswerMention[] }): CorroboratedMention[] {
  const tokens = tokenize(input.answer);
  const placed = input.mentions.map((mention) => ({ mention, at: positionOf(tokens, mention.name) }));
  const found = placed.filter((row) => row.at >= 0).map((row) => row.at).sort((left, right) => left - right);

  return placed.map(({ mention, at }) => {
    const quoteInAnswer = Boolean(mention.mentionQuote) && input.answer.includes(mention.mentionQuote || "");
    if (at < 0) {
      // Reported by the model and not in the answer it wrote. Keeping its
      // position would rank a mention that is not there.
      return { ...mention, firstMentionOffset: null, firstMentionState: "none" as const, corroboration: "absent_from_answer" as const, quoteInAnswer };
    }
    const tied = found.filter((value) => value === at).length > 1;
    return {
      ...mention,
      firstMentionOffset: at,
      firstMentionState: tied ? ("tied" as const) : ("unique" as const),
      corroboration: tied ? ("named_only" as const) : ("measured" as const),
      quoteInAnswer,
    };
  });
}

export interface CorroborationSummary {
  reported: number;
  measured: number;
  namedOnly: number;
  absentFromAnswer: number;
  quotesChecked: number;
  quotesFound: number;
  caveat: string;
}

export function summariseCorroboration(mentions: CorroboratedMention[]): CorroborationSummary {
  const quoted = mentions.filter((row) => Boolean(row.mentionQuote));
  return {
    reported: mentions.length,
    measured: mentions.filter((row) => row.corroboration === "measured").length,
    namedOnly: mentions.filter((row) => row.corroboration === "named_only").length,
    absentFromAnswer: mentions.filter((row) => row.corroboration === "absent_from_answer").length,
    quotesChecked: quoted.length,
    quotesFound: quoted.filter((row) => row.quoteInAnswer).length,
    caveat: CORROBORATION_CAVEAT,
  };
}
