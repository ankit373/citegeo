import { sha256 } from "../../utils/hash.js";

type Schema = Record<string, unknown>;

export const FACTCHECK_SCHEMA_NAME = "answer_claims";
export const FACTCHECK_TOOL_DESCRIPTION = "Check what an answer asserts about a brand against that brand's own pages.";

const claim: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["quote", "claim", "verdict", "sourceQuote", "detail"],
  properties: {
    quote: { type: "string", description: "The sentence from the answer that carries the claim, copied exactly." },
    claim: { type: "string", description: "The assertion on its own, as a plain statement about the brand." },
    verdict: {
      type: "string",
      enum: ["supported", "contradicted", "unsupported"],
      description: "supported: the pages say it. contradicted: the pages say otherwise. unsupported: the pages do not address it.",
    },
    sourceQuote: { type: ["string", "null"], description: "The sentence from the pages that settles it, copied exactly. Null when unsupported." },
    detail: { type: "string", description: "One sentence on why, naming what the pages did or did not say." },
  },
};

export const factcheckResponseSchema: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["analysisStatus", "claims"],
  properties: {
    analysisStatus: { type: "string", enum: ["completed", "unreadable"] },
    claims: { type: "array", items: claim },
  },
};

export const FACTCHECK_SCHEMA_HASH = sha256(JSON.stringify(factcheckResponseSchema));

// The pages are the only authority. Anything the model already knows about the
// brand is exactly what is being checked, so it cannot also be the evidence.
const PROMPT_TEMPLATE = [
  "Below is an answer an assistant gave, and the brand's own pages.",
  "Find every factual claim the answer makes about the named brand, and check each one against the pages.",
  "A claim is a checkable statement: what it does, who it is for, what it costs, what it supports, when it started, who owns it.",
  "Ignore opinion, recommendation and comparison. Ignore anything said about a different company.",
  "The pages are the only evidence. Do not use anything you already know about this brand, and do not treat your own knowledge as confirmation.",
  "Mark a claim contradicted only where the pages state something that cannot both be true with it.",
  "Where the pages simply do not address a claim, mark it unsupported. That is a correct and useful answer, and it is not the same as contradicted.",
  "Copy quote and sourceQuote exactly from the text given. Never paraphrase into a quote, and never invent a page sentence.",
  "If the answer makes no checkable claim about the brand, return an empty claims list with analysisStatus completed.",
  "Return analysisStatus unreadable only when the answer or the pages could not be read at all.",
  "Return only the requested JSON schema.",
].join("\n");

export const FACTCHECK_PROMPT_HASH = sha256(PROMPT_TEMPLATE);

export function factcheckPrompt(input: { brandName: string; domain: string; answer: string; digest: string }): string {
  return [
    PROMPT_TEMPLATE,
    `Brand: ${input.brandName}`,
    `Domain: ${input.domain}`,
    "",
    "Answer:",
    input.answer,
    "",
    "Pages:",
    input.digest,
  ].join("\n");
}
