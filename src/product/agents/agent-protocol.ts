import { sha256 } from "../../utils/hash.js";

type Schema = Record<string, unknown>;

export const AGENT_SCHEMA_NAME = "content_draft";
export const AGENT_TOOL_DESCRIPTION = "Draft a page from a brief, using only the brand's own pages as fact.";

export const agentResponseSchema: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["analysisStatus", "title", "body", "rationale"],
  properties: {
    analysisStatus: { type: "string", enum: ["completed", "insufficient"] },
    title: { type: "string", description: "A title that states what the page answers." },
    body: { type: "string", description: "The draft in Markdown, headings included." },
    rationale: { type: "string", description: "One or two sentences on what this is meant to change." },
  },
};

export const AGENT_SCHEMA_HASH = sha256(JSON.stringify(agentResponseSchema));

// A draft that invents a capability is worse than no draft, because it reads
// as ready and a reviewer has to catch the invention.
const PROMPT_TEMPLATE = [
  "Write a draft from the brief below.",
  "The brand's own pages are the only source of fact about the brand. Do not state a capability, a price, a customer or a date the pages do not state.",
  "Where the brief asks for something the pages do not support, leave it out and say so at the end under a heading called Gaps.",
  "Do not invent a statistic, a quotation or a named customer.",
  "Write in plain prose. No marketing superlatives, no invented urgency.",
  "Return Markdown in body, starting at a level two heading.",
  "Return analysisStatus insufficient when the pages do not carry enough to write anything honest.",
  "Return only the requested JSON schema.",
].join("\n");

export const AGENT_PROMPT_HASH = sha256(PROMPT_TEMPLATE);

export function agentPrompt(input: { brandName: string; domain: string; instruction: string; digest: string }): string {
  return [
    PROMPT_TEMPLATE,
    `Brand: ${input.brandName}`,
    `Domain: ${input.domain}`,
    "",
    "Brief:",
    input.instruction,
    "",
    "The brand's pages:",
    input.digest,
  ].join("\n");
}
