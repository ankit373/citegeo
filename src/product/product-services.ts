import { browserDebugEndpoint, productDataDir } from "../config/env.js";
import { PROVIDER_MODEL_CAPABILITIES } from "../providers/catalog.js";
import { ProductConfigurationFileStore } from "./configuration/configuration-store.js";
import { OpenRouterProductModelCatalog } from "./configuration/model-catalog.js";
import { AzureOpenAiProductModelCatalog, CompositeProductModelCatalog, OpenAiCompatibleProductModelCatalog } from "./configuration/local-model-catalog.js";
import { DirectProviderModelCatalog } from "./configuration/direct-model-catalog.js";
import type { ProductProviderId } from "./configuration/provider-id.js";
import { hasProviderKey } from "../config/env.js";
import { ProductModelSelectionService } from "./configuration/model-selection-service.js";
import type { ProductModelCatalog } from "./configuration/model-selection-schema.js";
import { ProductBaselineService } from "./configuration/baseline-service.js";
import { ProductProjectService } from "./projects/project-service.js";
import { ProductProjectFileStore } from "./projects/project-store.js";
import { OpenRouterRecognitionAnswerExecutor, type RecognitionAnswerExecutor } from "./recognition/recognition-service.js";
import { PromptRunFileStore } from "./topics/prompt-run-store.js";
import { PromptRunService } from "./topics/prompt-run-service.js";
import { TopicFileStore } from "./topics/topic-store.js";
import { TopicService } from "./topics/topic-service.js";
import { createStructuredAsk } from "./topics/structured-ask.js";
import { PromptScheduleFileStore, PromptScheduleService } from "./topics/prompt-schedule.js";
import { DemandReportFileStore } from "./demand/demand-store.js";
import { BrandProfileFileStore, BrandProfileService } from "./discovery/brand-profile-service.js";
import { StorageSettingsStore } from "./storage/storage-settings.js";
import { CompetitorFileStore, CompetitorService } from "./topics/competitor-set.js";
import { SegmentFileStore, SegmentService } from "./topics/segment-set.js";
import { createObjectStore } from "./storage/storage-config.js";
import { DeferredObjectStore, LocalObjectStore, type ObjectStore } from "./storage/object-store.js";
import type { StructuredAsk } from "./topics/topic-service.js";
import { ProductRecognitionRunService } from "./recognition/recognition-service.js";
import { ProductRecognitionFileStore } from "./recognition/recognition-store.js";
import { RecognitionReportFileStore } from "./reports/report-store.js";
import { RecognitionReportService } from "./reports/report-service.js";
import { ProductInsightsService } from "./insights/insights-service.js";
import { CrawlerLogIngestService, CrawlerLogStateStore } from "./crawlers/crawler-ingest.js";
import { SiteSignalProbeService } from "./actions/signal-probe.js";
import { SiteSignalFileStore } from "./actions/signal-store.js";
import { authConfig } from "./auth/auth-guard.js";
import { CredentialFileStore } from "./auth/credential-store.js";
import { CredentialService } from "./auth/credential-service.js";
import { ProductMeasurementFileStore } from "./measurements/measurement-store.js";
import { ProductWatchSetService } from "./measurements/watchset-service.js";
import { ProductMeasurementRunService } from "./measurements/measurement-service.js";
import { ProductMeasurementStatsService } from "./measurements/measurement-stats.js";
import { ProductScheduleFileStore } from "./scheduling/schedule-store.js";
import { ProductScheduleService } from "./scheduling/schedule-service.js";
import { EngineService } from "./engines/engine-service.js";
import { ActionLogService, ActionLogStore } from "./topics/action-log.js";
import { SourcePageService } from "./citations/source-service.js";
import { SearchConsoleService } from "./search-console/search-console-service.js";
import { PersonaService } from "./topics/persona.js";
// The composition root. The graph is built once per server, not per request:
// rebuilding it per call silently discarded anything a service held between
// calls, so the insights cache cached nothing and cost 60ms every time.


export interface ProductServerDependencies {
  modelCatalog?: ProductModelCatalog | undefined;
  objectStore?: ObjectStore | undefined;
  recognitionExecutor?: RecognitionAnswerExecutor | undefined;
  measurementExecutor?: RecognitionAnswerExecutor | undefined;
}








// Providers whose models are read from the provider's own listing endpoint, or
// from its declared models where it publishes no listing.
const DIRECT_PROVIDERS: ProductProviderId[] = ["openai", "anthropic", "gemini", "perplexity", "deepseek"];

// Offer whichever providers are actually configured, so a machine is never
// shown models it cannot call. OpenRouter keeps its own catalogue because only
// that one carries per-model web search pricing.
function defaultProductCatalog(): ProductModelCatalog {
  const catalogs: ProductModelCatalog[] = [];
  if (hasProviderKey("openrouter")) catalogs.push(new OpenRouterProductModelCatalog(PROVIDER_MODEL_CAPABILITIES));
  for (const providerId of DIRECT_PROVIDERS) {
    if (hasProviderKey(providerId)) catalogs.push(new DirectProviderModelCatalog(providerId));
  }
  if (hasProviderKey("openai-compatible")) catalogs.push(new OpenAiCompatibleProductModelCatalog());
  if (hasProviderKey("azure-openai")) catalogs.push(new AzureOpenAiProductModelCatalog());
  // With nothing configured the product still has to render a provider page, and
  // an empty catalogue says "nothing is set up" more clearly than an error does.
  return new CompositeProductModelCatalog(catalogs);
}

