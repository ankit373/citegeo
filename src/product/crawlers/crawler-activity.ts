import type { CrawlerPurpose } from "./crawler-identity.js";
import type { AccessLogEntry } from "./access-log.js";
import { activityFromState, emptyCrawlerState, mergeCrawlerEntries } from "./crawler-state.js";

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

/**
 * Aggregates a whole batch in one go. Incremental ingestion accumulates state
 * instead, so this folds through the same merge to keep one implementation of
 * the counting rules rather than two that can drift apart.
 */
export function buildCrawlerActivity(input: {
  entries: AccessLogEntry[];
  allowedCrawlers?: string[] | undefined;
  citedPaths?: string[] | undefined;
}): CrawlerActivity {
  const state = mergeCrawlerEntries(emptyCrawlerState("batch"), input.entries);
  return activityFromState(state, {
    ...(input.allowedCrawlers ? { allowedCrawlers: input.allowedCrawlers } : {}),
    ...(input.citedPaths ? { citedPaths: input.citedPaths } : {}),
  });
}
