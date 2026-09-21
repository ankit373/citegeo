import { getJson, putJson } from "../storage/object-store.js";
import { recentWindow, SearchConsoleClient, type SearchRow } from "./search-console-client.js";
import { buildSearchDemand, type SearchDemandReport } from "./search-demand.js";
import { ServiceAccountError } from "./service-account.js";
import type { ProductProjectFileStore } from "../projects/project-store.js";
import type { TopicInsights } from "../topics/topic-insights.js";
import type { Prompt } from "../topics/topic-schema.js";

export class SearchConsoleUnavailableError extends Error {}

export interface SearchConsoleStatus {
  /** True once a key is held, whether in the environment or the store. */
  configured: boolean;
  siteUrl: string | null;
  /** The last report, or null when none has been pulled. Never an empty one. */
  report: SearchDemandReport | null;
  detail: string;
}

export class SearchConsoleService {
  constructor(
    private readonly projects: ProductProjectFileStore,
    private readonly secret: () => Promise<string | null>,
    private readonly siteUrl: () => string | null,
    private readonly client = new SearchConsoleClient(),
  ) {}

  private key(projectId: string): string {
    return this.projects.keyFor(projectId, "search-console", "report.json");
  }

  private async saved(projectId: string): Promise<SearchDemandReport | null> {
    return getJson<SearchDemandReport>(this.projects.objects, this.key(projectId));
  }

  async status(projectId: string): Promise<SearchConsoleStatus> {
    const raw = await this.secret();
    const site = this.siteUrl();
    const report = await this.saved(projectId);
    return {
      configured: Boolean(raw),
      siteUrl: site,
      report,
      detail: !raw
        ? "No service account key is held. Add one under Setup, and add that service account as a user on the property."
        : !site
          ? "A key is held but no property is set. Search Console needs the exact property URL, including the scheme."
          : report
            ? `Last pulled ${report.fetchedAt.slice(0, 10)}, ${report.queries} query row(s).`
            : "Ready to pull. Nothing has been read yet.",
    };
  }

  /** Pulls the window and joins it to the tracked prompts. A pull that fails
   * leaves the last good report alone rather than replacing it with nothing. */
  async refresh(input: { projectId: string; prompts: Prompt[]; insights?: TopicInsights | undefined; days?: number | undefined }): Promise<SearchDemandReport> {
    const raw = await this.secret();
    if (!raw) throw new SearchConsoleUnavailableError("No service account key is held for Search Console.");
    const site = this.siteUrl();
    if (!site) throw new SearchConsoleUnavailableError("No Search Console property is set, so there is nothing to query.");

    let rows: SearchRow[];
    const window = recentWindow(input.days || 90);
    try {
      rows = await this.client.queries({ account: SearchConsoleClient.accountFrom(raw), siteUrl: site, window });
    } catch (error) {
      throw error instanceof ServiceAccountError ? new SearchConsoleUnavailableError(error.message) : error;
    }

    const report = buildSearchDemand({ siteUrl: site, window, rows, prompts: input.prompts, insights: input.insights });
    await putJson(this.projects.objects, this.key(input.projectId), report);
    return report;
  }
}
