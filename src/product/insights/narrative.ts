// How a model talks about a brand, not just whether it knows it. Profound calls
// this sentiment and narrative analysis.
//
// This is the one analysis in the product that is a judgement rather than an
// observation, so it is bounded hard: the classifier is given the stored answer
// and nothing else, anything it returns outside the allowed set becomes
// "unknown", and the raw response is kept so the judgement can be checked. It
// never rewrites or summarises the answer it was given.

export type Sentiment = "positive" | "neutral" | "negative" | "unknown";

const ALLOWED: Sentiment[] = ["positive", "neutral", "negative"];

export interface NarrativeJudgement {
  modelRunId: string;
  /** The model whose answer was judged, not the one doing the judging. */
  modelId: string;
  sentiment: Sentiment;
  /** Short phrases the classifier lifted from the answer, never invented prose. */
  themes: string[];
  /** Kept so a reader can disagree with the judgement. */
  raw: string;
}

export interface NarrativeSummary {
  judged: number;
  counts: Record<Sentiment, number>;
  /** null when nothing could be judged, so silence never reads as neutral. */
  dominant: Sentiment | null;
  themes: Array<{ theme: string; count: number }>;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/**
 * Reads a classifier reply. Anything unexpected is "unknown" rather than a
 * nearest guess, because a wrong sentiment about a brand is worse than none.
 */
export function parseJudgement(raw: string): { sentiment: Sentiment; themes: string[] } {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return { sentiment: "unknown", themes: [] };
  }
  const root = asObject(payload);
  const claimed = typeof root?.sentiment === "string" ? root.sentiment.trim().toLocaleLowerCase() : "";
  const sentiment = ALLOWED.includes(claimed as Sentiment) ? (claimed as Sentiment) : "unknown";
  const themes: string[] = [];
  const list = Array.isArray(root?.themes) ? root.themes : [];
  for (const value of list) {
    if (typeof value !== "string") continue;
    const theme = value.trim();
    // A "theme" longer than a phrase is the classifier writing prose, which is
    // not what was asked for and not evidence of anything.
    if (theme && theme.length <= 60) themes.push(theme);
  }
  return { sentiment, themes: [...new Set(themes)] };
}

export function summariseNarrative(judgements: NarrativeJudgement[]): NarrativeSummary {
  const counts: Record<Sentiment, number> = { positive: 0, neutral: 0, negative: 0, unknown: 0 };
  const themes = new Map<string, { theme: string; count: number }>();

  for (const judgement of judgements) {
    counts[judgement.sentiment] += 1;
    for (const theme of new Set(judgement.themes.map((value) => value.toLocaleLowerCase()))) {
      const existing = themes.get(theme) || { theme, count: 0 };
      existing.count += 1;
      themes.set(theme, existing);
    }
  }

  const decided = ALLOWED.map((value) => ({ value, count: counts[value] })).filter((row) => row.count > 0);
  const top = decided.sort((left, right) => right.count - left.count);
  // A tie has no dominant reading, and reporting one would invent a majority.
  const dominant = top.length && (top.length === 1 || top[0]!.count > top[1]!.count) ? top[0]!.value : null;

  return {
    judged: judgements.length,
    counts,
    dominant,
    themes: [...themes.values()].sort((left, right) => right.count - left.count || left.theme.localeCompare(right.theme)),
  };
}

export const NARRATIVE_INSTRUCTION = [
  "You are labelling an existing answer, not answering a question.",
  "Reply with JSON only, no prose, in this exact shape:",
  '{"sentiment":"positive|neutral|negative","themes":["short phrase","short phrase"]}',
  "sentiment is how the answer portrays the brand.",
  "themes are at most five short phrases taken from the answer itself.",
  "Do not infer anything the answer does not say. If the answer says nothing about the brand, use neutral and an empty themes list.",
].join("\n");
