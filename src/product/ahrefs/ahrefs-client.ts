import { ahrefsEndpoint } from "../../config/env.js";

// Brand Radar answers on surfaces this product cannot ask directly, which is
// why it is worth reading. Its figures are somebody else's panel, never ours.

export class AhrefsUnavailableError extends Error {}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export interface AhrefsQuery {
  /** A saved report carries the brand, rivals, market and filters as one. */
  reportId?: string | undefined;
  brand?: string | undefined;
  competitors?: string | undefined;
  country?: string | undefined;
  dataSource: string;
  select: string;
  limit?: number | undefined;
}

/** Only the columns asked for are billed, and a response body costs ten units,
 * so the caller names its columns rather than taking everything. */
export function brandRadarUrl(path: string, query: AhrefsQuery): string {
  const url = new URL(`${ahrefsEndpoint()}/brand-radar/${path}`);
  const put = (key: string, value: string | undefined) => {
    if (value) url.searchParams.set(key, value);
  };
  put("select", query.select);
  put("data_source", query.dataSource);
  put("report_id", query.reportId);
  put("brand", query.brand);
  put("competitors", query.competitors);
  put("country", query.country);
  if (query.limit) url.searchParams.set("limit", String(query.limit));
  return url.toString();
}

export async function readBrandRadar(path: string, apiKey: string, query: AhrefsQuery): Promise<Record<string, unknown>> {
  const url = brandRadarUrl(path, query);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
  } catch (error) {
    throw new AhrefsUnavailableError(
      `Ahrefs could not be reached: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const payload = asObject(await response.json().catch(() => null));
  if (!response.ok) {
    // A spent unit balance and a wrong key both answer here, and telling them
    // apart is the difference between waiting and fixing something.
    const detail = typeof payload?.error === "string" ? payload.error : `HTTP ${response.status}`;
    if (response.status === 401 || response.status === 403) {
      throw new AhrefsUnavailableError(`Ahrefs rejected the API key: ${detail}`);
    }
    if (response.status === 429) {
      throw new AhrefsUnavailableError(`Ahrefs is rate limiting this key: ${detail}`);
    }
    throw new AhrefsUnavailableError(`Ahrefs answered ${response.status}: ${detail}`);
  }
  if (!payload) throw new AhrefsUnavailableError("Ahrefs returned no readable body.");
  return payload;
}
