import { isSpanId, isTraceId } from "./ids.js";

// W3C Trace Context. Accepting a caller's trace means a request that crossed a
// boundary is one trace rather than two unconnected ones.

export interface TraceContext {
  traceId: string;
  spanId: string;
  sampled: boolean;
}

const VERSION = "00";

/** A malformed header is ignored rather than repaired: a trace stitched onto a
 * guess is worse than a new one, because it claims a link that is not there. */
export function parseTraceparent(header: string | undefined): TraceContext | null {
  if (!header) return null;
  const parts = header.trim().split("-");
  if (parts.length !== 4) return null;
  const [version, trace, span, flags] = parts as [string, string, string, string];
  if (version.length !== 2 || version === "ff") return null;
  if (!isTraceId(trace) || !isSpanId(span)) return null;
  if (flags.length !== 2) return null;
  const parsed = Number.parseInt(flags, 16);
  if (!Number.isFinite(parsed)) return null;
  return { traceId: trace, spanId: span, sampled: (parsed & 1) === 1 };
}

export function formatTraceparent(context: TraceContext): string {
  return `${VERSION}-${context.traceId}-${context.spanId}-${context.sampled ? "01" : "00"}`;
}

/** Deterministic on the trace id, so every service in a trace decides the same
 * way without talking to each other, and a rerun samples the same traces. */
export function sampledByRatio(traceId: string, ratio: number): boolean {
  if (ratio >= 1) return true;
  if (ratio <= 0) return false;
  const tail = traceId.slice(-8);
  const value = Number.parseInt(tail, 16);
  if (!Number.isFinite(value)) return false;
  return value / 0xffffffff < ratio;
}
