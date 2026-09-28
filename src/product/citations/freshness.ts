// How old the pages being cited are. Retrieval favours recent pages for a
// question whose answer moves, so a cited page ageing out is a visibility loss
// nothing else here would report.
//
// Every date is one the page states about itself. Nothing is inferred from a
// header, a guess or the date it was fetched, because a page that states no
// date has an unknown age, which is not the same as a new one.

export type Freshness = "fresh" | "ageing" | "stale" | "undated";

/** Past this a page for a moving question starts losing retrieval priority.
 * A judgement, so it travels with every figure derived from it. */
export const DECAY_DAYS = 90;
export const STALE_DAYS = 365;

export const FRESHNESS_CAVEAT = "Age is read from a date the page states about itself. A page that states none is undated, not new. The ninety day mark is where a page for a question whose answer moves starts losing retrieval priority; it is a judgement, not a measurement.";

export interface PageAge {
  url: string;
  host: string;
  /** What the page says about when it was written. Null when it says nothing. */
  statedAt: string | null;
  ageDays: number | null;
  freshness: Freshness;
  /** Where the date came from, so a wrong one is traceable. */
  source: "json_ld" | "meta" | "time_element" | null;
}

function iso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const at = new Date(trimmed);
  const stamp = at.getTime();
  if (!Number.isFinite(stamp)) return null;
  // A date before the web existed or in the future is a parse gone wrong.
  const year = at.getUTCFullYear();
  if (year < 1995 || stamp > Date.now() + 86400000) return null;
  return at.toISOString();
}

function between(quotes: string, key: string, html: string): string | null {
  const at = html.indexOf(key);
  if (at === -1) return null;
  const open = html.indexOf(quotes, at + key.length);
  if (open === -1) return null;
  const close = html.indexOf(quotes, open + 1);
  return close === -1 ? null : html.slice(open + 1, close);
}

/** Read by hand: the architecture test bans regular expressions. Each source is
 * tried in the order a publisher is most likely to have got right. */
export function statedDate(html: string): { at: string | null; source: PageAge["source"] } {
  for (const key of ['"datePublished"', '"dateModified"', '"uploadDate"']) {
    const found = between('"', key, html);
    const parsed = found ? iso(found) : null;
    if (parsed) return { at: parsed, source: "json_ld" };
  }
  for (const key of ["article:published_time", "article:modified_time", "og:updated_time", "\"date\""]) {
    const at = html.indexOf(key);
    if (at === -1) continue;
    const content = between('"', "content=", html.slice(at, at + 400));
    const parsed = content ? iso(content) : null;
    if (parsed) return { at: parsed, source: "meta" };
  }
  const time = between('"', "datetime=", html);
  const parsed = time ? iso(time) : null;
  return parsed ? { at: parsed, source: "time_element" } : { at: null, source: null };
}

export function freshnessOf(ageDays: number | null): Freshness {
  if (ageDays === null) return "undated";
  if (ageDays <= DECAY_DAYS) return "fresh";
  return ageDays <= STALE_DAYS ? "ageing" : "stale";
}

export function ageOf(input: { url: string; host: string; html: string; now?: Date }): PageAge {
  const { at, source } = statedDate(input.html);
  const now = (input.now || new Date()).getTime();
  const ageDays = at ? Math.floor((now - new Date(at).getTime()) / 86400000) : null;
  return {
    url: input.url,
    host: input.host,
    statedAt: at,
    // A page dated in the future is not negative days old; it is unusable.
    ageDays: ageDays !== null && ageDays >= 0 ? ageDays : null,
    freshness: freshnessOf(ageDays !== null && ageDays >= 0 ? ageDays : null),
    source: ageDays !== null && ageDays >= 0 ? source : null,
  };
}

export interface FreshnessReport {
  pages: PageAge[];
  fresh: number;
  ageing: number;
  stale: number;
  undated: number;
  /** Null when no cited page states a date at all, because an average over
   * nothing is not zero days old. */
  medianAgeDays: number | null;
  caveat: string;
}

export function freshnessReport(pages: PageAge[]): FreshnessReport {
  const dated = pages.map((row) => row.ageDays).filter((value): value is number => value !== null).sort((a, b) => a - b);
  const middle = dated.length ? dated[Math.floor(dated.length / 2)] ?? null : null;
  return {
    pages: [...pages].sort((left, right) => (right.ageDays ?? -1) - (left.ageDays ?? -1)),
    fresh: pages.filter((row) => row.freshness === "fresh").length,
    ageing: pages.filter((row) => row.freshness === "ageing").length,
    stale: pages.filter((row) => row.freshness === "stale").length,
    undated: pages.filter((row) => row.freshness === "undated").length,
    medianAgeDays: middle,
    caveat: FRESHNESS_CAVEAT,
  };
}
