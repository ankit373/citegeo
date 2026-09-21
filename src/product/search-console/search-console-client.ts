import { ServiceAccountError, ServiceAccountTokens, parseServiceAccount, type ServiceAccount } from "./service-account.js";

// Four fields from one endpoint. The rest of the API is not needed and is not
// wrapped for the sake of wrapping it.

const API = "https://searchconsole.googleapis.com/webmasters/v3/sites";

export interface SearchRow {
  query: string;
  clicks: number;
  impressions: number;
  /** Click-through rate as Google reports it, 0 to 1. */
  ctr: number;
  /** Mean position. Lower is better; 1 is the top result. */
  position: number;
}

export interface SearchWindow {
  from: string;
  to: string;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Search Console lags by a couple of days, so a window ending today is a
 * window ending in rows that do not exist yet. */
export function recentWindow(days = 90, now = new Date()): SearchWindow {
  const to = new Date(now.getTime() - 3 * 86400000);
  const from = new Date(to.getTime() - days * 86400000);
  return { from: isoDay(from), to: isoDay(to) };
}

export class SearchConsoleClient {
  constructor(private readonly tokens = new ServiceAccountTokens(), private readonly call: typeof fetch = fetch) {}

  static accountFrom(raw: string): ServiceAccount {
    return parseServiceAccount(raw);
  }

  async queries(input: { account: ServiceAccount; siteUrl: string; window: SearchWindow; limit?: number | undefined }): Promise<SearchRow[]> {
    const token = await this.tokens.token(input.account);
    const url = `${API}/${encodeURIComponent(input.siteUrl)}/searchAnalytics/query`;
    const response = await this.call(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        startDate: input.window.from,
        endDate: input.window.to,
        dimensions: ["query"],
        rowLimit: Math.min(input.limit || 5000, 25000),
      }),
    });
    const text = await response.text();
    if (!response.ok) {
      // 403 here almost always means the service account is not a user on the
      // property, which is a different fix from a bad key.
      throw new ServiceAccountError(response.status === 403
        ? `Search Console refused the property (403). Add the service account as a user on ${input.siteUrl}, then try again.`
        : `Search Console answered ${response.status}. ${text.slice(0, 200)}`);
    }
    const parsed = JSON.parse(text) as { rows?: unknown };
    const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
    return rows.flatMap((row) => {
      const item = row && typeof row === "object" ? (row as Record<string, unknown>) : null;
      const keys = Array.isArray(item?.keys) ? item.keys : [];
      const query = typeof keys[0] === "string" ? keys[0] : "";
      if (!query) return [];
      return [{
        query,
        clicks: typeof item?.clicks === "number" ? item.clicks : 0,
        impressions: typeof item?.impressions === "number" ? item.impressions : 0,
        ctr: typeof item?.ctr === "number" ? item.ctr : 0,
        position: typeof item?.position === "number" ? item.position : 0,
      }];
    });
  }
}
