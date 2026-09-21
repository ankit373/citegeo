import { currentScope, describeScope, runInScope } from "./context.js";
import { spanId as newSpanId, traceId as newTraceId } from "./ids.js";
import { RingBuffer } from "./ring.js";
import { redact } from "./redact.js";
import { sampledByRatio, type TraceContext } from "./traceparent.js";

// Spans, held in a bounded queue and shipped in batches. Nothing here blocks
// the request: a collector that is slow or gone costs dropped spans and a
// counter saying how many, never latency.

export type SpanKind = "server" | "client" | "internal";

export interface FinishedSpan {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: string;
  kind: SpanKind;
  startedAt: number;
  endedAt: number;
  attributes: Record<string, unknown>;
  status: "ok" | "error";
  error?: string;
}

export interface Span {
  readonly traceId: string;
  readonly spanId: string;
  setAttributes(attributes: Record<string, unknown>): void;
  fail(error: unknown): void;
  end(): void;
}

const QUEUE_CAPACITY = 2048;
const queue = new RingBuffer<FinishedSpan>(QUEUE_CAPACITY);

export function samplingRatio(): number {
  const raw = Number.parseFloat(process.env.OTEL_TRACES_SAMPLER_ARG || "");
  return Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 1;
}

export function startTrace(input: { name: string; kind?: SpanKind; parent?: TraceContext | null; attributes?: Record<string, unknown> }): { scope: TraceContext; span: Span } {
  const traceId = input.parent ? input.parent.traceId : newTraceId();
  // A caller that sampled decides for the whole trace, which is what keeps a
  // trace whole rather than half recorded.
  const sampled = input.parent ? input.parent.sampled : sampledByRatio(traceId, samplingRatio());
  const span = makeSpan({
    traceId,
    parentSpanId: input.parent ? input.parent.spanId : null,
    name: input.name,
    kind: input.kind || "server",
    sampled,
    attributes: input.attributes || {},
  });
  return { scope: { traceId, spanId: span.spanId, sampled }, span };
}

/** A child of whatever is running. Outside a request it is a trace of one. */
export function startSpan(name: string, options: { kind?: SpanKind; attributes?: Record<string, unknown> } = {}): Span {
  const scope = currentScope();
  if (!scope) return startTrace({ name, kind: options.kind || "internal", ...(options.attributes ? { attributes: options.attributes } : {}) }).span;
  return makeSpan({
    traceId: scope.traceId,
    parentSpanId: scope.spanId,
    name,
    kind: options.kind || "internal",
    sampled: scope.sampled,
    attributes: options.attributes || {},
  });
}

/** Runs the work as a child span, ending it whichever way the work goes. */
export async function traced<T>(name: string, run: () => Promise<T>, options: { kind?: SpanKind; attributes?: Record<string, unknown> } = {}): Promise<T> {
  const span = startSpan(name, options);
  const scope = currentScope();
  const inner = scope ? { ...scope, spanId: span.spanId } : null;
  const work = async (): Promise<T> => {
    try {
      return await run();
    } catch (error) {
      span.fail(error);
      throw error;
    } finally {
      span.end();
    }
  };
  return inner ? runInScope(inner, work) : work();
}

function makeSpan(input: {
  traceId: string;
  parentSpanId: string | null;
  name: string;
  kind: SpanKind;
  sampled: boolean;
  attributes: Record<string, unknown>;
}): Span {
  const id = newSpanId();
  const startedAt = Date.now();
  const attributes: Record<string, unknown> = { ...input.attributes };
  let status: "ok" | "error" = "ok";
  let failure: string | undefined;
  let ended = false;

  return {
    traceId: input.traceId,
    spanId: id,
    setAttributes(next) {
      Object.assign(attributes, next);
    },
    fail(error) {
      status = "error";
      failure = error instanceof Error ? error.message : String(error);
    },
    end() {
      // Ending twice would double-count the duration and the error rate.
      if (ended) return;
      ended = true;
      if (!input.sampled) return;
      queue.push({
        traceId: input.traceId,
        spanId: id,
        parentSpanId: input.parentSpanId,
        name: input.name,
        kind: input.kind,
        startedAt,
        endedAt: Date.now(),
        attributes: redact(attributes) as Record<string, unknown>,
        status,
        ...(failure ? { error: failure } : {}),
      });
    },
  };
}

export function drainSpans(): FinishedSpan[] {
  return queue.drain();
}

export function droppedSpans(): number {
  return queue.resetDropped();
}

export function noteProject(projectId: string): void {
  describeScope({ projectId });
}
