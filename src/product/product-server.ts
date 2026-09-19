import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { loadDotEnv, productDataDir } from "../config/env.js";
import { PROVIDER_MODEL_CAPABILITIES } from "../providers/catalog.js";
import { ProductConfigurationFileStore } from "./configuration/configuration-store.js";
import { handleProductConfigurationApi } from "./configuration/configuration-http.js";
import { OpenRouterProductModelCatalog } from "./configuration/model-catalog.js";
import { AzureOpenAiProductModelCatalog, CompositeProductModelCatalog, OpenAiCompatibleProductModelCatalog } from "./configuration/local-model-catalog.js";
import { providerStatuses } from "./configuration/provider-status.js";
import { hasProviderKey, serverHost } from "../config/env.js";
import { ProductModelSelectionService } from "./configuration/model-selection-service.js";
import type { ProductModelCatalog } from "./configuration/model-selection-schema.js";
import { ProductBaselineService } from "./configuration/baseline-service.js";
import { handleProductProjectApi } from "./projects/project-http.js";
import { ProductProjectService } from "./projects/project-service.js";
import { ProductProjectFileStore } from "./projects/project-store.js";
import { handleProductRecognitionApi, handleProductRecognitionRetryApi } from "./recognition/recognition-http.js";
import type { RecognitionAnswerExecutor } from "./recognition/recognition-service.js";
import { ProductRecognitionRunService } from "./recognition/recognition-service.js";
import { ProductRecognitionFileStore } from "./recognition/recognition-store.js";
import { RecognitionReportFileStore } from "./reports/report-store.js";
import { RecognitionReportService } from "./reports/report-service.js";
import { handleRecognitionReportApi } from "./reports/report-http.js";
import { ProductInsightsService } from "./insights/insights-service.js";
import { CrawlerLogIngestService, CrawlerLogStateStore } from "./crawlers/crawler-ingest.js";
import { SiteSignalProbeService } from "./actions/signal-probe.js";
import { SiteSignalFileStore } from "./actions/signal-store.js";
import { buildActionPlan } from "./actions/action-plan.js";
import { toCsv } from "./insights/csv.js";
import { authConfig, authorise, passwordMatches } from "./auth/auth-guard.js";
import { clearedCookie, issueSession, sessionCookie } from "./auth/session.js";
import { renderLoginPageHtml } from "../ui/login-page.js";
import type { CsvTable } from "./insights/csv.js";
import { renderProductPhase4AppHtml } from "../ui/product-phase4-app.js";
import { ProductMeasurementFileStore } from "./measurements/measurement-store.js";
import { ProductWatchSetService } from "./measurements/watchset-service.js";
import { ProductMeasurementRunService } from "./measurements/measurement-service.js";
import { ProductMeasurementStatsService } from "./measurements/measurement-stats.js";
import { handleMeasurementApi } from "./measurements/measurement-http.js";
import { ProductScheduleFileStore } from "./scheduling/schedule-store.js";
import { ProductScheduleService } from "./scheduling/schedule-service.js";
import { handleScheduleApi } from "./scheduling/schedule-http.js";
import { renderProductPhase5AppHtml } from "../ui/product-phase5-app.js";

loadDotEnv();

export interface ProductServerDependencies {
  modelCatalog?: ProductModelCatalog | undefined;
  recognitionExecutor?: RecognitionAnswerExecutor | undefined;
  measurementExecutor?: RecognitionAnswerExecutor | undefined;
}

const AUTH = authConfig();

function httpsRequest(req: IncomingMessage): boolean {
  const forwarded = req.headers["x-forwarded-proto"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (value || "").split(",")[0]?.trim() === "https";
}

async function formOrJsonBody(req: IncomingMessage): Promise<Record<string, string>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  const type = String(req.headers["content-type"] || "");
  if (type.includes("application/json")) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) if (typeof value === "string") out[key] = value;
      return out;
    } catch {
      return {};
    }
  }
  const params = new URLSearchParams(raw);
  const out: Record<string, string> = {};
  for (const [key, value] of params) out[key] = value;
  return out;
}

function send(res: ServerResponse, status: number, body: unknown, contentType = "application/json"): void {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(contentType === "application/json" ? JSON.stringify(body, null, 2) : String(body));
}

function assetContentType(path: string): string {
  const ext = extname(path).toLowerCase();
  if (ext === ".svg") return "image/svg+xml; charset=utf-8";
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".ico") return "image/x-icon";
  return "application/octet-stream";
}

