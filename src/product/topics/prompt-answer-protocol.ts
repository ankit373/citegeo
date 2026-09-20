import { sha256 } from "../../utils/hash.js";
import type { DiscoveryRecommendation, FirstPositionState } from "../measurements/measurement-schema.js";

type Schema = Record<string, unknown>;

export const PROMPT_ANSWER_SCHEMA_NAME = "prompt_answer_result";
export const PROMPT_ANSWER_TOOL_DESCRIPTION = "Answer the question, then record every organisation named in your answer.";

const nullableString: Schema = { type: ["string", "null"] };
const nullableInteger: Schema = { type: ["integer", "null"], minimum: 0 };

const mention: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "domain", "recommendation", "mentionQuote", "firstMentionOffset", "firstMentionState"],
  properties: {
    name: { type: "string" },
    domain: nullableString,
    recommendation: { type: "string", enum: ["positive", "negative", "mentioned", "uncertain"] },
    mentionQuote: nullableString,
    firstMentionOffset: nullableInteger,
    firstMentionState: { type: "string", enum: ["unique", "tied", "none", "unresolved"] },
  },
};

export const promptAnswerResponseSchema: Schema = {
  type: "object",
  description: "One answer to a buyer's question, plus the organisations it named.",
  additionalProperties: false,
  required: ["analysisStatus", "answer", "mentions", "citationUrls"],
  properties: {
    analysisStatus: { type: "string", enum: ["completed", "unknown"] },
    answer: { type: "string", description: "The answer as you would give it to the person asking." },
    mentions: { type: "array", items: mention },
    citationUrls: { type: "array", items: { type: "string" }, description: "Only URLs this response actually cited." },
  },
};

export const PROMPT_ANSWER_SCHEMA_HASH = sha256(JSON.stringify(promptAnswerResponseSchema));

const PROMPT_TEMPLATE = [
  "Answer the question below the way you would answer it for the person asking. Do not adjust it for anyone watching.",
  "Then list every identifiable product or organization your answer named, including ones you did not recommend.",
  "For each, state whether your answer recommends it, rejects it, merely mentions it, or leaves it uncertain.",
  "Quote your own answer as the evidence. Record a unique first position only where your answer gives an unambiguous order, and otherwise tied, none or unresolved.",
  "Do not infer which brand is being tracked, and do not favour or avoid any name because of this instruction.",
  "Return only the requested JSON schema.",
].join("\n");

export const PROMPT_ANSWER_PROMPT_HASH = sha256(PROMPT_TEMPLATE);

export function promptAnswerPrompt(input: { question: string; language: "en" }): string {
  return [
    PROMPT_TEMPLATE,
    `Question: ${input.question}`,
    "Use English for all string values.",
  ].join("\n");
}

export interface StructuredPromptAnswer {
  analysisStatus: "completed" | "unknown";
  answer: string;
  mentions: Array<{
    name: string;
    domain: string | null;
    recommendation: DiscoveryRecommendation;
    mentionQuote: string | null;
    firstMentionOffset: number | null;
    firstMentionState: FirstPositionState;
  }>;
  citationUrls: string[];
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

const RECOMMENDATIONS = ["positive", "negative", "mentioned", "uncertain"];
const POSITIONS = ["unique", "tied", "none", "unresolved"];

export function parsePromptAnswerOutput(raw: unknown): StructuredPromptAnswer {
  const root = asObject(raw);
  const mentions: StructuredPromptAnswer["mentions"] = [];
  for (const value of asArray(root?.mentions)) {
    const row = asObject(value);
    const name = text(row?.name);
    if (!name) continue;
    const recommendation = text(row?.recommendation);
    const position = text(row?.firstMentionState);
    mentions.push({
      name,
      domain: text(row?.domain) || null,
      // An unreadable judgement is uncertain, never a neutral-looking "mentioned".
      recommendation: (RECOMMENDATIONS.includes(recommendation) ? recommendation : "uncertain") as DiscoveryRecommendation,
      mentionQuote: text(row?.mentionQuote) || null,
      firstMentionOffset: typeof row?.firstMentionOffset === "number" ? row.firstMentionOffset : null,
      firstMentionState: (POSITIONS.includes(position) ? position : "unresolved") as FirstPositionState,
    });
  }
  const answer = text(root?.answer);
  const status = text(root?.analysisStatus) === "completed" && answer ? "completed" : "unknown";
  return {
    analysisStatus: status,
    answer,
    mentions,
    citationUrls: asArray(root?.citationUrls).map(text).filter(Boolean),
  };
}
