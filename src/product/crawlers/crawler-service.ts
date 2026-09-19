// Where the operator points this at its access log. The reading itself is
// incremental and lives in crawler-ingest.ts, because a log only grows and
// re-reading its whole history on every request is work proportional to age.

export function accessLogPath(): string | undefined {
  return process.env.ACCESS_LOG_PATH?.trim() || undefined;
}
