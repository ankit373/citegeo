import { identifyCrawler, KNOWN_CRAWLERS } from "./crawler-identity.js";
import type { CrawlerIdentity, CrawlerPurpose } from "./crawler-identity.js";
import type { AccessLogEntry } from "./access-log.js";

// What the logs prove about AI crawlers, and the two states that matter most:
// a crawler robots.txt allows but that never arrives, and a page a crawler
// fetched that no answer ever cited.

export interface CrawlerSummary {
  name: string;
  engine: string;
  purpose: CrawlerPurpose;
  fetches: number;
  pages: number;
  lastSeen: string | null;
  /** Share of fetches that did not return 2xx, or null when nothing was fetched. */
  errorRate: number | null;
}

export interface PageCrawlActivity {
  path: string;
  fetches: number;
  crawlers: string[];
  lastSeen: string | null;
  /** The page appeared as a citation in a stored answer. */
  cited: boolean;
}

export interface CrawlerActivity {
  totalFetches: number;
  window: { from: string | null; to: string | null };
  crawlers: CrawlerSummary[];
  pages: PageCrawlActivity[];
  /** Allowed by robots.txt yet never seen in the logs. */
  allowedButAbsent: string[];
  /** Fetched repeatedly and never cited by any answer. */
  fetchedNeverCited: string[];
  /** Cited by an answer but never seen being fetched, so the citation came from elsewhere. */
  citedNeverFetched: string[];
}

function normalisePath(value: string): string {
  const withoutQuery = value.split("?")[0] || value;
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) return withoutQuery.slice(0, -1);
  return withoutQuery;
}

function later(left: string | null, right: string | null): string | null {
  if (!left) return right;
  if (!right) return left;
  return left.localeCompare(right) >= 0 ? left : right;
}

function earlier(left: string | null, right: string | null): string | null {
  if (!left) return right;
  if (!right) return left;
  return left.localeCompare(right) <= 0 ? left : right;
}

export function buildCrawlerActivity(input: {
  entries: AccessLogEntry[];
  /** Crawlers robots.txt permits, so absence can be distinguished from refusal. */
  allowedCrawlers?: string[] | undefined;
  /** Paths cited in stored answers, used to correlate a fetch with a citation. */
  citedPaths?: string[] | undefined;
}): CrawlerActivity {
  const cited = new Set((input.citedPaths || []).map(normalisePath));
  const byCrawler = new Map<string, { identity: CrawlerIdentity; fetches: number; errors: number; pages: Set<string>; lastSeen: string | null }>();
  const byPage = new Map<string, { path: string; fetches: number; crawlers: Set<string>; lastSeen: string | null }>();
  let totalFetches = 0;
  let from: string | null = null;
  let to: string | null = null;

  for (const entry of input.entries) {
    const identity = identifyCrawler(entry.userAgent);
    if (!identity) continue;
    const path = normalisePath(entry.path);
    totalFetches += 1;
    from = earlier(from, entry.at);
    to = later(to, entry.at);

    const crawler = byCrawler.get(identity.name)
      || { identity, fetches: 0, errors: 0, pages: new Set<string>(), lastSeen: null };
    crawler.fetches += 1;
    if (entry.status && (entry.status < 200 || entry.status > 299)) crawler.errors += 1;
    crawler.pages.add(path);
    crawler.lastSeen = later(crawler.lastSeen, entry.at);
    byCrawler.set(identity.name, crawler);

    const page = byPage.get(path) || { path, fetches: 0, crawlers: new Set<string>(), lastSeen: null };
    page.fetches += 1;
    page.crawlers.add(identity.name);
    page.lastSeen = later(page.lastSeen, entry.at);
    byPage.set(path, page);
  }

  const crawlers = [...byCrawler.values()]
    .map((row) => ({
      name: row.identity.name,
      engine: row.identity.engine,
      purpose: row.identity.purpose,
      fetches: row.fetches,
      pages: row.pages.size,
      lastSeen: row.lastSeen,
      errorRate: row.fetches ? row.errors / row.fetches : null,
    }))
    .sort((left, right) => right.fetches - left.fetches);

  const pages = [...byPage.values()]
    .map((row) => ({
      path: row.path,
      fetches: row.fetches,
      crawlers: [...row.crawlers].sort(),
      lastSeen: row.lastSeen,
      cited: cited.has(row.path),
    }))
    .sort((left, right) => right.fetches - left.fetches);

  const seen = new Set(crawlers.map((row) => row.name));
  const allowed = input.allowedCrawlers || KNOWN_CRAWLERS.map((row) => row.name);
  const fetchedPaths = new Set(pages.map((row) => row.path));

  return {
    totalFetches,
    window: { from, to },
    crawlers,
    pages,
    // Permission without arrival means nothing links to you where they crawl.
    allowedButAbsent: allowed.filter((name) => !seen.has(name)).sort(),
    fetchedNeverCited: pages.filter((row) => !row.cited).map((row) => row.path),
    // A citation with no fetch came from a cache, a training set or a third party.
    citedNeverFetched: [...cited].filter((path) => !fetchedPaths.has(path)).sort(),
  };
}
