import { GoogleAuthError } from "./google-auth.js";

// Typing a property URL exactly as Google spells it, scheme and trailing slash
// included, is a guessing game the account can answer instead.

const SITES = "https://searchconsole.googleapis.com/webmasters/v3/sites";
const ACCOUNT_SUMMARIES = "https://analyticsadmin.googleapis.com/v1beta/accountSummaries";

export interface SearchConsoleProperty {
  siteUrl: string;
  /** owner, siteOwner, siteFullUser, siteRestrictedUser or siteUnverifiedUser. */
  permission: string;
  /** False when the account can see it but cannot read its data. */
  readable: boolean;
}

export interface AnalyticsProperty {
  propertyId: string;
  displayName: string;
  account: string;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

async function read(url: string, token: string, what: string): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch (error) {
    throw new GoogleAuthError(`${what} could not be reached: ${error instanceof Error ? error.message : String(error)}`);
  }
  const payload = asObject(await response.json().catch(() => null));
  if (!response.ok) {
    const detail = typeof asObject(payload?.error)?.message === "string"
      ? String(asObject(payload?.error)?.message) : `HTTP ${response.status}`;
    if (response.status === 403) {
      throw new GoogleAuthError(`${what} answered 403. The API may not be enabled on the project this credential belongs to: ${detail}`);
    }
    throw new GoogleAuthError(`${what} answered ${response.status}: ${detail}`);
  }
  return payload || {};
}

/** A property the account can see but not read is listed and marked, because
 * hiding it makes a missing property look like a missing permission. */
export function readablePermission(permission: string): boolean {
  return permission !== "siteUnverifiedUser";
}

export async function searchConsoleProperties(token: string): Promise<SearchConsoleProperty[]> {
  const payload = await read(SITES, token, "Search Console");
  const rows = Array.isArray(payload.siteEntry) ? payload.siteEntry : [];
  return rows.flatMap((value) => {
    const row = asObject(value);
    const siteUrl = typeof row?.siteUrl === "string" ? row.siteUrl : "";
    if (!siteUrl) return [];
    const permission = typeof row?.permissionLevel === "string" ? row.permissionLevel : "";
    return [{ siteUrl, permission, readable: readablePermission(permission) }];
  }).sort((left, right) => left.siteUrl.localeCompare(right.siteUrl));
}

/** The numeric id is what the Data API takes, and the name is what a reader
 * recognises, so both travel together. */
export function propertyIdFrom(name: string): string {
  const at = name.lastIndexOf("/");
  return at >= 0 ? name.slice(at + 1) : name;
}

export async function analyticsProperties(token: string): Promise<AnalyticsProperty[]> {
  const payload = await read(ACCOUNT_SUMMARIES, token, "Analytics");
  const accounts = Array.isArray(payload.accountSummaries) ? payload.accountSummaries : [];
  const out: AnalyticsProperty[] = [];
  for (const value of accounts) {
    const account = asObject(value);
    const accountName = typeof account?.displayName === "string" ? account.displayName : "";
    const summaries = Array.isArray(account?.propertySummaries) ? account.propertySummaries : [];
    for (const item of summaries) {
      const row = asObject(item);
      const property = typeof row?.property === "string" ? row.property : "";
      if (!property) continue;
      out.push({
        propertyId: propertyIdFrom(property),
        displayName: typeof row?.displayName === "string" ? row.displayName : property,
        account: accountName,
      });
    }
  }
  return out.sort((left, right) => left.displayName.localeCompare(right.displayName));
}
