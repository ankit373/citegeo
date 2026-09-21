import test from "node:test";
import assert from "node:assert/strict";
import { RingBuffer } from "../src/runtime/ring.js";
import { BoundedSeries, OVERFLOW } from "../src/runtime/cardinality.js";
import { Counter, Histogram, seriesKey } from "../src/runtime/metrics.js";
import { formatTraceparent, parseTraceparent, sampledByRatio } from "../src/runtime/traceparent.js";
import { isSpanId, isTraceId, spanId, traceId } from "../src/runtime/ids.js";
import { maskValue, redact } from "../src/runtime/redact.js";
import { routeTemplate } from "../src/runtime/route-template.js";
import { compose, type Exchange, type Middleware } from "../src/runtime/middleware.js";
import { Lifecycle } from "../src/runtime/lifecycle.js";

test("a full queue drops the oldest and counts it, rather than growing", () => {
  const ring = new RingBuffer<number>(3);
  assert.equal(ring.push(1), true);
  ring.push(2);
  ring.push(3);
  assert.equal(ring.push(4), false, "the push that displaced one says so");
  assert.equal(ring.length, 3);
  assert.deepEqual(ring.drain(), [2, 3, 4], "oldest first, oldest dropped");
  assert.equal(ring.droppedCount, 1);
  assert.equal(ring.resetDropped(), 1);
  assert.equal(ring.droppedCount, 0);
  assert.equal(ring.length, 0);
});

test("label sets beyond the cap fold into one visible series, not unbounded memory", () => {
  const series = new BoundedSeries<{ n: number }>(3, () => ({ n: 0 }));
  series.get("a").n = 1;
  series.get("b").n = 2;
  series.get("c").n = 3;
  series.get("d").n = 4;
  const keys = series.entries().map(([key]) => key).sort();
  assert.deepEqual(keys, ["a", "b", OVERFLOW].sort(), "the cap holds and the rest is one named bucket");
  assert.ok(series.size <= 3, "the total never exceeds the cap, overflow included");
  assert.equal(series.overflowCount, 2);
});

test("a label set is one series whatever order it was written in", () => {
  assert.equal(seriesKey({ a: "1", b: "2" }), seriesKey({ b: "2", a: "1" }));
  assert.notEqual(seriesKey({ a: "1" }), seriesKey({ a: "2" }));
});

test("a histogram puts a value in the bucket the boundaries say, found by halving", () => {
  const histogram = new Histogram("h", [1, 10, 100]);
  for (const value of [0.5, 1, 5, 10, 50, 100, 1000]) histogram.observe(value);
  const point = histogram.collect()[0];
  // <=1, <=10, <=100, then the overflow bucket.
  assert.deepEqual(point?.counts, [2, 2, 2, 1]);
  assert.equal(point?.count, 7);
  assert.equal(point?.sum, 1166.5);
});

test("a counter keeps its series apart and sums within one", () => {
  const counter = new Counter("c");
  counter.add(1, { route: "/a" });
  counter.add(2, { route: "/a" });
  counter.add(5, { route: "/b" });
  const points = counter.collect().sort((left, right) => String(left.labels.route).localeCompare(String(right.labels.route)));
  assert.deepEqual(points.map((point) => point.value), [3, 5]);
});

test("ids are the right width and are rejected when they are not", () => {
  assert.equal(traceId().length, 32);
  assert.equal(spanId().length, 16);
  assert.equal(isTraceId("0".repeat(32)), false, "all-zero is the invalid id");
  assert.equal(isTraceId("z".repeat(32)), false);
  assert.equal(isSpanId(spanId()), true);
});

test("a malformed traceparent is ignored rather than repaired into a false link", () => {
  assert.equal(parseTraceparent(undefined), null);
  assert.equal(parseTraceparent("garbage"), null);
  assert.equal(parseTraceparent(`00-${"0".repeat(32)}-${"a".repeat(16)}-01`), null, "all-zero trace id");
  assert.equal(parseTraceparent(`ff-${"a".repeat(32)}-${"b".repeat(16)}-01`), null, "version ff is reserved");
  const good = parseTraceparent(`00-${"a".repeat(32)}-${"b".repeat(16)}-01`);
  assert.deepEqual(good, { traceId: "a".repeat(32), spanId: "b".repeat(16), sampled: true });
  assert.equal(formatTraceparent(good!), `00-${"a".repeat(32)}-${"b".repeat(16)}-01`);
});

