import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseAccessLog } from "./access-log.js";
import {
  activityFromState,
  completeLines,
  emptyCrawlerState,
  mergeCrawlerEntries,
  planNextRead,
} from "./crawler-state.js";
import type { CrawlerLogState } from "./crawler-state.js";
import { accessLogPath } from "./crawler-service.js";
import type { CrawlerActivity } from "./crawler-activity.js";

// Incremental ingestion. The log only grows, so reading it from the top on
// every request was work proportional to its whole history. State carries a
// byte offset and accumulated counts, and a read resumes from there.

function notFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

async function writeJson(path: string, value: unknown): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

export class CrawlerLogStateStore {
  constructor(private readonly dataDir: string) {}

  private path(): string {
    return join(this.dataDir, "crawler-log-state.json");
  }

  async read(): Promise<CrawlerLogState | null> {
    try {
      return JSON.parse(await readFile(this.path(), "utf8")) as CrawlerLogState;
    } catch (error) {
      if (notFound(error)) return null;
      return null;
    }
  }

  async write(state: CrawlerLogState): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    await writeJson(this.path(), state);
  }
}

export interface IngestOutcome {
  state: "ingested" | "up_to_date" | "not_configured" | "unreadable";
  source: string | null;
  detail: string;
  bytesRead: number;
  linesParsed: number;
  restarted: boolean;
  activity: CrawlerActivity | null;
}

export class CrawlerLogIngestService {
  constructor(
    private readonly store: CrawlerLogStateStore,
    private readonly resolvePath: () => string | undefined = accessLogPath,
  ) {}

  async current(input: { allowedCrawlers?: string[] | undefined; citedPaths?: string[] | undefined } = {}): Promise<IngestOutcome> {
    const state = await this.store.read();
    if (!state) {
      const path = this.resolvePath();
      return {
        state: path ? "up_to_date" : "not_configured",
        source: path || null,
        detail: path
          ? "Nothing ingested yet. The worker reads the log on its next pass."
          : "Set ACCESS_LOG_PATH to a combined-format access log. Without one there is no evidence that any crawler arrived, which is not the same as none arriving.",
        bytesRead: 0,
        linesParsed: 0,
        restarted: false,
        activity: null,
      };
    }
    return {
      state: "up_to_date",
      source: state.source,
      detail: `${state.totalFetches.toLocaleString()} crawler fetch(es) ingested to byte ${state.offset.toLocaleString()}.`,
      bytesRead: 0,
      linesParsed: 0,
      restarted: false,
      activity: activityFromState(state, input),
    };
  }

  /** Reads whatever has been appended since the last pass. */
  async ingest(input: { allowedCrawlers?: string[] | undefined; citedPaths?: string[] | undefined } = {}): Promise<IngestOutcome> {
    const path = this.resolvePath();
    if (!path) {
      return {
        state: "not_configured",
        source: null,
        detail: "Set ACCESS_LOG_PATH to a combined-format access log.",
        bytesRead: 0,
        linesParsed: 0,
        restarted: false,
        activity: null,
      };
    }

    let size: number;
    try {
      size = (await stat(path)).size;
    } catch {
      return {
        state: "unreadable",
        source: path,
        detail: `No readable file at ${path}.`,
        bytesRead: 0,
        linesParsed: 0,
        restarted: false,
        activity: null,
      };
    }

    const existing = await this.store.read();
    // A different path is a different log, so its accumulated counts do not apply.
    const base = existing && existing.source === path ? existing : emptyCrawlerState(path);
    const plan = planNextRead(base, size);
    const from = plan.restarted ? emptyCrawlerState(path) : base;

    if (!plan.restarted && size === base.offset) {
      return {
        state: "up_to_date",
        source: path,
        detail: "No new requests since the last pass.",
        bytesRead: 0,
        linesParsed: 0,
        restarted: false,
        activity: activityFromState(base, input),
      };
    }

    const length = size - plan.start;
    const buffer = Buffer.alloc(length);
    const handle = await open(path, "r");
    try {
      await handle.read(buffer, 0, length, plan.start);
    } finally {
      await handle.close();
    }

    const { text, consumed } = completeLines(buffer.toString("utf8"));
    const entries = parseAccessLog(text);
    const next: CrawlerLogState = {
      ...mergeCrawlerEntries(from, entries),
      source: path,
      offset: plan.start + consumed,
      size,
      ingestedAt: new Date().toISOString(),
    };
    await this.store.write(next);

    return {
      state: "ingested",
      source: path,
      detail: plan.restarted
        ? `The log was rotated or truncated, so it was read from the start. ${entries.length.toLocaleString()} request(s) parsed.`
        : `${entries.length.toLocaleString()} new request(s) parsed.`,
      bytesRead: consumed,
      linesParsed: entries.length,
      restarted: plan.restarted,
      activity: activityFromState(next, input),
    };
  }
}
