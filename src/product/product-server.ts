import type { IncomingMessage, ServerResponse } from "node:http";
import { formOrJsonBody, httpsRequest, readJson, send, sendAsset } from "./http-io.js";
import { createServer } from "node:http";
import { stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { loadDotEnv } from "../config/env.js";
import { handleProductConfigurationApi } from "./configuration/configuration-http.js";
import { serverHost } from "../config/env.js";
import { handleProductProjectApi } from "./projects/project-http.js";
import { handleProductRecognitionApi, handleProductRecognitionRetryApi } from "./recognition/recognition-http.js";
import { handleRecognitionReportApi } from "./reports/report-http.js";
import { handleActionApi } from "./actions/action-http.js";
import { handleInsightsApi } from "./insights/insights-http.js";
import { handleCrawlerApi } from "./crawlers/crawler-http.js";
import { handleCredentialApi } from "./auth/credential-http.js";
import { handleProviderStatusApi } from "./configuration/provider-http.js";
import { authorise, passwordMatches } from "./auth/auth-guard.js";
import { clearedCookie, issueSession, sessionCookie } from "./auth/session.js";
import { renderLoginPageHtml } from "../ui/login-page.js";
import { renderProductPhase4AppHtml } from "../ui/product-phase4-app.js";
import { handleMeasurementApi } from "./measurements/measurement-http.js";
import { handleScheduleApi } from "./scheduling/schedule-http.js";
import { handleTopicApi } from "./topics/topic-http.js";
import { handleEngineApi } from "./engines/engine-http.js";
import { handleRankingActionApi } from "./topics/action-http.js";
import { handleCitationApi } from "./citations/citation-http.js";
import { handleSearchConsoleApi } from "./search-console/search-console-http.js";
import { projectInsights } from "./topics/project-insights.js";
import { handleStorageApi } from "./storage/storage-http.js";
import { renderProductPhase5AppHtml } from "../ui/product-phase5-app.js";
import { createProductServices } from "./product-services.js";
import type { ProductServerDependencies, ProductServices } from "./product-services.js";

loadDotEnv();


async function handle(req: IncomingMessage, res: ServerResponse, services: ProductServices): Promise<void> {
  const method = req.method || "GET";
  const url = new URL(req.url || "/", "http://localhost");
  const route = url.pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  const { projects, catalog, selections, baselines, recognition, reports, insights, signals, crawlerLog, watchSets, measurements, stats, schedules, topics, promptRuns, promptSchedule, demand, profiles } = services;

  if (services.auth.enabled) {
    const secure = httpsRequest(req);
    if (method === "POST" && url.pathname === "/api/login") {
      const body = await formOrJsonBody(req);
      if (!passwordMatches(services.auth, body.password)) {
        // Same shape and timing for a wrong password as for a missing one.
        return send(res, 401, renderLoginPageHtml(true), "text/html; charset=utf-8");
      }
      res.writeHead(303, {
        Location: "/",
        "Set-Cookie": sessionCookie(issueSession(services.auth.secret, services.auth.lifetimeMs), services.auth.lifetimeMs, secure),
      });
      res.end();
      return;
    }
    if (method === "POST" && url.pathname === "/api/logout") {
      res.writeHead(303, { Location: "/login", "Set-Cookie": clearedCookie(secure) });
      res.end();
      return;
    }
    if (method === "GET" && url.pathname === "/login") {
      return send(res, 200, renderLoginPageHtml(false), "text/html; charset=utf-8");
    }
    const decision = authorise({ config: services.auth, pathname: url.pathname, cookieHeader: req.headers.cookie });
    if (!decision.allowed) {
      // An API caller wants a status it can act on; a browser wants the form.
      if (url.pathname.startsWith("/api/")) return send(res, 401, { error: "Authentication required." });
      return send(res, 401, renderLoginPageHtml(false), "text/html; charset=utf-8");
    }
  }
  if (method === "GET" && url.pathname === "/") {
    const measurementView = url.searchParams.get("view") === "measurements";
    return send(res, 200, measurementView ? renderProductPhase5AppHtml() : renderProductPhase4AppHtml(), "text/html; charset=utf-8");
  }
  if (method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true });
  if (method === "GET" && route[0] === "assets" && route.length > 1) {
    const root = resolve("assets");
    const path = resolve(root, route.slice(1).join("/"));
    if (path === root || !path.startsWith(root + sep) || !existsSync(path)) return send(res, 404, { error: "asset not found" });
    if (!(await stat(path)).isFile()) return send(res, 404, { error: "asset not found" });
    return sendAsset(res, path);
  }

  const json = (status: number, body: unknown, contentType?: string) => send(res, status, body, contentType);
  const body = () => readJson(req);

  if (await handleStorageApi({ method, route, send: json, settings: services.storageSettings, dataDir: services.dataDir, readJson: body })) return;
  if (await handleProviderStatusApi({ method, route, send: json, catalog })) return;
  if (await handleCredentialApi({ method, route, send: json, service: services.credentials, authEnabled: services.auth.enabled, readJson: body })) return;
  if (await handleInsightsApi({ method, route, send: json, service: insights })) return;
  if (await handleCrawlerApi({ method, route, send: json, crawlerLog, insights })) return;
  if (await handleActionApi({ method, route, send: json, signals, insights })) return;
  if (await handleSearchConsoleApi({ method, route, send: json, searchConsole: services.searchConsole, readJson: body,
    prompts: async (id) => (await topics.get(id)).prompts.filter((prompt) => prompt.status === "active"),
    insights: (id) => projectInsights({ projectId: id, topics, runs: promptRuns, competitors: services.competitors, personas: services.personas }) })) return;
  if (await handleCitationApi({ method, route, send: json, pages: services.sourcePages,
    answers: (id) => promptRuns.listAnswers(id),
    identity: (id) => topics.targetIdentity(id),
    names: async (id) => [...new Set((await promptRuns.listAnswers(id)).flatMap((answer) => answer.mentions.map((row) => row.name)))] })) return;
  if (await handleRankingActionApi({ method, route, send: json, actions: services.actions, readJson: body,
    insights: (id) => projectInsights({ projectId: id, topics, runs: promptRuns, competitors: services.competitors, personas: services.personas }) })) return;
  if (await handleEngineApi({ method, route, send: json, engines: services.engines, readJson: body })) return;
  if (await handleTopicApi({ method, route, url, send: json, topics, runs: promptRuns, schedule: promptSchedule, demand, profiles, models: async (id) => (await selections.list(id)).length, competitors: services.competitors, segments: services.segments, personas: services.personas, ask: services.ask, readJson: body })) return;

  if (await handleProductConfigurationApi({ method, route, projects, selections, baselines, catalog, readJson: () => readJson(req), send: (status, body) => send(res, status, body) })) return;
  if (await handleMeasurementApi({ method, route, readJson: () => readJson(req), send: (status, body) => send(res, status, body), projects, watchSets, measurements, stats })) return;
  if (await handleScheduleApi({ method, route, readJson: () => readJson(req), send: (status, body) => send(res, status, body), service: schedules })) return;
  if (await handleRecognitionReportApi({ method, route, service: reports, send: (status, body) => send(res, status, body) })) return;
  if (await handleProductRecognitionRetryApi({ method, route, service: recognition, send: (status, body) => send(res, status, body) })) return;
  if (await handleProductRecognitionApi({ method, route, service: recognition, idempotencyKey: typeof req.headers["idempotency-key"] === "string" ? req.headers["idempotency-key"] : undefined, readJson: () => readJson(req), send: (status, body) => send(res, status, body) })) return;
  if (await handleProductProjectApi({ method, url, route, service: projects, readJson: () => readJson(req), send: (status, body) => send(res, status, body) })) return;
  return send(res, 404, { error: "not found" });
}

export function createProductServer(dependencies: ProductServerDependencies = {}) {
  const services = createProductServices(dependencies);
  return createServer((req, res) => {
    handle(req, res, services).catch((error) => send(res, 500, { error: error instanceof Error ? error.message : String(error) }));
  });
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entrypoint) {
  const port = Number(process.env.PORT || 8787);
  const host = serverHost();
  createProductServer().listen(port, host, () => {
    console.log(`citegeo product server listening on http://${host === "0.0.0.0" ? "localhost" : host}:${port} (bound to ${host})`);
  });
}
