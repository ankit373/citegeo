// A claim is only ever reported with the two sentences that settle it: the one
// the answer said, and the one the brand's own page said back.

export type ClaimVerdict = "supported" | "contradicted" | "unsupported";

export const CLAIM_VERDICTS: ClaimVerdict[] = ["supported", "contradicted", "unsupported"];

export interface CheckedClaim {
  quote: string;
  claim: string;
  verdict: ClaimVerdict;
  sourceQuote: string | null;
  detail: string;
}

export interface AnswerFactCheck {
  answerId: string;
  promptId: string;
  promptText: string;
  modelId: string;
  modelDisplayName: string;
  claims: CheckedClaim[];
}

export interface FactCheckReport {
  projectId: string;
  domain: string;
  /** The pages the verdicts were drawn from, so a wrong one is traceable. */
  sources: string[];
  answers: AnswerFactCheck[];
  /** Answers that were asked about but returned nothing readable. */
  unreadable: number;
  checkedAt: string;
  schemaHash: string;
  promptHash: string;
}

export interface VerdictTally {
  supported: number;
  contradicted: number;
  unsupported: number;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function verdictOf(value: unknown): ClaimVerdict | null {
  const found = CLAIM_VERDICTS.find((item) => item === value);
  return found || null;
}

/** A claim missing its quote, its verdict or its supporting sentence is not
 * evidence, so it is dropped rather than shown without one. */
export function parseClaim(value: unknown): CheckedClaim | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const quote = text(row.quote);
  const claim = text(row.claim);
  const verdict = verdictOf(row.verdict);
  if (!quote || !claim || !verdict) return null;
  const sourceQuote = text(row.sourceQuote);
  // Supported and contradicted both rest on a page sentence. Without one there
  // is nothing to check against, which is what unsupported means.
  if (verdict !== "unsupported" && !sourceQuote) return null;
  return {
    quote,
    claim,
    verdict,
    sourceQuote: verdict === "unsupported" ? null : sourceQuote,
    detail: text(row.detail),
  };
}

export interface ParsedFactCheck {
  status: "completed" | "unreadable";
  claims: CheckedClaim[];
}

export function parseFactCheck(value: unknown): ParsedFactCheck {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { status: "unreadable", claims: [] };
  const row = value as Record<string, unknown>;
  if (row.analysisStatus !== "completed") return { status: "unreadable", claims: [] };
  const rows = Array.isArray(row.claims) ? row.claims : [];
  const claims: CheckedClaim[] = [];
  for (const item of rows) {
    const parsed = parseClaim(item);
    if (parsed) claims.push(parsed);
  }
  return { status: "completed", claims };
}

export function tally(report: FactCheckReport): VerdictTally {
  const counts: VerdictTally = { supported: 0, contradicted: 0, unsupported: 0 };
  for (const answer of report.answers) {
    for (const claim of answer.claims) counts[claim.verdict] += 1;
  }
  return counts;
}

/** The same wrong claim repeated by four models is one finding, not four. It is
 * grouped on the claim rather than the sentence, which differs every time. */
export function groupClaims(report: FactCheckReport, verdict: ClaimVerdict): Array<{
  claim: string;
  models: string[];
  occurrences: CheckedClaim[];
}> {
  const groups = new Map<string, { claim: string; models: string[]; occurrences: CheckedClaim[] }>();
  for (const answer of report.answers) {
    for (const claim of answer.claims) {
      if (claim.verdict !== verdict) continue;
      const key = claim.claim.toLowerCase();
      const existing = groups.get(key);
      if (existing) {
        if (!existing.models.includes(answer.modelDisplayName)) existing.models.push(answer.modelDisplayName);
        existing.occurrences.push(claim);
      } else {
        groups.set(key, { claim: claim.claim, models: [answer.modelDisplayName], occurrences: [claim] });
      }
    }
  }
  return [...groups.values()].sort((left, right) => right.models.length - left.models.length);
}
