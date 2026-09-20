import { pathToFileURL } from "node:url";
import { loadDotEnv, productDataDir } from "../../config/env.js";
import { PROVIDER_MODEL_CAPABILITIES } from "../../providers/catalog.js";
import { ProductBaselineService } from "../configuration/baseline-service.js";
import { ProductConfigurationFileStore } from "../configuration/configuration-store.js";
import { OpenRouterProductModelCatalog } from "../configuration/model-catalog.js";
import { ProductModelSelectionService } from "../configuration/model-selection-service.js";
import { ProductMeasurementRunService } from "../measurements/measurement-service.js";
import { ProductMeasurementFileStore } from "../measurements/measurement-store.js";
import { ProductProjectService } from "../projects/project-service.js";
import { ProductProjectFileStore } from "../projects/project-store.js";
import { ProductRecognitionFileStore } from "../recognition/recognition-store.js";
import { RecognitionReportFileStore } from "../reports/report-store.js";
import { ProductScheduleService } from "./schedule-service.js";
import { ProductScheduleFileStore } from "./schedule-store.js";
import { ProductWatchSetService } from "../measurements/watchset-service.js";
import { SiteSignalProbeService } from "../actions/signal-probe.js";
import { SiteSignalFileStore } from "../actions/signal-store.js";
import { CrawlerLogIngestService, CrawlerLogStateStore } from "../crawlers/crawler-ingest.js";
import { ProductInsightsService } from "../insights/insights-service.js";
import { ProductRecognitionRunService } from "../recognition/recognition-service.js";
import { DigestBaselineStore } from "../reporting/delivery.js";
import { runDigests } from "../reporting/digest-run.js";
import { reportWebhookUrl } from "../reporting/delivery.js";
import { createProductServices } from "../product-services.js";

export function productScheduleService(): ProductScheduleService {
  const projectStore = new ProductProjectFileStore(productDataDir());
  const projects = new ProductProjectService(projectStore);
  const configurationStore = new ProductConfigurationFileStore(projectStore);
  const selections = new ProductModelSelectionService(projects, configurationStore, new OpenRouterProductModelCatalog(PROVIDER_MODEL_CAPABILITIES));
  const baselines = new ProductBaselineService(projects, selections, configurationStore);
  const measurementStore = new ProductMeasurementFileStore(projectStore);
  const recognitionStore = new ProductRecognitionFileStore(projectStore);
  const reportStore = new RecognitionReportFileStore(projectStore);
  const watchSets = new ProductWatchSetService(projects, baselines, measurementStore, recognitionStore, reportStore);
  const measurements = new ProductMeasurementRunService(projects, baselines, watchSets, measurementStore);
  return new ProductScheduleService(projects, baselines, watchSets, measurements, new ProductScheduleFileStore(projectStore));
}

export function siteSignalProbeService(): SiteSignalProbeService {
  const projectStore = new ProductProjectFileStore(productDataDir());
  return new SiteSignalProbeService(new ProductProjectService(projectStore), new SiteSignalFileStore(projectStore));
}

export function crawlerLogIngestService(): CrawlerLogIngestService {
  return new CrawlerLogIngestService(new CrawlerLogStateStore(productDataDir()));
}

export interface DigestDependencies {
  projects: ProductProjectService;
  insights: ProductInsightsService;
  signals: SiteSignalProbeService;
  store: DigestBaselineStore;
}

export function digestDependencies(): DigestDependencies {
  const projectStore = new ProductProjectFileStore(productDataDir());
  const projects = new ProductProjectService(projectStore);
  const configurationStore = new ProductConfigurationFileStore(projectStore);
  const selections = new ProductModelSelectionService(projects, configurationStore, new OpenRouterProductModelCatalog(PROVIDER_MODEL_CAPABILITIES));
  const baselines = new ProductBaselineService(projects, selections, configurationStore);
  const recognitionStore = new ProductRecognitionFileStore(projectStore);
  const recognition = new ProductRecognitionRunService(projects, baselines, recognitionStore);
  return {
    projects,
    insights: new ProductInsightsService(projects, recognition),
    signals: new SiteSignalProbeService(projects, new SiteSignalFileStore(projectStore)),
    store: new DigestBaselineStore(productDataDir()),
  };
}

