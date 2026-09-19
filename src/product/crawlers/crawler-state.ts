import { identifyCrawler, KNOWN_CRAWLERS } from "./crawler-identity.js";
import type { CrawlerPurpose } from "./crawler-identity.js";
import type { AccessLogEntry } from "./access-log.js";
import type { CrawlerActivity } from "./crawler-activity.js";

// Accumulated crawler evidence, so a growing log is read once rather than from
// the top on every request. Everything here merges, which is what lets
// ingestion resume from a byte offset instead of recomputing.

export interface CrawlerStateEntry {
  engine: string;
  purpose: CrawlerPurpose;
  fetches: number;
  errors: number;
  lastSeen: string | null;
  pages: string[];
}

export interface PageStateEntry {
  fetches: number;
  crawlers: string[];
  lastSeen: string | null;
}

export interface CrawlerLogState {
  source: string;
  /** Bytes consumed. Resumes here, and never mid-line. */
  offset: number;
  /** File size when last read, so truncation and rotation are detectable. */
  size: number;
  ingestedAt: string | null;
  totalFetches: number;
  from: string | null;
  to: string | null;
  crawlers: Record<string, CrawlerStateEntry>;
  pages: Record<string, PageStateEntry>;
}

export function emptyCrawlerState(source: string): CrawlerLogState {
  return {
    source,
    offset: 0,
    size: 0,
    ingestedAt: null,
    totalFetches: 0,
    from: null,
    to: null,
    crawlers: {},
    pages: {},
  };
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

function addUnique(values: string[], value: string): string[] {
  return values.includes(value) ? values : values.concat(value).sort();
}

/** Folds new entries into the accumulated state. Pure, so it is testable. */
export function mergeCrawlerEntries(state: CrawlerLogState, entries: AccessLogEntry[]): CrawlerLogState {
  const next: CrawlerLogState = {
    ...state,
    crawlers: { ...state.crawlers },
    pages: { ...state.pages },
  };

  for (const entry of entries) {
    const identity = identifyCrawler(entry.userAgent);
    if (!identity) continue;
    const path = normalisePath(entry.path);
    next.totalFetches += 1;
    next.from = earlier(next.from, entry.at);
    next.to = later(next.to, entry.at);

    const crawler = next.crawlers[identity.name] || {
      engine: identity.engine,
      purpose: identity.purpose,
      fetches: 0,
      errors: 0,
      lastSeen: null,
      pages: [],
    };
    next.crawlers[identity.name] = {
      ...crawler,
      fetches: crawler.fetches + 1,
      errors: crawler.errors + (entry.status && (entry.status < 200 || entry.status > 299) ? 1 : 0),
      lastSeen: later(crawler.lastSeen, entry.at),
      pages: addUnique(crawler.pages, path),
    };

    const page = next.pages[path] || { fetches: 0, crawlers: [], lastSeen: null };
    next.pages[path] = {
      fetches: page.fetches + 1,
      crawlers: addUnique(page.crawlers, identity.name),
      lastSeen: later(page.lastSeen, entry.at),
    };
  }

  return next;
}

export function activityFromState(state: CrawlerLogState, input: {
  allowedCrawlers?: string[] | undefined;
  citedPaths?: string[] | undefined;
} = {}): CrawlerActivity {
  const cited = new Set((input.citedPaths || []).map(normalisePath));

  const crawlers = Object.entries(state.crawlers)
    .map(([name, row]) => ({
      name,
      engine: row.engine,
      purpose: row.purpose,
      fetches: row.fetches,
      pages: row.pages.length,
      lastSeen: row.lastSeen,
      errorRate: row.fetches ? row.errors / row.fetches : null,
    }))
    .sort((left, right) => right.fetches - left.fetches);

  const pages = Object.entries(state.pages)
    .map(([path, row]) => ({
      path,
      fetches: row.fetches,
      crawlers: row.crawlers,
      lastSeen: row.lastSeen,
      cited: cited.has(path),
    }))
    .sort((left, right) => right.fetches - left.fetches);

  const seen = new Set(crawlers.map((row) => row.name));
  const allowed = input.allowedCrawlers || KNOWN_CRAWLERS.map((row) => row.name);
  const fetchedPaths = new Set(pages.map((row) => row.path));

  return {
    totalFetches: state.totalFetches,
    window: { from: state.from, to: state.to },
    crawlers,
    pages,
    allowedButAbsent: allowed.filter((name) => !seen.has(name)).sort(),
    fetchedNeverCited: pages.filter((row) => !row.cited).map((row) => row.path),
    citedNeverFetched: [...cited].filter((path) => !fetchedPaths.has(path)).sort(),
  };
}

export interface ChunkPlan {
  /** Byte to start reading from. */
  start: number;
  /** True when the file shrank or was replaced, so accumulated counts are void. */
  restarted: boolean;
}

/**
 * A rotated or truncated log has to be read from the top, and its old counts
 * belong to a file that no longer exists.
 */
export function planNextRead(state: CrawlerLogState, currentSize: number): ChunkPlan {
  if (currentSize < state.offset) return { start: 0, restarted: true };
  return { start: state.offset, restarted: false };
}

/**
 * Consumes only whole lines. A log being appended to while it is read would
 * otherwise contribute a truncated final line and a corrupt entry.
 */
export function completeLines(chunk: string): { text: string; consumed: number } {
  const lastBreak = chunk.lastIndexOf("\n");
  if (lastBreak === -1) return { text: "", consumed: 0 };
  return { text: chunk.slice(0, lastBreak + 1), consumed: Buffer.byteLength(chunk.slice(0, lastBreak + 1), "utf8") };
}
