import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { ANSWER_INDEX_SCHEMA_VERSION, type AnswerIndexEntry } from "./answer-index-entry.js";

type DatabaseSyncClass = typeof import("node:sqlite").DatabaseSync;
type Database = InstanceType<DatabaseSyncClass>;
type SqlValue = import("node:sqlite").SQLOutputValue;

/** Loads a database class, or reports that this runtime has none. */
export type DatabaseLoader = () => Promise<DatabaseSyncClass | null>;

/**
 * node:sqlite ships built in on Node 24 and sits behind a flag on Node 22, so
 * it is imported at runtime and its absence costs speed rather than a failure.
 */
export const loadDatabaseClass: DatabaseLoader = async () => {
  try {
    const sqlite = await import("node:sqlite");
    return sqlite.DatabaseSync;
  } catch {
    return null;
  }
};

const COLUMNS = [
  "key", "prefix", "project_id", "run_id", "prompt_id", "topic_id", "model_id", "provider_id",
  "region_id", "language_id", "persona_id", "status", "created_at",
  "mention_count", "target_named", "citation_count",
];

const SCHEMA = `CREATE TABLE IF NOT EXISTS answers (
  key TEXT PRIMARY KEY,
  prefix TEXT NOT NULL,
  project_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  prompt_id TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  region_id TEXT NOT NULL,
  language_id TEXT NOT NULL,
  persona_id TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  mention_count INTEGER,
  target_named INTEGER,
  citation_count INTEGER
);
CREATE INDEX IF NOT EXISTS answers_by_prefix_run ON answers (prefix, run_id);
CREATE TABLE IF NOT EXISTS meta (name TEXT PRIMARY KEY, value TEXT NOT NULL);`;

function text(value: SqlValue | undefined): string {
  return typeof value === "string" ? value : "";
}

function optionalText(value: SqlValue | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function counted(value: SqlValue | undefined): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  return null;
}

function flag(value: SqlValue | undefined): boolean | null {
  const parsed = counted(value);
  return parsed === null ? null : parsed !== 0;
}

function rowToEntry(row: Record<string, SqlValue>): AnswerIndexEntry {
  return {
    key: text(row.key),
    prefix: text(row.prefix),
    projectId: text(row.project_id),
    runId: text(row.run_id),
    promptId: text(row.prompt_id),
    topicId: text(row.topic_id),
    modelId: text(row.model_id),
    providerId: text(row.provider_id),
    regionId: text(row.region_id),
    languageId: text(row.language_id),
    personaId: optionalText(row.persona_id),
    status: text(row.status),
    createdAt: text(row.created_at),
    mentionCount: counted(row.mention_count),
    targetNamed: flag(row.target_named),
    citationCount: counted(row.citation_count),
  };
}

/** A derived, disposable view of the answers in a store. Losing it costs speed. */
export class AnswerIndex {
  constructor(private readonly database: Database) {}

  entriesUnder(prefix: string): Map<string, AnswerIndexEntry> {
    const rows = this.database.prepare(`SELECT ${COLUMNS.join(", ")} FROM answers WHERE prefix = ?`).all(prefix);
    const entries = new Map<string, AnswerIndexEntry>();
    for (const row of rows) {
      const entry = rowToEntry(row);
      if (entry.key) entries.set(entry.key, entry);
    }
    return entries;
  }

  put(entries: AnswerIndexEntry[]): void {
    if (!entries.length) return;
    const statement = this.database.prepare(
      `INSERT OR REPLACE INTO answers (${COLUMNS.join(", ")}) VALUES (${COLUMNS.map(() => "?").join(", ")})`,
    );
    this.transaction(() => {
      for (const entry of entries) {
        statement.run(
          entry.key, entry.prefix, entry.projectId, entry.runId, entry.promptId, entry.topicId,
          entry.modelId, entry.providerId, entry.regionId, entry.languageId, entry.personaId,
          entry.status, entry.createdAt, entry.mentionCount,
          entry.targetNamed === null ? null : Number(entry.targetNamed), entry.citationCount,
        );
      }
    });
  }

  forget(keys: string[]): void {
    if (!keys.length) return;
    const statement = this.database.prepare("DELETE FROM answers WHERE key = ?");
    this.transaction(() => {
      for (const key of keys) statement.run(key);
    });
  }

  clear(prefix: string): void {
    this.database.prepare("DELETE FROM answers WHERE prefix = ?").run(prefix);
  }

  close(): void {
    this.database.close();
  }

  private transaction(body: () => void): void {
    this.database.exec("BEGIN");
    try {
      body();
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}

/** Opens the index on local disk, or reports that this runtime offers none. */
export async function openAnswerIndex(directory: string, load: DatabaseLoader = loadDatabaseClass): Promise<AnswerIndex | null> {
  const DatabaseClass = await load();
  if (!DatabaseClass) return null;
  try {
    await mkdir(directory, { recursive: true });
    const database = new DatabaseClass(join(directory, "answers.sqlite"));
    // The index is rebuildable from the bucket, so durability can be traded
    // for write speed: a torn write costs a rescan and nothing else.
    database.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
    resetIfStaleSchema(database);
    return new AnswerIndex(database);
  } catch {
    return null;
  }
}

function resetIfStaleSchema(database: Database): void {
  database.exec(SCHEMA);
  const row = database.prepare("SELECT value FROM meta WHERE name = 'schema_version'").get();
  const found = row ? text(row.value) : "";
  const wanted = String(ANSWER_INDEX_SCHEMA_VERSION);
  if (found === wanted) return;
  // A file written by older columns is thrown away rather than migrated. It
  // holds nothing the store does not.
  database.exec("DROP TABLE IF EXISTS answers; DROP TABLE IF EXISTS meta;");
  database.exec(SCHEMA);
  database.prepare("INSERT OR REPLACE INTO meta (name, value) VALUES ('schema_version', ?)").run(wanted);
}
