import { sha256 } from "../../utils/hash.js";
import { isPromptIntent, PROMPT_INTENTS, type PromptIntent } from "./topic-schema.js";

type Schema = Record<string, unknown>;

export const PROMPT_GENERATION_SCHEMA_NAME = "prompt_set_proposal";
export const PROMPT_GENERATION_TOOL_DESCRIPTION = "Propose the topics and buyer prompts to track, using the required schema.";

const promptItem: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["text", "intent"],
  properties: {
    text: { type: "string", description: "The question verbatim, as a buyer would type it. No placeholders." },
    intent: { type: "string", enum: PROMPT_INTENTS },
  },
};

const topicItem: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "description", "prompts"],
  properties: {
    name: { type: "string", description: "Two to four words naming a buying decision, not a marketing theme." },
    description: { type: "string", description: "One sentence on why a buyer in this topic matters." },
    prompts: { type: "array", items: promptItem },
  },
};

export const promptGenerationResponseSchema: Schema = {
  type: "object",
  description: "A proposed set of topics and prompts. This records suggestions, not measurements.",
  additionalProperties: false,
  required: ["analysisStatus", "topics", "unknowns"],
  properties: {
    analysisStatus: { type: "string", enum: ["completed", "unknown"] },
    topics: { type: "array", items: topicItem },
    unknowns: { type: "array", items: { type: "string" } },
  },
};

export const PROMPT_GENERATION_SCHEMA_HASH = sha256(JSON.stringify(promptGenerationResponseSchema));

const PROMPT_TEMPLATE = [
  "Propose the questions real buyers type into an AI assistant when they are solving the problem this company solves.",
  "Write each question exactly as a person would type it: lower case is fine, no placeholders, no brand-marketing phrasing.",
  "Group them into topics. A topic is a buying decision, such as how someone chooses between two kinds of tool.",
  "Cover several intents. Discovery questions name no company at all. Comparison and alternatives questions name a competitor.",
  "Only a brand intent question may name the company being tracked, and there should be few of those.",
  "Do not invent facts about the company. Use only what is supplied below.",
  "Return only the requested JSON schema.",
].join("\n");

export const PROMPT_GENERATION_PROMPT_HASH = sha256(PROMPT_TEMPLATE);
export const PROMPT_GENERATION_PROTOCOL_ID = "prompt-generation/v1";

export interface PromptGenerationSubject {
  brandName: string;
  domain: string;
  businessDescription: string | null;
  productCategory: string | null;
  competitors: Array<{ name: string; domain: string | null }>;
  topicCount: number;
  promptsPerTopic: number;
}

export function promptGenerationPrompt(subject: PromptGenerationSubject): string {
  const competitors = subject.competitors.length
    ? subject.competitors.map((item) => (item.domain ? `${item.name} (${item.domain})` : item.name)).join(", ")
    : "None have been identified yet, so do not name any.";
  return [
    PROMPT_TEMPLATE,
    `Company: ${subject.brandName}`,
    `Domain: ${subject.domain}`,
    `What it does: ${subject.businessDescription || "Not established. Do not guess at it."}`,
    `Category: ${subject.productCategory || "Not established. Do not guess at it."}`,
    `Known competitors: ${competitors}`,
    `Propose ${subject.topicCount} topics with about ${subject.promptsPerTopic} prompts each.`,
    `Protocol: ${PROMPT_GENERATION_PROTOCOL_ID}`,
    "Use English for all string values.",
  ].join("\n");
}

export interface ProposedPrompt {
  text: string;
  intent: PromptIntent;
}

export interface ProposedTopic {
  name: string;
  description: string;
  prompts: ProposedPrompt[];
}

export interface PromptSetProposal {
  analysisStatus: "completed" | "unknown";
  topics: ProposedTopic[];
  unknowns: string[];
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** A malformed topic is dropped rather than repaired: an invented prompt would
 * survive review looking exactly like a real one. */
export function parsePromptSetProposal(raw: unknown): PromptSetProposal {
  const root = asObject(raw);
  const status = text(root?.analysisStatus) === "completed" ? "completed" : "unknown";
  const topics: ProposedTopic[] = [];
  for (const value of asArray(root?.topics)) {
    const row = asObject(value);
    const name = text(row?.name);
    if (!name) continue;
    const prompts: ProposedPrompt[] = [];
    for (const promptValue of asArray(row?.prompts)) {
      const promptRow = asObject(promptValue);
      const promptText = text(promptRow?.text);
      const intent = promptRow?.intent;
      if (!promptText || !isPromptIntent(intent)) continue;
      prompts.push({ text: promptText, intent });
    }
    if (!prompts.length) continue;
    topics.push({ name, description: text(row?.description), prompts });
  }
  const unknowns = asArray(root?.unknowns).map(text).filter(Boolean);
  // A proposal with no usable topic is unknown, never an empty success.
  return { analysisStatus: topics.length ? status : "unknown", topics, unknowns };
}
