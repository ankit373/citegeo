import { integrationSetting } from "../../config/env.js";
import type { ProductProjectService } from "../projects/project-service.js";
import { ExternalMetricSnapshotStore, type ExternalMetricSnapshot } from "./snapshot-store.js";

export class ExternalMetricProviderError extends Error {}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function scope(providerId: "ahrefs" | "semrush", key: string, envKey: string): string | null {
  return process.env[envKey]?.trim() || integrationSetting(providerId, key) || null;
}

function csvRow(text: string): string[] | null {
  const lines = text.trim().split("\n").map((line) => line.endsWith("\r") ? line.slice(0, -1) : line).filter(Boolean);
  if (lines.length < 2) return null;
  // Domain Overview uses a simple semicolon table. Quotes are retained as a
  // value rather than split, which is enough for the numeric columns we ask.
  const parse = (line: string) => line.split(";").map((value) => {
    const trimmed = value.trim();
    return trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1) : trimmed;
  });
  const header = parse(lines[0]!);
  const row = parse(lines[1]!);
  return header.map((name, index) => `${name}\u0000${row[index] || ""}`);
}

function csvNumber(values: string[] | null, name: string): number | null {
  const item = values?.find((value) => value.startsWith(`${name}\u0000`));
  if (!item) return null;
  const parsed = Number(item.slice(name.length + 1));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Pulls third-party SEO estimates only on deliberate request. These are
 * snapshots of each provider's model, not sessions, clicks, or evidence that
 * an answer engine cited a site. */
export class ExternalMetricProviderPullService {
  constructor(
    private readonly projects: ProductProjectService,
    private readonly snapshots: ExternalMetricSnapshotStore,
    private readonly credential: (providerId: "ahrefs" | "semrush") => Promise<string | null>,
    private readonly call: typeof fetch = fetch,
  ) {}

  async pull(projectId: string, source: "ahrefs" | "semrush"): Promise<ExternalMetricSnapshot> {
    return source === "ahrefs" ? this.ahrefs(projectId) : this.semrush(projectId);
  }

  private async ahrefs(projectId: string): Promise<ExternalMetricSnapshot> {
    const key = await this.credential("ahrefs");
    const country = scope("ahrefs", "country", "AHREFS_COUNTRY");
    if (!key) throw new ExternalMetricProviderError("No Ahrefs API key is held.");
    if (!country) throw new ExternalMetricProviderError("Choose an Ahrefs country in Setup before pulling estimates.");
    const project = await this.projects.get(projectId);
    const asOf = today();
    const url = new URL("https://api.ahrefs.com/v3/site-explorer/metrics");
    url.search = new URLSearchParams({ target: project.normalizedDomain, mode: "domain", country, date: asOf }).toString();
    const response = await this.call(url, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" } });
    const body = await response.json().catch(() => null) as { metrics?: Record<string, unknown>; message?: string } | null;
    if (!response.ok || !body?.metrics) throw new ExternalMetricProviderError(`Ahrefs could not return metrics (${response.status}). ${body?.message || "Check API units and Site Explorer access."}`);
    const metrics = body.metrics;
    return this.snapshots.append({
      projectId, source: "ahrefs", sourceScope: { target: project.normalizedDomain, country, mode: "domain", trafficMode: "adaptive" },
      observedAt: new Date().toISOString(), periodStart: asOf, periodEnd: asOf, dataFreshThrough: asOf,
      values: {
        estimated_organic_traffic: number(metrics.org_traffic),
        organic_keywords: number(metrics.org_keywords),
        organic_keywords_top_3: number(metrics.org_keywords_1_3),
        estimated_organic_traffic_value_usd: number(metrics.org_cost),
      },
      completeness: "complete",
    });
  }

  private async semrush(projectId: string): Promise<ExternalMetricSnapshot> {
    const key = await this.credential("semrush");
    const database = scope("semrush", "database", "SEMRUSH_DATABASE");
    if (!key) throw new ExternalMetricProviderError("No Semrush API key is held.");
    if (!database) throw new ExternalMetricProviderError("Choose a Semrush regional database in Setup before pulling estimates.");
    const project = await this.projects.get(projectId);
    const asOf = today();
    const url = new URL("https://api.semrush.com/");
    url.search = new URLSearchParams({ type: "domain_rank", key, domain: project.normalizedDomain, database, export_columns: "Dn,Rk,Or,Ot,Oc" }).toString();
    const response = await this.call(url);
    const body = await response.text();
    if (!response.ok || body.trim().toUpperCase().startsWith("ERROR")) throw new ExternalMetricProviderError(`Semrush could not return Domain Overview (${response.status}). Check API units and database access.`);
    const values = csvRow(body);
    if (!values) throw new ExternalMetricProviderError("Semrush returned no Domain Overview row for this scope.");
    return this.snapshots.append({
      projectId, source: "semrush", sourceScope: { target: project.normalizedDomain, database },
      observedAt: new Date().toISOString(), periodStart: asOf, periodEnd: asOf, dataFreshThrough: asOf,
      values: {
        domain_rank: csvNumber(values, "Rank"),
        organic_keywords: csvNumber(values, "Organic Keywords"),
        estimated_organic_traffic: csvNumber(values, "Organic Traffic"),
        estimated_organic_traffic_cost: csvNumber(values, "Organic Cost"),
      },
      completeness: "complete",
    });
  }
}
