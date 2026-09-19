import { readFile, stat } from "node:fs/promises";
import { parseAccessLog } from "./access-log.js";
import { buildCrawlerActivity } from "./crawler-activity.js";
import type { CrawlerActivity } from "./crawler-activity.js";

// Reads whatever access log the operator points at. A log is the only evidence
// that a crawler arrived, so when there is no source this reports that plainly
// rather than returning an empty result that reads like "nothing crawled you".

export type CrawlerSourceState = "ready" | "not_configured" | "unreadable";

export interface CrawlerReport {
  state: CrawlerSourceState;
  source: string | null;
  detail: string;
  bytesRead: number;
  linesParsed: number;
  activity: CrawlerActivity | null;
}

export function accessLogPath(): string | undefined {
  return process.env.ACCESS_LOG_PATH?.trim() || undefined;
}

const EMPTY: Omit<CrawlerReport, "state" | "detail" | "source"> = {
  bytesRead: 0,
  linesParsed: 0,
  activity: null,
};

export async function readCrawlerReport(input: {
  path?: string | undefined;
  allowedCrawlers?: string[] | undefined;
  citedPaths?: string[] | undefined;
  /** Guards against loading an unbounded rotated log into memory. */
  maxBytes?: number;
}): Promise<CrawlerReport> {
  const path = input.path || accessLogPath();
  if (!path) {
    return {
      ...EMPTY,
      state: "not_configured",
      source: null,
      detail: "Set ACCESS_LOG_PATH to a combined-format access log. Without one there is no evidence that any crawler arrived, which is not the same as none arriving.",
    };
  }

  let size = 0;
  try {
    size = (await stat(path)).size;
  } catch {
    return { ...EMPTY, state: "unreadable", source: path, detail: `No readable file at ${path}.` };
  }

  const maxBytes = input.maxBytes ?? 64 * 1024 * 1024;
  if (size > maxBytes) {
    return {
      ...EMPTY,
      state: "unreadable",
      source: path,
      detail: `The log is ${size.toLocaleString()} bytes, over the ${maxBytes.toLocaleString()} byte limit. Point at a rotated slice instead.`,
    };
  }

  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    return {
      ...EMPTY,
      state: "unreadable",
      source: path,
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  const entries = parseAccessLog(text);
  return {
    state: "ready",
    source: path,
    detail: `${entries.length.toLocaleString()} request(s) parsed.`,
    bytesRead: text.length,
    linesParsed: entries.length,
    activity: buildCrawlerActivity({
      entries,
      ...(input.allowedCrawlers ? { allowedCrawlers: input.allowedCrawlers } : {}),
      ...(input.citedPaths ? { citedPaths: input.citedPaths } : {}),
    }),
  };
}
