import { tokenize } from "./prompt-identity.js";
import type { PromptAnswer } from "./prompt-run-schema.js";
import type { Prompt } from "./topic-schema.js";

// What the models rewarded on one question, in their own words. A score says
// you lost it; the quotes say what the winners were credited with.

export interface BriefVoice {
  name: string;
  domain: string | null;
  isTarget: boolean;
  /** Answers naming them, of the answers considered here. */
  answers: number;
  positive: number;
  negative: number;
  /** Mean position weight, 1 when always named first. Null when unresolvable. */
  prominence: number | null;
  /** The models' own words. Deduplicated, longest first. */
  quotes: string[];
}

export interface PromptBrief {
  promptId: string;
  text: string;
  /** Completed answers behind this brief. A failed answer is not a zero. */
  answers: number;
  answersFailed: number;
  appearances: number;
  /** Assistants that named the brand here, and the ones that did not. */
  namedBy: string[];
  missedBy: string[];
  /** Assistants that name the brand on other questions, so the gap is this
   * question rather than the brand itself. */
  namesYouElsewhere: string[];
  voices: BriefVoice[];
  /** What the models said about the brand here, including the unkind ones. */
  yourQuotes: string[];
  sources: string[];
  /** One sentence naming the state this question is in. */
  verdict: string;
}

function quoteKey(quote: string): string {
  return tokenize(quote).join(" ");
}

function orderedMentions(answer: PromptAnswer) {
  return answer.mentions
    .filter((mention) => mention.firstMentionOffset !== null)
    .sort((left, right) => (left.firstMentionOffset || 0) - (right.firstMentionOffset || 0));
}

function entityKey(name: string, domain: string | null): string {
  return tokenize(name).join(" ") || (domain || "");
}

export function buildPromptBrief(input: { prompt: Prompt; answers: PromptAnswer[]; allAnswers?: PromptAnswer[] }): PromptBrief {
  const mine = input.answers.filter((answer) => answer.promptId === input.prompt.id);
  const completed = mine.filter((answer) => answer.status === "completed");
  const failed = mine.length - completed.length;

  const rows = new Map<string, BriefVoice & { positions: number[]; keys: Set<string> }>();
  const namedBy: string[] = [];
  const missedBy: string[] = [];
  const sources = new Set<string>();
  let appearances = 0;

  for (const answer of completed) {
    for (const url of answer.citationUrls) sources.add(url);
    const ordered = orderedMentions(answer);
    const seen = new Set<string>();
    let namedHere = false;
    for (const mention of answer.mentions) {
      const key = entityKey(mention.name, mention.domain);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      if (mention.isTarget) namedHere = true;
      const existing = rows.get(key) || {
        name: mention.name,
        domain: mention.domain,
        isTarget: mention.isTarget,
        answers: 0,
        positive: 0,
        negative: 0,
        prominence: null,
        quotes: [],
        positions: [],
        keys: new Set<string>(),
      };
      existing.answers += 1;
      if (mention.isTarget) existing.isTarget = true;
      if (!existing.domain && mention.domain) existing.domain = mention.domain;
      if (mention.recommendation === "positive") existing.positive += 1;
      if (mention.recommendation === "negative") existing.negative += 1;
      const quote = (mention.mentionQuote || "").trim();
      const dedupe = quoteKey(quote);
      if (quote && dedupe && !existing.keys.has(dedupe)) {
        existing.keys.add(dedupe);
        existing.quotes.push(quote);
      }
      const index = ordered.indexOf(mention);
      if (ordered.length && index >= 0) existing.positions.push(1 - index / ordered.length);
      else if (mention.firstMentionState === "unique") existing.positions.push(1);
      rows.set(key, existing);
    }
    if (namedHere) appearances += 1;
    (namedHere ? namedBy : missedBy).push(answer.modelDisplayName);
  }

  const voices: BriefVoice[] = [...rows.values()]
    .map((row) => ({
      name: row.name,
      domain: row.domain,
      isTarget: row.isTarget,
      answers: row.answers,
      positive: row.positive,
      negative: row.negative,
      prominence: row.positions.length ? row.positions.reduce((total, value) => total + value, 0) / row.positions.length : null,
      // Longest first: the fuller sentence is the one that states a reason.
      quotes: row.quotes.sort((left, right) => right.length - left.length).slice(0, 4),
    }))
    .sort((left, right) => right.answers - left.answers || (right.prominence || 0) - (left.prominence || 0));

  const elsewhere = new Set<string>();
  for (const answer of input.allAnswers || []) {
    if (answer.promptId === input.prompt.id || answer.status !== "completed") continue;
    if (answer.mentions.some((mention) => mention.isTarget)) elsewhere.add(answer.modelDisplayName);
  }

  const you = voices.find((voice) => voice.isTarget);
  const leader = voices.find((voice) => !voice.isTarget);
  const verdict = completed.length === 0
    ? failed
      ? `${failed} answer(s) to this question failed, so nothing here is measured. That is not a zero.`
      : "Nothing has been asked here yet."
    : appearances === completed.length
      ? `Every one of the ${completed.length} answer(s) named you.`
      : appearances > 0
        ? `${appearances} of ${completed.length} answer(s) named you. The rest named ${leader ? leader.name : "somebody else"}.`
        : elsewhere.size
          ? `No answer here named you, though ${elsewhere.size} assistant(s) name you on other questions. The gap is this question, not the brand.`
          : `No answer here named you, and none elsewhere in this project has either.`;

  return {
    promptId: input.prompt.id,
    text: input.prompt.text,
    answers: completed.length,
    answersFailed: failed,
    appearances,
    namedBy: [...new Set(namedBy)],
    missedBy: [...new Set(missedBy)],
    namesYouElsewhere: [...elsewhere],
    voices,
    yourQuotes: you ? you.quotes : [],
    sources: [...sources],
    verdict,
  };
}