async function sendAsset(res: ServerResponse, path: string): Promise<void> {
  res.writeHead(200, {
    "Content-Type": assetContentType(path),
    "Cache-Control": "public, max-age=3600",
  });
  res.end(await readFile(path));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

// OpenRouter needs a funded key; the local gateway needs only a base URL. Offer
// whichever is actually configured so a machine with neither is not shown models
// it cannot call.
function defaultProductCatalog(): ProductModelCatalog {
  const catalogs: ProductModelCatalog[] = [];
  if (hasProviderKey("openrouter")) catalogs.push(new OpenRouterProductModelCatalog(PROVIDER_MODEL_CAPABILITIES));
  if (hasProviderKey("openai-compatible")) catalogs.push(new OpenAiCompatibleProductModelCatalog());
  if (hasProviderKey("azure-openai")) catalogs.push(new AzureOpenAiProductModelCatalog());
  if (!catalogs.length) catalogs.push(new OpenRouterProductModelCatalog(PROVIDER_MODEL_CAPABILITIES));
  return new CompositeProductModelCatalog(catalogs);
}

async function handle(req: IncomingMessage, res: ServerResponse, dependencies: ProductServerDependencies): Promise<void> {
  const method = req.method || "GET";
  const url = new URL(req.url || "/", "http://localhost");
  const route = url.pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));

  if (AUTH.enabled) {
    const secure = httpsRequest(req);
    if (method === "POST" && url.pathname === "/api/login") {
      const body = await formOrJsonBody(req);
      if (!passwordMatches(AUTH, body.password)) {
        // Same shape and timing for a wrong password as for a missing one.
        return send(res, 401, renderLoginPageHtml(true), "text/html; charset=utf-8");
      }
      res.writeHead(303, {
        Location: "/",
        "Set-Cookie": sessionCookie(issueSession(AUTH.secret, AUTH.lifetimeMs), AUTH.lifetimeMs, secure),
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
    const decision = authorise({ config: AUTH, pathname: url.pathname, cookieHeader: req.headers.cookie });
    if (!decision.allowed) {
      // An API caller wants a status it can act on; a browser wants the form.
      if (url.pathname.startsWith("/api/")) return send(res, 401, { error: "Authentication required." });
      return send(res, 401, renderLoginPageHtml(false), "text/html; charset=utf-8");
    }
  }
  const projectStore = new ProductProjectFileStore(productDataDir());
  const projects = new ProductProjectService(projectStore);
  const configurationStore = new ProductConfigurationFileStore(projectStore);
  const catalog = dependencies.modelCatalog || defaultProductCatalog();
  const selections = new ProductModelSelectionService(projects, configurationStore, catalog);
  const baselines = new ProductBaselineService(projects, selections, configurationStore);
  const recognitionStore = new ProductRecognitionFileStore(projectStore);
  const recognition = new ProductRecognitionRunService(projects, baselines, recognitionStore, dependencies.recognitionExecutor);
  const reportStore = new RecognitionReportFileStore(projectStore);
  const reports = new RecognitionReportService(projects, baselines, recognitionStore, reportStore);
  const insights = new ProductInsightsService(projects, recognition);
  const signals = new SiteSignalProbeService(projects, new SiteSignalFileStore(projectStore));
  const crawlerLog = new CrawlerLogIngestService(new CrawlerLogStateStore(productDataDir()));
  const measurementStore = new ProductMeasurementFileStore(projectStore);
  const watchSets = new ProductWatchSetService(projects, baselines, measurementStore, recognitionStore, reportStore);
  const measurements = new ProductMeasurementRunService(projects, baselines, watchSets, measurementStore, dependencies.measurementExecutor || dependencies.recognitionExecutor);
  const stats = new ProductMeasurementStatsService(projects, measurementStore);
  const schedules = new ProductScheduleService(projects, baselines, watchSets, measurements, new ProductScheduleFileStore(projectStore));

  if (method === "GET" && url.pathname === "/") {
    const measurementView = url.searchParams.get("view") === "measurements";
    return send(res, 200, measurementView ? renderProductPhase5AppHtml() : renderProductPhase4AppHtml(), "text/html; charset=utf-8");
  }
  if (method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true });
  if (method === "GET" && url.pathname === "/api/providers") {
    return send(res, 200, { providers: await providerStatuses(catalog) });
  }

  if (method === "GET" && route[0] === "assets" && route.length > 1) {
    const root = resolve("assets");
    const path = resolve(root, route.slice(1).join("/"));
    if (path === root || !path.startsWith(root + sep) || !existsSync(path)) return send(res, 404, { error: "asset not found" });
    if (!(await stat(path)).isFile()) return send(res, 404, { error: "asset not found" });
    return sendAsset(res, path);
  }

  if (method === "GET" && route.length === 5 && route[0] === "api" && route[1] === "projects" && route[3] === "export") {
    const projectId = route[2] || "";
    const table = (route[4] || "").endsWith(".csv") ? (route[4] || "").slice(0, -4) : route[4] || "";
    try {
      const built = await insights.build(projectId);
      const core = built.insights;
      const tables: Record<string, CsvTable> = {
        visibility: {
          columns: ["model", "modelId", "answered", "recognized", "visibility"],
          rows: core.visibility.byModel.map((row) => [row.displayName, row.modelId, row.answered, row.recognized, row.score]),
        },
        voice: {
          columns: ["brand", "domain", "mentions", "share", "isTarget"],
          rows: [[core.shareOfVoice.target.name, core.shareOfVoice.target.domain, core.shareOfVoice.target.mentions, core.shareOfVoice.target.share, true]]
            .concat(core.shareOfVoice.competitors.map((row) => [row.name, row.domain, row.mentions, row.share, false])),
        },
        citations: {
          columns: ["domain", "answers", "isTarget", "models"],
          rows: core.citations.domains.map((row) => [row.domain, row.answers, row.isTarget, row.models]),
        },
        gap: {
          columns: ["domain", "answers", "competitors", "models"],
          rows: built.citationGap.map((row) => [row.domain, row.answers, row.competitors, row.models]),
        },
        fanout: {
          columns: ["query", "answers", "models"],
          rows: built.fanout.queries.map((row) => [row.query, row.answers, row.models]),
        },
        categories: {
          columns: ["category", "count"],
          rows: core.categories.map((row) => [row.value, row.count]),
        },
      };
      const chosen = tables[table];
      if (!chosen) return send(res, 404, { error: `Unknown export "${table}". Available: ${Object.keys(tables).join(", ")}.` });
      return send(res, 200, toCsv(chosen), "text/csv; charset=utf-8");
    } catch (error) {
      return send(res, 404, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (route.length === 4 && route[0] === "api" && route[1] === "projects" && route[3] === "signals") {
    try {
      if (method === "GET") return send(res, 200, { snapshots: await signals.history(route[2] || "") });
      if (method === "POST") return send(res, 201, { snapshot: await signals.capture(route[2] || "") });
    } catch (error) {
      return send(res, 404, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (method === "GET" && route.length === 4 && route[0] === "api" && route[1] === "projects" && route[3] === "action-plan") {
    try {
      const projectId = route[2] || "";
      const snapshot = await signals.history(projectId).then((rows) => rows[0] || null);
      if (!snapshot) {
        return send(res, 200, { probed: false, detail: "No site probe yet. POST to /signals or let the worker run one.", actions: [] });
      }
      const built = await insights.build(projectId);
      const competitors = built.insights.shareOfVoice.competitors.map((row) => row.name);
      return send(res, 200, {
        probed: true,
        capturedAt: snapshot.capturedAt,
        changes: snapshot.changes,
        actions: buildActionPlan({
          signals: snapshot.signals,
          recognition: {
            answered: built.insights.visibility.answered,
            recognized: built.insights.visibility.recognized,
            competitors,
          },
        }),
      });
    } catch (error) {
      return send(res, 404, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (method === "GET" && route.length === 4 && route[0] === "api" && route[1] === "projects" && route[3] === "crawlers") {
    try {
      const built = await insights.build(route[2] || "");
      // Incremental, so this reads only what was appended since the last pass.
      return send(res, 200, await crawlerLog.ingest({ citedPaths: built.citedPaths }));
    } catch (error) {
      return send(res, 404, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (method === "GET" && route.length === 4 && route[0] === "api" && route[1] === "projects" && route[3] === "insights") {
    try {
      return send(res, 200, await insights.build(route[2] || ""));
    } catch (error) {
      return send(res, 404, { error: error instanceof Error ? error.message : String(error) });
    }
  }

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
  return createServer((req, res) => {
    handle(req, res, dependencies).catch((error) => send(res, 500, { error: error instanceof Error ? error.message : String(error) }));
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
