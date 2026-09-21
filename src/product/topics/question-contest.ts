import { tokenize } from "./prompt-identity.js";
import type { PromptAnswer } from "./prompt-run-schema.js";
import type { Prompt } from "./topic-schema.js";

// How settled a question is, measured from the answers rather than from search
// volume nobody here can see. Being absent from a question every model answers
// the same way is a different problem from being absent from an open one.

/** "unknown" is not a fourth kind of field. It is the absence of a reading,
 * and calling an unasked question open would be inventing one. */
export type ContestState = "settled" | "contested" | "open" | "unknown";

export interface QuestionContest {
  promptId: string;
  text: string;
  answers: number;
  /** Distinct organisations named across those answers. */
  named: number;
  /** Named by exactly one answer: the churn at the edge of the field. */
  namedOnce: number;
  /** Share of answers whose first name is the most common first name. Null
   * when no answer gave a readable order. */
  leaderAgreement: number | null;
  usualLeader: string | null;
  /** Answers that named the brand, so an absence here has its context. */
  youNamed: number;
  state: ContestState;
  /** Why it was called that, in the figures it was called from. */
  reason: string;
}

/** How reliably one name comes first decides whether the question has an
 * owner. Both are a judgement, so both travel with the reading. */
export const SETTLED_AGREEMENT = 0.6;
export const OPEN_AGREEMENT = 0.4;

function firstNamed(answer: PromptAnswer): string | null {
  const ordered = answer.mentions
    .filter((mention) => mention.firstMentionOffset !== null)
    .sort((left, right) => (left.firstMentionOffset || 0) - (right.firstMentionOffset || 0));
  const head = ordered[0];
  return head ? head.name : null;
}

export function buildQuestionContest(input: { prompt: Prompt; answers: PromptAnswer[] }): QuestionContest {
  const completed = input.answers.filter((answer) => answer.status === "completed" && answer.promptId === input.prompt.id);
  const counts = new Map<string, { name: string; answers: number }>();
  const leaders = new Map<string, { name: string; answers: number }>();
  let youNamed = 0;

  for (const answer of completed) {
    const seen = new Set<string>();
    let named = false;
    for (const mention of answer.mentions) {
      const key = tokenize(mention.name).join(" ") || (mention.domain || "");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      if (mention.isTarget) named = true;
      const row = counts.get(key) || { name: mention.name, answers: 0 };
      row.answers += 1;
      counts.set(key, row);
    }
    if (named) youNamed += 1;
    const head = firstNamed(answer);
    if (head) {
      const key = tokenize(head).join(" ") || head;
      const row = leaders.get(key) || { name: head, answers: 0 };
      row.answers += 1;
      leaders.set(key, row);
    }
  }

  const ordered = [...leaders.values()].sort((left, right) => right.answers - left.answers);
  const top = ordered[0];
  const withOrder = ordered.reduce((total, row) => total + row.answers, 0);
  const leaderAgreement = withOrder ? (top ? top.answers / withOrder : null) : null;
  const named = counts.size;
  const namedOnce = [...counts.values()].filter((row) => row.answers === 1).length;

  // Nothing answered is no reading at all, not an open field.
  const state: ContestState = completed.length === 0
    ? "unknown"
    : leaderAgreement === null
      ? "open"
      : leaderAgreement >= SETTLED_AGREEMENT
        ? "settled"
        : leaderAgreement < OPEN_AGREEMENT
          ? "open"
          : "contested";

  const tail = `${named} organisation(s) named in total, ${namedOnce} of them by one answer only.`;
  const share = `${Math.round((leaderAgreement || 0) * 100)}%`;
  const reason = completed.length === 0
    ? "Nothing has been answered here, so nothing can be read about the field."
    : leaderAgreement === null
      ? `No answer gave a readable order, so nobody can be said to lead. ${tail}`
      : state === "settled"
        ? `${top?.name} is named first in ${share} of answers. ${tail}`
        : state === "open"
          ? `No name leads: the most common first name, ${top?.name}, takes only ${share} of answers. ${tail}`
          : `${top?.name} leads on ${share} of answers, which is not enough to own the question. ${tail}`;

  return {
    promptId: input.prompt.id,
    text: input.prompt.text,
    answers: completed.length,
    named,
    namedOnce,
    leaderAgreement,
    usualLeader: top ? top.name : null,
    youNamed,
    state,
    reason,
  };
}
