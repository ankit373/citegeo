import { sha256 } from "../../utils/hash.js";
import type { DiscoveryRecommendation, FirstPositionState } from "../measurements/measurement-schema.js";

// A browser engine returns prose, not a schema. The mentions have to be read
// out of it afterwards, by a model that is told to read and not to answer.

type Schema = Record<string, unknown>;

export const ENGINE_ANALYSIS_SCHEMA_NAME = "engine_answer_analysis";
export const ENGINE_ANALYSIS_TOOL_DESCRIPTION = "Record every organisation an answer named, without adding any of your own.";

const nullableString: Schema = { type: ["string", "null"] };

const mention: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "domain", "recommendation", "mentionQuote", "firstMentionOffset", "firstMentionState"],
  properties: {
    name: { type: "string" },
    domain: nullableString,
    recommendation: { type: "string", enum: ["positive", "negative", "mentioned", "uncertain"] },
    mentionQuote: nullableString,
    firstMentionOffset: { type: ["integer", "null"], minimum: 0 },
    firstMentionState: { type: "string", enum: ["unique", "tied", "none", "unresolved"] },
  },
};

export const engineAnalysisResponseSchema: Schema = {
  type: "object",
  description: "The organisations an answer named, read out of the answer text.",
  additionalProperties: false,
  required: ["analysisStatus", "mentions"],
  properties: {
    analysisStatus: { type: "string", enum: ["completed", "unknown"] },
    mentions: { type: "array", items: mention },
  },
};

export const ENGINE_ANALYSIS_SCHEMA_HASH = sha256(JSON.stringify(engineAnalysisResponseSchema));

const TEMPLATE = [
  "Below is a question and an answer somebody else gave to it. Read the answer. Do not answer the question yourself.",
  "List every identifiable product or organization the answer named, including ones it did not recommend.",
  "For each, state whether the answer recommends it, rejects it, merely mentions it, or leaves it uncertain.",
  "Quote the answer as the evidence. Record a unique first position only where the answer gives an unambiguous order, and otherwise tied, none or unresolved.",
  "Add nothing the answer did not name. An answer that named nobody has an empty list, which is a correct result.",
  "Return only the requested JSON schema.",
].join("\n");

export const ENGINE_ANALYSIS_PROMPT_HASH = sha256(TEMPLATE);

export function engineAnalysisPrompt(input: { question: string; answer: string }): string {
  return [TEMPLATE, `Question: ${input.question}`, "Answer:", input.answer].join("\n");
}

export interface StructuredEngineAnalysis {
  analysisStatus: "completed" | "unknown";
  mentions: Array<{
    name: string;
    domain: string | null;
    recommendation: DiscoveryRecommendation;
    mentionQuote: string | null;
    firstMentionOffset: number | null;
    firstMentionState: FirstPositionState;
  }>;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

const RECOMMENDATIONS = ["positive", "negative", "mentioned", "uncertain"];
const POSITIONS = ["unique", "tied", "none", "unresolved"];

export function parseEngineAnalysisOutput(raw: unknown): StructuredEngineAnalysis {
  const root = asObject(raw);
  const mentions: StructuredEngineAnalysis["mentions"] = [];
  for (const value of Array.isArray(root?.mentions) ? root.mentions : []) {
    const row = asObject(value);
    const name = text(row?.name);
    if (!name) continue;
    const recommendation = text(row?.recommendation);
    const position = text(row?.firstMentionState);
    mentions.push({
      name,
      domain: text(row?.domain) || null,
      recommendation: (RECOMMENDATIONS.includes(recommendation) ? recommendation : "uncertain") as DiscoveryRecommendation,
      mentionQuote: text(row?.mentionQuote) || null,
      firstMentionOffset: typeof row?.firstMentionOffset === "number" ? row.firstMentionOffset : null,
      firstMentionState: (POSITIONS.includes(position) ? position : "unresolved") as FirstPositionState,
    });
  }
  // A reader that did not run is not a reader that found nobody.
  const status = text(root?.analysisStatus) === "completed" ? "completed" : "unknown";
  return { analysisStatus: status, mentions };
}
