import { getJson, listJson, putJson } from "../storage/object-store.js";
import { sha256 } from "../../utils/hash.js";
import { readSourcePage, type SourcePage } from "./source-page.js";
import { canonicalUrl } from "./canonical-url.js";
import { buildOutreachPlan, type OutreachPlan } from "./outreach.js";
import { summariseUptake, uptakeOf, type UptakeSummary } from "./answer-uptake.js";
import { buildInterferenceReport, type InterferenceReport } from "./interference.js";
import type { ProductProjectFileStore } from "../projects/project-store.js";
import type { BrandIdentity } from "../topics/brand-identity.js";
import type { PromptAnswer, PromptRun } from "../topics/prompt-run-schema.js";

// Reading someone else's page is a request to their server, so it is capped,
// spaced, and never repeated for a page already read.

/** Pages read in one harvest. A bigger number is a bigger favour to ask of
 * somebody else's server than this product should take without being told. */
export const HARVEST_LIMIT = 25;
const SPACING_MS = 400;

export class SourcePageService {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private key(projectId: string, url: string): string {
    return this.projects.keyFor(projectId, "source-pages", `${sha256(url)}.json`);
  }

  private prefix(projectId: string): string {
    return this.projects.keyFor(projectId, "source-pages");
  }

  async list(projectId: string): Promise<SourcePage[]> {
    return listJson<SourcePage>(this.projects.objects, this.prefix(projectId));
  }

  async plan(projectId: string, answers: PromptAnswer[], scope: { domain?: string | undefined; rivalDomains?: string[] | undefined } = {}): Promise<OutreachPlan> {
    return buildOutreachPlan({
      answers,
      pages: await this.list(projectId),
      domain: scope.domain,
      rivalDomains: scope.rivalDomains,
    });
  }

  /** What each answer took from the pages cited for it. One row per page per
   * answer, because the same page can be used hard by one and ignored by the next. */
  async uptake(projectId: string, answers: PromptAnswer[]): Promise<UptakeSummary> {
    // One page can be stored twice, once before its text was kept. Whichever
    // the listing returns last would win, and the empty one reports unknown.
    const pages = new Map<string, SourcePage>();
    for (const page of await this.list(projectId)) {
      const key = canonicalUrl(page.url)?.key || page.url;
      const held = pages.get(key);
      if (!held || (!held.text && page.text)) pages.set(key, page);
    }
    const rows = [];
    for (const answer of answers) {
      if (answer.status !== "completed" || !answer.text) continue;
      let place = 0;
      const seen = new Set<string>();
      for (const raw of answer.citationUrls) {
        const cited = canonicalUrl(raw);
        if (!cited || seen.has(cited.key)) continue;
        seen.add(cited.key);
        place += 1;
        const page = pages.get(cited.key);
        rows.push(uptakeOf({
          answerText: answer.text,
          page: page || { url: cited.raw, host: cited.host, detail: "This page has not been read back yet." },
          citedAt: place,
        }));
      }
    }
    return summariseUptake(rows);
  }

  /** Shapes that a source was pushed into the answers rather than grew there. */
  async interference(projectId: string, answers: PromptAnswer[], runs: PromptRun[]): Promise<InterferenceReport> {
    return buildInterferenceReport({ answers, runs, pages: await this.list(projectId) });
  }

  /** Reads the cited pages this project has not read yet. A page already read
   * is left alone: re-reading it is another request for the same answer. */
  async harvest(input: {
    projectId: string;
    answers: PromptAnswer[];
    identity: BrandIdentity;
    names: string[];
    limit?: number | undefined;
    /** The same scope the read path uses. Without it a harvested plan calls
     * every page independent, and the two paths disagree about the same page. */
    scope?: { domain?: string | undefined; rivalDomains?: string[] | undefined } | undefined;
    /** Reads pages already stored, so a page that changed can be seen. Off by
     * default, because re-reading is another request to somebody's server. */
    refresh?: boolean | undefined;
  }): Promise<{ read: number; skipped: number; failed: number; plan: OutreachPlan }> {
    const completed = input.answers.filter((answer) => answer.status === "completed");
    // Keyed by the page, not the string. One page cited with an assistant's
    // tracking parameter and without it was fetched twice and stored twice.
    // The value stays a URL that was really cited, because the key is a
    // comparison and not an address anybody can fetch.
    const byPage = new Map<string, string>();
    for (const raw of completed.flatMap((answer) => answer.citationUrls)) {
      const page = canonicalUrl(raw);
      if (page && !byPage.has(page.key)) byPage.set(page.key, page.raw);
    }
    const urls = [...byPage.entries()];
    const limit = Math.min(input.limit || HARVEST_LIMIT, HARVEST_LIMIT);

    let read = 0;
    let skipped = 0;
    let failed = 0;
    for (const [key, url] of urls) {
      if (read + failed >= limit) { skipped += 1; continue; }
      const already = await getJson<SourcePage>(this.projects.objects, this.key(input.projectId, key));
      // A record written before dates or page text were kept is missing the
      // field entirely, which is not the same as a page that had none, so it
      // is read again once rather than reported as unknown for ever.
      const complete = Boolean(already) && "statedAt" in (already as SourcePage) && typeof (already as SourcePage).text === "string";
      if (already && !already.detail && complete && !input.refresh) { skipped += 1; continue; }
      const page = await readSourcePage({
        url,
        names: input.names,
        brandNames: input.identity.distinctive,
        brandHost: input.identity.host,
      });
      // What it said last time travels with it, so a page that changed under a
      // URL an answer already cites can be seen rather than silently replaced.
      const carried: SourcePage = already && already.text && page.text
        ? { ...page, previousText: already.text, previousFetchedAt: already.fetchedAt }
        : page;
      await putJson(this.projects.objects, this.key(input.projectId, key), carried);
      if (page.detail) failed += 1;
      else read += 1;
      await new Promise((resolve) => setTimeout(resolve, SPACING_MS));
    }

    return { read, skipped, failed, plan: await this.plan(input.projectId, input.answers, input.scope || {}) };
  }
}
