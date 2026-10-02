import type { Prompt, TopicSet } from "./topic-schema.js";
import type { PromptAnswer } from "./prompt-run-schema.js";

// Asking the same question in other words is a different test from asking it
// again. Repetition holds the wording and varies the day. This holds the day
// and varies the wording, and the two together separate a brand that is visible
// for an intent from one that is visible for an exact string.
//
// A wording nobody has written down cannot be compared, so a question with no
// rewording says nothing here rather than reading as stable.

/** One question, one model, one market, one language, one persona. Only the
 * words change, or a difference between them would mean two things. */
function groupKey(answer: PromptAnswer, root: string): string {
  return [root, answer.providerId, answer.modelId, answer.regionId, answer.languageId, answer.personaId || "anyone"].join("\u0000");
}

export const PHRASING_CAVEAT = "Measured between answers to wordings of one question, with the model, market, language and persona held still, so what moved is the words. A wording that names the brand is left out, because the model will discuss it whatever it thinks and the difference would be the name rather than the words. Each wording is asked as many times as the run asks, and a wording asked once carries whatever the day did to it, which is why this reads next to how much the answer moves rather than instead of it.";

export interface WordingResult {
  promptId: string;
  text: string;
  /** Answers to this wording under these conditions. */
  answers: number;
  /** How many of them named the brand. */
  named: number;
}

export interface QuestionPhrasing {
  /** The prompt the others are rewordings of. */
  rootId: string;
  rootText: string;
  modelId: string;
  wordings: WordingResult[];
  /** Wordings where the brand was named at least once. */
  namedIn: number;
  /** True where every wording agreed, either always naming it or never. */
  agreed: boolean;
  /** Widest gap in naming rate between two wordings. Null where a wording
   * produced no answer to take a rate from. */
  spread: number | null;
}

export interface PhrasingReport {
  /** Questions with more than one wording asked under matching conditions. */
  measured: number;
  /** Wordings left out because they name the brand. The model will discuss it
   * whatever it thinks, so the difference would be the name, not the words. */
  namesTheBrand: number;
  /** Questions asked in one wording only, which say nothing about phrasing. */
  oneWording: number;
  /** Questions where the wordings disagreed about whether the brand appears. */
  unstable: number;
  /** Mean widest gap across the measured questions. Null with none. */
  spread: number | null;
  questions: QuestionPhrasing[];
  caveat: string;
}

/** The prompt a rewording belongs to. A prompt that rewords nothing is its own
 * root, so an untouched project groups exactly as it did before. */
export function rootOf(prompt: Prompt): string {
  return prompt.variantOf || prompt.id;
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function buildPhrasingReport(answers: PromptAnswer[], set: TopicSet): PhrasingReport {
  const prompts = new Map(set.prompts.map((prompt) => [prompt.id, prompt]));
  const groups = new Map<string, Map<string, PromptAnswer[]>>();

  const excluded = new Set<string>();
  for (const answer of answers) {
    if (answer.status !== "completed") continue;
    const prompt = prompts.get(answer.promptId);
    if (!prompt) continue;
    // A wording that names the brand is not a wording of the same question.
    // The model will discuss it whatever it thinks, so comparing it against
    // one that does not would report the name as the words.
    if (!prompt.measuresVisibility) { excluded.add(prompt.id); continue; }
    const root = rootOf(prompt);
    const key = groupKey(answer, root);
    const byWording = groups.get(key) || new Map<string, PromptAnswer[]>();
    const rows = byWording.get(answer.promptId) || [];
    rows.push(answer);
    byWording.set(answer.promptId, rows);
    groups.set(key, byWording);
  }

  const questions: QuestionPhrasing[] = [];
  let oneWording = 0;
  for (const byWording of groups.values()) {
    if (byWording.size < 2) { oneWording += 1; continue; }
    const wordings: WordingResult[] = [];
    for (const [promptId, rows] of byWording) {
      const first = rows[0] as PromptAnswer;
      wordings.push({
        promptId,
        text: first.promptText,
        answers: rows.length,
        named: rows.filter((row) => row.mentions.some((mention) => mention.isTarget)).length,
      });
    }
    // Loudest disagreement first, because that is the question whose figure
    // depends most on which words somebody happened to type.
    const rates = wordings.map((row) => row.named / row.answers);
    const spread = rates.length ? Math.max(...rates) - Math.min(...rates) : null;
    const namedIn = wordings.filter((row) => row.named > 0).length;
    const root = [...byWording.values()][0]?.[0] as PromptAnswer;
    const rootPrompt = prompts.get(root.promptId);
    const rootId = rootPrompt ? rootOf(rootPrompt) : root.promptId;
    questions.push({
      rootId,
      rootText: prompts.get(rootId)?.text || root.promptText,
      modelId: root.modelId,
      wordings: wordings.sort((left, right) => right.named / right.answers - left.named / left.answers),
      namedIn,
      agreed: namedIn === 0 || namedIn === wordings.length,
      spread,
    });
  }

  questions.sort((left, right) => (right.spread ?? -1) - (left.spread ?? -1));
  const spreads = questions.map((row) => row.spread).filter((value): value is number => value !== null);
  return {
    measured: questions.length,
    namesTheBrand: excluded.size,
    oneWording,
    unstable: questions.filter((row) => !row.agreed).length,
    spread: mean(spreads),
    questions,
    caveat: PHRASING_CAVEAT,
  };
}
