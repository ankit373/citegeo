import { ServiceAccountError, ServiceAccountTokens, type ServiceAccount } from "./service-account.js";

// Whether the assistants send anybody. Visibility says you were named; this
// says somebody arrived because of it, which is a different claim.

const API = "https://analyticsdata.googleapis.com/v1beta/properties";

export interface ReferralRow {
  /** The referring host as Analytics reports it. */
  source: string;
  sessions: number;
  /** Null when the property does not report engaged sessions for this row. */
  engaged: number | null;
}

export interface ReferralReport {
  propertyId: string;
  from: string;
  to: string;
  fetchedAt: string;
  /** Referrers matched against the surfaces this product asks. */
  assistants: ReferralRow[];
  /** Sessions from every source, so a share can be taken honestly. */
  totalSessions: number;
  /** True when the property reported no row at all for the window. */
  empty: boolean;
}

/** The hosts the assistants send from. Matched as whole hosts or subdomains,
 * never as a substring, so "notchatgpt.example" is not ChatGPT. */
const ASSISTANT_HOSTS: Array<{ label: string; hosts: string[] }> = [
  { label: "ChatGPT", hosts: ["chatgpt.com", "chat.openai.com", "openai.com"] },
  { label: "Perplexity", hosts: ["perplexity.ai"] },
  { label: "Gemini", hosts: ["gemini.google.com", "bard.google.com"] },
  { label: "Copilot", hosts: ["copilot.microsoft.com", "bing.com"] },
  { label: "Claude", hosts: ["claude.ai"] },
];

export function assistantFor(source: string): string | null {
  const host = source.trim().toLocaleLowerCase();
  for (const row of ASSISTANT_HOSTS) {
    for (const candidate of row.hosts) {
      if (host === candidate || host.endsWith(`.${candidate}`)) return row.label;
    }
  }
  return null;
}

export class AnalyticsClient {
  constructor(private readonly tokens = new ServiceAccountTokens(), private readonly call: typeof fetch = fetch) {}

  async referrals(input: { account: ServiceAccount; propertyId: string; from: string; to: string }): Promise<ReferralReport> {
    const token = await this.tokens.token(input.account);
    const response = await this.call(`${API}/${encodeURIComponent(input.propertyId)}:runReport`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        dateRanges: [{ startDate: input.from, endDate: input.to }],
        dimensions: [{ name: "sessionSource" }],
        metrics: [{ name: "sessions" }, { name: "engagedSessions" }],
        limit: 500,
      }),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new ServiceAccountError(response.status === 403
        ? `Analytics refused property ${input.propertyId} (403). Add the service account as a viewer on it, then try again.`
        : `Analytics answered ${response.status}. ${text.slice(0, 200)}`);
    }
    const parsed = JSON.parse(text) as { rows?: unknown };
    const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
    const assistants: ReferralRow[] = [];
    let totalSessions = 0;
    for (const row of rows) {
      const item = row && typeof row === "object" ? (row as Record<string, unknown>) : null;
      const dimensions = Array.isArray(item?.dimensionValues) ? item.dimensionValues : [];
      const metrics = Array.isArray(item?.metricValues) ? item.metricValues : [];
      const first = dimensions[0] && typeof dimensions[0] === "object" ? (dimensions[0] as Record<string, unknown>) : null;
      const source = typeof first?.value === "string" ? first.value : "";
      const number = (index: number): number | null => {
        const cell = metrics[index] && typeof metrics[index] === "object" ? (metrics[index] as Record<string, unknown>) : null;
        const raw = typeof cell?.value === "string" ? Number(cell.value) : NaN;
        return Number.isFinite(raw) ? raw : null;
      };
      const sessions = number(0) || 0;
      totalSessions += sessions;
      const label = assistantFor(source);
      if (label) assistants.push({ source: label, sessions, engaged: number(1) });
    }
    // One label can come from several hosts, so they are folded together.
    const folded = new Map<string, ReferralRow>();
    for (const row of assistants) {
      const held = folded.get(row.source) || { source: row.source, sessions: 0, engaged: null };
      held.sessions += row.sessions;
      held.engaged = row.engaged === null ? held.engaged : (held.engaged || 0) + row.engaged;
      folded.set(row.source, held);
    }
    return {
      propertyId: input.propertyId,
      from: input.from,
      to: input.to,
      fetchedAt: new Date().toISOString(),
      assistants: [...folded.values()].sort((left, right) => right.sessions - left.sessions),
      totalSessions,
      // No row at all is a property that reported nothing, which is not a
      // property where nobody arrived from an assistant.
      empty: rows.length === 0,
    };
  }
}
