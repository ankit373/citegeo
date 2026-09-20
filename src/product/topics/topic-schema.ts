// Profound's unit of measurement is the question a buyer actually types, not a
// keyword. "best stock screener for indian markets" and "screener.in
// alternatives" reach the same buyer through different answers, and a keyword
// collapses them into one. Prompts are grouped into topics so every metric can
// be read per topic rather than only per model.

/** How a buyer is asking, which decides what the answer can be used to measure. */
export type PromptIntent =
  /** "best X", "top X tools". No brand named, so visibility here is earned. */
  | "discovery"
  /** "X vs Y". Both names supplied, so it measures how you are framed, not whether you appear. */
  | "comparison"
  /** "alternatives to X". Names a rival, not you. */
  | "alternatives"
  /** "is X any good". Names you, so the model will discuss you whatever it thinks. */
  | "brand"
  /** "how do I screen for breakouts". Names a job, not a product. */
  | "problem";

export const PROMPT_INTENTS: PromptIntent[] = ["discovery", "comparison", "alternatives", "brand", "problem"];

export function isPromptIntent(value: unknown): value is PromptIntent {
  return typeof value === "string" && (PROMPT_INTENTS as string[]).includes(value);
}

export type EntityStatus = "proposed" | "active" | "retired";
export type EntitySource = "generated" | "authored";

export interface Topic {
  id: string;
  projectId: string;
  name: string;
  /** Why this topic is worth tracking, in the user's terms. */
  description: string;
  source: EntitySource;
  status: EntityStatus;
  createdAt: string;
}

export interface Prompt {
  id: string;
  projectId: string;
  topicId: string;
  /** Verbatim, as a buyer would type it. Never a template. */
  text: string;
  normalizedText: string;
  intent: PromptIntent;
  source: EntitySource;
  /**
   * False when the prompt names the brand. The model will then discuss the
   * brand whatever it thinks of it, so an appearance is not evidence of
   * visibility. Those prompts still measure sentiment and framing.
   */
  measuresVisibility: boolean;
  /** Why it does not, when it does not. */
  visibilityExclusionReason: "names_the_brand" | null;
  status: EntityStatus;
  createdAt: string;
  activatedAt: string | null;
}

export interface TopicSet {
  projectId: string;
  topics: Topic[];
  prompts: Prompt[];
  /** When a model last proposed a set for this project. Null when authored by hand. */
  generatedAt: string | null;
  updatedAt: string;
}

export function emptyTopicSet(projectId: string): TopicSet {
  return { projectId, topics: [], prompts: [], generatedAt: null, updatedAt: new Date().toISOString() };
}

export function normalizePrompt(text: string): string {
  return text.trim().toLocaleLowerCase();
}

/** Prompts that can be used to measure whether the brand is found rather than discussed. */
export function visibilityPrompts(set: TopicSet): Prompt[] {
  return set.prompts.filter((prompt) => prompt.status === "active" && prompt.measuresVisibility);
}

export function activePrompts(set: TopicSet): Prompt[] {
  return set.prompts.filter((prompt) => prompt.status === "active");
}

export function promptsForTopic(set: TopicSet, topicId: string): Prompt[] {
  return set.prompts.filter((prompt) => prompt.topicId === topicId);
}
