import { randomFillSync } from "node:crypto";

// Trace and span ids are hex, fixed width, and generated without allocating a
// Buffer per call. One id per span on a hot path adds up.

const TRACE_BYTES = 16;
const SPAN_BYTES = 8;
const HEX = "0123456789abcdef";

/** One scratch buffer, refilled in place. randomFillSync on a reused buffer
 * avoids an allocation per id, which a request makes several of. */
const scratch = Buffer.allocUnsafe(TRACE_BYTES);

function hex(bytes: number): string {
  randomFillSync(scratch, 0, bytes);
  let out = "";
  for (let index = 0; index < bytes; index += 1) {
    const byte = scratch[index] as number;
    out += HEX[byte >> 4];
    out += HEX[byte & 15];
  }
  return out;
}

export function traceId(): string {
  return hex(TRACE_BYTES);
}

export function spanId(): string {
  return hex(SPAN_BYTES);
}

export const INVALID_TRACE_ID = "0".repeat(TRACE_BYTES * 2);
export const INVALID_SPAN_ID = "0".repeat(SPAN_BYTES * 2);

export function isTraceId(value: string): boolean {
  return value.length === TRACE_BYTES * 2 && value !== INVALID_TRACE_ID && isHex(value);
}

export function isSpanId(value: string): boolean {
  return value.length === SPAN_BYTES * 2 && value !== INVALID_SPAN_ID && isHex(value);
}

function isHex(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    const digit = code >= 48 && code <= 57;
    const lower = code >= 97 && code <= 102;
    if (!digit && !lower) return false;
  }
  return true;
}
