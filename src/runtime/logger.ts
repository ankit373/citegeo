import { currentScope } from "./context.js";
import { redact } from "./redact.js";

// One line of JSON per event, carrying the trace it belongs to. Correlating a
// log with a trace is the whole point of writing them this way.

export type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function configuredLevel(): Level {
  const raw = (process.env.LOG_LEVEL || "info").toLocaleLowerCase();
  return raw === "debug" || raw === "info" || raw === "warn" || raw === "error" ? raw : "info";
}

/** Read once. Reading process.env per line is measurable on a hot path. */
let threshold = ORDER[configuredLevel()];
let pretty = process.env.LOG_FORMAT === "pretty";

export function configureLogging(input: { level?: Level; pretty?: boolean } = {}): void {
  if (input.level) threshold = ORDER[input.level];
  if (input.pretty !== undefined) pretty = input.pretty;
}

export interface LogFields {
  [key: string]: unknown;
}

function write(level: Level, message: string, fields: LogFields): void {
  if (ORDER[level] < threshold) return;
  const scope = currentScope();
  const line: Record<string, unknown> = {
    at: new Date().toISOString(),
    level,
    msg: message,
    ...(scope ? { traceId: scope.traceId, spanId: scope.spanId } : {}),
    ...(scope?.route ? { route: scope.route } : {}),
    ...(scope?.projectId ? { projectId: scope.projectId } : {}),
    ...(redact(fields) as Record<string, unknown>),
  };
  const out = pretty
    ? `${String(line.at).slice(11, 23)} ${level.padEnd(5)} ${message} ${JSON.stringify(redact(fields))}`
    : JSON.stringify(line);
  // stdout for everything: a container collects one stream, and splitting
  // warn onto stderr interleaves the two unpredictably.
  process.stdout.write(`${out}\n`);
}

export const log = {
  debug: (message: string, fields: LogFields = {}) => write("debug", message, fields),
  info: (message: string, fields: LogFields = {}) => write("info", message, fields),
  warn: (message: string, fields: LogFields = {}) => write("warn", message, fields),
  error: (message: string, fields: LogFields = {}) => write("error", message, fields),
};
