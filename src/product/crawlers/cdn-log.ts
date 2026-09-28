import type { AccessLogEntry } from "./access-log.js";

// A site behind a CDN never sees the crawler at its origin, so the combined
// format alone cannot answer whether the crawler fetched anything.
//
// Two shapes are read here: JSON lines, which edge log pushes and platform log
// drains emit, and the tab separated standard log CloudFront writes.
// The shape is taken from the line, never configured, because a log that is
// pointed at the wrong reader reports silence rather than an error.

export type CdnLogFormat = "json" | "cloudfront";

function first(row: Record<string, unknown>, names: string[]): unknown {
  for (const name of names) {
    const value = row[name];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  // Some drains send the user agent as the list of headers they saw.
  if (Array.isArray(value)) {
    const found = value.find((entry) => typeof entry === "string" && entry);
    return typeof found === "string" ? found : "";
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function asStatus(value: unknown): number {
  const status = typeof value === "number" ? value : Number(asText(value));
  return Number.isFinite(status) ? status : 0;
}

/** A path with a query string on it is still that path, and keeping the query
 * would split one page into a row per visitor. */
export function pathOnly(value: string): string {
  const question = value.indexOf("?");
  const trimmed = question === -1 ? value : value.slice(0, question);
  if (!trimmed) return "";
  if (trimmed.startsWith("/")) return trimmed;
  // Cloudflare can send a full URL rather than a path.
  const scheme = trimmed.indexOf("://");
  if (scheme === -1) return trimmed;
  const slash = trimmed.indexOf("/", scheme + 3);
  return slash === -1 ? "/" : trimmed.slice(slash);
}

// Epoch seconds, milliseconds and nanoseconds all appear in these logs, and
// reading one as another puts the fetch in 1970 or in the year 55000.
function fromEpoch(value: number): string | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const milliseconds = value > 1e17 ? value / 1e6 : value > 1e14 ? value / 1e3 : value > 1e11 ? value : value * 1000;
  const at = new Date(milliseconds);
  return Number.isFinite(at.getTime()) ? at.toISOString() : null;
}

export function cdnTimestamp(value: unknown): string | null {
  if (typeof value === "number") return fromEpoch(value);
  if (typeof value !== "string" || !value.trim()) return null;
  const digits = Number(value);
  if (Number.isFinite(digits) && value.trim().length > 8 && !value.includes("-") && !value.includes(":")) {
    return fromEpoch(digits);
  }
  const at = new Date(value);
  return Number.isFinite(at.getTime()) ? at.toISOString() : null;
}

const METHODS = ["ClientRequestMethod", "method", "cs-method", "requestMethod"];
const PATHS = ["ClientRequestPath", "ClientRequestURI", "path", "url", "requestPath", "cs-uri-stem"];
const STATUSES = ["EdgeResponseStatus", "statusCode", "status", "sc-status", "OriginResponseStatus"];
const AGENTS = ["ClientRequestUserAgent", "userAgent", "user_agent", "cs(User-Agent)", "http_user_agent"];
const TIMES = ["EdgeStartTimestamp", "timestamp", "time", "datetime", "EdgeEndTimestamp"];

/** Some drains put the request at the top level and others nest it under a
 * proxy object. Reading only the top level loses every nested line. */
function requestObject(row: Record<string, unknown>): Record<string, unknown> {
  const nested = row.proxy;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return { ...row, ...(nested as Record<string, unknown>) };
  }
  return row;
}

export function parseJsonLogLine(line: string): AccessLogEntry | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (_) {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const row = requestObject(parsed as Record<string, unknown>);
  const path = pathOnly(asText(first(row, PATHS)));
  const userAgent = asText(first(row, AGENTS));
  // A line with neither a path nor an agent is not a request record, and
  // counting it would inflate every total with log noise.
  if (!path || !userAgent) return null;
  return {
    method: asText(first(row, METHODS)) || "GET",
    path,
    status: asStatus(first(row, STATUSES)),
    userAgent,
    at: cdnTimestamp(first(row, TIMES)),
  };
}

function decoded(value: string): string {
  if (!value.includes("%")) return value;
  try {
    return decodeURIComponent(value);
  } catch (_) {
    return value;
  }
}

/** CloudFront names its columns in a #Fields header, and the order is not
 * fixed, so the header is what says which column is which. */
export class CloudFrontReader {
  private fields: string[];

  constructor(carried?: string[] | undefined) {
    this.fields = carried && carried.length ? [...carried] : [];
  }

  /** The header seen so far, so a caller reading a file in pieces can carry it
   * into the next piece. */
  get fieldNames(): string[] {
    return [...this.fields];
  }

  header(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed.startsWith("#")) return false;
    const marker = "#fields:";
    if (trimmed.toLowerCase().startsWith(marker)) {
      this.fields = trimmed.slice(marker.length).trim().split(" ").filter(Boolean);
    }
    return true;
  }

  get ready(): boolean {
    return this.fields.length > 0;
  }

  line(text: string): AccessLogEntry | null {
    if (!this.fields.length) return null;
    const columns = text.split("\t");
    if (columns.length < 2) return null;
    const value = (name: string): string => {
      const at = this.fields.indexOf(name);
      return at === -1 ? "" : (columns[at] || "").trim();
    };
    const path = pathOnly(decoded(value("cs-uri-stem")));
    const userAgent = decoded(value("cs(User-Agent)"));
    if (!path || !userAgent) return null;
    const date = value("date");
    const time = value("time");
    return {
      method: value("cs-method") || "GET",
      path,
      status: asStatus(value("sc-status")),
      userAgent,
      at: date && time ? cdnTimestamp(`${date}T${time}Z`) : null,
    };
  }
}
