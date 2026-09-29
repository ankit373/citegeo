import { getJson, listJson, putJson } from "../storage/object-store.js";
import { sha256 } from "../../utils/hash.js";
import { readSourcePage, type SourcePage } from "./source-page.js";
import { canonicalUrl } from "./canonical-url.js";
import { buildOutreachPlan, type OutreachPlan } from "./outreach.js";
import type { ProductProjectFileStore } from "../projects/project-store.js";
import type { BrandIdentity } from "../topics/brand-identity.js";
import type { PromptAnswer } from "../topics/prompt-run-schema.js";

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
      // A record written before dates were read has no date field at all, which
      // is not the same as a page that stated none, so it is read again once.
      if (already && !already.detail && "statedAt" in already) { skipped += 1; continue; }
      const page = await readSourcePage({
        url,
        names: input.names,
        brandNames: input.identity.distinctive,
        brandHost: input.identity.host,
      });
      await putJson(this.projects.objects, this.key(input.projectId, key), page);
      if (page.detail) failed += 1;
      else read += 1;
      await new Promise((resolve) => setTimeout(resolve, SPACING_MS));
    }

    return { read, skipped, failed, plan: await this.plan(input.projectId, input.answers, input.scope || {}) };
  }
}
