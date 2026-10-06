import { open, stat } from "node:fs/promises";
import { getJson, putJson } from "../storage/object-store.js";
import { sha256 } from "../../utils/hash.js";
import { readAccessLog } from "./access-log.js";
import {
  activityFromState,
  completeLines,
  emptyCrawlerState,
  mergeCrawlerEntries,
  planNextRead,
} from "./crawler-state.js";
import type { CrawlerLogState } from "./crawler-state.js";
import { accessLogPath } from "./crawler-service.js";
import type { ProductProjectFileStore } from "../projects/project-store.js";
import type { CrawlerActivity } from "./crawler-activity.js";

// Incremental ingestion. The log only grows, so reading it from the top on
// every request was work proportional to its whole history. State carries a
// byte offset and accumulated counts, and a read resumes from there.
//
// One state per project. It was one file for the whole installation, so three
// projects on one server read whichever project's log had been configured, and
// each of them listed every page it had as cited and never fetched.

/** Where an uploaded log's counts live, which is not a path on this machine. */
export const UPLOAD_SOURCE = "upload";

export class CrawlerLogStateStore {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private key(projectId: string): string {
    return this.projects.keyFor(projectId, "crawler-log-state.json");
  }

  async read(projectId: string): Promise<CrawlerLogState | null> {
    return getJson<CrawlerLogState>(this.projects.objects, this.key(projectId));
  }

  async write(projectId: string, state: CrawlerLogState): Promise<void> {
    await putJson(this.projects.objects, this.key(projectId), state);
  }
}

export interface IngestOutcome {
  state: "ingested" | "up_to_date" | "not_configured" | "unreadable" | "already_counted";
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

  async current(projectId: string, input: { allowedCrawlers?: string[] | undefined; citedPaths?: string[] | undefined } = {}): Promise<IngestOutcome> {
    const state = await this.store.read(projectId);
    if (!state) {
      const path = this.resolvePath();
      return {
        state: path ? "up_to_date" : "not_configured",
        source: path || null,
        detail: path
          ? "Nothing ingested yet. The worker reads the log on its next pass."
          : "Upload an access log, or set ACCESS_LOG_PATH to one on this machine. Without one there is no evidence that any crawler arrived, which is not the same as none arriving.",
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

  /** Counts an uploaded log against this project. A file somebody posts has no
   * byte offset into anything, so the same bytes posted twice would double every
   * figure. The digest of what was counted is kept and a repeat says so. */
  async addLog(projectId: string, text: string, input: { allowedCrawlers?: string[] | undefined; citedPaths?: string[] | undefined } = {}): Promise<IngestOutcome> {
    const digest = sha256(text);
    const existing = await this.store.read(projectId);
    const base = existing && existing.source === UPLOAD_SOURCE ? existing : emptyCrawlerState(UPLOAD_SOURCE);
    if ((base.uploads || []).includes(digest)) {
      return {
        state: "already_counted",
        source: UPLOAD_SOURCE,
        detail: "This log has been counted already, so it was not counted again.",
        bytesRead: 0,
        linesParsed: 0,
        restarted: false,
        activity: activityFromState(base, input),
      };
    }
    const { entries, fields } = readAccessLog(text, base.logFields);
    const next: CrawlerLogState = {
      ...mergeCrawlerEntries(base, entries),
      source: UPLOAD_SOURCE,
      // An upload is a whole file, not a window into a growing one, so the
      // offset stays at nought and the digest is what stops a second count.
      offset: 0,
      size: 0,
      ingestedAt: new Date().toISOString(),
      uploads: [...(base.uploads || []), digest],
      ...(fields.length ? { logFields: fields } : {}),
    };
    await this.store.write(projectId, next);
    return {
      state: "ingested",
      source: UPLOAD_SOURCE,
      detail: entries.length
        ? `${entries.length.toLocaleString()} request(s) parsed from the uploaded log.`
        : "Nothing in that file parsed as a request. It needs to be a combined-format access log, or a CloudFront one with its #Fields header.",
      bytesRead: Buffer.byteLength(text, "utf8"),
      linesParsed: entries.length,
      restarted: false,
      activity: activityFromState(next, input),
    };
  }

  /** Reads whatever has been appended since the last pass. */
  async ingest(projectId: string, input: { allowedCrawlers?: string[] | undefined; citedPaths?: string[] | undefined } = {}): Promise<IngestOutcome> {
    const path = this.resolvePath();
    if (!path) {
      // A project that uploaded a log has evidence, whatever this server was
      // told. Reporting it as unconfigured threw that evidence away on every
      // read, so an upload could be made and never seen again.
      const uploaded = await this.store.read(projectId);
      if (uploaded) {
        return {
          state: "up_to_date",
          source: uploaded.source,
          detail: `${uploaded.totalFetches.toLocaleString()} crawler fetch(es) counted from the log you uploaded.`,
          bytesRead: 0,
          linesParsed: 0,
          restarted: false,
          activity: activityFromState(uploaded, input),
        };
      }
      return {
        state: "not_configured",
        source: null,
        detail: "Upload an access log, or set ACCESS_LOG_PATH to one on this machine. Without one there is no evidence that any crawler arrived, which is not the same as none arriving.",
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

    const existing = await this.store.read(projectId);
    // A project that uploaded its own log is counting its own traffic. The
    // configured path belongs to whichever server this process runs on, and
    // folding it in would mix two sites' crawlers into one set of figures.
    if (existing && existing.source === UPLOAD_SOURCE) {
      return {
        state: "up_to_date",
        source: UPLOAD_SOURCE,
        detail: "This project is counting a log it uploaded, so the log configured on this server is left out of it.",
        bytesRead: 0,
        linesParsed: 0,
        restarted: false,
        activity: activityFromState(existing, input),
      };
    }
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
    // A restart re-reads the header, so the carried one is dropped with it.
    const carried = plan.restarted ? undefined : from.logFields;
    const { entries, fields } = readAccessLog(text, carried);
    const next: CrawlerLogState = {
      ...mergeCrawlerEntries(from, entries),
      source: path,
      offset: plan.start + consumed,
      size,
      ingestedAt: new Date().toISOString(),
      ...(fields.length ? { logFields: fields } : {}),
    };
    await this.store.write(projectId, next);

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
