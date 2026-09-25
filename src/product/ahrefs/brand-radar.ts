import { readBrandRadar, type AhrefsQuery } from "./ahrefs-client.js";

// What this adds is reach. Every figure here was measured by someone else's
// panel, so it is reported beside ours and never folded into it.

/** Surfaces with no API to ask, which is the whole reason to read this. */
export const UNREACHABLE_SURFACES = ["google_ai_overviews", "google_ai_mode", "copilot", "grok"];

/** Surfaces this product asks itself, where its own archive is the better read. */
export const REACHABLE_SURFACES = ["chatgpt", "gemini", "perplexity", "claude"];

export const PROVENANCE =
  "Measured by Ahrefs Brand Radar against its own panel of prompts, not by asking a model from here."
  + " It cannot be traced to an answer in this archive, so it sits beside those figures rather than in them.";

export interface AhrefsCitedDomain {
  domain: string;
  responses: number;
}

export interface AhrefsCitedPage {
  url: string;
  responses: number;
}

export interface AhrefsReport {
  surfaces: string[];
  citedDomains: AhrefsCitedDomain[];
  citedPages: AhrefsCitedPage[];
  readAt: string;
  provenance: string;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

/** A row with no url is not a page, and a zero is not a citation. */
export function normaliseCitedPages(payload: unknown): AhrefsCitedPage[] {
  const rows = asObject(payload)?.pages;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((value) => {
    const row = asObject(value);
    const url = typeof row?.url === "string" ? row.url.trim() : "";
    if (!url) return [];
    return [{ url, responses: count(row?.responses) }];
  }).sort((left, right) => right.responses - left.responses);
}

export function normaliseCitedDomains(payload: unknown): AhrefsCitedDomain[] {
  const rows = asObject(payload)?.domains;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((value) => {
    const row = asObject(value);
    const domain = typeof row?.domain === "string" ? row.domain.trim().toLowerCase() : "";
    if (!domain) return [];
    return [{ domain, responses: count(row?.responses) }];
  }).sort((left, right) => right.responses - left.responses);
}

/** Defaults to the surfaces nothing here can ask, so a read adds reach rather
 * than a second opinion on a surface already in the archive. */
export function surfacesFor(requested: string[] | undefined): string[] {
  const wanted = (requested || []).filter(Boolean);
  return wanted.length ? wanted : UNREACHABLE_SURFACES;
}

export async function buildAhrefsReport(input: {
  apiKey: string;
  reportId?: string | undefined;
  brand?: string | undefined;
  competitors?: string | undefined;
  country?: string | undefined;
  surfaces?: string[] | undefined;
  limit?: number | undefined;
  now?: Date | undefined;
}): Promise<AhrefsReport> {
  const surfaces = surfacesFor(input.surfaces);
  const shared: Omit<AhrefsQuery, "select" | "dataSource"> = {
    reportId: input.reportId,
    brand: input.brand,
    competitors: input.competitors,
    country: input.country,
    limit: input.limit ?? 100,
  };
  const dataSource = surfaces.join(",");
  const [pages, domains] = await Promise.all([
    readBrandRadar("cited-pages", input.apiKey, { ...shared, dataSource, select: "url,responses" }),
    readBrandRadar("cited-domains", input.apiKey, { ...shared, dataSource, select: "domain,responses" }),
  ]);
  return {
    surfaces,
    citedPages: normaliseCitedPages(pages),
    citedDomains: normaliseCitedDomains(domains),
    readAt: (input.now ?? new Date()).toISOString(),
    provenance: PROVENANCE,
  };
}
