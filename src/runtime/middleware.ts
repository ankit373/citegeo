import type { IncomingMessage, ServerResponse } from "node:http";
import { describeScope, runInScope } from "./context.js";
import type { Lifecycle } from "./lifecycle.js";
import { log } from "./logger.js";
import { metrics } from "./metrics.js";
import { routeTemplate } from "./route-template.js";
import { formatTraceparent, parseTraceparent } from "./traceparent.js";
import { startTrace } from "./tracer.js";

// One onion, composed once. Each layer sees the request on the way in and the
// response on the way out, so timing, tracing and error handling are written
// once rather than at the top of every handler.

export interface Exchange {
  req: IncomingMessage;
  res: ServerResponse;
  method: string;
  url: URL;
  /** The templated shape, for span names and metric labels. */
  route: string;
  startedAt: number;
  /** Set by a layer so a later one can report what happened. */
  handled: boolean;
}

export type Next = () => Promise<void>;
export type Middleware = (exchange: Exchange, next: Next) => Promise<void>;

/** Runs the layers in order, each wrapping the rest. A layer that does not
 * call next ends the exchange, which is how the auth gate short-circuits. */
export function compose(layers: Middleware[]): (exchange: Exchange) => Promise<void> {
  return function run(exchange: Exchange): Promise<void> {
    let last = -1;
    const step = async (index: number): Promise<void> => {
      // Calling next twice would run the rest of the stack twice, which is a
      // bug that otherwise shows up as a duplicated write much further away.
      if (index <= last) throw new Error("next() called more than once");
      last = index;
      const layer = layers[index];
      if (!layer) return;
      await layer(exchange, () => step(index + 1));
    };
    return step(0);
  };
}

const DURATION = "http.server.request.duration";
const ACTIVE = "http.server.active_requests";

/** Semantic conventions, so a dashboard built for any other service reads
 * these without translation. Seconds, because that is what the spec says. */
export function observability(): Middleware {
  const duration = metrics.histogram(DURATION, [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30], "s", "Time to serve a request.");
  const active = metrics.counter(ACTIVE, "1", "Requests started, less those finished.");
  const failures = metrics.counter("http.server.errors", "1", "Requests that ended in an error.");

  return async (exchange, next) => {
    const parent = parseTraceparent(exchange.req.headers.traceparent as string | undefined);
    const { scope, span } = startTrace({
      name: `${exchange.method} ${exchange.route}`,
      kind: "server",
      parent,
      attributes: {
        "http.request.method": exchange.method,
        "http.route": exchange.route,
        "url.path": exchange.url.pathname,
      },
    });
    exchange.res.setHeader("traceparent", formatTraceparent(scope));
    active.add(1, { "http.route": exchange.route });

    await runInScope({ ...scope, route: exchange.route, method: exchange.method }, async () => {
      try {
        await next();
      } catch (error) {
        span.fail(error);
        throw error;
      } finally {
        const status = exchange.res.statusCode;
        const seconds = (Date.now() - exchange.startedAt) / 1000;
        // Low cardinality only: the route template, the method and the status
        // class. The project id lives on the span, where it is free.
        const labels = {
          "http.request.method": exchange.method,
          "http.route": exchange.route,
          "http.response.status_code": status,
        };
        duration.observe(seconds, labels);
        active.add(-1, { "http.route": exchange.route });
        if (status >= 500) failures.add(1, { "http.route": exchange.route, "error.type": String(status) });
        span.setAttributes({ "http.response.status_code": status });
        if (status >= 500) span.fail(`status ${status}`);
        span.end();
        log.info("request", {
          method: exchange.method,
          route: exchange.route,
          path: exchange.url.pathname,
          status,
          ms: Math.round(seconds * 1000),
        });
      }
    });
  };
}

/** The last line. An unhandled throw becomes a 500 with no internals in it,
 * and the detail goes to the log where it belongs. */
export function catchErrors(): Middleware {
  return async (exchange, next) => {
    try {
      await next();
    } catch (error) {
      log.error("unhandled request error", { error, route: exchange.route });
      if (!exchange.res.headersSent) {
        exchange.res.writeHead(500, { "Content-Type": "application/json" });
        exchange.res.end(JSON.stringify({ error: "The server failed to handle that request." }));
      } else {
        exchange.res.end();
      }
    }
  };
}

/** Counts what is in flight so a shutdown can wait for it, and refuses new
 * work once draining has begun. */
export function lifecycleGate(lifecycle: Lifecycle): Middleware {
  return async (exchange, next) => {
    if (lifecycle.isDraining) {
      exchange.res.writeHead(503, { "Content-Type": "application/json", Connection: "close" });
      exchange.res.end(JSON.stringify({ error: "This instance is shutting down." }));
      return;
    }
    lifecycle.enter();
    try {
      await next();
    } finally {
      lifecycle.leave();
    }
  };
}

export function probes(lifecycle: Lifecycle): Middleware {
  return async (exchange, next) => {
    if (exchange.method !== "GET") return next();
    const path = exchange.url.pathname;
    if (path !== "/healthz" && path !== "/readyz") return next();
    const ready = lifecycle.isReady;
    const body = { ok: path === "/healthz" ? lifecycle.isLive : ready, draining: lifecycle.isDraining, inFlight: lifecycle.active };
    exchange.res.writeHead(path === "/healthz" || ready ? 200 : 503, { "Content-Type": "application/json" });
    exchange.res.end(JSON.stringify(body));
  };
}

export function exchangeFor(req: IncomingMessage, res: ServerResponse, origin: string): Exchange {
  const url = new URL(req.url || "/", origin);
  return {
    req,
    res,
    method: (req.method || "GET").toUpperCase(),
    url,
    route: routeTemplate(url.pathname),
    startedAt: Date.now(),
    handled: false,
  };
}

export { describeScope };
