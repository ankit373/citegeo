import { sha256 } from "../../utils/hash.js";

type Schema = Record<string, unknown>;

export const BRAND_PROFILE_SCHEMA_NAME = "brand_profile";
export const BRAND_PROFILE_TOOL_DESCRIPTION = "Describe this company using only the supplied pages.";

const stringArray: Schema = { type: "array", items: { type: "string" } };

const competitor: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "domain"],
  properties: { name: { type: "string" }, domain: { type: ["string", "null"] } },
};

export const brandProfileResponseSchema: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["analysisStatus", "businessDescription", "productCategory", "audience", "markets", "features", "competitors", "unknowns"],
  properties: {
    analysisStatus: { type: "string", enum: ["completed", "unknown"] },
    businessDescription: { type: ["string", "null"], description: "What it does, in two or three sentences a buyer would recognise." },
    productCategory: { type: ["string", "null"], description: "The category a buyer would search in, not a marketing phrase." },
    audience: { type: ["string", "null"], description: "Who it is for." },
    markets: { ...stringArray, description: "Countries or regions it serves, only where the pages say so." },
    features: { ...stringArray, description: "Named capabilities, as the site names them." },
    competitors: { type: "array", items: competitor, description: "Only companies the pages actually name." },
    unknowns: { ...stringArray, description: "What the pages did not establish." },
  },
};

export const BRAND_PROFILE_SCHEMA_HASH = sha256(JSON.stringify(brandProfileResponseSchema));

const PROMPT_TEMPLATE = [
  "Read the pages below and describe the company behind them.",
  "Use only what these pages say. Do not use anything you already know about the company or the brand name, and do not fill a gap with something plausible.",
  "The category is the one a buyer would search in, not the phrase the marketing uses.",
  "Name a competitor only where the pages name it. An absent competitor list is a correct answer.",
  "State a market only where the pages state it. Naming an index, an exchange or a currency counts as stating it.",
  "Put anything the pages left unclear in unknowns rather than guessing at it.",
  "Return only the requested JSON schema.",
].join("\n");

export const BRAND_PROFILE_PROMPT_HASH = sha256(PROMPT_TEMPLATE);

export function brandProfilePrompt(input: { brandName: string; domain: string; digest: string }): string {
  return [
    PROMPT_TEMPLATE,
    `Domain: ${input.domain}`,
    `Name it goes by: ${input.brandName}`,
    "",
    "Pages:",
    input.digest,
  ].join("\n");
}

export interface BrandProfile {
  analysisStatus: "completed" | "unknown";
  businessDescription: string | null;
  productCategory: string | null;
  audience: string | null;
  markets: string[];
  features: string[];
  competitors: Array<{ name: string; domain: string | null }>;
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

function strings(value: unknown): string[] {
  return [...new Set(asArray(value).map(text).filter(Boolean))];
}

export function parseBrandProfile(raw: unknown): BrandProfile {
  const root = asObject(raw);
  const description = text(root?.businessDescription);
  const competitors = asArray(root?.competitors).flatMap((value) => {
    const row = asObject(value);
    const name = text(row?.name);
    return name ? [{ name, domain: text(row?.domain) || null }] : [];
  });
  // A profile with no description describes nothing, whatever it claims.
  const status = text(root?.analysisStatus) === "completed" && description ? "completed" : "unknown";
  return {
    analysisStatus: status,
    businessDescription: description || null,
    productCategory: text(root?.productCategory) || null,
    audience: text(root?.audience) || null,
    markets: strings(root?.markets),
    features: strings(root?.features),
    competitors,
    unknowns: strings(root?.unknowns),
  };
}