test("sampling is decided from the trace id, so every service agrees and a rerun repeats", () => {
  const id = "a".repeat(24) + "80000000";
  assert.equal(sampledByRatio(id, 1), true);
  assert.equal(sampledByRatio(id, 0), false);
  assert.equal(sampledByRatio(id, 0.4), sampledByRatio(id, 0.4), "the same id decides the same way twice");
  assert.equal(sampledByRatio("f".repeat(32), 0.5), false);
  assert.equal(sampledByRatio("0".repeat(31) + "1", 0.5), true);
});

test("anything that looks like a secret is masked before it is written", () => {
  const out = redact({ authorization: "Bearer abcdef123456", nested: { api_key: "sk-livekey1234" }, safe: "visible" }) as Record<string, unknown>;
  assert.equal(out.authorization, "****3456");
  assert.equal((out.nested as Record<string, unknown>).api_key, "****1234");
  assert.equal(out.safe, "visible");
  assert.equal(maskValue("ab"), "****", "too short to show any of");
});

test("a path becomes a route template, so one series does not become thousands", () => {
  assert.equal(routeTemplate("/api/projects/71ee32c3-1bd4/topics"), "/api/projects/{projectId}/topics");
  assert.equal(routeTemplate("/api/projects/abc/prompt-runs/run-9/cancel"), "/api/projects/{projectId}/prompt-runs/{runId}/cancel");
  assert.equal(routeTemplate("/api/projects/abc/answer-export/answers.csv"), "/api/projects/{projectId}/answer-export/{table}");
  assert.equal(routeTemplate("/assets/img/a/b/c.png"), "/assets/{path}", "a static tree is one label");
  assert.equal(routeTemplate("/"), "/");
  assert.equal(routeTemplate("/" + "a/".repeat(20)), "/{deep}");
});

function exchange(): Exchange {
  return { req: {} as never, res: { statusCode: 200 } as never, method: "GET", url: new URL("http://x/"), route: "/", startedAt: 0, handled: false };
}

test("the layers run outside in and unwind inside out", async () => {
  const order: string[] = [];
  const layer = (name: string): Middleware => async (unused, next) => {
    order.push(`>${name}`);
    await next();
    order.push(`<${name}`);
  };
  await compose([layer("a"), layer("b")])(exchange());
  assert.deepEqual(order, [">a", ">b", "<b", "<a"]);
});

test("a layer that does not call next ends the exchange", async () => {
  const order: string[] = [];
  const stop: Middleware = async () => { order.push("stopped"); };
  const never: Middleware = async () => { order.push("reached"); };
  await compose([stop, never])(exchange());
  assert.deepEqual(order, ["stopped"]);
});

test("calling next twice is refused, because the rest would run twice", async () => {
  const twice: Middleware = async (unused, next) => { await next(); await next(); };
  await assert.rejects(
    () => compose([twice, async () => undefined])(exchange()),
    (error: Error) => error.message.includes("more than once"),
  );
});

test("a shutdown waits for what is in flight, then gives up rather than hanging", async () => {
  const lifecycle = new Lifecycle({ drainMs: 40 });
  lifecycle.markReady();
  assert.equal(lifecycle.isReady, true);
  lifecycle.enter();
  const closed: string[] = [];
  lifecycle.onClose(() => { closed.push("db"); });
  const shutting = lifecycle.shutdown("test");
  assert.equal(lifecycle.isReady, false, "readiness fails the moment a shutdown starts");
  assert.equal(lifecycle.isLive, true, "a draining process is still alive and must not be killed");
  lifecycle.leave();
  await shutting;
  assert.deepEqual(closed, ["db"]);
});

test("a drain that never finishes still closes, after its deadline", async () => {
  const lifecycle = new Lifecycle({ drainMs: 20 });
  lifecycle.markReady();
  lifecycle.enter();
  const closed: string[] = [];
  lifecycle.onClose(() => { closed.push("db"); });
  await lifecycle.shutdown("stuck");
  assert.deepEqual(closed, ["db"], "a stuck request does not hold the process open forever");
});
