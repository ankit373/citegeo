import { jsonKeys, readJsonEntries, type JsonEntry, type ObjectStore } from "../storage/object-store.js";
import type { PromptAnswer } from "../topics/prompt-run-schema.js";
import { answerEntryDiffers, answerIndexEntry, type AnswerIndexEntry } from "./answer-index-entry.js";
import { openAnswerIndex, type AnswerIndex, type DatabaseLoader } from "./answer-index.js";

export interface AnswerIndexOptions {
  /** Absent or null turns the index off, and every read falls back to a scan. */
  dir?: string | null | undefined;
  /** A seam for proving the fallback path on a runtime that has sqlite. */
  load?: DatabaseLoader | undefined;
}

/** Which keys a read has to fetch, and what the index already claimed of them. */
export interface AnswerReadPlan {
  prefix: string;
  keys: string[];
  /** Null when there is no index, which is the plain scan. */
  known: Map<string, AnswerIndexEntry> | null;
}

/** Where the index and the store disagree. The store is always the winner. */
export interface AnswerIndexDifference {
  checked: number;
  /** In the store, absent from the index. */
  missing: string[];
  /** In the index, gone from the store. */
  extra: string[];
  /** In both, saying different things. */
  mismatched: string[];
}

/**
 * The object store is the record and this is a cache of its queryable half.
 * It resolves on first use so the service graph stays synchronous.
 */
export class AnswerIndexService {
  private opened: Promise<AnswerIndex | null> | null = null;
  private disabled: boolean;

  constructor(private readonly options: AnswerIndexOptions = {}) {
    this.disabled = !options.dir;
  }

  /** True once an index is open, so a caller can say which path it is on. */
  async available(): Promise<boolean> {
    return (await this.index()) !== null;
  }

  /**
   * The keys a read of this prefix has to fetch. A listing is one round trip
   * against one per object, so it is what staleness is measured against.
   */
  async plan(store: ObjectStore, prefix: string, runId?: string | undefined): Promise<AnswerReadPlan> {
    const listed = jsonKeys(await store.list(prefix));
    const index = await this.index();
    if (!index) return { prefix, keys: listed, known: null };
    try {
      const known = index.entriesUnder(prefix);
      const present = new Set(listed);
      const gone = [...known.keys()].filter((key) => !present.has(key));
      // A key the store no longer has leaves the index too: the blobs decide.
      if (gone.length) {
        index.forget(gone);
        for (const key of gone) known.delete(key);
      }
      if (runId === undefined) return { prefix, keys: listed, known };
      // A key the index has never seen is read rather than assumed absent,
      // which is how a write that crashed before indexing comes back.
      const keys = listed.filter((key) => {
        const entry = known.get(key);
        return !entry || entry.runId === runId;
      });
      return { prefix, keys, known };
    } catch {
      this.giveUp();
      return { prefix, keys: listed, known: null };
    }
  }

  /** Folds what a read actually saw back into the index, for free. */
  async observe(plan: AnswerReadPlan, entries: Array<JsonEntry<PromptAnswer>>): Promise<void> {
    const index = await this.index();
    if (!index || !entries.length) return;
    const fresh: AnswerIndexEntry[] = [];
    for (const entry of entries) {
      const built = answerIndexEntry(plan.prefix, entry.key, entry.value);
      const indexed = plan.known?.get(entry.key);
      if (!indexed || answerEntryDiffers(indexed, built)) fresh.push(built);
    }
    try {
      index.put(fresh);
    } catch {
      this.giveUp();
    }
  }

  /** Called after the store has the document, never before. */
  async record(prefix: string, key: string, answer: PromptAnswer): Promise<void> {
    const index = await this.index();
    if (!index) return;
    try {
      index.put([answerIndexEntry(prefix, key, answer)]);
    } catch {
      this.giveUp();
    }
  }

  /** Throws this prefix away and repopulates it from the store. */
  async rebuild(store: ObjectStore, prefix: string): Promise<number | null> {
    const index = await this.index();
    if (!index) return null;
    const entries = await readJsonEntries<PromptAnswer>(store, jsonKeys(await store.list(prefix)));
    index.clear(prefix);
    index.put(entries.map((entry) => answerIndexEntry(prefix, entry.key, entry.value)));
    return entries.length;
  }

  /**
   * Reads every document and reports the difference rather than trusting
   * either side. Null when there is no index to compare against.
   */
  async verify(store: ObjectStore, prefix: string): Promise<AnswerIndexDifference | null> {
    const index = await this.index();
    if (!index) return null;
    const known = index.entriesUnder(prefix);
    const entries = await readJsonEntries<PromptAnswer>(store, jsonKeys(await store.list(prefix)));
    const missing: string[] = [];
    const mismatched: string[] = [];
    const seen = new Set<string>();
    for (const entry of entries) {
      seen.add(entry.key);
      const indexed = known.get(entry.key);
      if (!indexed) missing.push(entry.key);
      else if (answerEntryDiffers(indexed, answerIndexEntry(prefix, entry.key, entry.value))) mismatched.push(entry.key);
    }
    const extra = [...known.keys()].filter((key) => !seen.has(key)).sort();
    return { checked: entries.length, missing, extra, mismatched };
  }

  async close(): Promise<void> {
    const index = await this.index();
    this.opened = null;
    this.disabled = true;
    index?.close();
  }

  private index(): Promise<AnswerIndex | null> {
    if (this.disabled) return Promise.resolve(null);
    if (!this.opened) {
      const directory = this.options.dir;
      this.opened = directory
        ? openAnswerIndex(directory, this.options.load ?? undefined).catch(() => null)
        : Promise.resolve(null);
    }
    return this.opened;
  }

  // A file that has started throwing would otherwise slow every request. The
  // scan is always correct, so the index steps aside for the rest of the run.
  private giveUp(): void {
    this.disabled = true;
    void this.opened?.then((index) => index?.close()).catch(() => undefined);
    this.opened = null;
  }
}
