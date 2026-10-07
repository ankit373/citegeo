import { getJson, putJson } from "../storage/object-store.js";
import { recentWindow, SearchConsoleClient, type SearchRow } from "./search-console-client.js";
import { AnalyticsClient, type ReferralReport } from "./analytics-client.js";
import { buildSearchDemand, type SearchDemandReport } from "./search-demand.js";
import { parseGoogleCredential } from "./google-auth.js";
import { ServiceAccountError } from "./service-account.js";
import type { ProductProjectFileStore } from "../projects/project-store.js";
import type { TopicInsights } from "../topics/topic-insights.js";
import type { Prompt } from "../topics/topic-schema.js";
import { ExternalMetricSnapshotStore } from "../external-metrics/snapshot-store.js";

export class SearchConsoleUnavailableError extends Error {}

export interface SearchConsoleStatus {
  /** True once a credential is held, in the environment or in the store. */
  configured: boolean;
  siteUrl: string | null;
  /** The last report, or null when none has been pulled. Never an empty one. */
  report: SearchDemandReport | null;
  detail: string;
}

export class SearchConsoleService {
  private readonly snapshots: ExternalMetricSnapshotStore;

  constructor(
    private readonly projects: ProductProjectFileStore,
    private readonly secret: () => Promise<string | null>,
    private readonly siteUrl: () => string | null,
    private readonly client = new SearchConsoleClient(),
    private readonly propertyId: () => string | null = () => null,
    private readonly analytics = new AnalyticsClient(),
  ) {
    this.snapshots = new ExternalMetricSnapshotStore(projects);
  }

  private key(projectId: string): string {
    return this.projects.keyFor(projectId, "search-console", "report.json");
  }

  private referralKey(projectId: string): string {
    return this.projects.keyFor(projectId, "search-console", "referrals.json");
  }

  async metricSnapshots(projectId: string) {
    return this.snapshots.list(projectId);
  }

  async referrals(projectId: string): Promise<{ configured: boolean; propertyId: string | null; report: ReferralReport | null; detail: string }> {
    const raw = await this.secret();
    const property = this.propertyId();
    const report = await getJson<ReferralReport>(this.projects.objects, this.referralKey(projectId));
    return {
      configured: Boolean(raw),
      propertyId: property,
      report,
      detail: !raw
        ? "No Google credential is held. The same one serves Search Console and Analytics."
        : !property
          ? "A credential is held but no GA4 property id is set."
          : report
            ? `Last pulled ${report.fetchedAt.slice(0, 10)}.`
            : "Ready to pull. Nothing has been read yet.",
    };
  }

  /** Who arrived, as opposed to who was named. A property that reported no
   * row at all says so rather than reading as nobody arriving. */
  async refreshReferrals(projectId: string, days = 90): Promise<ReferralReport> {
    const raw = await this.secret();
    if (!raw) throw new SearchConsoleUnavailableError("No Google credential is held.");
    const property = this.propertyId();
    if (!property) throw new SearchConsoleUnavailableError("No GA4 property id is set, so there is nothing to query.");
    const window = recentWindow(days);
    try {
      const report = await this.analytics.referrals({
        account: parseGoogleCredential(raw),
        propertyId: property,
        from: window.from,
        to: window.to,
      });
      await putJson(this.projects.objects, this.referralKey(projectId), report);
      await this.snapshots.append({
        projectId,
        source: "google_analytics",
        sourceScope: { propertyId: property, windowDays: String(days) },
        observedAt: report.fetchedAt,
        periodStart: report.from,
        periodEnd: report.to,
        dataFreshThrough: report.to,
        values: {
          total_sessions: report.totalSessions,
          assistant_sessions: report.assistants.reduce((total, row) => total + row.sessions, 0),
          assistant_engaged_sessions: report.assistants.reduce((total, row) => total + (row.engaged || 0), 0),
        },
        completeness: report.empty ? "unknown" : "complete",
      });
      return report;
    } catch (error) {
      throw error instanceof ServiceAccountError ? new SearchConsoleUnavailableError(error.message) : error;
    }
  }

  private async saved(projectId: string): Promise<SearchDemandReport | null> {
    return getJson<SearchDemandReport>(this.projects.objects, this.key(projectId));
  }

  /** The queries kept from the last pull. Empty where none was ever made, or
   * where the report predates them being kept, which is not no demand. */
  async observedRows(projectId: string): Promise<SearchRow[]> {
    const saved = await this.saved(projectId).catch(() => null);
    return saved?.observed || [];
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
        ? "No Google credential is held. Add a service account key or an OAuth client under Setup, and give it read access to the property."
        : !site
          ? "A credential is held but no property is set. Search Console needs the exact property URL, including the scheme."
          : report
            ? `Last pulled ${report.fetchedAt.slice(0, 10)}, ${report.queries} query row(s).`
            : "Ready to pull. Nothing has been read yet.",
    };
  }

  /** Pulls the window and joins it to the tracked prompts. A pull that fails
   * leaves the last good report alone rather than replacing it with nothing. */
  async refresh(input: { projectId: string; prompts: Prompt[]; insights?: TopicInsights | undefined; days?: number | undefined }): Promise<SearchDemandReport> {
    const raw = await this.secret();
    if (!raw) throw new SearchConsoleUnavailableError("No Google credential is held for Search Console.");
    const site = this.siteUrl();
    if (!site) throw new SearchConsoleUnavailableError("No Search Console property is set, so there is nothing to query.");

    let rows: SearchRow[];
    const window = recentWindow(input.days || 90);
    try {
      rows = await this.client.queries({ account: parseGoogleCredential(raw), siteUrl: site, window });
    } catch (error) {
      throw error instanceof ServiceAccountError ? new SearchConsoleUnavailableError(error.message) : error;
    }

    const report = buildSearchDemand({ siteUrl: site, window, rows, prompts: input.prompts, insights: input.insights });
    await putJson(this.projects.objects, this.key(input.projectId), report);
    await this.snapshots.append({
      projectId: input.projectId,
      source: "google_search_console",
      sourceScope: { siteUrl: site, windowDays: String(input.days || 90) },
      observedAt: report.fetchedAt,
      periodStart: report.window.from,
      periodEnd: report.window.to,
      dataFreshThrough: report.window.to,
      values: {
        query_rows: report.queries,
        impressions: report.totalImpressions,
        clicks: report.prompts.reduce((total, prompt) => total + prompt.clicks, 0),
      },
      completeness: "complete",
    });
    return report;
  }
}
