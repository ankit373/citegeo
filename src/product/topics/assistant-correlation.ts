// Visibility is measured by asking an API. Arrivals are counted from the
// consumer app. They are related and they are not the same measurement.

export interface VisibilityByModel {
  providerId: string;
  displayName: string;
  score: number | null;
  answers: number;
}

export interface ArrivalBySource {
  source: string;
  sessions: number;
  engaged: number;
}

/** Which provider family answers for which consumer assistant. A model rented
 * through a cloud is still that vendor's model, so it maps to the same one. */
const FAMILY: Record<string, string> = {
  openai: "chatgpt",
  anthropic: "claude",
  gemini: "gemini",
  perplexity: "perplexity",
  deepseek: "deepseek",
  "azure-openai": "chatgpt",
  copilot: "copilot",
};

export function familyOf(value: string): string {
  const key = value.trim().toLowerCase();
  if (FAMILY[key]) return FAMILY[key] as string;
  for (const [id, family] of Object.entries(FAMILY)) {
    if (key.includes(family) || key.includes(id)) return family;
  }
  return key;
}

export type Quadrant = "working" | "named_no_arrivals" | "arrivals_not_named" | "absent" | "not_measurable";

export interface AssistantLink {
  assistant: string;
  /** Null when nothing was asked of this family here. */
  score: number | null;
  answers: number;
  sessions: number;
  engaged: number;
  quadrant: Quadrant;
}

/**
 * Named and nobody arrives is a different problem from arrivals nothing here
 * explains, and reporting either as one number hides which you have.
 */
export function quadrantFor(score: number | null, answers: number, sessions: number): Quadrant {
  if (answers === 0 && sessions === 0) return "not_measurable";
  if (answers === 0) return "arrivals_not_named";
  if (score === null) return "not_measurable";
  const named = score > 0;
  if (named && sessions > 0) return "working";
  if (named) return "named_no_arrivals";
  if (sessions > 0) return "arrivals_not_named";
  return "absent";
}

export function linkAssistants(input: {
  visibility: VisibilityByModel[];
  arrivals: ArrivalBySource[];
}): AssistantLink[] {
  const byFamily = new Map<string, { score: number | null; answers: number; sessions: number; engaged: number }>();
  const touch = (family: string) => {
    const row = byFamily.get(family) || { score: null, answers: 0, sessions: 0, engaged: 0 };
    byFamily.set(family, row);
    return row;
  };
  // Several models can answer for one assistant, so the score is weighted by
  // how many answers each contributed rather than averaged flat.
  const weighted = new Map<string, { total: number; answers: number }>();
  for (const model of input.visibility) {
    const family = familyOf(model.providerId);
    const row = touch(family);
    row.answers += model.answers;
    if (model.score !== null && model.answers > 0) {
      const carry = weighted.get(family) || { total: 0, answers: 0 };
      carry.total += model.score * model.answers;
      carry.answers += model.answers;
      weighted.set(family, carry);
    }
  }
  for (const [family, carry] of weighted) {
    const row = touch(family);
    row.score = carry.answers > 0 ? Math.round((carry.total / carry.answers) * 10) / 10 : null;
  }
  for (const arrival of input.arrivals) {
    const row = touch(familyOf(arrival.source));
    row.sessions += arrival.sessions;
    row.engaged += arrival.engaged;
  }
  return [...byFamily.entries()]
    .map(([assistant, row]) => ({
      assistant,
      score: row.score,
      answers: row.answers,
      sessions: row.sessions,
      engaged: row.engaged,
      quadrant: quadrantFor(row.score, row.answers, row.sessions),
    }))
    .sort((left, right) => right.sessions - left.sessions || right.answers - left.answers);
}

export const CORRELATION_CAVEAT =
  "Visibility here is measured by putting the question to a provider API. Arrivals are counted from the assistant people actually use, which runs its own retrieval. The two move together often enough to be worth reading side by side, and neither explains the other.";
