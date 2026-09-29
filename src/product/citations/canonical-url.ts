import { hostOf } from "./source-page.js";

// An assistant does not hand back the URL a publisher would recognise. It
// appends its own tracking parameter, keeps or drops a trailing slash, and
// varies the scheme. Counted raw, one page becomes several sources, every
// per-page figure divides by the wrong number, and the harvest fetches the
// same page more than once.

/** Parameters that identify who sent the reader, never which page this is.
 * Anything not listed is kept, because a site may key content off it. */
const TRACKING_PARAMETERS = [
  "fbclid", "gclid", "gclsrc", "dclid", "msclkid", "twclid", "igshid",
  "mc_cid", "mc_eid", "vero_id", "yclid", "wbraid", "gbraid", "si",
  "ref", "ref_src", "referrer",
];

function isTracking(name: string): boolean {
  const lower = name.toLocaleLowerCase();
  // Every utm_ parameter is a campaign tag, so the prefix covers the family.
  return lower.startsWith("utm_") || TRACKING_PARAMETERS.includes(lower);
}

export interface CanonicalUrl {
  /** Exactly as it arrived, so a wrong reading here stays traceable. */
  raw: string;
  /** What two citations have to share to be the same page. */
  key: string;
  host: string;
  path: string;
}

/** Null for anything that is not a readable http URL, because a citation this
 * product cannot parse is not a page it can claim anything about. */
export function canonicalUrl(raw: string): CanonicalUrl | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = hostOf(trimmed);
  if (!host) return null;
  // The port belongs in the key: two servers on one machine are two sites. It
  // stays out of host, which groups by domain and has no use for it.
  const authority = url.port ? `${host}:${url.port}` : host;

  // A trailing slash is the same page as none, except at the root where it is
  // the only path there is.
  let path = url.pathname || "/";
  while (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

  // Rebuilt through URLSearchParams so the key stays a URL somebody can open.
  // Joining the decoded pairs by hand turns one parameter holding an ampersand
  // into two, and the key is rendered as a link.
  const kept = new URLSearchParams();
  for (const [name, value] of url.searchParams) {
    if (!isTracking(name)) kept.append(name, value);
  }
  // Sorted, or the same page cited with its parameters in another order reads
  // as a second page.
  kept.sort();
  const query = kept.toString();

  // http and https to one page are one page, so the scheme is normalised, except
  // where a port says this is a server that answers on one of them only.
  const scheme = url.port ? url.protocol.slice(0, -1) : "https";
  // The fragment is dropped because it never reaches the server.
  return { raw: trimmed, key: `${scheme}://${authority}${path}${query ? `?${query}` : ""}`, host, path };
}

/** The key alone, for the many places that only need to know whether two
 * citations point at the same page. */
export function canonicalKey(raw: string): string | null {
  return canonicalUrl(raw)?.key || null;
}