function buildConfiguredStore(): ObjectStore {
  const settings = new StorageSettingsStore(productDataDir());
  return new DeferredObjectStore(async () => {
    try {
      const saved = await settings.load();
      if (saved.backend === "local") return new LocalObjectStore(saved.values.rootDir?.trim() || productDataDir());
      return createObjectStore(saved, productDataDir());
    } catch {
      // A broken setting must not stop the server booting, or it could never
      // be fixed through the page that fixes it.
      return new LocalObjectStore(productDataDir());
    }
  });
}

export interface ProductServices {
  projects: ProductProjectService;
  catalog: ProductModelCatalog;
  selections: ProductModelSelectionService;
  baselines: ProductBaselineService;
  recognition: ProductRecognitionRunService;
  reports: RecognitionReportService;
  insights: ProductInsightsService;
  signals: SiteSignalProbeService;
  crawlerLog: CrawlerLogIngestService;
  watchSets: ProductWatchSetService;
  measurements: ProductMeasurementRunService;
  stats: ProductMeasurementStatsService;
  schedules: ProductScheduleService;
  topics: TopicService;
  promptRuns: PromptRunService;
  promptSchedule: PromptScheduleService;
  demand: DemandReportFileStore;
  profiles: BrandProfileService;
  competitors: CompetitorService;
  segments: SegmentService;
  engines: EngineService;
  actions: ActionLogService;
  sourcePages: SourcePageService;
  searchConsole: SearchConsoleService;
  personas: PersonaService;
  storageSettings: StorageSettingsStore;
  dataDir: string;
  /** Asks one structured question through the project's own saved models. */
  ask: StructuredAsk;
  credentials: CredentialService;
  auth: ReturnType<typeof authConfig>;
}

/** Built once per server. Rebuilding it per request discarded everything a
 * service held between calls, so the insights cache cached nothing. */
export function createProductServices(dependencies: ProductServerDependencies = {}): ProductServices {
  // Built from whatever was configured, falling back to the disk so a broken
  // setting cannot stop the server booting and being fixed through the page.
  const objects: ObjectStore = dependencies.objectStore || buildConfiguredStore();
  const projectStore = new ProductProjectFileStore(productDataDir(), objects);
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
  const schedules = new ProductScheduleService(projects, baselines, watchSets, measurements, new ProductScheduleFileStore(projectStore, productDataDir()));

  // One executor for the prompt engine and for generation, so both are billed
  // and configured exactly like a recognition run.
  const executor = dependencies.recognitionExecutor || new OpenRouterRecognitionAnswerExecutor();
  const profiles = new BrandProfileService(new BrandProfileFileStore(projectStore), projects);
  const topics = new TopicService(new TopicFileStore(projectStore), projects, insights, profiles);
  const ask = createStructuredAsk({ baselines, executor });
  const personas = new PersonaService(projectStore);
  // Browser engines read the surfaces a buyer uses, through the user's own
  // signed-in browser, and are the only source here that carries citations.
  const engines = new EngineService(projectStore, ask, { endpoint: browserDebugEndpoint() });
  const promptRuns = new PromptRunService(new PromptRunFileStore(projectStore), topics, projects, baselines, executor, catalog, {
    saved: (projectId) => engines.saved(projectId),
    lookup: (engineId) => engines.lookup(engineId),
    ask: (input) => engines.askOne(input),
  }, personas);
  const promptSchedule = new PromptScheduleService(new PromptScheduleFileStore(projectStore), promptRuns);
  const demand = new DemandReportFileStore(projectStore);
  const competitors = new CompetitorService(new CompetitorFileStore(projectStore));
  const segments = new SegmentService(new SegmentFileStore(projectStore));
  const actions = new ActionLogService(new ActionLogStore(projectStore));
  const sourcePages = new SourcePageService(projectStore);
  const credentials = new CredentialService(new CredentialFileStore(productDataDir()));
  // The environment owns a credential when it sets one, the same rule every
  // other integration here follows.
  const searchConsole = new SearchConsoleService(
    projectStore,
    async () => process.env.GOOGLE_SERVICE_ACCOUNT_JSON || await credentials.resolve("google"),
    () => process.env.GOOGLE_SEARCH_CONSOLE_SITE || null,
  );
  const storageSettings = new StorageSettingsStore(productDataDir());
  // A run left "running" by a process that is gone would otherwise show as
  // live forever, which is how three dead runs kept claiming to be working.
  void projects.list().then(async (rows) => {
    for (const row of rows) await promptRuns.reconcileInterrupted(row.id).catch(() => 0);
  }).catch(() => undefined);

  return {
    projects, catalog, selections, baselines, recognition, reports, insights,
    signals, crawlerLog, watchSets, measurements, stats, schedules,
    topics, promptRuns, promptSchedule, demand, profiles, competitors, segments, ask, engines, actions, sourcePages, searchConsole, personas,
    storageSettings, dataDir: productDataDir(),
    credentials,
    auth: authConfig(),
  };
}

