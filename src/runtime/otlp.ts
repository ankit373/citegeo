import { log } from "./logger.js";
import { metrics } from "./metrics.js";
import { drainSpans, droppedSpans, type FinishedSpan } from "./tracer.js";

// OTLP over HTTP with a JSON body. The wire format is a published spec and
// three endpoints, so it is written here rather than taken with the eighteen
// packages the official exporter brings. Same judgement as the request signing.

const MILLISECOND_NS = 1_000_000;

function nanos(milliseconds: number): string {
  return String(BigInt(Math.round(milliseconds)) * BigInt(MILLISECOND_NS));
}

function attributes(input: Record<string, unknown>): Array<Record<string, unknown>> {
  return Object.entries(input).map(([key, value]) => ({
    key,
    value: typeof value === "number"
      ? (Number.isInteger(value) ? { intValue: String(value) } : { doubleValue: value })
      : typeof value === "boolean"
        ? { boolValue: value }
        : { stringValue: String(value) },
  }));
}

const KIND: Record<FinishedSpan["kind"], number> = { internal: 1, server: 2, client: 3 };

/** Trailing slashes are stripped by hand: this codebase bans regular
 * expressions, and the endpoint is joined with a path either way. */
export function endpoint(): string | null {
  const explicit = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "").trim();
  if (!explicit) return null;
  let end = explicit.length;
  while (end > 0 && explicit[end - 1] === "/") end -= 1;
  return explicit.slice(0, end);
}

export function serviceResource(): Record<string, unknown> {
  return {
    attributes: attributes({
      "service.name": process.env.OTEL_SERVICE_NAME || "citegeo",
      "service.version": process.env.OTEL_SERVICE_VERSION || "0.2.0",
      "deployment.environment": process.env.NODE_ENV || "development",
    }),
  };
}

export function tracePayload(spans: FinishedSpan[]): Record<string, unknown> {
  return {
    resourceSpans: [{
      resource: serviceResource(),
      scopeSpans: [{
        scope: { name: "citegeo" },
        spans: spans.map((span) => ({
          traceId: span.traceId,
          spanId: span.spanId,
          ...(span.parentSpanId ? { parentSpanId: span.parentSpanId } : {}),
          name: span.name,
          kind: KIND[span.kind],
          startTimeUnixNano: nanos(span.startedAt),
          endTimeUnixNano: nanos(span.endedAt),
          attributes: attributes(span.attributes),
          status: span.status === "error" ? { code: 2, message: span.error || "" } : { code: 1 },
        })),
      }],
    }],
  };
}

export function metricPayload(at = Date.now()): Record<string, unknown> {
  const stamp = nanos(at);
  const counters = metrics.allCounters().map((counter) => ({
    name: counter.name,
    unit: counter.unit,
    description: counter.description,
    sum: {
      aggregationTemporality: 2,
      isMonotonic: true,
      dataPoints: counter.collect().map((point) => ({
        attributes: attributes(point.labels),
        timeUnixNano: stamp,
        asDouble: point.value,
      })),
    },
  }));
  const histograms = metrics.allHistograms().map((histogram) => ({
    name: histogram.name,
    unit: histogram.unit,
    description: histogram.description,
    histogram: {
      aggregationTemporality: 2,
      dataPoints: histogram.collect().map((point) => ({
        attributes: attributes(point.labels),
        timeUnixNano: stamp,
        count: String(point.count),
        sum: point.sum,
        bucketCounts: point.counts.map(String),
        explicitBounds: histogram.boundaries,
      })),
    },
  }));
  return {
    resourceMetrics: [{
      resource: serviceResource(),
      scopeMetrics: [{ scope: { name: "citegeo" }, metrics: [...counters, ...histograms] }],
    }],
  };
}

async function post(url: string, body: unknown, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export interface ExporterOptions {
  intervalMs?: number;
  timeoutMs?: number;
  /** Injected in tests, so an export can be checked without a collector. */
  send?: (url: string, body: unknown, timeoutMs: number) => Promise<boolean>;
}

/** Nothing is exported unless an endpoint is set. A tool nobody configured a
 * collector for should not be making outbound requests every ten seconds. */
export function startExporter(options: ExporterOptions = {}): { stop: () => void } | null {
  const root = endpoint();
  if (!root) return null;
  const send = options.send || post;
  const timeoutMs = options.timeoutMs || 5000;
  const failures = metrics.counter("citegeo.telemetry.export_failures", "1", "OTLP exports that did not land.");
  const dropped = metrics.counter("citegeo.telemetry.spans_dropped", "1", "Spans dropped because the queue was full.");

  const flush = async (): Promise<void> => {
    const lost = droppedSpans();
    if (lost) dropped.add(lost);
    const spans = drainSpans();
    if (spans.length && !await send(`${root}/v1/traces`, tracePayload(spans), timeoutMs)) failures.add(1, { signal: "traces" });
    if (!await send(`${root}/v1/metrics`, metricPayload(), timeoutMs)) failures.add(1, { signal: "metrics" });
  };

  const timer = setInterval(() => { void flush().catch((error) => log.debug("telemetry flush failed", { error })); }, options.intervalMs || 10000);
  // The export must never be the reason a process stays alive.
  timer.unref();
  return { stop: () => clearInterval(timer) };
}