export async function runProductScheduleDue(): Promise<Awaited<ReturnType<ProductScheduleService["runDue"]>>> {
  return productScheduleService().runDue();
}

/**
 * Prompt runs due right now. The whole service graph is built because a prompt
 * run needs the same executor, baselines and topic set the server uses, and
 * building a second half-graph here is how the two would drift.
 */
export async function runPromptSchedulesDue(at: Date = new Date()): Promise<number> {
  const services = createProductServices();
  const projects = await services.projects.list();
  const fired = await services.promptSchedule.runDue(projects.map((project) => project.id), at);
  for (const schedule of fired) {
    console.log(JSON.stringify({
      type: schedule.lastError ? "prompt_schedule_failed" : "prompt_schedule_ran",
      projectId: schedule.projectId,
      runId: schedule.lastRunId,
      detail: schedule.lastError || undefined,
    }));
  }
  return fired.length;
}

export async function runProductScheduleWorker(pollSeconds = 60): Promise<void> {
  if (!Number.isInteger(pollSeconds) || pollSeconds < 10) throw new Error("Poll seconds must be an integer of at least 10.");
  const service = productScheduleService();
  let stopped = false;
  const stop = () => { stopped = true; };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  const probe = siteSignalProbeService();
  const crawlerLog = crawlerLogIngestService();
  const digests = digestDependencies();
  while (!stopped) {
    const occurrences = await service.runDue();
    if (occurrences.length) console.log(JSON.stringify({ type: "product_schedule_due", occurrenceCount: occurrences.length, occurrenceIds: occurrences.map((item) => item.id) }));
    // Probes share this process so file storage keeps one writer. A failing
    // probe must never stop scheduled runs, which are the product's job.
    try {
      const probed = (await probe.probeDue()).filter((outcome) => outcome.captured);
      for (const outcome of probed) {
        if (!outcome.snapshot.changes.length) continue;
        console.log(JSON.stringify({
          type: "site_signal_changed",
          projectId: outcome.projectId,
          changes: outcome.snapshot.changes.map((change) => ({ field: change.field, direction: change.direction, detail: change.detail })),
        }));
      }
    } catch (error) {
      console.error(JSON.stringify({ type: "site_signal_probe_failed", detail: error instanceof Error ? error.message : String(error) }));
    }
    // Prompt runs are the tracker's job, so a failure here is logged and the
    // loop continues rather than taking the worker down.
    try {
      await runPromptSchedulesDue();
    } catch (error) {
      console.error(JSON.stringify({ type: "prompt_schedule_worker_failed", detail: error instanceof Error ? error.message : String(error) }));
    }
    try {
      const ingested = await crawlerLog.ingest();
      if (ingested.state === "ingested" && ingested.linesParsed) {
        console.log(JSON.stringify({ type: "crawler_log_ingested", lines: ingested.linesParsed, bytes: ingested.bytesRead, restarted: ingested.restarted }));
      }
    } catch (error) {
      console.error(JSON.stringify({ type: "crawler_log_ingest_failed", detail: error instanceof Error ? error.message : String(error) }));
    }
    // Delivered last, so a digest describes the probe and ingestion that just
    // ran rather than the previous pass's picture.
    if (reportWebhookUrl()) {
      try {
        for (const outcome of await runDigests(digests)) {
          if (outcome.result.outcome === "no_news") continue;
          const level = outcome.result.outcome === "failed" ? console.error : console.log;
          level(JSON.stringify({
            type: "digest_" + outcome.result.outcome,
            projectId: outcome.projectId,
            domain: outcome.domain,
            detail: outcome.result.detail,
            reasons: outcome.reasons,
          }));
        }
      } catch (error) {
        console.error(JSON.stringify({ type: "digest_run_failed", detail: error instanceof Error ? error.message : String(error) }));
      }
    }
    await new Promise<void>((resolve) => setTimeout(resolve, pollSeconds * 1000));
  }
}

loadDotEnv();
const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entrypoint) {
  const argument = process.argv[2];
  const parsed = argument === undefined ? 60 : Number(argument);
  runProductScheduleWorker(parsed).catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
