import { CONFIG } from "./config.js";
import { html } from "./dom.js";
import { dashboardPanels } from "./pages/dashboard-view.js";
import { buyingView, claimsView, conversationsView, draftsView, entityView, marketerView } from "./pages/marketer-view.js";
import { exportName, filterSummary, matchesQuery, panelCsv } from "./components/panel-tools.js";
import { section } from "./components/primitives.js";
import { button } from "./components/button.js";
import { formatTime, percent } from "./format.js";
import { recognitionRunStatusText } from "./labels.js";
import { overAppearances, stat } from "./pages/metric-cells.js";
import { crawlerUpload, languagePicker, pasteCountPicker, repetitionPicker } from "./components/pickers.js";
import { catalogResultSummary, selectedRows } from "./components/catalog-rows.js";
import { mentionChips, paneRun, runIsLive, runPaneProgress } from "./pages/run-pane.js";
import { answerTasks } from "./pages/task-views.js";
import { ProjectBusy } from "./busy.js";
import { isOpen, loadForProject, settlePull } from "./pull.js";
import { renderBrandVisibility } from "./pages/rivals-view.js";
import { filteredPrompts, promptBulkInner, promptStandings, renderPromptGroups, renderPrompts, topicStandings, liveTopics, livePrompts, promptResultSummary, type PriorityQuestion } from "./pages/prompts-view.js";
import type { TopicSet } from "../../product/topics/topic-schema.js";
import type { DemandReport } from "../../product/demand/corpus-schema.js";
import type { CompetitorSet } from "../../product/topics/competitor-set.js";
import type { PersonaSet } from "../../product/topics/persona.js";
import type { TakenActionView } from "../../product/topics/action-http.js";
import { renderAnswerEngine, renderTrustPage } from "./pages/answer-page.js";
import { dashboardView, renderHome, type AnswerDigest, type CitedPages, type ReferralsPayload } from "./pages/home-view.js";
import { renderFooter, renderOverview } from "./pages/overview-view.js";
import { recognitionCountStrip, recognitionRunSummary, renderRecognitionModel, type RecognitionRunDetail } from "./pages/recognition-view.js";
import { loading, skeletonCard, skeletonText, skeletonTiles } from "./components/skeleton.js";
import { clearToasts, toast } from "./components/toast.js";
import { DESTINATIONS, navScrim, navToggle, sidebar, wireNav } from "./components/nav.js";
import { resetPanelOrder, setPanelSpan, togglePanelHidden, wirePanelDrag } from "./components/reorder.js";
import { wireChartHover } from "./components/chart-hover.js";
import { renderSetup, type CredentialRow, type IntegrationRow, type ProviderRow, type StorageCheck, type StorageSettings } from "./pages/setup-view.js";
import type { HomeSummary } from "../../product/alerts/home-summary.js";
import type { RankingPlan } from "../../product/topics/ranking-plan.js";
import type { OutreachPlan } from "../../product/citations/outreach.js";
import type { SearchConsoleStatus } from "../../product/search-console/search-console-service.js";
import { renderModels, filteredCatalogModels, renderCatalogModelRows, type EngineReachReport } from "./pages/models-view.js";
import { renderConfiguration } from "./pages/configuration-view.js";
import type { MonitoringConfigurationView } from "./components/configuration-button.js";
import type { MonitoringConfigurationState } from "../../product/configuration/monitoring-configuration-state.js";
import type { ProductBaseline } from "../../product/configuration/baseline-schema.js";
import type { EngineStatus } from "../../product/engines/engine-service.js";
import type { ExternalMetricSnapshotView } from "./components/external-metric-history.js";

/** What the credentials endpoint answers with, or nothing when it refuses. */
type CredentialFile = { closed?: boolean; detail?: string; storageEnabled?: boolean; credentials?: CredentialRow[] };
import type {
  AnswerRow, CatalogModel, InsightsShape, LoadState, Notice, Panel, Payload,
  ProjectRow, RunRow, SelectionRow, Unshaped,
} from "./types.js";

// The application, as a module the compiler can see. It used to live inside a
// template literal, where a syntax error, an undefined name or a typo shipped
// silently and was found in a browser.

export function boot(): void {
  interface State {
    page: string; mode: string;
    projects: ProjectRow[]; currentProjects: ProjectRow[]; selectedId: string;
    providers: ProviderRow[]; providersState: LoadState;
    insights: Unshaped; insightsState: LoadState;
    crawlers: Unshaped; crawlersState: LoadState; crawlerUploading: boolean; crawlerNotice: { text: string; kind: string };
    plan: Unshaped; planState: LoadState;
    marketer: Unshaped; drafts: Unshaped; claims: Unshaped; buying: Unshaped; conversations: Unshaped; entity: Unshaped;
    marketerState: LoadState;
    signals: Unshaped; signalsState: LoadState;
    credentials: CredentialFile | null; credentialsState: LoadState; credentialNotice: Notice;
    integrations: IntegrationRow[]; integrationsState: LoadState;
    externalMetrics: { snapshots: ExternalMetricSnapshotView[] } | null; externalMetricsState: LoadState;
    externalMetricsPulling: "" | "ahrefs" | "semrush"; externalMetricsNotice: Notice;
    digest: AnswerDigest | null; digestState: LoadState;
    demand: DemandReport | null; demandState: LoadState;
    catalog: CatalogModel[]; catalogState: LoadState; catalogError: string;
    query: string; catalogProvider: string; catalogNativeSearch: string; catalogSort: string;
    selections: SelectionRow[]; draftSelections: Map<string, string>; selectionsDirty: boolean;
    baselines: ProductBaseline[]; monitoringConfiguration: MonitoringConfigurationState | null; configurationState: LoadState;
    drawerSession: number; modelNotice: Notice; monitoringNotice: Notice;
    modelActionState: string; monitoringSaveState: string;
    recognitionRuns: Unshaped[]; recognitionDetail: RecognitionRunDetail | null;
    recognitionModelDetails: Record<string, Unshaped>; recognitionSelectedRunId: string;
    recognitionNotice: Notice; recognitionActionState: string; recognitionRefreshTimer: number;
    topicSet: TopicSet | null; topicState: LoadState;
    promptFilters: { query: string; topicId: string; intent: string; status: string };
    promptSelection: string[]; promptSort: string;
    answerEngine: InsightsShape | null; answerEngineState: LoadState;
    promptRunState: string; promptNotice: Notice;
    /** A run is starting on the open project, whatever else it is doing. */
    promptRunning: boolean;
    promptDraft: { topicId: string; text: string; intent: string };
    schedule: Unshaped; scheduleState: LoadState;
    regions: Array<{ id: string; label: string }>; languages: Array<{ id: string; label: string }>;
    home: HomeSummary | null; homeState: LoadState;
    cited: CitedPages | null; citedState: LoadState;
    rivals: CompetitorSet | null; rivalsState: LoadState;
    storage: StorageSettings | null; storageState: LoadState;
    storageDraft: Record<string, string>; storageBackend: string; storageCheck: StorageCheck | null;
    filters: Record<string, string>;
    panel: Panel | null; panelState: LoadState; panelAnswers: AnswerRow[];
    liveRun: RunRow | null; lastRun: RunRow | null; runPollTimer: number;
    runFeed: AnswerRow[]; runFeedState: LoadState; runFeedTimer: number;
    rankPlan: RankingPlan | null; rankPlanState: LoadState;
    brief: Unshaped; briefState: LoadState;
    outreach: OutreachPlan | null; outreachState: LoadState; harvesting: boolean;
    uptake: Unshaped; uptakeState: LoadState;
    interference: Unshaped; interferenceState: LoadState;
    concentration: Unshaped; concentrationState: LoadState;
    shape: Unshaped; shapeState: LoadState;
    kinds: Unshaped; kindsState: LoadState;
    experiments: Unshaped; experimentsState: LoadState;
    history: Unshaped; historyState: LoadState;
    marketerNotice: { text: string; kind: string };
    check: Unshaped; checkState: LoadState;
    credit: Unshaped; creditState: LoadState;
    reach: EngineReachReport | null; reachState: LoadState;
    paste: Unshaped; pasteState: LoadState; pasteCount: number;
    repetitions: number;
    runLanguageId: string;
    searchDemand: SearchConsoleStatus | null; searchDemandState: LoadState; pulling: boolean;
    personas: PersonaSet | null; personasState: LoadState;
    priority: { questions: PriorityQuestion[]; corpusIndexed: boolean } | null; priorityState: LoadState;
    referrals: ReferralsPayload | null; referralsState: LoadState; pullingReferrals: boolean;
    engines: EngineStatus | null; enginesState: LoadState;
    actions: TakenActionView[]; actionsState: LoadState;
    matrixOpen: string[];
    editingBoard: boolean;
    brandIcons: Record<string, string | null>;
    /** Which panels the reader switched to a table, kept in this browser. */
    panelViews: Record<string, "chart" | "table">;
    /** Rival columns switched off in the matrix, kept in this browser. */
    matrixHidden: string[];
    /** Folded panels a reader opened, so a re-render does not shut them. */
    panelOpen: string[];
    /** True until the first read lands. The shell paints before it, so the
     * reader sees the product rather than a blank page for a second. */
    booting: boolean;
  }

    const state: State = { page:savedPreference("page", "dashboard"), mode:"current", projects:[], currentProjects:[], selectedId:new URL(window.location.href).searchParams.get("projectId") || localStorage.getItem("citegeo.product.projectId") || "", providers:[], providersState:"idle", insights:null, insightsState:"idle", crawlers:null, crawlersState:"idle", crawlerUploading:false, crawlerNotice:{ text:"", kind:"" }, plan:null, planState:"idle", marketer:null, drafts:null, claims:null, buying:null, conversations:null, entity:null, marketerState:"idle", marketerNotice:{ text:"", kind:"" }, signals:null, signalsState:"idle", credentials:null, credentialsState:"idle", credentialNotice:{text:"",kind:""}, integrations:[], integrationsState:"idle", externalMetrics:null, externalMetricsState:"idle", externalMetricsPulling:"", externalMetricsNotice:{text:"",kind:""}, digest:null, digestState:"idle", demand:null, demandState:"idle", repetitions:Number(savedPreference("repetitions", "1")) || 1, runLanguageId:savedPreference("runLanguage", "en"), catalog:[], catalogState:"idle", catalogError:"", query:"", catalogProvider:"", catalogNativeSearch:"all", catalogSort:"name", selections:[], draftSelections:new Map(), selectionsDirty:false, baselines:[], monitoringConfiguration:null, configurationState:"idle", drawerSession:0, modelNotice:{ text:"", kind:"" }, monitoringNotice:{ text:"", kind:"" }, modelActionState:"idle", monitoringSaveState:"idle", recognitionRuns:[], recognitionDetail:null, recognitionModelDetails:{}, recognitionSelectedRunId:"", recognitionNotice:{ text:"", kind:"" }, recognitionActionState:"idle", recognitionRefreshTimer:0, topicSet:null, topicState:"idle", promptFilters:{ query:"", topicId:"", intent:"", status:"" }, promptSelection:[], answerEngine:null, answerEngineState:"idle", promptRunState:"idle", promptRunning:false, promptNotice:{ text:"", kind:"" }, promptDraft:{ topicId:"", text:"", intent:"discovery" }, schedule:null, scheduleState:"idle", regions:[], languages:[], home:null, homeState:"idle", cited:null, citedState:"idle", history:null, historyState:"idle", rivals:null, rivalsState:"idle", storage:null, storageState:"idle", storageDraft:{}, storageBackend:"", storageCheck:null, filters:{ modelId:"", regionId:"", languageId:"", topicId:"" }, panel:null, panelState:"idle", panelAnswers:[], liveRun:null, lastRun:null, runPollTimer:0, runFeed:[], runFeedState:"idle", runFeedTimer:0, rankPlan:null, rankPlanState:"idle", brief:null, briefState:"idle", outreach:null, outreachState:"idle", harvesting:false, paste:null, pasteState:"idle", pasteCount:Number(savedPreference("pasteCount", "2")) || 2, uptake:null, uptakeState:"idle", interference:null, interferenceState:"idle", concentration:null, concentrationState:"idle", shape:null, shapeState:"idle", kinds:null, kindsState:"idle", experiments:null, experimentsState:"idle", check:null, checkState:"idle", credit:null, creditState:"idle", reach:null, reachState:"idle", searchDemand:null, searchDemandState:"idle", pulling:false, personas:null, personasState:"idle", priority:null, priorityState:"idle", promptSort:"topic", referrals:null, referralsState:"idle", pullingReferrals:false, engines:null, enginesState:"idle", actions:[], actionsState:"idle", matrixOpen:[], editingBoard:false, brandIcons:{}, panelViews:savedJson("panelViews"), matrixHidden:savedList("matrixHidden"), panelOpen:savedList("panelOpen"), booting:true };
    const app = document.getElementById("app") as HTMLElement;
    let renderOverride: (() => void) | null = null;
    // render() was a hoisted declaration that a later line reassigned. A
    // module forbids that, and a let would put earlier calls in the dead zone.
    // Every page prints its outcome in a box under its heading, up to five
    // screens from the click. The same sentence goes where the reader is.
    const NOTICES = ["promptNotice", "recognitionNotice", "modelNotice", "monitoringNotice",
      "credentialNotice", "crawlerNotice", "externalMetricsNotice", "marketerNotice"];
    const announced = new Map<string, unknown>();
    // The page that owns one of these prints it in its own live region, so a
    // toast would put the same sentence on screen and read it out twice.
    const PRINTED_INLINE: Record<string, string> = { modelNotice: "models", recognitionNotice: "recognition" };

    function announce(): void {
      for (const channel of NOTICES) {
        const raised = (state as any)[channel];
        // Each setter writes a fresh object, so identity catches the same
        // sentence raised twice running where comparing the text would not.
        if (!raised || announced.get(channel) === raised) continue;
        announced.set(channel, raised);
        if (raised.text && PRINTED_INLINE[channel] !== state.page) toast({ text: String(raised.text), kind: raised.kind === "error" ? "error" : "success" });
      }
    }

    function render(): void { announce(); if (renderOverride) renderOverride(); else phase2RenderImpl(); }
    const element = (id: string) => document.getElementById(id) as any;

    const project = () => state.currentProjects.find((item) => item.id === state.selectedId) || null;
    const busy = new ProjectBusy();
    /** What the page shows when several are in flight: a proposal or a run outranks a save. */
    const PROMPT_KINDS = ["generating", "running", "stopping", "saving"];
    const footerActions = { loadHome };
    const rivalsActions = { loadRankingPlan, loadActions, loadPersonas, loadRivals, loadDemand };
    const homeActions = { loadHome, loadAnswerEngine, loadOutreach, loadRankingPlan, loadDigest, loadSearchDemand, loadReferrals };
    const brandVisibilityActions = { ...homeActions, ...rivalsActions };
    const promptPageActions = { ...brandVisibilityActions, loadTopics, loadSchedule, loadPriority };
    const trustActions = { loadCheck, loadExperiments, loadSchedule };
    const currentTasks = () => answerTasks(state.answerEngine);
    const sourceActions = { loadInterference, loadConcentration, loadShape, loadCredit, loadKinds, loadOutreach, loadSearchDemand, loadReferrals, loadUptake };
    const modelsActions = { loadProviders, loadEngines };
    const setupActions = { loadProviders, loadStorage, loadCredentials, loadIntegrations, loadExternalMetrics };
    const sourcesActions = { ...sourceActions, loadAnswerEngine, loadLiveRun, loadCited, loadHistory };
    const trustPageActions = { ...trustActions, loadAnswerEngine, loadLiveRun };
    const currentPaneRun = () => paneRun(state.panel, state.liveRun, state.lastRun);
    /** Clears the side panel and what it was showing, without drawing. */
    function clearPanel() {
      document.body.classList.remove("panel-open");
      state.panel = null;
      state.panelAnswers = [];
      state.panelState = "idle";
      state.runFeed = [];
      state.runFeedState = "idle";
      state.brief = null;
      state.briefState = "idle";
      window.clearTimeout(state.runFeedTimer);
    }

    /** Everything that belongs to the open project, so the next one starts from nothing.
     * The busy flags of a pull in flight stay, because that request is still running. */
    function resetProject() {
      state.liveRun = null; state.lastRun = null; window.clearTimeout(state.runPollTimer);
      state.insights = null; state.insightsState = "idle";
      state.plan = null; state.planState = "idle";
      state.rankPlan = null; state.rankPlanState = "idle";
      state.engines = null; state.enginesState = "idle";
      state.actions = []; state.actionsState = "idle";
      state.outreach = null; state.outreachState = "idle";
      state.paste = null; state.pasteState = "idle";
      state.uptake = null; state.uptakeState = "idle";
      state.interference = null; state.interferenceState = "idle";
      state.concentration = null; state.concentrationState = "idle";
      state.shape = null; state.shapeState = "idle";
      state.kinds = null; state.kindsState = "idle";
      state.experiments = null; state.experimentsState = "idle";
      state.check = null; state.checkState = "idle";
      state.credit = null; state.creditState = "idle";
      state.reach = null; state.reachState = "idle";
      state.searchDemand = null; state.searchDemandState = "idle";
      state.personas = null; state.personasState = "idle";
      state.priority = null; state.priorityState = "idle";
      state.referrals = null; state.referralsState = "idle";
      state.crawlers = null; state.crawlersState = "idle";
      state.signals = null; state.signalsState = "idle";
      state.externalMetrics = null; state.externalMetricsState = "idle";
      state.home = null; state.homeState = "idle";
      state.answerEngine = null; state.answerEngineState = "idle";
      state.rivals = null; state.rivalsState = "idle";
      state.demand = null; state.demandState = "idle";
      state.cited = null; state.citedState = "idle";
      state.digest = null; state.digestState = "idle";
      state.history = null; state.historyState = "idle";
      state.marketer = null; state.drafts = null; state.claims = null; state.buying = null; state.conversations = null; state.entity = null; state.marketerState = "idle";
      state.topicSet = null; state.topicState = "idle";
      state.schedule = null; state.scheduleState = "idle";
      state.selections = []; state.baselines = []; state.monitoringConfiguration = null; state.configurationState = "idle"; state.monitoringSaveState = "idle"; resetDraftSelections();
      state.recognitionRuns = []; state.recognitionDetail = null; state.recognitionModelDetails = {}; state.recognitionSelectedRunId = "";
      state.recognitionNotice = { text:"", kind:"" }; window.clearTimeout(state.recognitionRefreshTimer);
      state.regions = []; state.languages = [];
      state.filters = { modelId:"", regionId:"", languageId:"", topicId:"" };
      state.promptFilters.topicId = ""; state.promptDraft.topicId = ""; state.promptSelection = [];
      state.promptNotice = { text:"", kind:"" }; state.crawlerNotice = { text:"", kind:"" }; state.marketerNotice = { text:"", kind:"" };
      state.modelNotice = { text:"", kind:"" }; state.externalMetricsNotice = { text:"", kind:"" }; state.monitoringNotice = { text:"", kind:"" };
      clearPanel();
    }

    function syncBusy() {
      const id = state.selectedId;
      state.harvesting = busy.has(id, "harvest");
      state.pulling = busy.has(id, "search-pull");
      state.pullingReferrals = busy.has(id, "referrals-pull");
      state.crawlerUploading = busy.has(id, "crawler-upload");
      state.promptRunning = busy.has(id, "prompt:running");
      if (busy.has(id, "config-save")) state.monitoringSaveState = "saving"; else if (state.monitoringSaveState === "saving") state.monitoringSaveState = "idle";
      state.promptRunState = PROMPT_KINDS.find((kind) => busy.has(id, "prompt:" + kind)) || "idle";
      state.externalMetricsPulling = busy.has(id, "metrics:ahrefs") ? "ahrefs" : busy.has(id, "metrics:semrush") ? "semrush" : "";
    }

    function setSelectedProject(projectId: string) {
      if (projectId !== state.selectedId) resetProject();
      state.selectedId = projectId || "";
      syncBusy();
      if (state.selectedId) localStorage.setItem("citegeo.product.projectId", state.selectedId); else localStorage.removeItem("citegeo.product.projectId");
      const next = new URL(window.location.href);
      if (state.selectedId) next.searchParams.set("projectId", state.selectedId); else next.searchParams.delete("projectId");
      window.history.replaceState({ projectId:state.selectedId }, "", next);
    }
    // A shut drawer sits off screen but kept five tab stops, so a keyboard
    // reader fell into a form they could not see. Inert takes it out.
    function setDrawer(open: boolean) { document.body.classList.toggle("drawer-open", open); const drawer = element("project-drawer"); drawer.setAttribute("aria-hidden", String(!open)); drawer.toggleAttribute("inert", !open); }
    function openDrawer() { state.drawerSession += 1; setFormStatus("", ""); setDrawer(true); window.setTimeout(() => element("project-domain").focus(), 0); }
    function closeDrawer() { state.drawerSession += 1; setDrawer(false); }
    function setFormStatus(message: string, kind: string) { const target = element("form-status"); target.textContent = message || ""; target.className = kind ? "form-status " + kind : "form-status"; }
    const expectedErrorText: Record<string, string | undefined> = { invalid_project_input:"Invalid project input. Check the domain and name.", project_not_found:"The project does not exist or has been deleted.", project_domain_conflict:"This domain is already used by another project.", project_state_conflict:"The project's current status does not allow this action.", project_endpoint_not_found:"The requested project action does not exist.", configuration_invalid:"Invalid configuration. Check the models and their web search modes.", baseline_unchanged:"The current configuration is already saved.", baseline_not_found:"That configuration version does not exist.", model_catalog_unavailable:"The model catalog is temporarily unavailable. Try again shortly.", configuration_operation_failed:"Could not save the configuration. Try again.", recognition_invalid:"The recognition test cannot start. Check the configuration, or wait for the running test to finish.", recognition_run_not_found:"That recognition test record does not exist.", recognition_model_run_not_found:"That model execution record does not exist.", recognition_operation_failed:"The recognition test action failed. Try again.", project_operation_failed:"The project action failed. Try again.", request_failed:"The request did not complete. Check your network and try again." };
    function requestError(code: string, detail?: string): any {
      // The server names the model or the field at fault. The generic line for
      // a code does not, and a save that fails without saying which row is why.
      const error = new Error(detail || expectedErrorText[code] || (expectedErrorText.request_failed || "The request failed."));
      (error as any).code = code || "request_failed";
      return error;
    }
    function errorCode(error: any) { return error && typeof error === "object" && typeof error.code === "string" ? error.code : "request_failed"; }
    async function request<T = any>(path: string, options?: RequestInit): Promise<T> {
      try {
        const response = await fetch(path, options);
        const text = await response.text();
        let body: any = {};
        if (text) body = JSON.parse(text);
        if (!response.ok) throw requestError(typeof body.code === "string" ? body.code : "request_failed", typeof body.error === "string" ? body.error : undefined);
        return body as T;
      } catch (error: any) {
        if (error && typeof error === "object" && typeof error.code === "string") throw error;
        throw requestError("request_failed");
      }
    }

    /** An event target that is an element, or nothing. Every delegated handler
     * needs it, and casting at each one is how a wrong cast gets in. */
    function el(target: EventTarget | null): Element | null {
      return target instanceof Element ? target : null;
    }
    function buttonState(button: any, value: any, label: string) { if (!button) return; if (!button.dataset.originalLabel) button.dataset.originalLabel = button.textContent; button.dataset.actionState = value; button.textContent = label; button.disabled = value === "loading"; }
    function restoreButton(button: any) { if (!button) return; button.disabled = false; button.dataset.actionState = "idle"; button.textContent = button.dataset.originalLabel || button.textContent; }
    async function runAction(button: any, labels: any, work: () => Promise<any>) { if (!button || button.disabled) return; buttonState(button, "loading", labels.loading); try { const value = await work(); buttonState(button, "success", labels.success); window.setTimeout(() => restoreButton(button), 850); return value; } catch (error) { buttonState(button, "error", labels.error); window.setTimeout(() => restoreButton(button), 1200); throw error; } }
    function listUrl() { if (state.mode === "archived") return "/api/projects?includeArchived=true"; if (state.mode === "deleted") return "/api/projects?includeDeleted=true"; return "/api/projects"; }
    async function refreshProjects() { const responses = state.mode === "current" ? [await request("/api/projects")] : await Promise.all([request("/api/projects"), request(listUrl())]); state.currentProjects = responses[0].projects; state.projects = state.mode === "current" ? state.currentProjects : responses[1].projects; if (!state.currentProjects.some((item) => item.id === state.selectedId)) setSelectedProject(state.currentProjects[0] ? state.currentProjects[0].id : ""); else setSelectedProject(state.selectedId); }
    function resetDraftSelections() { state.draftSelections = new Map(state.selections.map((selection) => [selection.modelId, selection.webSearchMode])); state.selectionsDirty = false; }
    async function refreshConfiguration() {
      const selected = project();
      if (!selected) {
        state.selections = [];
        state.baselines = [];
        state.monitoringConfiguration = null;
        resetDraftSelections();
        return;
      }
      state.configurationState = "loading";
      render();
      const at = "/api/projects/" + encodeURIComponent(selected.id);
      await loadForProject(selected.id, () => state.selectedId,
        () => Promise.all([request(at + "/models"), request(at + "/baselines"), request(at + "/monitoring-configuration")]),
        (result) => {
          state.selections = result[0].selections;
          state.baselines = result[1].baselines;
          state.monitoringConfiguration = result[2].configuration;
          if (!state.selectionsDirty) resetDraftSelections();
          state.configurationState = "ready";
        },
        (error) => {
          state.configurationState = "error";
          state.monitoringNotice = { text: error instanceof Error ? error.message : (expectedErrorText.request_failed || "The request failed."), kind: "error" };
        });
      render();
    }
    async function loadCatalog() { if (state.catalogState === "loading" || state.catalogState === "ready") return; state.catalogState = "loading"; state.catalogError = ""; render(); try { const result = await request("/api/provider-models"); state.catalog = result.models; state.catalogState = "ready"; } catch (error) { state.catalogState = "error"; state.catalogError = error instanceof Error ? error.message : String(error); } render(); }
    const NO_CONFIGURATION: MonitoringConfigurationView = {
      status: "no_version", currentVersion: null, nextVersion: 1, currentBaseline: null,
      currentProtocol: { protocolId: "domain-recognition", protocolVersion: "v1", promptTemplateHash: "" },
      currentDomain: "", currentLanguage: "en", currentModelSnapshots: [],
      diff: { addedModels: [], removedModels: [], webSearchModeChanges: [], protocolVersionChange: null, domainChange: null, languageChange: null },
    };
    function monitoringConfiguration(): MonitoringConfigurationView { return state.monitoringConfiguration || NO_CONFIGURATION; }
    async function loadProviders() {
      if (state.providersState === "loading") return;
      state.providersState = "loading";
      try {
        const result = await request("/api/providers");
        state.providers = result.providers || [];
        state.providersState = "ready";
      } catch (error) {
        state.providersState = "error";
      }
      render();
    }

    async function loadTopics() {
      if (!state.selectedId || state.topicState === "loading") return;
      state.topicState = "loading";
      const startedFor = state.selectedId;
      await loadForProject(startedFor, () => state.selectedId, () => request("/api/projects/" + encodeURIComponent(startedFor) + "/topics"),
        (value) => {
          state.topicSet = value;
          state.topicState = "ready";
          if (!liveTopics(value).some((topic) => topic.id === state.promptFilters.topicId)) state.promptFilters.topicId = "";
        }, () => { state.topicState = "error"; });
      render();
    }

    async function loadRivals() {
      if (!state.selectedId || state.rivalsState === "loading") return;
      state.rivalsState = "loading";
      const startedFor = state.selectedId;
      await loadForProject(startedFor, () => state.selectedId, () => request("/api/projects/" + encodeURIComponent(startedFor) + "/competitors"),
        (value) => { state.rivals = value; state.rivalsState = "ready"; }, () => { state.rivalsState = "error"; });
      render();
    }

    async function rivalAction(path: string, body: Payload, notice: string) {
      const startedFor = state.selectedId;
      await postPrompts(path, body, "saving", notice);
      if (!isOpen(startedFor, state.selectedId)) return;
      state.rivalsState = "idle";
      state.answerEngineState = "idle";
      loadRivals();
    }

    async function loadCited() {
      if (!state.selectedId || state.citedState === "loading") return;
      state.citedState = "loading";
      const startedFor = state.selectedId;
      await loadForProject(startedFor, () => state.selectedId, () => request("/api/projects/" + encodeURIComponent(startedFor) + "/cited-pages" + filterQuery()),
        (value) => { state.cited = value; state.citedState = "ready"; }, () => { state.citedState = "error"; });
      render();
    }

    async function loadHome() {
      if (!state.selectedId || state.homeState === "loading") return;
      state.homeState = "loading";
      const startedFor = state.selectedId;
      await loadForProject(startedFor, () => state.selectedId, () => request("/api/projects/" + encodeURIComponent(startedFor) + "/home"),
        (value) => { state.home = value; state.homeState = "ready"; }, () => { state.homeState = "error"; });
      render();
    }

    async function loadStorage() {
      if (state.storageState === "loading") return;
      state.storageState = "loading";
      try {
        const settings = await request<StorageSettings>("/api/storage");
        state.storage = settings;
        state.storageBackend = state.storageBackend || settings.current.backend;
        state.storageState = "ready";
      } catch (error) {
        state.storageState = "error";
      }
      render();
    }

    async function storageAction(path: string, method: string, notice: string) {
      const values = {};
      for (const input of document.querySelectorAll("[data-storage-field]")) {
        const fieldName = input.getAttribute("data-storage-field");
        if (fieldName) (values as any)[fieldName] = (input as HTMLInputElement).value;
      }
      state.storageCheck = { pending: true };
      render();
      try {
        const result = await request("/api/storage" + path, {
          method: method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ backend: state.storageBackend, values: values }),
        });
        state.storageCheck = { ok: true, detail: result.detail || notice, describes: result.describes || "" };
        state.storageState = "idle";
        loadStorage();
      } catch (error) {
        state.storageCheck = { ok: false, detail: error && (error as any).message ? (error as any).message : "That did not work." };
        render();
      }
    }

    async function loadSchedule() {
      if (!state.selectedId || state.scheduleState === "loading") return;
      state.scheduleState = "loading";
      const startedFor = state.selectedId;
      await loadForProject(startedFor, () => state.selectedId, () => Promise.all([
        request("/api/projects/" + encodeURIComponent(startedFor) + "/prompt-schedule"),
        request("/api/projects/" + encodeURIComponent(startedFor) + "/regions"),
      ]), (results) => {
        state.schedule = results[0];
        state.regions = results[1].regions || [];
        state.languages = results[1].languages || [];
        state.scheduleState = "ready";
      }, () => { state.scheduleState = "error"; });
      render();
    }

    function filterQuery() {
      const parts = [];
      for (const key of ["modelId", "regionId", "languageId", "topicId"]) {
        if (state.filters[key]) parts.push(key + "=" + encodeURIComponent(state.filters[key]));
      }
      return parts.length ? "?" + parts.join("&") : "";
    }


    /** The mark each rival's own site declares, read once by the server and
     * kept. A domain with no mark is remembered as having none. */
    async function loadBrandIcons(domains: string[]) {
      const wanted = domains.filter((domain) => domain && !(domain in state.brandIcons));
      if (!wanted.length) return;
      // Marked as read before the call, so a slow crawl is not asked for twice.
      for (const domain of wanted) state.brandIcons[domain] = null;
      try {
        const answer: Unshaped = await request("/api/brand-icons", { method: "POST", body: JSON.stringify({ domains: wanted }) });
        Object.assign(state.brandIcons, (answer.icons as Record<string, string | null>) || {});
        render();
      } catch (error) {
        /* a mark is decoration; the table reads the same without it */
      }
    }

    async function loadAnswerEngine() {
      if (!state.selectedId || state.answerEngineState === "loading") return;
      state.answerEngineState = "loading";
      const startedFor = state.selectedId;
      await loadForProject(startedFor, () => state.selectedId, () => request("/api/projects/" + encodeURIComponent(startedFor) + "/prompt-insights" + filterQuery()), (value) => {
        state.answerEngine = value;
        state.answerEngineState = "ready";
        const board = ((state.answerEngine as Unshaped).leaderboard as Unshaped[]) || [];
        loadBrandIcons(board.map((row) => String(row.domain || "")).filter(Boolean).slice(0, 24));
      }, () => { state.answerEngineState = "error"; });
      render();
    }

    async function loadLiveRun() {
      if (!state.selectedId) return;
      const startedFor = state.selectedId;
      try {
        const result = await request("/api/projects/" + encodeURIComponent(startedFor) + "/prompt-runs");
        if (!isOpen(startedFor, state.selectedId)) return;
        const rows = result.runs || result || [];
        const live = rows.find ? rows.find((row: any) => row.status === "running" || row.status === "cancelling") : null;
        const had = Boolean(state.liveRun);
        state.liveRun = live || null;
        state.lastRun = rows.length ? rows[0] : null;
        window.clearTimeout(state.runPollTimer);
        if (live) state.runPollTimer = window.setTimeout(loadLiveRun, 4000);
        // A start takes a moment to appear, and one missed poll used to leave
        // the page claiming nothing was running for the length of the run.
        else if (busy.has(startedFor, "prompt:running")) state.runPollTimer = window.setTimeout(loadLiveRun, 1500);
        else if (had) { state.answerEngineState = "idle"; state.rankPlanState = "idle"; state.actionsState = "idle"; state.outreachState = "idle"; state.uptakeState = "idle"; loadAnswerEngine(); if (state.panel && state.panel.kind === "run") loadRunFeed(); }
        render();
      } catch (error) {
        if (isOpen(startedFor, state.selectedId)) state.liveRun = null;
      }
    }

    // Only the prompts the action can apply to: activating something already
    // tracked is a no-op the count should not claim.
    async function bulkPrompts(action: string) {
      const set = state.topicSet || { topics: [], prompts: [] };
      const wanted = action === "activate" ? "proposed" : "active";
      const ids = set.prompts.filter((prompt) => prompt.status === wanted && state.promptSelection.indexOf(prompt.id) >= 0).map((prompt) => prompt.id);
      if (!ids.length) return;
      state.promptSelection = [];
      const done = action === "activate" ? ids.length + " question(s) now tracked." : ids.length + " question(s) no longer tracked. Past answers are kept.";
      await postPrompts("/prompts/" + action, { promptIds: ids }, "saving", done);
    }

    async function bulkRun() {
      const set = state.topicSet || { topics: [], prompts: [] };
      const ids = set.prompts.filter((prompt) => prompt.status === "active" && state.promptSelection.indexOf(prompt.id) >= 0).map((prompt) => prompt.id);
      if (!ids.length) return;
      state.promptSelection = [];
      loadLiveRun();
      await postPrompts("/prompt-runs", { promptIds: ids }, "running", "The run has started. Watch it below, or leave the page and come back.");
      loadLiveRun();
    }

    async function stopRun() {
      if (!state.liveRun) return;
      await postPrompts("/prompt-runs/" + encodeURIComponent(state.liveRun.id) + "/cancel", {}, "stopping", "Stopping after the answer in flight.");
      loadLiveRun();
    }

    async function openEvidence(promptId: string, title: string) {
      window.clearTimeout(state.runFeedTimer);
      state.panel = { kind:"evidence", promptId: promptId, title: title };
      state.panelState = "loading";
      state.panelAnswers = [];
      document.body.classList.add("panel-open");
      render();
      loadBrief(promptId);
      const startedFor = state.selectedId;
      try {
        const query = filterQuery();
        const joiner = query ? "&" : "?";
        const result = await request("/api/projects/" + encodeURIComponent(startedFor) + "/prompt-answers" + query + joiner + "promptId=" + encodeURIComponent(promptId));
        if (!isOpen(startedFor, state.selectedId)) return;
        state.panelAnswers = result.answers || [];
        state.panelState = "ready";
      } catch (error) {
        if (!isOpen(startedFor, state.selectedId)) return;
        state.panelState = "error";
      }
      render();
    }

    /** Every archived answer that named one brand, optionally only the ones
     * that recommended it. The figures in the table are counts of these. */
    async function openBrandEvidence(name: string, tone: string) {
      window.clearTimeout(state.runFeedTimer);
      state.panel = { kind: "brand", promptId: "", title: name + (tone ? " \u00b7 " + tone : "") };
      state.panelState = "loading";
      state.panelAnswers = [];
      state.brief = null;
      document.body.classList.add("panel-open");
      render();
      const startedFor = state.selectedId;
      try {
        const result = await request<{ answers: Unshaped[] }>("/api/projects/" + encodeURIComponent(startedFor) + "/prompt-answers");
        if (!isOpen(startedFor, state.selectedId)) return;
        state.panelAnswers = (result.answers || []).filter((answer: Unshaped) =>
          (answer.mentions || []).some((row: Unshaped) => row.name === name && (!tone || row.recommendation === tone)));
        state.panelState = "ready";
      } catch (error) {
        if (!isOpen(startedFor, state.selectedId)) return;
        state.panelState = "error";
      }
      render();
    }

    /** One dashboard panel on its own. It carries what the card had to leave
     * out, because opening a panel is a deep dive rather than a bigger card. */
    function openPanel(panelId: string) {
      const view = dashboardView(state, project());
      if (!view) return;
      const panel = dashboardPanels(view).find((row) => row.id === panelId);
      if (!panel) return;
      state.panel = { kind: "panel", promptId: "", title: panel.title, panelId, blurb: panel.blurb, body: panel.detail };
      state.panelState = "ready";
      state.panelAnswers = [];
      state.brief = null;
      document.body.classList.add("panel-open");
      render();
    }

    function closeEvidence() {
      clearPanel();
      render();
    }

    async function postPrompts(path: string, body: Payload, working: string, done: string) {
      if (!state.selectedId) return;
      const startedFor = state.selectedId;
      try {
        busy.start(startedFor, "prompt:" + working);
        syncBusy();
        state.promptNotice = { text:"", kind:"" };
        render();
        const verb = path === "/prompt-schedule" ? "PUT" : "POST";
        await request("/api/projects/" + encodeURIComponent(startedFor) + path, { method:verb, headers:{"Content-Type":"application/json"}, body: JSON.stringify(body || {}) });
        if (isOpen(startedFor, state.selectedId)) {
          state.promptNotice = { text: done, kind: "success" };
          state.topicState = "idle";
          state.answerEngineState = "idle";
        }
      } catch (error) {
        if (isOpen(startedFor, state.selectedId)) {
          state.promptNotice = { text: error && (error as any).message ? (error as any).message : String(error), kind: "error" };
        }
      } finally {
        busy.end(startedFor, "prompt:" + working);
        syncBusy();
      }
      render();
    }

    async function loadInsights() {
      if (state.insightsState === "loading") return;
      const selected = project();
      if (!selected) return;
      state.insightsState = "loading";
      await loadForProject(selected.id, () => state.selectedId, () => request("/api/projects/" + selected.id + "/insights"),
        (value) => { state.insights = value; state.insightsState = "ready"; }, () => { state.insightsState = "error"; });
      render();
    }
    async function loadCrawlers() {
      if (state.crawlersState === "loading") return;
      const selected = project();
      if (!selected) return;
      state.crawlersState = "loading";
      await loadForProject(selected.id, () => state.selectedId, () => request("/api/projects/" + selected.id + "/crawlers"),
        (value) => { state.crawlers = value; state.crawlersState = "ready"; }, () => { state.crawlersState = "error"; });
      render();
    }
    function renderCrawlerSection() {
      if (state.crawlersState === "idle") { loadCrawlers(); }
      const head = '<section class="section-card"><div class="section-head"><div><h2>AI crawlers</h2><p class="subtle">Whether a bot actually fetched your pages. Permission is not arrival.</p></div></div>';
      if (state.crawlersState !== "ready" || !state.crawlers) {
        return head + '<p class="subtle">' + (state.crawlersState === "error" ? "Could not read the access log." : "Reading the access log…") + '</p></section>';
      }
      const report = state.crawlers;
      // The guard tested for a state this endpoint has never returned, so the
      // table below it has never been drawn: every reader got the warning box
      // and nothing else, whatever was in the log. What decides is whether
      // there is any activity to show.
      if (!report.activity) {
        return head + '<div class="warning-box">' + html(report.detail) + '</div>' + crawlerUpload(state.crawlerUploading, state.crawlerNotice) + '</section>';
      }
      const activity = report.activity;
      const rows = activity.crawlers.map((row: any) => '<div class="mrow mcols-crawler"><div class="mname"><strong>' + html(row.name) + '</strong><span>' + html(row.engine) + ' · ' + html(row.purpose === "live_fetch" ? "fetches when asked" : row.purpose === "training" ? "training crawl" : "search index") + '</span></div><span class="mcell">' + row.fetches + '</span><span class="mcell">' + row.pages + '</span><span class="mcell ' + (row.errorRate ? "state-flag" : "") + '">' + (row.errorRate === null ? "n/a" : Math.round(row.errorRate * 100) + "%") + '</span><span class="mcell mono">' + html(row.lastSeen ? row.lastSeen.slice(0, 10) : "unknown") + '</span></div>').join("");
      const absent = activity.allowedButAbsent.length
        ? '<div class="warning-box"><strong>' + activity.allowedButAbsent.length + ' allowed crawler(s) never arrived.</strong> Nothing links to you where they crawl: ' + html(activity.allowedButAbsent.slice(0, 8).join(", ")) + (activity.allowedButAbsent.length > 8 ? ", and more" : "") + '</div>'
        : '';
      const orphan = activity.citedNeverFetched.length
        ? '<p class="mlegend">' + activity.citedNeverFetched.length + ' cited page(s) were never seen being fetched, so those citations came from a cache, a training set or a third party.</p>'
        : '';
      // Whose log this is. A path set on the server is that server's log and
      // every project on it reads the same traffic; an uploaded one is this
      // project's. Saying which is the difference between a figure a reader
      // can act on and one they cannot place.
      const whose = report.source === "upload"
        ? '<p class="subtle">Counted from a log you uploaded.</p>'
        : report.source
          ? '<p class="subtle">Counted from ' + html(report.source) + ' on this server, which is the same log for every project here. Upload your own to count only your traffic.</p>'
          : '';
      return head
        + '<div class="countstrip"><span class="count"><strong>' + activity.totalFetches + '</strong>Crawler fetches</span><span class="count"><strong>' + activity.crawlers.length + '</strong>Bots seen</span><span class="count"><strong>' + activity.pages.length + '</strong>Pages fetched</span><span class="count"><strong>' + activity.fetchedNeverCited.length + '</strong>Fetched, never cited</span></div>'
        + whose
        + absent
        + insightTable("mcols-crawler", ["Crawler", "Fetches", "Pages", "Errors", "Last seen"], rows ? [rows] : [], "No AI crawler appears in this log.")
        + orphan + crawlerUpload(state.crawlerUploading, state.crawlerNotice) + '</section>';
    }

    async function uploadCrawlerLog(file: File) {
      const selected = project();
      if (!selected || busy.has(selected.id, "crawler-upload")) return;
      try {
        busy.start(selected.id, "crawler-upload");
        syncBusy();
        state.crawlerNotice = { text: "", kind: "" };
        render();
        const text = await file.text();
        const result = await request("/api/projects/" + selected.id + "/crawlers", {
          method: "POST",
          headers: { "content-type": "text/plain" },
          body: text,
        });
        if (isOpen(selected.id, state.selectedId)) {
          state.crawlers = result;
          state.crawlersState = "ready";
          state.crawlerNotice = { text: result.detail, kind: result.linesParsed ? "" : "bad" };
        }
      } catch (error) {
        if (isOpen(selected.id, state.selectedId)) state.crawlerNotice = { text: error instanceof Error ? error.message : String(error), kind: "bad" };
      } finally {
        busy.end(selected.id, "crawler-upload");
        syncBusy();
      }
      render();
    }
    /** Every marketer surface is read-only and cheap, so one loader fills them
     * all and a page never waits on a request it does not use. */
    /** The shared probe reloads the plan page, so on this page the probe ran
     * and nothing moved. This one reports progress and reloads what is shown. */
    async function probeForEntity(control: Element) {
      const selected = project();
      if (!selected) return;
      const label = control.textContent || "Probe the site now";
      (control as HTMLButtonElement).disabled = true;
      control.textContent = "Probing the site…";
      try {
        await request("/api/projects/" + selected.id + "/signals", { method: "POST" });
        if (!isOpen(selected.id, state.selectedId)) return;
        state.marketerState = "idle";
        loadMarketer();
      } catch (error) {
        shortReason(control, error);
        (control as HTMLButtonElement).disabled = false;
        return;
      }
      control.textContent = label;
    }

    function draftBody(draftId: string): string {
      const rows = (state.drafts?.drafts || []) as any[];
      const found = rows.find((row) => row.id === draftId);
      return found ? `# ${found.title}\n\n${found.body}` : "";
    }

    /** A draft with nowhere to go is not finished work, so it leaves as text.
     * Clipboard access can be refused, and saying so beats a silent no-op. */
    async function copyText(control: Element, text: string) {
      if (!text) { control.textContent = "Nothing to copy"; return; }
      const label = control.textContent || "Copy";
      try {
        await navigator.clipboard.writeText(text);
        control.textContent = "Copied";
      } catch (error) {
        control.textContent = "Copying was refused";
      }
      window.setTimeout(() => { control.textContent = label; }, 1800);
    }

    /** Reading claims or buying answers spends a model call per answer, so the
     * control says it is working and reports the provider's reason if it is not. */
    async function runMarketerCheck(control: Element, where: "factcheck" | "shopping") {
      const selected = project();
      if (!selected) return;
      const label = control.textContent || "Run";
      (control as HTMLButtonElement).disabled = true;
      control.textContent = "Reading the answers…";
      try {
        await request("/api/projects/" + selected.id + "/" + where, { method: "POST", body: JSON.stringify({}) });
        if (!isOpen(selected.id, state.selectedId)) return;
        state.marketerState = "idle";
        loadMarketer();
      } catch (error) {
        shortReason(control, error);
        (control as HTMLButtonElement).disabled = false;
        return;
      }
      control.textContent = label;
    }

    /** A provider lists every model it tried, which is hundreds of characters
     * and unreadable on a button. The first sentence goes on the control and
     * the whole of it stays reachable on hover. */
    function shortReason(control: Element, error: unknown) {
      const full = error instanceof Error ? error.message : String(error);
      const stop = full.indexOf(". ");
      const first = stop === -1 ? full : full.slice(0, stop + 1);
      control.textContent = first.length > 90 ? `${first.slice(0, 87)}…` : first || "It did not work";
      control.setAttribute("title", full);
    }

    /** Drafting spends a model call per gap, so the button says what it is
     * doing and the reason is shown when a provider refuses. */
    async function runDraft(control: Element, templateId: string, batch: boolean) {
      const selected = project();
      if (!selected || !templateId) return;
      const label = control.textContent || "Draft";
      (control as HTMLButtonElement).disabled = true;
      control.textContent = batch ? "Drafting every gap…" : "Drafting…";
      try {
        await request("/api/projects/" + selected.id + "/agents", {
          method: "POST",
          body: JSON.stringify(batch ? { templateId, batch: true } : { templateId }),
        });
        if (!isOpen(selected.id, state.selectedId)) return;
        state.marketerState = "idle";
        state.page = "drafts";
        loadMarketer();
      } catch (error) {
        shortReason(control, error);
        (control as HTMLButtonElement).disabled = false;
        return;
      }
      control.textContent = label;
    }

    async function reviewDraft(control: Element, value: string) {
      const selected = project();
      const at = value.indexOf(":");
      if (!selected || at === -1) return;
      (control as HTMLButtonElement).disabled = true;
      try {
        await request("/api/projects/" + selected.id + "/agents/" + value.slice(0, at) + "/review", {
          method: "POST",
          body: JSON.stringify({ status: value.slice(at + 1) }),
        });
        if (!isOpen(selected.id, state.selectedId)) return;
        state.marketerState = "idle";
        loadMarketer();
      } catch (error) {
        shortReason(control, error);
        (control as HTMLButtonElement).disabled = false;
      }
    }

    async function publishDraft(control: Element, draftId: string) {
      const selected = project();
      if (!selected || !draftId) return;
      const where = window.prompt("Where did it go live? Paste the address of the published page.");
      if (!where || !where.trim()) return;
      const when = window.prompt("When did it go live? Leave this as it is unless it was earlier.", new Date().toISOString().slice(0, 10)) || "";
      (control as HTMLButtonElement).disabled = true;
      try {
        const result: any = await request("/api/projects/" + selected.id + "/agents/" + draftId + "/publish", {
          method: "POST",
          body: JSON.stringify({ url: where.trim(), at: when.trim() || undefined }),
        });
        if (!isOpen(selected.id, state.selectedId)) return;
        state.marketerNotice = result && result.measuring
          ? { text: 'Recorded as live, and "' + result.measuring.name + '" is now measuring it against the questions it was written for.', kind: "success" }
          : { text: "Recorded as live. " + ((result && result.notMeasured) || "Nothing is measuring it yet."), kind: "warning" };
        state.marketerState = "idle";
        state.experimentsState = "idle";
        loadMarketer();
      } catch (error) {
        shortReason(control, error);
        (control as HTMLButtonElement).disabled = false;
      }
    }

    async function loadMarketer() {
      if (state.marketerState === "loading") return;
      const selected = project();
      if (!selected) return;
      state.marketerState = "loading";
      const at = "/api/projects/" + selected.id;
      const quietly = async (path: string) => request(at + path).catch(() => null);
      await loadForProject(selected.id, () => state.selectedId, () => Promise.all([
        quietly("/aim"), quietly("/agents"), quietly("/factcheck"), quietly("/shopping"),
        quietly("/conversations"), quietly("/entity"), quietly("/llms-txt"),
      ]), ([memo, agents, claims, buying, conversations, entity, llms]) => {
        state.marketer = memo?.memo || null;
        state.drafts = agents || null;
        // The report is absent until a check has run, which is not an empty one.
        state.claims = claims?.report ? { ...claims.report, ...claims } : null;
        state.buying = buying?.report || null;
        state.conversations = conversations?.explorations || [];
        state.entity = { alignment: entity?.alignment || null, llms: llms?.draft || null };
        state.marketerState = "ready";
      }, () => { state.marketerState = "error"; });
      render();
    }

    async function loadPlan() {
      if (state.planState === "loading") return;
      const selected = project();
      if (!selected) return;
      state.planState = "loading";
      await loadForProject(selected.id, () => state.selectedId, () => request("/api/projects/" + selected.id + "/action-plan"),
        (value) => { state.plan = value; state.planState = "ready"; }, () => { state.planState = "error"; });
      render();
    }
    // Asking for more a day does not invent more. The shortfall is named, which
    // is the whole difference from a tool that ships a fixed number whatever is true.
    async function loadPaste() {
      if (!state.selectedId || state.pasteState === "loading") return;
      state.pasteState = "loading";
      const startedFor = state.selectedId;
      await loadForProject(startedFor, () => state.selectedId, () => request("/api/projects/" + encodeURIComponent(startedFor) + "/paste-fixes?count=" + state.pasteCount),
        (value) => { state.paste = value; state.pasteState = "ready"; }, () => { state.pasteState = "error"; });
      render();
    }

    function pasteFixCard(fix: any) {
      return '<div class="fix"><div class="fix-top"><strong>' + html(fix.title) + '</strong><span class="tag">' + html(fix.language) + '</span>'
        + '<button type="button" class="card-action" data-copy-fix="' + html(fix.id) + '">Copy</button></div>'
        + '<p class="why">' + html(fix.why) + '</p>'
        + '<p class="evidence-note">Observed: ' + html(fix.evidence) + '</p>'
        + '<p class="evidence-note">Goes in: ' + html(fix.where) + '</p>'
        + '<pre class="fix-snippet" id="fix-' + html(fix.id) + '">' + html(fix.snippet) + '</pre></div>';
    }

    function renderPaste() {
      if (state.pasteState === "idle") { loadPaste(); }
      const head = '<section class="section-card"><div class="section-head"><div><h2>Ready to paste</h2>'
        + '<p class="subtle">Generated from what was observed on your site, so every snippet can be checked against the evidence beside it. Asking for more a day does not invent any.</p></div>'
        + '<div class="inline-actions">' + pasteCountPicker(state.pasteCount) + '</div></div>';
      if (state.pasteState !== "ready" || !state.paste) {
        return head + '<p class="subtle">' + (state.pasteState === "error" ? "Could not generate anything." : "Generating from the last site probe.") + '</p></section>';
      }
      const list = state.paste;
      const fixes = (list.fixes || []).map(pasteFixCard).join("");
      const shortfall = list.shortfall ? '<div class="warning-box">' + html(list.shortfall) + '</div>' : '';
      const described = (list.described || []).length
        ? '<details class="technical-details"><summary>' + list.described.length + ' that cannot be generated correctly, so they are described instead</summary>'
          + list.described.map((row: any) => '<div class="move"><div class="move-top"><strong>' + html(row.title) + '</strong></div>'
            + '<p class="why">' + html(row.why) + '</p><p class="evidence-note">Observed: ' + html(row.evidence) + '</p></div>').join("")
          + '</details>'
        : '';
      return head + shortfall + (fixes || '<p class="subtle">Nothing outstanding can be generated from the last probe.</p>') + described
        + (list.caveat ? '<p class="mlegend">' + html(list.caveat) + '</p>' : '') + '</section>';
    }

    async function captureSignals(button: any) {
      const selected = project();
      if (!selected) return;
      try {
        await runAction(button, { loading:"Probing…", success:"Probed", error:"Probe failed" }, () => request("/api/projects/" + selected.id + "/signals", { method:"POST" }));
      } catch {
        // runAction has already shown the failure on the button.
        return;
      }
      if (!isOpen(selected.id, state.selectedId)) return;
      state.planState = "idle";
      loadPlan();
      state.signalsState = "idle";
      loadSignals();
    }
    async function loadSignals() {
      if (state.signalsState === "loading") return;
      const selected = project();
      if (!selected) return;
      state.signalsState = "loading";
      await loadForProject(selected.id, () => state.selectedId, () => request("/api/projects/" + selected.id + "/signals"),
        (result) => { state.signals = result.snapshots || []; state.signalsState = "ready"; }, () => { state.signalsState = "error"; });
      render();
    }
    function signalFacts(signals: any) {
      const blocked = signals.robots.blocked.length;
      return [
        blocked ? blocked + " crawler(s) blocked" : "all crawlers allowed",
        signals.llmsTxt.present ? "llms.txt published" : "no llms.txt",
        signals.structuredData.organization ? "Organization markup" : "no Organization markup",
        signals.structuredData.independent.length + " independent record(s)",
        signals.wikidata.present ? "Wikidata " + signals.wikidata.id : "no Wikidata entity",
      ].join(" · ");
    }
    function renderSignalHistory() {
      if (state.signalsState === "idle") { loadSignals(); }
      const head = '<section class="section-card"><div class="section-head"><div><h2>Site signal history</h2><p class="subtle">What each probe saw, and what moved between them. A snapshot says the state; two say the story.</p></div></div>';
      if (state.signalsState !== "ready" || !state.signals) {
        return head + '<p class="subtle">' + (state.signalsState === "error" ? "Could not read the probe history." : "Reading the probe history…") + '</p></section>';
      }
      const snapshots = state.signals;
      if (!snapshots.length) {
        return head + '<p class="subtle">No probe yet. Use "Probe the site" above, or let the worker run one.</p></section>';
      }
      const rows = snapshots.map((snapshot: any) => {
        const when = snapshot.capturedAt ? snapshot.capturedAt.slice(0, 16).split("T").join(" ") : "unknown";
        const changes = (snapshot.changes || []).length
          ? '<ul class="protocol-list">' + snapshot.changes.map((change: any) => '<li><span class="' + (change.direction === "regressed" ? "state-bad" : change.direction === "improved" ? "state-ok" : "state-flag") + '">' + html(change.direction) + '</span> ' + html(change.detail) + '</li>').join("") + '</ul>'
          : '<span class="step-note">No change from the probe before it.</span>';
        return '<div class="mrow mcols-signal"><span class="mcell mono">' + html(when) + '</span><div class="mname"><span class="step-note">' + html(signalFacts(snapshot.signals)) + '</span>' + changes + '</div></div>';
      }).join("");
      return head + '<div class="mtable"><div class="mhead mcols-signal"><span>Probed</span><span>What it saw, and what moved</span></div>' + rows + '</div></section>';
    }
    /** A stored list that survives a shape it does not recognise. */
    function savedList(key: string): string[] {
      try {
        const raw = window.localStorage.getItem("citegeo." + key);
        const parsed = raw ? JSON.parse(raw) : null;
        return Array.isArray(parsed) ? parsed.filter((row) => typeof row === "string") : [];
      } catch (error) { return []; }
    }
    /** A stored object that survives a shape it does not recognise. */
    function savedJson(key: string): Record<string, "chart" | "table"> {
      try {
        const raw = window.localStorage.getItem("citegeo." + key);
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      } catch (error) { return {}; }
    }
    function savedPreference(key: string, fallback: string) {
      try { return window.localStorage.getItem("citegeo." + key) || fallback; } catch (error) { return fallback; }
    }
    function savePreference(key: string, value: any) {
      try { window.localStorage.setItem("citegeo." + key, value); } catch (error) { return; }
    }
    // A line chart drawn by hand. Points with no score leave a gap rather than
    // dropping to zero, because a run that parsed nothing is not 0% visibility.
    /** One shell for every marketer page, so each one loads the same way and
     * an empty one says what is absent rather than showing nothing. */
    // These five lost their rail entries when it collapsed to six destinations,
    // and a page nothing links to is a page nobody can open.
    const ACT_PAGES = [
      ["marketer", "What to do"],
      ["drafts", "Drafts"],
      ["claims", "Claims"],
      ["buying", "Buying"],
      ["conversations", "Conversations"],
      ["entity", "Entity"],
    ];

    const MACHINE_PAGES: Array<[string, string]> = [
      ["models", "Models and surfaces"],
      ["recognition", "Results"],
      ["reports", "Current report"],
      ["configuration", "Configuration"],
    ];

    // Results and Configuration had no way in: the only tab that reached them
    // rendered on Results itself. Each of the three reaches the other two now.
    function machineTabs(): string {
      return '<div class="toolbar">' + MACHINE_PAGES.map(([page, label]) =>
        '<button type="button" class="filter ' + (state.page === page ? "active" : "")
        + '" data-page="' + html(page) + '"' + (state.page === page ? ' aria-current="page"' : '')
        + '>' + html(label) + '</button>').join("") + '</div>';
    }

    // The report has its own module, but it is a page in this shell like any
    // other, so the rail it used to draw for itself cannot come back.
    function renderReport(): string {
      const module = (window as any).__citegeoPhase4;
      if (module && typeof module.body === "function") return String(module.body());
      return '<section class="view"><div class="heading"><div><h1>Current report</h1><p class="subtle">Built from the stored evidence of a finished run.</p></div></div>' + machineTabs() + '<div class="empty"><div class="empty-copy"><h2>The report is still loading</h2><p class="subtle">Nothing has been asked of any model.</p></div></div></section>';
    }

    function actTabs(): string {
      return '<div class="toolbar">' + ACT_PAGES.map(([page, label]) =>
        '<button type="button" class="filter ' + (state.page === page ? "active" : "")
        + '" data-page="' + html(page) + '"' + (state.page === page ? ' aria-current="page"' : '')
        + '>' + html(label) + '</button>').join("") + '</div>';
    }

    // The one action this page is for, beside its name. It used to sit grey
    // inside the body, under whatever the page happened to be showing.
    function marketerPage(title: string, blurb: string, body: () => string, action?: string) {
      if (state.marketerState === "idle") { loadMarketer(); }
      const inner = state.marketerState === "error"
        ? '<p class="subtle">Could not read this project.</p>'
        : state.marketerState !== "ready" ? loading("this page", skeletonTiles(3) + skeletonCard({ rows: 4 })) : body();
      const notice = state.marketerNotice.text
        ? '<div class="' + (state.marketerNotice.kind === "success" ? "success-box" : "warning-box") + '">' + html(state.marketerNotice.text) + '</div>'
        : '';
      const head = action ? '<div class="inline-actions">' + action + '</div>' : '';
      return '<section class="view"><div class="heading"><div><h1>' + html(title) + '</h1><p class="subtle">' + html(blurb) + '</p></div>' + head + '</div>' + actTabs() + notice + inner + '</section>';
    }

    function renderMarketer() {
      return marketerPage("Act", "What moved, what moved it, and what would act on it. Nothing here calls a model.", () => marketerView(state.marketer));
    }
    function renderDrafts() {
      return marketerPage("Drafts", "Pages drafted from a measured gap. Every one waits for your decision.", () => draftsView(state.drafts));
    }
    function renderClaims() {
      return marketerPage("Claims", "What the answers assert about you, settled against your own pages.", () => claimsView(state.claims),
        button({ label: "Check claims now", kind: "primary", on: { "data-run-factcheck": true } }));
    }
    function renderBuying() {
      return marketerPage("Buying", "Which products and retailers a buying answer actually named.", () => buyingView(state.buying),
        button({ label: "Read buying answers", kind: "primary", on: { "data-run-shopping": true } }));
    }
    function renderConversations() {
      return marketerPage("Conversations", "Real demand, and which of it nothing here measures.", () => conversationsView(state.conversations || []),
        button({ label: "Open questions", on: { "data-page": "prompts" } }));
    }
    function renderEntity() {
      return marketerPage("Entity", "What corroborates this brand from outside its own control.", () => entityView(state.entity?.alignment || null, state.entity?.llms || null),
        button({ label: "Probe the site now", kind: "primary", on: { "data-probe-signals": true } }));
    }

    function renderActionPlan() {
      if (state.planState === "idle") { loadPlan(); }
      const head = '<section class="section-card"><div class="section-head"><div><h2>What to fix on the site</h2><p class="subtle">Ordered by what decides whether a model can cite you at all. Every line names the observation behind it. What to do about the answers themselves is on the report.</p></div><div class="inline-actions">' + button({ label: "Probe the site", on: { "data-probe-signals": true } }) + '</div></div>';
      if (state.planState !== "ready" || !state.plan) {
        return head + '<p class="subtle">' + (state.planState === "error" ? "Could not build a plan." : "Building the plan…") + '</p></section>';
      }
      const plan = state.plan;
      if (!plan.probed) {
        return head + '<div class="warning-box">' + html(plan.detail || "No site probe yet.") + '</div></section>';
      }
      const changes = (plan.changes || []).length
        ? '<div class="warning-box"><strong>Changed since the previous probe</strong><ul class="protocol-list">' + plan.changes.map((change: any) => '<li><span class="' + (change.direction === "regressed" ? "state-bad" : change.direction === "improved" ? "state-ok" : "state-flag") + '">' + html(change.direction) + '</span> ' + html(change.detail) + '</li>').join("") + '</ul></div>'
        : '';
      const open = plan.actions.filter((action: any) => action.severity !== "done");
      const done = plan.actions.filter((action: any) => action.severity === "done");
      const row = (action: any) => '<li class="step plan-step" data-state="' + (action.severity === "critical" ? "warn" : action.severity === "done" ? "done" : "next") + '">'
        + '<span class="step-index ' + (action.severity === "critical" ? "state-bad" : action.severity === "high" ? "state-flag" : "") + '">' + html(action.severity === "done" ? "ok" : action.severity) + '</span>'
        + '<span class="step-label"><strong>' + html(action.title) + '</strong>'
        + (action.severity === "done" || !action.why ? '' : '<br><span class="step-why">' + html(action.why) + '</span>')
        + '<br><span class="step-note">Observed: ' + html(action.evidence) + '</span>'
        + (action.severity === "done" ? '' : '<br><span class="step-note state-ok">Fix: ' + html(action.fix) + '</span>')
        + '</span></li>';
      return head + changes
        + (open.length ? '<ol class="steps">' + open.map(row).join("") + '</ol>' : '<p class="subtle">Nothing outstanding.</p>')
        + (done.length ? '<details class="technical-details"><summary>' + done.length + ' already in place</summary><ol class="steps">' + done.map(row).join("") + '</ol></details>' : '')
        + '<p class="mlegend">Probed ' + html(plan.capturedAt ? plan.capturedAt.slice(0, 16).split("T").join(" ") : "never") + '.</p></section>';
    }
    function comparablePercent(value: any) { return value === null || value === undefined ? '<span class="state-flag">not comparable</span>' : '<strong>' + Math.round(value * 100) + '%</strong>'; }
    function insightTable(columns: any, head: any, rows: any[], empty: string) {
      if (!rows.length) return '<p class="subtle">' + html(empty) + '</p>';
      return '<div class="mtable"><div class="mhead ' + columns + '">' + (head as any).map((label: any) => '<span>' + html(label) + '</span>').join("") + '</div>' + rows.join("") + '</div>';
    }
    function renderVisibility() {
      if (state.insightsState === "idle") { loadInsights(); }
      const selected = project();
      if (!selected) return '<section class="view"><div class="empty"><div class="empty-copy"><h2>Select a project first</h2></div></div></section>';
      if (state.insightsState !== "ready" || !state.insights) {
        return '<section class="view"><div class="heading"><div><h1>Visibility</h1><p class="subtle">What the models know, who they name instead, and what they cite.</p></div></div><div class="empty"><div class="empty-copy"><h2>' + (state.insightsState === "error" ? "Could not read the evidence" : "Reading every archived answer") + '</h2></div></div></section>';
      }
      const data = state.insights;
      const core = data.insights;
      const v = core.visibility;
      const sov = core.shareOfVoice;
      const modelRows = v.byModel.map((row: any) => '<div class="mrow mcols-vis"><div class="mname"><strong>' + html(row.displayName) + '</strong><span class="mono">' + html(row.modelId) + '</span></div><span class="mcell">' + row.recognized + ' / ' + row.answered + '</span><span class="mcell">' + comparablePercent(row.score) + '</span></div>').join("");
      const voiceRow = (row: any, isTarget: any) => '<div class="mrow mcols-voice"><div class="mname"><strong>' + html(row.name) + (isTarget ? ' <span class="state-ok">you</span>' : '') + '</strong>' + (row.domain ? '<span class="mono">' + html(row.domain) + '</span>' : '') + '</div><span class="mcell">' + row.mentions + '</span><span class="mcell">' + comparablePercent(row.share) + '</span></div>';
      const voiceRows = [voiceRow(sov.target, true)].concat(sov.competitors.map((row: any) => voiceRow(row, false))).join("");
      const citedRows = core.citations.domains.map((row: any) => '<div class="mrow mcols-cited"><div class="mname"><strong class="mono">' + html(row.domain) + '</strong>' + (row.isTarget ? '<span class="state-ok">your domain</span>' : '') + '</div><span class="mcell">' + row.answers + '</span><span class="mcell">' + html(row.models.join(", ")) + '</span></div>').join("");
      const gapRows = data.citationGap.map((row: any) => '<div class="mrow mcols-cited"><div class="mname"><strong class="mono">' + html(row.domain) + '</strong><span>cited alongside ' + html(row.competitors.join(", ")) + '</span></div><span class="mcell">' + row.answers + '</span><span class="mcell">' + html(row.models.join(", ")) + '</span></div>').join("");
      const audit = data.claimAudit;
      const auditRows = [].concat(
        audit.disagreements.map((row: any) => '<li><strong>Models disagree on ' + html(row.field) + '</strong><br><span class="subtle">' + row.variants.map((variant: any) => html(variant.value) + ' (' + variant.models.length + ')').join(" vs ") + '</span></li>'),
        audit.unsourced.map((row: any) => '<li><strong class="state-flag">' + html(row.field) + ' asserted with no source</strong><br><span class="subtle">' + row.count + ' answer(s) from ' + html(row.models.join(", ")) + '</span></li>'),
        audit.mismatches.map((row: any) => '<li><strong class="state-bad">' + html(row.field) + ' shares nothing with what you declare</strong><br><span class="subtle">they say "' + html(row.asserted) + '", you say "' + html(row.declared) + '"</span></li>'),
      ).join("");
      const categoryRows = core.categories.map((row: any) => '<li>' + html(row.value) + ' <span class="subtle">' + row.count + '</span></li>').join("");
      return '<section class="view"><div class="heading"><div><h1>Visibility</h1><p class="subtle">Pooled from ' + data.runsConsidered + ' run(s) and ' + core.answered + ' parsed answer(s) for ' + html(data.domain) + '.</p></div><div class="inline-actions">' + button({ label: "Recompute", on: { "data-reload-insights": true } }) + '</div></div>'
        + renderPaste()
        + renderActionPlan()
        + '<div class="countstrip"><span class="count"><strong>' + (v.score === null ? "n/a" : Math.round(v.score * 100) + "%") + '</strong>Visibility</span><span class="count"><strong>' + v.recognized + '</strong>Recognised</span><span class="count"><strong>' + v.answered + '</strong>Answers</span><span class="count"><strong>' + core.citations.targetCitedIn + '</strong>Answers citing you</span><span class="count"><strong>' + data.citationGap.length + '</strong>Citation gaps</span></div>'
        + '<section class="section-card"><div class="section-head"><div><h2>Visibility by model</h2><p class="subtle">Answers where the model said it recognised the domain.</p></div></div>' + insightTable("mcols-vis", ["Model", "Recognised", "Visibility"], v.byModel.length ? [modelRows] : [], "No parsed answers yet.") + '</section>'
        + '<section class="section-card"><div class="section-head"><div><h2>Share of voice</h2><p class="subtle">Counted once per answer. A share needs a competitor to be a share of.</p></div></div>' + insightTable("mcols-voice", ["Brand", "Mentions", "Share"], [voiceRows], "Nothing named yet.") + '</section>'
        + '<section class="section-card"><div class="section-head"><div><h2>Citation gap</h2><p class="subtle">Cited when a competitor is named, never when you are. This is the shortest list of places to get into.</p></div></div>' + insightTable("mcols-cited", ["Domain", "Answers", "Models"], gapRows ? [gapRows] : [], "No gap yet. It fills in once answers name competitors, which needs web search enabled.") + '</section>'
        + '<section class="section-card"><div class="section-head"><div><h2>Cited sources</h2><p class="subtle">Every domain the answers cited.</p></div></div>' + insightTable("mcols-cited", ["Domain", "Answers", "Models"], citedRows ? [citedRows] : [], "No citations captured yet.") + '</section>'
        + '<section class="section-card"><div class="section-head"><div><h2>Claim audit</h2><p class="subtle">Disagreement, assertions with no source, and claims unlike your own description.</p></div></div>' + (auditRows ? '<ul class="protocol-list">' + auditRows + '</ul>' : '<p class="subtle">Nothing flagged across ' + audit.answers + ' answer(s).</p>') + '</section>'
        + renderCrawlerSection() + renderSignalHistory() + '<section class="section-card"><div class="section-head"><div><h2>How the models categorise you</h2><p class="subtle">Their words, counted.</p></div></div>' + (categoryRows ? '<ul class="protocol-list">' + categoryRows + '</ul>' : '<p class="subtle">No category returned yet.</p>') + '</section></section>';
    }
    /** What this product can connect to. It answers whether or not key entry
     * is open, so a closed server still says what Setup would ask for. */
    async function loadDigest() {
      const selected = project();
      if (!selected || state.digestState === "loading") return;
      state.digestState = "loading";
      // Nothing to summarise is a state, not a failure.
      await loadForProject(selected.id, () => state.selectedId, () => request<AnswerDigest>("/api/projects/" + encodeURIComponent(selected.id) + "/digest"),
        (value) => { state.digest = value; state.digestState = "ready"; }, () => { state.digest = null; state.digestState = "error"; });
      render();
    }

    async function loadIntegrations() {
      if (state.integrationsState === "loading") return;
      state.integrationsState = "loading";
      try {
        const body = await request<{ integrations: Unshaped[] }>("/api/integrations");
        state.integrations = body.integrations || [];
        state.integrationsState = "ready";
      } catch (error) {
        state.integrationsState = "error";
      }
      render();
    }

    async function loadExternalMetrics() {
      if (!state.selectedId || state.externalMetricsState === "loading") return;
      state.externalMetricsState = "loading";
      const startedFor = state.selectedId;
      await loadForProject(startedFor, () => state.selectedId, () => request("/api/projects/" + encodeURIComponent(startedFor) + "/external-metrics"),
        (value) => { state.externalMetrics = value; state.externalMetricsState = "ready"; }, () => { state.externalMetricsState = "error"; });
      render();
    }

    async function pullExternalMetrics(source: "ahrefs" | "semrush", control: HTMLElement | null) {
      if (!state.selectedId || state.externalMetricsPulling) return;
      const startedFor = state.selectedId;
      try {
        busy.start(startedFor, "metrics:" + source);
        syncBusy();
        state.externalMetricsNotice = { text:"", kind:"" };
        render();
        const result = await runAction(control, { loading:"Pulling…", success:"Saved", error:"Pull failed" }, () => request<{ snapshot: { source: string } }>("/api/projects/" + encodeURIComponent(startedFor) + "/external-metrics", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ source }) }));
        if (isOpen(startedFor, state.selectedId)) {
          state.externalMetricsNotice = { text: (result.snapshot.source === "ahrefs" ? "Ahrefs" : "Semrush") + " estimate saved as a dated snapshot.", kind:"success" };
          state.externalMetricsState = "idle";
        }
      } catch (error) {
        if (isOpen(startedFor, state.selectedId)) state.externalMetricsNotice = { text: error instanceof Error ? error.message : String(error), kind:"error" };
      } finally {
        busy.end(startedFor, "metrics:" + source);
        syncBusy();
      }
      if (!isOpen(startedFor, state.selectedId)) { render(); return; }
      await loadExternalMetrics();
    }

    async function loadCredentials() {
      if (state.credentialsState === "loading") return;
      state.credentialsState = "loading";
      try {
        state.credentials = await request("/api/credentials");
        state.credentialsState = "ready";
      } catch (error) {
        // 403 means authentication is off, which is a configuration state
        // rather than a failure, so it is reported as one.
        state.credentials = { closed:true, detail:error instanceof Error ? error.message : String(error) };
        state.credentialsState = "ready";
      }
      render();
    }
    async function saveCredential(providerId: any, button: HTMLElement | null) {
      const field = document.querySelector('[data-credential-input="' + providerId + '"]');
      const secret = field ? (field as any).value : "";
      try {
        const result = await runAction(button, { loading:"Saving…", success:"Saved", error:"Refused" }, () => request("/api/credentials/" + encodeURIComponent(providerId), { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ secret:secret }) }));
        state.credentialNotice = { text:result.detail || "Stored.", kind:"success" };
      } catch (error) {
        state.credentialNotice = { text:error instanceof Error ? error.message : String(error), kind:"error" };
      }
      if (field) (field as any).value = "";
      state.credentialsState = "idle";
      state.providersState = "idle";
      loadCredentials();
      loadProviders();
    }
    async function clearCredential(providerId: any, button: HTMLElement | null) {
      try {
        const result = await runAction(button, { loading:"Removing…", success:"Removed", error:"Failed" }, () => request("/api/credentials/" + encodeURIComponent(providerId), { method:"DELETE" }));
        state.credentialNotice = { text:result.detail || "Removed.", kind:"success" };
      } catch (error) {
        state.credentialNotice = { text:error instanceof Error ? error.message : String(error), kind:"error" };
      }
      state.credentialsState = "idle";
      state.providersState = "idle";
      loadCredentials();
      loadProviders();
    }
    async function saveIntegrationSettings(providerId: any, button: HTMLElement | null) {
      const settings: Record<string, string> = {};
      const prefix = String(providerId) + ":";
      document.querySelectorAll<HTMLInputElement>("[data-integration-setting]").forEach((field) => {
        const identity = field.getAttribute("data-integration-setting") || "";
        if (!identity.startsWith(prefix)) return;
        settings[identity.slice(prefix.length)] = field.value;
      });
      try {
        const result = await runAction(button, { loading:"Saving scope…", success:"Scope saved", error:"Refused" }, () => request("/api/credentials/" + encodeURIComponent(providerId) + "/settings", { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ settings }) }));
        state.credentialNotice = { text:result.detail || "Connection settings saved.", kind:"success" };
      } catch (error) {
        state.credentialNotice = { text:error instanceof Error ? error.message : String(error), kind:"error" };
      }
      state.credentialsState = "idle";
      loadCredentials();
    }
    // Prominence and framing are means over the answers that named the brand,
    // which on a handful of them cannot be told from a coin. The counts are the
    // finding there, and a percentage beside "Not named" is the old bug.
    function renderScoreBreakdown(score: any) {
      if (!score || score.answers === 0) return '<p class="subtle">Nothing has been answered yet, so there is nothing to score. This is not a zero.</p>';
      const band = score.presenceInterval;
      // Absent on an archive scored before the range existed, so nothing is
      // claimed about how precise those figures were.
      const presenceNote = band && band.low !== null
        ? score.appearances + ' of ' + score.answers + ', consistent with ' + percent(band.low) + ' to ' + percent(band.high)
        : score.appearances + ' of ' + score.answers + ' answers named you';
      const width = score.tooFewAnswers
        ? '<div class="warning-box"><strong>Too few answers to read this as a rate.</strong> '
          + score.answers + ' answer(s) leave the presence rate anywhere from ' + percent(band.low) + ' to ' + percent(band.high)
          + ', which decides nothing. Track more questions, or more models, before acting on the number. ' + html(band.caveat) + '</div>'
        : '';
      const prom = overAppearances(score, score.prominence, 'Full marks means always named first.');
      const sent = overAppearances(score, score.sentiment, 'Full marks means always recommended.');
      return '<div class="statgrid">'
        + stat("Presence", percent(score.presenceRate), presenceNote, score.presenceRate)
        + stat("Prominence", prom.value, score.prominence === null && !score.namedIn ? 'No answer gave a readable order' : prom.note, prom.fraction)
        + stat("Sentiment", sent.value, sent.note, sent.fraction)
        + '</div>' + width;
    }

    // A trend read at a glance: no axes, no grid, just the shape.
    // A spark has no room to say which points it dropped, so it draws only the
    // runs that asked enough to read a figure off. A line through a one-answer
    // run is a picture of how big the run was.



    // The mentions the model reported, marked in its own words. This is the
    // receipt the whole product claims to keep.
    function markMentions(text: string, mentions: any) {
      const names = ((mentions || []) as any[]).map((row: any) => row.name).filter(Boolean).sort((a: string, b: string) => b.length - a.length);
      let out = html(text);
      for (const name of names) {
        const needle = html(name);
        const at = out.toLowerCase().indexOf(needle.toLowerCase());
        if (at < 0) continue;
        out = out.slice(0, at) + "<mark>" + out.slice(at, at + needle.length) + "</mark>" + out.slice(at + needle.length);
      }
      return out;
    }

    // Answers archived before markets and languages existed carry neither, and
    // printing the raw field showed "undefined", which reads as a value.
    function labelFor(rows: any[], id: string | undefined, fallback: string) {
      if (!id) return fallback;
      const found = (rows || []).find((row) => row.id === id);
      return found ? found.label : id;
    }

    // A second run is refused by the server, so the page must not offer one.
    function runActionButton(label: string, enabled?: boolean) {
      if (state.liveRun) return button({ label: "Watch the run", kind: "primary", on: { "data-open-run": state.liveRun.id } });
      const starting = busy.has(state.selectedId, "prompt:running");
      const last = state.lastRun ? button({ label: "Last run", on: { "data-open-run": state.lastRun.id } }) : '';
      return last + languagePicker(state.languages, state.runLanguageId) + repetitionPicker(state.repetitions) + button({ label: (starting ? "Starting…" : html(label)), kind: "primary", disabled: starting || enabled === false, on: { "data-run-prompts": true } });
    }

    function openRunPane(runId: string) {
      const id = runId || (state.liveRun ? state.liveRun.id : state.lastRun ? state.lastRun.id : "");
      if (!id) return;
      state.panel = { kind:"run", runId:id, promptId:"", title:"Run" };
      state.runFeed = [];
      state.runFeedState = "loading";
      document.body.classList.add("panel-open");
      render();
      loadRunFeed();
    }

    async function loadRunFeed() {
      const open = state.panel;
      if (!open || open.kind !== "run" || !state.selectedId) return;
      const startedFor = state.selectedId;
      try {
        const result = await request("/api/projects/" + encodeURIComponent(startedFor) + "/prompt-answers?runId=" + encodeURIComponent((open.runId as any)));
        if (!isOpen(startedFor, state.selectedId) || state.panel !== open) return;
        state.runFeed = result.answers || [];
        state.runFeedState = "ready";
      } catch (error) {
        if (!isOpen(startedFor, state.selectedId) || state.panel !== open) return;
        state.runFeedState = "error";
      }
      window.clearTimeout(state.runFeedTimer);
      if (runIsLive(currentPaneRun())) state.runFeedTimer = window.setTimeout(loadRunFeed, 3000);
      // Patch in place: a full render would throw away the reader's scroll.
      const body = document.querySelector(".panel-body");
      const head = document.querySelector(".runpane-progress");
      if (!body) { render(); return; }
      const top = body.scrollTop;
      body.innerHTML = runFeedBody();
      body.scrollTop = top;
      if (head) head.innerHTML = runPaneProgress(currentPaneRun());
    }

    function runAnswerCard(answer: AnswerRow) {
      const failed = answer.status !== "completed";
      const target = (answer.mentions || []).find((row) => row.isTarget);
      const badge = answer.status === "no_answer"
        ? '<span class="pill flat">no answer from this surface</span>'
        : failed
          ? '<span class="pill bad">' + html(answer.status.split("_").join(" ")) + '</span>'
          : target ? '<span class="pill good">named you</span>' : '<span class="pill flat">did not name you</span>';
      const came = failed
        ? '<p class="runtext state-bad">' + html(answer.errorMessage || answer.errorCode || "The model returned nothing usable.") + '</p>'
        : '<p class="runtext">' + (answer.text ? markMentions(answer.text, answer.mentions) : html("This answer returned no text.")) + '</p>';
      const sources = (answer.citationUrls || []).length
        ? answer.citationUrls.slice(0, 6).map((url) => '<a href="' + html(url) + '" target="_blank" rel="noreferrer">' + html(url) + '</a>').join("")
        : '<span class="subtle">No source was cited.</span>';
      return '<article class="evidence"><div class="evidence-head"><strong>' + html(answer.modelDisplayName || answer.modelId) + '</strong>' + badge
        + '<span>' + html(labelFor(state.regions, answer.regionId, "No stated market")) + ' · ' + html(labelFor(state.languages, answer.languageId, "English")) + '</span>'
        + '<span class="spacer"></span><span>' + (answer.latencyMs === null || answer.latencyMs === undefined ? "no timing" : Math.round(answer.latencyMs / 100) / 10 + 's') + '</span></div>'
        + '<div class="runfield"><span>Sent</span><p class="runtext">' + html(answer.promptText) + '</p></div>'
        + '<div class="runfield"><span>Came back</span>' + came + '</div>'
        + '<div class="runfield"><span>Named, in order</span><div class="namechips">' + mentionChips(answer) + '</div></div>'
        + '<div class="evidence-foot">' + sources + '</div></article>';
    }

    function runInFlightCard() {
      const run = runIsLive(currentPaneRun()) ? currentPaneRun() : null;
      if (!run || !run.currentPromptText) return "";
      return '<article class="evidence is-live"><div class="evidence-head"><strong>' + html(run.currentModelId || "a model") + '</strong>'
        + '<span class="pill flat">asking now</span><span class="spacer"></span><span>waiting for the answer</span></div>'
        + '<div class="runfield"><span>Sent</span><p class="runtext">' + html(run.currentPromptText) + '</p></div></article>';
    }

    function runFeedBody() {
      if (state.runFeedState === "loading" && !state.runFeed.length) return loading("what this run has archived", skeletonText(3) + skeletonText(4));
      if (state.runFeedState === "error") return '<p class="subtle">Could not read this run.</p>';
      const cards = state.runFeed.map(runAnswerCard).join("");
      const flight = runInFlightCard();
      if (!cards && !flight) return '<p class="subtle">No answer has come back yet. The first one appears here as soon as it does.</p>';
      return flight + cards;
    }

    async function loadRankingPlan() {
      if (!state.selectedId || state.rankPlanState === "loading") return;
      state.rankPlanState = "loading";
      const startedFor = state.selectedId;
      await loadForProject(startedFor, () => state.selectedId, () => request("/api/projects/" + encodeURIComponent(startedFor) + "/ranking-plan" + filterQuery()),
        (value) => { state.rankPlan = value; state.rankPlanState = "ready"; }, () => { state.rankPlanState = "error"; });
      render();
    }

    async function loadActions() {
      if (!state.selectedId || state.actionsState === "loading") return;
      state.actionsState = "loading";
      const startedFor = state.selectedId;
      await loadForProject(startedFor, () => state.selectedId, () => request("/api/projects/" + encodeURIComponent(startedFor) + "/actions"),
        (result) => { state.actions = result.actions || []; state.actionsState = "ready"; }, () => { state.actionsState = "error"; });
      render();
    }

    async function setActionState(moveId: string, promptId: string, next: string) {
      if (!state.selectedId) return;
      const startedFor = state.selectedId;
      try {
        await request("/api/projects/" + encodeURIComponent(startedFor) + "/actions", {
          method:"PUT", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ moveId: moveId, promptId: promptId || null, state: next }),
        });
        if (!isOpen(startedFor, state.selectedId)) return;
        state.actionsState = "idle";
        loadActions();
      } catch (error) {
        if (!isOpen(startedFor, state.selectedId)) return;
        state.promptNotice = { text: error && (error as any).message ? (error as any).message : String(error), kind:"error" };
        render();
      }
    }

    async function loadBrief(promptId: string) {
      state.briefState = "loading";
      state.brief = null;
      const startedFor = state.selectedId;
      const query = filterQuery();
      const joiner = query ? "&" : "?";
      await loadForProject(startedFor, () => state.selectedId, () => request("/api/projects/" + encodeURIComponent(startedFor) + "/prompt-brief" + query + joiner + "promptId=" + encodeURIComponent(promptId)),
        (value) => { state.brief = value; state.briefState = "ready"; }, () => { state.briefState = "error"; });
      render();
    }

    function briefVoice(voice: any) {
      const spread = voice.answers + ' answer(s)'
        + (voice.positive ? ' · ' + voice.positive + ' recommended' : '')
        + (voice.negative ? ' · ' + voice.negative + ' warned against' : '')
        + (voice.prominence === null ? '' : ' · named ' + percent(voice.prominence) + ' of the way to first');
      const quotes = voice.quotes.length
        ? '<ul class="quotes">' + voice.quotes.map((quote: any) => '<li>' + html(quote) + '</li>').join("") + '</ul>'
        : '<p class="subtle">Named without a reason given.</p>';
      return '<div class="voice' + (voice.isTarget ? ' is-you' : '') + '"><div class="voice-top"><strong>' + html(voice.name) + '</strong>'
        + (voice.isTarget ? '<span class="pill good">You</span>' : '') + '<span class="subtle">' + html(spread) + '</span></div>' + quotes + '</div>';
    }

    function renderBrief() {
      if (state.briefState === "loading") return loading("what the models credited", skeletonText(3));
      if (state.briefState === "error" || !state.brief) return '';
      const brief = state.brief;
      if (!brief.answers) return '<div class="brief"><p class="why">' + html(brief.verdict) + '</p></div>';
      const rivals = brief.voices.filter((voice: any) => !voice.isTarget).slice(0, 5);
      const you = brief.voices.find((voice: any) => voice.isTarget);
      const coverage = brief.namedBy.length
        ? '<p class="evidence-note">Named you: ' + html(brief.namedBy.join(", ")) + '.'
          + (brief.missedBy.length ? ' Did not: ' + html(brief.missedBy.join(", ")) + '.' : '') + '</p>'
        : '<p class="evidence-note">Not named by ' + html(brief.missedBy.join(", ")) + '.'
          + (brief.namesYouElsewhere.length ? ' These name you elsewhere: ' + html(brief.namesYouElsewhere.join(", ")) + '.' : '') + '</p>';
      const contest = brief.contest;
      const contestClass = contest.state === "open" ? "ready" : contest.state === "settled" ? "warning" : "";
      const contestLine = '<p class="evidence-note">'
        + (contest.state === "unknown" ? '' : '<span class="tag ' + contestClass + '">'
          + (contest.state === "open" ? "Open field" : contest.state === "settled" ? "Settled field" : "Contested field") + '</span> ')
        + html(contest.reason)
        + ' Being absent from a settled question is a harder problem than being absent from an open one.</p>';
      const demand = brief.demand
        ? '<p class="evidence-note">Asked ' + brief.demand.match.exactTerms + ' time(s) in the indexed corpus, '
          + brief.demand.match.relatedTerms + ' loosely. A historical sample of real conversations, not live volume.</p>'
        : '<p class="evidence-note">No corpus is indexed, so how often anyone asks this is unknown. That is not zero demand.</p>';
      const sources = brief.sources.length
        ? '<h3>What these answers read</h3><div class="evidence-foot">' + brief.sources.slice(0, 8).map((url: any) => '<a href="' + html(url) + '" target="_blank" rel="noreferrer">' + html(url) + '</a>').join("") + '</div>'
        : '<p class="evidence-note">These answers cited no source, so nothing here says which page to write. That is a property of the models that ran.</p>';
      return '<div class="brief"><p class="why">' + html(brief.verdict) + '</p>' + coverage + contestLine + demand
        + (rivals.length
          ? '<h3>What the models credited, in their own words</h3>'
            + '<p class="evidence-note">This is the standard this question is answered against. A model repeats what its sources say about a product, so these lines are the claims you would have to be credited with, somewhere it reads.</p>'
            + rivals.map(briefVoice).join("")
          : '')
        + (you && you.quotes.length ? '<h3>What they said about you</h3>' + briefVoice(you) : '')
        + sources + '</div>';
    }

    async function loadOutreach() {
      if (!state.selectedId || state.outreachState === "loading") return;
      state.outreachState = "loading";
      const startedFor = state.selectedId;
      await loadForProject(startedFor, () => state.selectedId, () => request("/api/projects/" + encodeURIComponent(startedFor) + "/source-pages"),
        (value) => { state.outreach = value; state.outreachState = "ready"; }, () => { state.outreachState = "error"; });
      render();
    }

    // Cited is not used. One engine cites twice as many pages as another and
    // takes a fifth as much from them, so the count is not the finding.
    async function loadUptake() {
      if (!state.selectedId || state.uptakeState === "loading") return;
      state.uptakeState = "loading";
      const startedFor = state.selectedId;
      await loadForProject(startedFor, () => state.selectedId, () => request("/api/projects/" + encodeURIComponent(startedFor) + "/source-uptake"),
        (value) => { state.uptake = value; state.uptakeState = "ready"; }, () => { state.uptakeState = "error"; });
      render();
    }


    // Shapes, not findings. A rewrite aimed at being cited stays factually
    // consistent with the original, so nothing that checks facts catches one.
    async function loadInterference() {
      if (!state.selectedId || state.interferenceState === "loading") return;
      state.interferenceState = "loading";
      const startedFor = state.selectedId;
      await loadForProject(startedFor, () => state.selectedId, () => request("/api/projects/" + encodeURIComponent(startedFor) + "/source-interference"),
        (value) => { state.interference = value; state.interferenceState = "ready"; }, () => { state.interferenceState = "error"; });
      render();
    }

    // Who supplies the answers in this category. A few domains holding most of
    // it makes getting onto them the whole game; a long tail means a new page
    // can still get in.
    async function loadConcentration() {
      if (!state.selectedId || state.concentrationState === "loading") return;
      state.concentrationState = "loading";
      const startedFor = state.selectedId;
      await loadForProject(startedFor, () => state.selectedId, () => request("/api/projects/" + encodeURIComponent(startedFor) + "/source-concentration"),
        (value) => { state.concentration = value; state.concentrationState = "ready"; }, () => { state.concentrationState = "error"; });
      render();
    }

    // Presentation moves citation credit between pages making the same claim,
    // and the gain comes out of somebody else rather than out of nowhere.
    async function loadShape() {
      if (!state.selectedId || state.shapeState === "loading") return;
      state.shapeState = "loading";
      const startedFor = state.selectedId;
      await loadForProject(startedFor, () => state.selectedId, () => request("/api/projects/" + encodeURIComponent(startedFor) + "/source-shape"),
        (value) => { state.shape = value; state.shapeState = "ready"; }, () => { state.shapeState = "error"; });
      render();
    }

    // Every figure here rests on a model classifying what another model wrote,
    // and nothing asked a person whether it got it right until this.
    async function loadCheck() {
      if (!state.selectedId || state.checkState === "loading") return;
      state.checkState = "loading";
      const startedFor = state.selectedId;
      await loadForProject(startedFor, () => state.selectedId, () => request("/api/projects/" + encodeURIComponent(startedFor) + "/human-check"),
        (value) => { state.check = value; state.checkState = "ready"; }, () => { state.checkState = "error"; });
      render();
    }

    async function recordVerdict(control: Element) {
      const id = control.getAttribute("data-verdict-id") || "";
      const field = control.getAttribute("data-verdict-field") || "";
      const agreed = control.getAttribute("data-verdict-agreed") === "true";
      const correction = control.getAttribute("data-verdict-correction") || "";
      const startedFor = state.selectedId;
      try {
        const checked = await request("/api/projects/" + encodeURIComponent(startedFor) + "/human-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, field, agreed, correction }),
        });
        if (!isOpen(startedFor, state.selectedId)) return;
        state.check = checked;
        state.checkState = "ready";
      } catch (error) {
        if (!isOpen(startedFor, state.selectedId)) return;
        state.promptNotice = { text: error && (error as any).message ? (error as any).message : String(error), kind: "error" };
      }
      render();
    }

    // Where a page was credited against how much of the answer it accounts for.
    // A gap is consistent with credit going somewhere other than the content.
    async function loadCredit() {
      if (!state.selectedId || state.creditState === "loading") return;
      state.creditState = "loading";
      const startedFor = state.selectedId;
      await loadForProject(startedFor, () => state.selectedId, () => request("/api/projects/" + encodeURIComponent(startedFor) + "/source-credit"),
        (value) => { state.credit = value; state.creditState = "ready"; }, () => { state.creditState = "error"; });
      render();
    }

    // The ranked best-of listicle was the most cited format in published work,
    // at about a fifth of all citations, and four in five went to a company's
    // own site. Both are worth knowing against what wins here.
    async function loadKinds() {
      if (!state.selectedId || state.kindsState === "loading") return;
      state.kindsState = "loading";
      const startedFor = state.selectedId;
      await loadForProject(startedFor, () => state.selectedId, () => request("/api/projects/" + encodeURIComponent(startedFor) + "/source-kinds"),
        (value) => { state.kinds = value; state.kindsState = "ready"; }, () => { state.kindsState = "error"; });
      render();
    }

    async function harvestPages(refresh?: boolean) {
      if (!state.selectedId || busy.has(state.selectedId, "harvest")) return;
      const startedFor = state.selectedId;
      try {
        busy.start(startedFor, "harvest");
        syncBusy();
        render();
        const where = "/api/projects/" + encodeURIComponent(startedFor) + "/source-pages" + (refresh ? "?refresh=true" : "");
        const result = await request(where, { method:"POST" });
        if (isOpen(startedFor, state.selectedId)) {
          state.outreach = result.plan;
          state.outreachState = "ready";
          state.promptNotice = { text: result.read + " page(s) read, " + result.skipped + " already read or over the cap, " + result.failed + " would not load.", kind:"success" };
          state.uptakeState = "idle";
          state.interferenceState = "idle";
          state.creditState = "idle";
          state.shapeState = "idle";
          state.kindsState = "idle";
        }
      } catch (error) {
        if (isOpen(startedFor, state.selectedId)) state.promptNotice = { text: error && (error as any).message ? (error as any).message : String(error), kind:"error" };
      } finally {
        busy.end(startedFor, "harvest");
        syncBusy();
      }
      render();
    }

    async function loadSearchDemand() {
      if (!state.selectedId || state.searchDemandState === "loading") return;
      state.searchDemandState = "loading";
      const startedFor = state.selectedId;
      await loadForProject(startedFor, () => state.selectedId, () => request("/api/projects/" + encodeURIComponent(startedFor) + "/search-demand"),
        (value) => { state.searchDemand = value; state.searchDemandState = "ready"; }, () => { state.searchDemandState = "error"; });
      render();
    }

    async function pullSearchDemand() {
      if (!state.selectedId || busy.has(state.selectedId, "search-pull")) return;
      const startedFor = state.selectedId;
      try {
        busy.start(startedFor, "search-pull");
        syncBusy();
        render();
        const result = await request("/api/projects/" + encodeURIComponent(startedFor) + "/search-demand", { method:"POST", headers:{"Content-Type":"application/json"}, body:"{}" });
        const settled = settlePull(startedFor, state.selectedId, state.searchDemand, result.report);
        if (settled.next) { state.searchDemand = settled.next; state.searchDemandState = "ready"; }
        if (settled.sameProject) state.promptNotice = { text: result.report.queries + " query row(s) read from Search Console.", kind:"success" };
      } catch (error) {
        if (isOpen(startedFor, state.selectedId)) state.promptNotice = { text: error && (error as any).message ? (error as any).message : String(error), kind:"error" };
      } finally {
        busy.end(startedFor, "search-pull");
        syncBusy();
      }
      render();
    }

    async function loadPersonas() {
      if (!state.selectedId || state.personasState === "loading") return;
      state.personasState = "loading";
      const startedFor = state.selectedId;
      await loadForProject(startedFor, () => state.selectedId, () => request("/api/projects/" + encodeURIComponent(startedFor) + "/personas"),
        (value) => { state.personas = value; state.personasState = "ready"; }, () => { state.personasState = "error"; });
      render();
    }

    async function personaAction(path: string, body: Payload, done: string) {
      const startedFor = state.selectedId;
      await postPrompts(path, body, "saving", done);
      if (!isOpen(startedFor, state.selectedId)) return;
      state.personasState = "idle";
      loadPersonas();
    }

    async function loadReferrals() {
      if (!state.selectedId || state.referralsState === "loading") return;
      state.referralsState = "loading";
      const startedFor = state.selectedId;
      await loadForProject(startedFor, () => state.selectedId, () => request("/api/projects/" + encodeURIComponent(startedFor) + "/assistant-referrals"),
        (value) => { state.referrals = value; state.referralsState = "ready"; }, () => { state.referralsState = "error"; });
      render();
    }

    async function pullReferrals() {
      if (!state.selectedId || busy.has(state.selectedId, "referrals-pull")) return;
      const startedFor = state.selectedId;
      try {
        busy.start(startedFor, "referrals-pull");
        syncBusy();
        render();
        const result = await request("/api/projects/" + encodeURIComponent(startedFor) + "/assistant-referrals", { method:"POST", headers:{"Content-Type":"application/json"}, body:"{}" });
        const settled = settlePull(startedFor, state.selectedId, state.referrals, result.report);
        if (settled.next) state.referrals = settled.next;
        if (settled.sameProject) state.promptNotice = { text:"Analytics read.", kind:"success" };
      } catch (error) {
        if (isOpen(startedFor, state.selectedId)) state.promptNotice = { text: error && (error as any).message ? (error as any).message : String(error), kind:"error" };
      } finally {
        busy.end(startedFor, "referrals-pull");
        syncBusy();
      }
      render();
    }

    function renderRunPane() {
      return '<div class="panel-scrim" data-close-panel></div><aside class="panel" role="dialog" aria-label="Live run">'
        + '<div class="panel-head"><div><h2>' + (runIsLive(currentPaneRun()) ? "Live run" : "Finished run") + '</h2>'
        + '<p class="subtle">What went to each model and what came back, newest first.</p>'
        + '<div class="runpane-progress">' + runPaneProgress(currentPaneRun()) + '</div></div>'
        + '<div class="panel-actions">'
        + (runIsLive(currentPaneRun()) && state.liveRun && state.liveRun.status !== "cancelling" ? button({ label: "Stop", tone: "danger", on: { "data-stop-run": true } }) : '')
        + '<button type="button" class="close" data-close-panel aria-label="Close">×</button></div></div>'
        + '<div class="panel-body">' + runFeedBody() + '</div></aside>';
    }

    function renderEvidence() {
      if (!state.panel) return '<div class="panel-scrim" data-close-panel></div><aside class="panel" aria-hidden="true"></aside>';
      if (state.panel.kind === "run") return renderRunPane();
      if (state.panel.kind === "panel") {
        return '<div class="panel-scrim" data-close-panel></div><aside class="panel is-wide-panel" role="dialog" aria-label="' + html(state.panel.title) + '">'
          + '<div class="panel-head"><div><h2>' + html(state.panel.title) + '</h2><p class="subtle">' + html(String(state.panel.blurb || "")) + '</p></div>'
          + '<div class="panel-actions">'
          + '<input type="search" class="panel-search" data-panel-search placeholder="Search this panel" aria-label="Search this panel">'
          + '<span class="panel-filter-note subtle" data-panel-filter-note aria-live="polite"></span>'
          + button({ label: "Export CSV", kind: "quiet", on: { "data-panel-export": true } })
          + button({ label: "Close", kind: "quiet", on: { "data-close-panel": true } }) + '</div></div>'
          + '<div class="panel-body">' + String(state.panel.body || "") + '</div></aside>';
      }
      const body = state.panelState === "loading"
        ? loading("the archived answers", skeletonText(4) + skeletonText(3))
        : state.panelState === "error"
          ? '<p class="subtle">Could not read the answers for this question.</p>'
          : !state.panelAnswers.length
            ? '<p class="subtle">' + (state.panel.kind === "brand" ? "No archived answer names this brand that way." : "No answer has been archived for this question yet.") + '</p>'
            : state.panelAnswers.map((answer) => {
                const target = (answer.mentions || []).find((row) => row.isTarget);
                const badge = answer.status !== "completed"
                  ? '<span class="pill bad">' + html(answer.status.split("_").join(" ")) + '</span>'
                  : target
                    ? '<span class="pill good">named you · ' + html(target.recommendation) + '</span>'
                    : '<span class="pill flat">did not name you</span>';
                const sources = (answer.citationUrls || []).length
                  ? '<div class="evidence-foot">' + answer.citationUrls.slice(0, 8).map((url) => '<a href="' + html(url) + '" target="_blank" rel="noreferrer">' + html(url) + '</a>').join("") + '</div>'
                  : '<div class="evidence-foot">This answer cited no sources.</div>';
                return '<article class="evidence"><div class="evidence-head"><strong>' + html(answer.modelDisplayName) + '</strong>'
                  + badge
                  + '<span>' + html(labelFor(state.regions, answer.regionId, "No stated market")) + ' · ' + html(labelFor(state.languages, answer.languageId, "English")) + '</span>'
                  + '<span class="spacer"></span><span>' + html((answer.createdAt || "").slice(0, 16).replace("T", " ")) + '</span></div>'
                  // An answer without the question it answered is not evidence
                  // of anything. The prompt pane is already headed by its own.
                  + (state.panel && state.panel.kind !== "evidence" && answer.promptText
                    ? '<p class="evidence-asked"><span>Asked</span>' + html(String(answer.promptText)) + '</p>'
                    : '')
                  + '<div class="evidence-text">' + (answer.text ? markMentions(answer.text, answer.mentions) + (answer.errorMessage ? '' : '') : html(answer.errorMessage || "This answer returned no text.")) + '</div>'
                  + sources + '</article>';
              }).join("");
      return '<div class="panel-scrim" data-close-panel></div><aside class="panel" role="dialog" aria-label="Archived answers">'
        + '<div class="panel-head"><div><h2>' + html(state.panel.title) + '</h2><p class="subtle">'
        + (state.panel.kind === "brand"
          ? 'Every archived answer that named this brand. The figures on the dashboard are counts of these.'
          : 'What the models rewarded here, and every archived answer behind it.') + '</p></div>'
        + '<div class="panel-actions">'
        + (state.brief ? '<a class="button" href="/api/projects/' + html(state.selectedId) + '/prompt-brief.md?promptId=' + encodeURIComponent(state.panel.promptId) + '" download>Take the brief</a>' : '')
        + '<button type="button" class="close" data-close-panel aria-label="Close">×</button></div></div>'
        + '<div class="panel-body">' + renderBrief() + '<h3 class="panel-section">The answers themselves</h3>' + body + '</div></aside>';
    }

    /** The corpus report, which is absent until one has been built. A 404 here
     * is a configuration answer and carries the corpora it could be built from. */
    async function loadDemand() {
      const selected = project();
      if (!selected || state.demandState === "loading") return;
      state.demandState = "loading";
      await loadForProject(selected.id, () => state.selectedId, () => request("/api/projects/" + encodeURIComponent(selected.id) + "/prompt-demand"),
        (value) => { state.demand = value; state.demandState = "ready"; }, () => { state.demand = null; state.demandState = "error"; });
      render();
    }

    async function loadHistory() {
      if (!state.selectedId || state.historyState === "loading") return;
      state.historyState = "loading";
      const startedFor = state.selectedId;
      await loadForProject(startedFor, () => state.selectedId, () => request("/api/projects/" + encodeURIComponent(startedFor) + "/source-history"),
        (value) => { state.history = value; state.historyState = "ready"; }, () => { state.historyState = "error"; });
      render();
    }

    async function setTier(value: string) {
      const selected = project();
      if (!selected) return;
      try {
        await request("/api/projects/" + encodeURIComponent(selected.id), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ primaryDomain: selected.primaryDomain || selected.normalizedDomain, tier: value }),
        });
        await refreshProjects();
        if (!isOpen(selected.id, state.selectedId)) return;
        state.answerEngineState = "idle";
        loadAnswerEngine();
      } catch (error) {
        if (!isOpen(selected.id, state.selectedId)) return;
        state.promptNotice = { text: error && (error as any).message ? (error as any).message : String(error), kind: "error" };
      }
      render();
    }

    // Everything else here is an observation. This is the only thing that can
    // say a change did something, and only because a control absorbs whatever
    // moved for reasons that were not the change.
    async function loadExperiments() {
      if (!state.selectedId || state.experimentsState === "loading") return;
      state.experimentsState = "loading";
      const startedFor = state.selectedId;
      await loadForProject(startedFor, () => state.selectedId, () => request("/api/projects/" + encodeURIComponent(startedFor) + "/experiments"),
        (value) => { state.experiments = value; state.experimentsState = "ready"; }, () => { state.experimentsState = "error"; });
      render();
    }

    async function startExperiment() {
      const selected = state.promptSelection.slice();
      if (!selected.length) {
        state.promptNotice = { text: "Select the questions the change is expected to move on the Prompts page first. Everything else already being asked becomes the control.", kind: "warning" };
        render();
        return;
      }
      const name = window.prompt("Name this experiment.");
      if (!name || !name.trim()) return;
      const changed = window.prompt("What did you change? Write it down now, so it can be checked later.") || "";
      const startedFor = state.selectedId;
      try {
        const started = await request("/api/projects/" + encodeURIComponent(startedFor) + "/experiments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            hypothesis: "",
            changed,
            // Only what the change was aimed at. The control is derived from
            // everything else with a baseline, not from where this list splits.
            treatedPromptIds: selected,
          }),
        });
        if (!isOpen(startedFor, state.selectedId)) return;
        state.experiments = started;
        state.experimentsState = "ready";
        state.promptNotice = { text: "Experiment started. Run the questions again and the comparison fills.", kind: "success" };
      } catch (error) {
        if (!isOpen(startedFor, state.selectedId)) return;
        state.promptNotice = { text: error && (error as any).message ? (error as any).message : String(error), kind: "error" };
      }
      render();
    }

    async function stopExperiment(id: string) {
      const startedFor = state.selectedId;
      try {
        const stopped = await request("/api/projects/" + encodeURIComponent(startedFor) + "/experiments/" + encodeURIComponent(id) + "/stop", { method: "POST" });
        if (!isOpen(startedFor, state.selectedId)) return;
        state.experiments = stopped;
        state.experimentsState = "ready";
      } catch (error) {
        if (!isOpen(startedFor, state.selectedId)) return;
        state.promptNotice = { text: error && (error as any).message ? (error as any).message : String(error), kind: "error" };
      }
      render();
    }

    // Cards nested inside a card, none of which could fold. Each is a card of
    // its own now, on the module that already knows how to fold one.
    function foldCard(id: string, title: string, blurb: string, body: string, aside = "") {
      return section({ id, title, blurb, body, aside, wide: true, folded: state.panelOpen.indexOf(id) < 0 });
    }

    // The comparison had no way to be fed from the product at all: it shipped
    // with the measurement and without a door into it.
    async function suggestWordings(control: Element) {
      const promptId = control.getAttribute("data-reword-prompt") || "";
      const startedFor = state.selectedId;
      await runAction(control, { loading: "Asking\u2026", success: "Added", error: "Failed" }, async () => {
        const result = await request("/api/projects/" + encodeURIComponent(startedFor) + "/prompts/suggest-wordings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promptId, count: 3 }),
        });
        if (!isOpen(startedFor, state.selectedId)) return;
        state.topicSet = result.set || result;
        state.promptNotice = result.added === undefined
          ? { text: "Wordings added.", kind: "success" }
          : { text: result.added + " wording(s) added, " + result.skipped + " skipped as blank or already there.", kind: result.added ? "success" : "warning" };
        render();
      }).catch(() => {
        if (!isOpen(startedFor, state.selectedId)) return;
        state.promptNotice = { text: "Could not get rewordings. The model that writes them needs to be reachable.", kind: "error" };
        render();
      });
    }

    async function addWordingByHand(promptId: string, text: string) {
      if (!text.trim()) return;
      const startedFor = state.selectedId;
      try {
        const result = await request("/api/projects/" + encodeURIComponent(startedFor) + "/prompts/wordings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promptId, texts: [text] }),
        });
        if (!isOpen(startedFor, state.selectedId)) return;
        state.topicSet = result.set || result;
        state.promptNotice = { text: result.added ? "Wording added." : "That wording is already there.", kind: result.added ? "success" : "warning" };
      } catch (error) {
        if (!isOpen(startedFor, state.selectedId)) return;
        state.promptNotice = { text: error && (error as any).message ? (error as any).message : String(error), kind: "error" };
      }
      render();
    }

    // Declared the same way a rival is, so it retires and resolves like one,
    // and every count that means rival leaves it out.
    async function addDecoy(name: string) {
      const startedFor = state.selectedId;
      try {
        await request("/api/projects/" + encodeURIComponent(startedFor) + "/competitors/decoy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (!isOpen(startedFor, state.selectedId)) return;
        state.answerEngineState = "idle";
        state.rivalsState = "idle";
        state.promptNotice = { text: "Decoy added. The next read of the answers reports how often it turns up.", kind: "success" };
        loadAnswerEngine();
      } catch (error) {
        if (!isOpen(startedFor, state.selectedId)) return;
        state.promptNotice = { text: error && (error as any).message ? (error as any).message : String(error), kind: "error" };
      }
      render();
    }

    async function loadPriority() {
      if (!state.selectedId || state.priorityState === "loading") return;
      state.priorityState = "loading";
      const startedFor = state.selectedId;
      await loadForProject(startedFor, () => state.selectedId, () => request("/api/projects/" + encodeURIComponent(startedFor) + "/question-priority"),
        (value) => { state.priority = value; state.priorityState = "ready"; }, () => { state.priorityState = "error"; });
      render();
    }

    function refreshPromptResults() {
      const list = document.querySelector(".prompt-results");
      if (!list || state.page !== "prompts" || state.topicState !== "ready") { render(); return; }
      const set = state.topicSet || { topics: [], prompts: [] };
      const standings = promptStandings(state.answerEngine);
      const rows = filteredPrompts(state, set, standings);
      list.innerHTML = renderPromptGroups(state, set, rows, standings, topicStandings(state.answerEngine));
      const summary = document.querySelector(".prompt-result-summary");
      if (summary) summary.textContent = promptResultSummary(rows.length, livePrompts(set).length);
      // The toolbar is not re-rendered on a filter, so the button that acts on
      // the rows has to be told when there are none to act on.
      const bulk = document.querySelector(".prompt-bulk");
      if (bulk) bulk.innerHTML = promptBulkInner(state);
    }

    /** The first paint, before any read has landed. The page's own name is
     * known without asking, so only the figures and the table are shadows. */
    function bootShape() {
      return '<section class="view"><div class="heading"><div><h1>' + html(DESTINATIONS.find((row) => row.page === state.page || (row.also || []).includes(state.page))?.label || CONFIG.productName) + '</h1></div></div>'
        + loading("this page", skeletonTiles(4) + skeletonCard({ rows: 5 })) + '</section>';
    }

    // Repaints the rows alone. The whole page is 70KB of markup, so re-rendering
    // it per keystroke is felt; this needs .model-list to wrap only the rows.
    function refreshCatalogSearchResults() { const list = document.querySelector(".model-list"); const summary = document.querySelector(".catalog-result-summary"); if (!list || !summary || state.catalogState !== "ready") { render(); return; } const results = filteredCatalogModels(state); summary.textContent = catalogResultSummary(results.length); list.innerHTML = results.length === 0 ? '<p class="subtle">No matching models.</p>' : renderCatalogModelRows(results, state); }
    async function loadEngines() {
      if (!state.selectedId || state.enginesState === "loading") return;
      state.enginesState = "loading";
      const startedFor = state.selectedId;
      await loadForProject(startedFor, () => state.selectedId, () => request("/api/projects/" + encodeURIComponent(startedFor) + "/engines"),
        (value) => { state.engines = value; state.enginesState = "ready"; }, () => { state.enginesState = "error"; });
      render();
    }

    // Asked for by name, because reaching into a signed-in browser is not
    // something opening a settings page should do on the reader's behalf.
    async function probeEngines(button: any) {
      if (!state.selectedId) return;
      const startedFor = state.selectedId;
      try {
        const found = await runAction(button, { loading: "Looking\u2026", success: "Found", error: "Not found" },
          () => request("/api/projects/" + encodeURIComponent(startedFor) + "/engines?probe=true"));
        if (!isOpen(startedFor, state.selectedId)) return;
        state.engines = found;
        state.enginesState = "ready";
      } catch (error) {
        if (!isOpen(startedFor, state.selectedId)) return;
        state.modelNotice = { text: error instanceof Error ? error.message : String(error), kind: "error" };
      }
      render();
    }

    async function saveEngines(engineIds: any) {
      if (!state.selectedId) return;
      const startedFor = state.selectedId;
      try {
        const saved = await request("/api/projects/" + encodeURIComponent(startedFor) + "/engines", {
          method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ engineIds: engineIds }),
        });
        if (!isOpen(startedFor, state.selectedId)) return;
        state.engines = saved;
        state.enginesState = "ready";
      } catch (error) {
        if (!isOpen(startedFor, state.selectedId)) return;
        state.enginesState = "error";
      }
      render();
    }

    // Which surfaces this browser can drive, asked before a run rather than
    // discovered by spending one. It loads each once and asks none of them.
    async function probeReachNow(button: any) {
      if (!state.selectedId) return;
      const startedFor = state.selectedId;
      state.reachState = "loading";
      render();
      try {
        const reached = await request("/api/projects/" + encodeURIComponent(startedFor) + "/engine-reach");
        if (isOpen(startedFor, state.selectedId)) { state.reach = reached; state.reachState = "ready"; }
      } catch (error) {
        if (isOpen(startedFor, state.selectedId)) {
          state.reachState = "error";
          state.modelNotice = { text: error && (error as any).message ? (error as any).message : String(error), kind: "error" };
        }
      }
      restoreButton(button);
      render();
    }

    const brandMark = CONFIG.brandMark;
    const brandLockup = CONFIG.brandLockup;
    function phase2RenderImpl() { if (window.__citegeoPhase5Active) return; const selected = project(); const options = state.currentProjects.length ? state.currentProjects.map((item) => '<option value="' + html(item.id) + '">' + html(item.name) + ' · ' + html(item.normalizedDomain) + '</option>').join("") : '<option value="">No projects yet</option>'; let view = state.booting ? bootShape() : state.page === "marketer" ? renderMarketer() : state.page === "drafts" ? renderDrafts() : state.page === "claims" ? renderClaims() : state.page === "buying" ? renderBuying() : state.page === "conversations" ? renderConversations() : state.page === "entity" ? renderEntity() : state.page === "reports" ? renderReport() : state.page === "models" ? renderModels(state, project(), monitoringConfiguration(), machineTabs, modelsActions) : state.page === "configuration" ? renderConfiguration(state, project(), monitoringConfiguration(), machineTabs) : state.page === "setup" ? renderSetup(state, project(), setupActions) : state.page === "visibility" ? renderVisibility() : state.page === "brand-visibility" ? renderBrandVisibility(state, project(), currentTasks(), runActionButton, brandVisibilityActions) : state.page === "trust" ? renderTrustPage(state, project(), currentTasks(), runActionButton, foldCard, renderScoreBreakdown, trustPageActions) : state.page === "prompts" ? renderPrompts(state, project(), runActionButton, promptPageActions) : state.page === "answer-engine" ? renderAnswerEngine(state, project(), currentTasks(), runActionButton, foldCard, sourcesActions) : state.page === "dashboard" ? renderHome(state, project(), currentTasks(), runActionButton, homeActions) : renderOverview(state, project(), monitoringConfiguration().currentVersion); app.innerHTML = renderEvidence() + '<div class="shell">' + navScrim() + '<aside class="sidebar"><button type="button" class="brand" data-page="dashboard" aria-label="Back to the dashboard">' + brandLockup + '</button><div class="project-label">Project</div><select id="project-select" class="project-select" aria-label="Switch project" data-testid="project-select">' + options + '</select>' + sidebar({ page: state.page, options }) + '<div class="sidebar-bottom">Domain recognition</div></aside><main class="workspace"><header class="topbar"><div class="topbar-lead">' + navToggle() + '<div class="crumb"><button type="button" class="crumb-home" data-page="dashboard">' + html(CONFIG.productName) + '</button> / ' + html(selected ? selected.name : "Project") + '</div></div><div class="topbar-actions"><button type="button" class="theme-toggle" data-theme-toggle aria-label="Switch between light and dark">&#9681;</button>' + button({ label: "New project", id: "new-project", testId: "new-project" }) + '</div></header><section class="content">' + view + '</section>' + renderFooter(state, footerActions) + '</main></div>'; const select = element("project-select"); select.value = state.selectedId; document.title = selected ? selected.name + " | " + CONFIG.productTitle + "" : "" + CONFIG.productTitle + ""; }
    async function setPage(page: any) { clearToasts(); state.page = page; savePreference("page", page); if (page === "configuration") { await refreshConfiguration(); return; } if (page === "reports" && window.__citegeoPhase4 && typeof window.__citegeoPhase4.open === "function") { await window.__citegeoPhase4.open(); return; } render(); if (page === "models") { await refreshConfiguration(); await loadCatalog(); } }
    async function createDraft(event: any) { event.preventDefault(); const control = element("save-draft"); const session = state.drawerSession; setFormStatus("Creating project draft", "loading"); try { const response = await runAction(control, { loading:"Saving…", success:"Saved", error:"Save failed" }, () => request("/api/projects", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ domain:element("project-domain").value, name:element("project-name").value }) })); state.mode = "current"; state.page = "overview"; setSelectedProject(response.project.id); await refreshProjects(); state.selections = []; state.baselines = []; resetDraftSelections(); setFormStatus("Draft saved", "success"); render(); window.setTimeout(() => { if (state.drawerSession === session) closeDrawer(); }, 850); } catch (error) { setFormStatus(error instanceof Error ? error.message : String(error), "error"); } }
    async function saveProject(event: any) { event.preventDefault(); const selected = project(); if (!selected) return; const control = event.currentTarget.querySelector('button[type="submit"]'); try { await runAction(control, { loading:"Saving…", success:"Saved", error:"Save failed" }, () => request("/api/projects/" + encodeURIComponent(selected.id), { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ domain:element("edit-domain").value, name:element("edit-name").value }) })); await refreshProjects(); render(); } catch (error) { toast({ text: error instanceof Error ? error.message : String(error), kind: "error" }); } }
    async function projectAction(action: string, projectId: string, button: HTMLElement | null) { if (action === "select") { setSelectedProject(projectId); state.selectionsDirty = false; await refreshConfiguration(); loadLiveRun(); render(); return; } if (action === "delete" && !window.confirm("The project will be removed from the current list.")) return; if (action === "purge" && !window.confirm("A permanent purge cannot be undone.")) return; const path = "/api/projects/" + encodeURIComponent(projectId) + (action === "archive" ? "/archive" : action === "restore" ? "/restore" : action === "purge" ? "/purge" : ""); const method = action === "delete" || action === "purge" ? "DELETE" : "POST"; const labels = action === "archive" ? { loading:"Archiving…", success:"Archived", error:"Archive failed" } : action === "restore" ? { loading:"Restoring…", success:"Restored", error:"Restore failed" } : action === "purge" ? { loading:"Purging…", success:"Purged", error:"Purge failed" } : { loading:"Deleting…", success:"Deleted", error:"Delete failed" }; try { await runAction(button, labels, () => request(path, { method })); if (state.selectedId === projectId && (action === "archive" || action === "delete" || action === "purge")) setSelectedProject(""); if (action === "restore") { state.mode = "current"; setSelectedProject(projectId); } await refreshProjects(); await refreshConfiguration(); render(); } catch (error) { toast({ text: error instanceof Error ? error.message : String(error), kind: "error" }); } }
    function changeModel(modelId: any, checked: any) { const catalogItem = state.catalog.find((item) => item.modelId === modelId); if (!catalogItem) return; if (!checked) state.draftSelections.delete(modelId); else state.draftSelections.set(modelId, "off"); state.modelNotice = { text:"", kind:"" }; state.modelActionState = "idle"; state.selectionsDirty = true; render(); }
    /** Clears a selection the catalogue no longer offers. changeModel refuses
     * one, so without this the save stays rejected with no way to fix it. */
    function dropSelection(modelId: any) { state.draftSelections.delete(modelId); state.modelNotice = { text:"", kind:"" }; state.modelActionState = "idle"; state.selectionsDirty = true; render(); }
    function changeModelMode(modelId: any, mode: any) { const catalogItem = state.catalog.find((item) => item.modelId === modelId); if (!catalogItem || !state.draftSelections.has(modelId)) return; if (mode === "provider_native" && !catalogItem.nativeWebSearchSupported) return; state.modelNotice = { text:"", kind:"" }; state.modelActionState = "idle"; state.draftSelections.set(modelId, mode); state.selectionsDirty = true; render(); }
    async function saveModels(button: HTMLElement | null) { const selected = project(); if (!selected) return; const selections = Array.from(state.draftSelections.entries()).map(([modelId, webSearchMode]) => ({ modelId, webSearchMode })); state.modelNotice = { text:"Saving each model's own web search mode…", kind:"loading" }; const startedFor = selected.id; try { const response = await runAction(button, { loading:"Saving…", success:"Saved", error:"Save failed" }, () => request("/api/projects/" + encodeURIComponent(selected.id) + "/models", { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ selections }) })); if (!isOpen(startedFor, state.selectedId)) return; state.selections = response.selections; resetDraftSelections(); state.modelNotice = { text:"Model configuration saved", kind:"success" }; state.modelActionState = "success"; render(); window.setTimeout(() => { state.modelActionState = "idle"; if (state.page === "models") render(); }, 850); } catch (error) { if (!isOpen(startedFor, state.selectedId)) return; state.modelNotice = { text:error instanceof Error ? error.message : String(error), kind:"error" }; state.modelActionState = "error"; render(); } }
    async function saveMonitoringConfiguration() {
      const selected = project();
      const configuration = monitoringConfiguration();
      if (!selected || configuration.status === "unchanged" || busy.has(selected.id, "config-save")) return;
      if (selectedRows(state.catalog, state.selections, state.draftSelections, state.catalogState).length === 0) {
        state.monitoringNotice = { text: "Select at least one available model before saving the configuration.", kind: "error" };
        state.monitoringSaveState = "failed";
        render();
        return;
      }
      const startedFor = selected.id;
      try {
        busy.start(startedFor, "config-save");
        syncBusy();
        state.monitoringNotice = { text: "Saving the current domain, language, models and web search modes…", kind: "loading" };
        render();
        const response = await request("/api/projects/" + encodeURIComponent(startedFor) + "/baselines", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        state.currentProjects = state.currentProjects.map((item) => item.id === response.project.id ? response.project : item);
        state.projects = state.projects.map((item) => item.id === response.project.id ? response.project : item);
        if (!isOpen(startedFor, state.selectedId)) return;
        await refreshConfiguration();
        if (!isOpen(startedFor, state.selectedId)) return;
        state.monitoringSaveState = "saved";
        state.monitoringNotice = { text: "Saved as config v" + response.baseline.version, kind: "success" };
        window.setTimeout(() => { state.monitoringSaveState = "idle"; syncBusy(); if (state.page === "configuration") render(); }, 850);
      } catch (error) {
        if (!isOpen(startedFor, state.selectedId)) return;
        if (errorCode(error) === "baseline_unchanged") {
          await refreshConfiguration();
          if (!isOpen(startedFor, state.selectedId)) return;
          state.monitoringSaveState = "idle";
          state.monitoringNotice = { text: "The current configuration is already saved", kind: "success" };
          return;
        }
        state.monitoringSaveState = "failed";
        state.monitoringNotice = { text: error instanceof Error ? error.message : (expectedErrorText.request_failed || "The request failed."), kind: "error" };
      } finally {
        busy.end(startedFor, "config-save");
        syncBusy();
        render();
      }
    }
    document.addEventListener("click", async (event) => {
      const clicked = el(event.target) as any;
      if (!clicked || !clicked.closest) return;
      if (clicked.closest("[data-generate-prompts]")) { if (busy.has(state.selectedId, "prompt:generating")) return; await postPrompts("/topics/generate", {}, "generating", "A set has been proposed. Read it, then track the questions worth tracking."); return; }
      const retrying = clicked.closest("[data-retry-run]");
      if (retrying) { loadLiveRun(); await postPrompts("/prompt-runs", { retryOf: retrying.getAttribute("data-retry-run") }, "running", "Asking again. Watch it below, or leave the page and come back."); loadLiveRun(); return; }
      if (clicked.closest("[data-run-prompts]")) { loadLiveRun(); await postPrompts("/prompt-runs", { repetitions: state.repetitions, languageIds: [state.runLanguageId] }, "running", "The run has started. Watch it below, or leave the page and come back."); loadLiveRun(); return; }
      const activate = clicked.closest("[data-activate-prompt]");
      if (activate) { await postPrompts("/prompts/activate", { promptIds:[activate.getAttribute("data-activate-prompt")] }, "saving", "Now tracked."); return; }
      const retire = clicked.closest("[data-retire-prompt]");
      if (retire) { await postPrompts("/prompts/retire", { promptIds:[retire.getAttribute("data-retire-prompt")] }, "saving", "No longer tracked. Past answers are kept."); return; }
      if (clicked.closest("[data-prompt-review]")) { state.promptFilters.status = "proposed"; render(); return; }
      const intentChip = clicked.closest("[data-prompt-intent]");
      if (intentChip) {
        const picked = intentChip.getAttribute("data-prompt-intent");
        state.promptFilters.intent = state.promptFilters.intent === picked ? "" : picked;
        render();
        return;
      }
      if (clicked.closest("[data-bulk-clear]")) { state.promptSelection = []; refreshPromptResults(); return; }
      if (clicked.closest("[data-bulk-activate]")) { await bulkPrompts("activate"); return; }
      if (clicked.closest("[data-bulk-retire]")) { await bulkPrompts("retire"); return; }
      if (clicked.closest("[data-bulk-run]")) { await bulkRun(); return; }
      const activateTopic = clicked.closest("[data-activate-topic]");
      if (activateTopic) {
        const topicId = activateTopic.getAttribute("data-activate-topic");
        const set = state.topicSet || { topics: [], prompts: [] };
        // Only what the filters are showing: the count on the button is the
        // list under it, not everything the topic happens to hold.
        const ids = filteredPrompts(state, set, promptStandings(state.answerEngine))
          .filter((prompt) => prompt.topicId === topicId && prompt.status === "proposed")
          .map((prompt) => prompt.id);
        if (!ids.length) return;
        await postPrompts("/prompts/activate", { promptIds: ids }, "saving", ids.length + " question(s) now tracked.");
      }
    });

    document.addEventListener("change", (event) => {
      const box = el(event.target) ? (el(event.target) as any).closest("[data-prompt-checkbox]") : null;
      if (box) {
        const id = box.getAttribute("data-prompt-checkbox");
        const at = state.promptSelection.indexOf(id);
        if (at >= 0) state.promptSelection.splice(at, 1);
        else state.promptSelection.push(id);
        const bar = document.querySelector(".prompt-bulk");
        if (bar) bar.innerHTML = promptBulkInner(state);
        else render();
        return;
      }
      const engineBox = el(event.target) ? (el(event.target) as any).closest("[data-engine-checkbox]") : null;
      if (engineBox) {
        const chosen = [...document.querySelectorAll("[data-engine-checkbox]")]
          .filter((row) => (row as any).checked)
          .map((row) => row.getAttribute("data-engine-checkbox"));
        saveEngines(chosen);
        return;
      }
      const promptOrder = el(event.target) ? (el(event.target) as any).closest("[data-prompt-sort]") : null;
      if (promptOrder) { state.promptSort = promptOrder.value; refreshPromptResults(); return; }
      const promptFilter = el(event.target) ? (el(event.target) as any).closest("[data-prompt-filter]") : null;
      if (promptFilter) {
        (state.promptFilters as any)[promptFilter.getAttribute("data-prompt-filter")] = promptFilter.value;
        refreshPromptResults();
        return;
      }
      const backend = el(event.target) ? (el(event.target) as any).closest("[data-storage-backend]") : null;
      if (backend) {
        state.storageBackend = backend.value;
        state.storageCheck = null;
        render();
        return;
      }
      const control = el(event.target) ? (el(event.target) as any).closest("[data-filter]") : null;
      if (!control) return;
      state.filters[control.getAttribute("data-filter")] = control.value;
      state.answerEngineState = "idle";
      state.citedState = "idle";
      state.rankPlanState = "idle";
      loadAnswerEngine();
    });

    document.addEventListener("click", (event) => {
      const target = el(event.target) as any;
      if (!target || !target.closest) return;
      if (target.closest("[data-clear-filters]")) {
        state.filters = { modelId:"", regionId:"", languageId:"", topicId:"" };
        state.answerEngineState = "idle";
        state.citedState = "idle";
        state.rankPlanState = "idle";
        loadAnswerEngine();
        return;
      }
      const moveButton = target.closest("[data-action-move]");
      if (moveButton) {
        setActionState(moveButton.getAttribute("data-action-move"), moveButton.getAttribute("data-action-prompt"), moveButton.getAttribute("data-action-state"));
        return;
      }
      if (target.closest("[data-harvest-pages]")) { harvestPages(); return; }
      if (target.closest("[data-refresh-pages]")) { harvestPages(true); return; }
      const reachNow = target && target.closest ? target.closest("[data-probe-reach]") : null;
      if (reachNow) { probeReachNow(reachNow); return; }
      if (target.closest("[data-start-experiment]")) { startExperiment(); return; }
      const stopIt = target && target.closest ? target.closest("[data-stop-experiment]") : null;
      if (stopIt) { stopExperiment(stopIt.getAttribute("data-stop-experiment") || ""); return; }
      if (target.closest("[data-add-decoy]")) {
        const name = window.prompt("Name a brand you know is irrelevant to these questions. It is never asked about, only matched against the answers, so it costs nothing to run.");
        if (name && name.trim()) addDecoy(name.trim());
        return;
      }
      const reword = target && target.closest ? target.closest("[data-reword-prompt]") : null;
      if (reword) {
        const typed = window.prompt("Add a wording of this question, or leave it blank to have one written for you.\n\n" + (reword.getAttribute("data-reword-text") || ""));
        if (typed === null) return;
        if (typed.trim()) addWordingByHand(reword.getAttribute("data-reword-prompt") || "", typed);
        else suggestWordings(reword);
        return;
      }
      const verdict = target && target.closest ? target.closest("[data-verdict-id]") : null;
      if (verdict) { recordVerdict(verdict); return; }
      if (target.closest("[data-pull-search]")) { pullSearchDemand(); return; }
      if (target.closest("[data-pull-referrals]")) { pullReferrals(); return; }
      if (target.closest("[data-stop-run]")) { stopRun(); return; }
      const openRun = target.closest("[data-open-run]");
      if (openRun) { openRunPane(openRun.getAttribute("data-open-run") || ""); return; }
      if (target.closest("[data-adopt-rivals]")) { rivalAction("/competitors/adopt", {}, "Adopted."); return; }
      const retirePersona = target.closest("[data-retire-persona]");
      if (retirePersona) { personaAction("/personas/retire", { personaIds: [retirePersona.getAttribute("data-retire-persona")] }, "No longer asked."); return; }
      const retireRival = target.closest("[data-retire-rival]");
      if (retireRival) { rivalAction("/competitors/retire", { competitorIds: [retireRival.getAttribute("data-retire-rival")] }, "No longer tracked."); return; }
      if (target.closest("[data-storage-check]")) { storageAction("/check", "POST", "Connected."); return; }
      if (target.closest("[data-storage-save]")) { storageAction("", "PUT", "Saved."); return; }
      if (target.closest("[data-close-panel]")) { closeEvidence(); return; }
      const row = target.closest("[data-evidence]");
      if (row) openEvidence(row.getAttribute("data-evidence"), row.getAttribute("data-evidence-title") || "");
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.panel) { closeEvidence(); return; }
      if (event.key === "Escape" && document.body.classList.contains("drawer-open")) { closeDrawer(); return; }
      if (event.key !== "Enter" && event.key !== " ") return;
      const row = el(event.target) ? (el(event.target) as any).closest("[data-evidence]") : null;
      if (!row) return;
      event.preventDefault();
      openEvidence(row.getAttribute("data-evidence"), row.getAttribute("data-evidence-title") || "");
    });

    document.addEventListener("click", (event) => {
      const toggle = el(event.target) ? (el(event.target) as any).closest("[data-theme-toggle]") : null;
      if (!toggle) return;
      const root = document.documentElement;
      const current = root.getAttribute("data-theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      const next = current === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("citegeo.theme", next); } catch (error) { /* the choice just will not persist */ }
    });

    document.addEventListener("submit", async (event) => {
      const form = el(event.target) as any;
      if (form && form.id === "add-persona-form") {
        event.preventDefault();
        const data = new FormData(form);
        await personaAction("/personas", { label: data.get("label"), describedAs: data.get("describedAs") }, "Now asked on their behalf.");
        return;
      }
      if (form && form.id === "add-rival-form") {
        event.preventDefault();
        const data = new FormData(form);
        await rivalAction("/competitors", { name: data.get("name"), domain: data.get("domain") }, "Now tracked.");
        return;
      }
      if (form && form.id === "schedule-form") {
        event.preventDefault();
        const data = new FormData(form);
        const checked = data.getAll("regionIds").map(String);
        await postPrompts("/prompt-schedule", {
          enabled: data.get("enabled") === "on",
          rule: { frequency: data.get("frequency"), timezone: "UTC", hour: 9, minute: 0, weekday: 1, dayOfMonth: 1 },
          regionIds: checked,
        }, "saving", "Schedule saved.");
        state.scheduleState = "idle";
        render();
        return;
      }
      if (form && form.id === "bulk-prompt-form") {
        event.preventDefault();
        const pasted = new FormData(form);
        await postPrompts("/prompts/bulk", { topicId: pasted.get("topicId"), text: pasted.get("text"), intent: pasted.get("intent") }, "saving", "Added and tracked. Anything already in the set was skipped.");
        return;
      }
      if (!form || form.id !== "add-prompt-form") return;
      event.preventDefault();
      const data = new FormData(form);
      state.promptDraft = { topicId: "", text: "", intent: "discovery" };
      await postPrompts("/prompts", { topicId: data.get("topicId"), text: data.get("text"), intent: data.get("intent") }, "saving", "Added and tracked.");
    });

    document.addEventListener("click", async (event) => { const target = el(event.target) as any; if (target && target.closest && target.closest("[data-reload-providers]")) { state.providersState = "idle"; loadProviders(); return; }
      if (target && target.closest && target.closest("[data-reload-insights]")) { state.insightsState = "idle"; state.crawlersState = "idle"; state.planState = "idle"; state.signalsState = "idle"; loadInsights(); loadCrawlers(); loadPlan(); loadSignals(); return; }
      const columnButton = target && target.closest ? target.closest("[data-matrix-column]") : null;
      if (columnButton) {
        const name = columnButton.getAttribute("data-matrix-column") || "";
        const off = state.matrixHidden.includes(name);
        state.matrixHidden = off ? state.matrixHidden.filter((row) => row !== name) : [...state.matrixHidden, name];
        savePreference("matrixHidden", JSON.stringify(state.matrixHidden));
        render();
        return;
      }
      const viewButton = target && target.closest ? target.closest("[data-panel-view]") : null;
      if (viewButton) {
        const id = viewButton.getAttribute("data-panel-view") || "";
        const mode = viewButton.getAttribute("data-panel-view-mode") === "table" ? "table" : "chart";
        state.panelViews = { ...state.panelViews, [id]: mode };
        savePreference("panelViews", JSON.stringify(state.panelViews));
        render();
        return;
      }
      const saveCred = target && target.closest ? target.closest("[data-credential-save]") : null;
      if (saveCred) { await saveCredential(saveCred.getAttribute("data-credential-save"), saveCred); return; }
      const clearCred = target && target.closest ? target.closest("[data-credential-clear]") : null;
      if (clearCred) { await clearCredential(clearCred.getAttribute("data-credential-clear"), clearCred); return; }
      const pullExternal = target && target.closest ? target.closest("[data-pull-external-metrics]") : null;
      if (pullExternal) {
        const source = pullExternal.getAttribute("data-pull-external-metrics");
        if (source === "ahrefs" || source === "semrush") await pullExternalMetrics(source, pullExternal);
        return;
      }
      const saveSettings = target && target.closest ? target.closest("[data-integration-settings-save]") : null;
      if (saveSettings) { await saveIntegrationSettings(saveSettings.getAttribute("data-integration-settings-save"), saveSettings); return; }
      const removeSelectedModel = target && target.closest ? target.closest("[data-remove-selected-model]") : null;
      if (removeSelectedModel) { dropSelection(removeSelectedModel.getAttribute("data-remove-selected-model") || ""); return; }
      const copyFix = target && target.closest ? target.closest("[data-copy-fix]") : null;
      if (copyFix) {
        const block = element("fix-" + (copyFix.getAttribute("data-copy-fix") || ""));
        if (block) await copyText(copyFix, block.textContent || "");
        return;
      }
      const probeHere = target && target.closest ? target.closest("[data-probe-signals]") : null;
      if (probeHere && state.page === "entity") { await probeForEntity(probeHere); return; }
      const runCheck = target && target.closest ? target.closest("[data-run-factcheck], [data-run-shopping]") : null;
      if (runCheck) {
        const where = runCheck.hasAttribute("data-run-factcheck") ? "factcheck" : "shopping";
        await runMarketerCheck(runCheck, where);
        return;
      }
      const copyDraft = target && target.closest ? target.closest("[data-copy-draft]") : null;
      if (copyDraft) { await copyText(copyDraft, draftBody(copyDraft.getAttribute("data-copy-draft") || "")); return; }
      const copyLlms = target && target.closest ? target.closest("[data-copy-llms]") : null;
      if (copyLlms) { await copyText(copyLlms, state.entity?.llms?.text || ""); return; }
      const draftOne = target && target.closest ? target.closest("[data-draft], [data-aim-run]") : null;
      if (draftOne) {
        const template = draftOne.getAttribute("data-draft") || draftOne.getAttribute("data-aim-run") || "";
        await runDraft(draftOne, template, false);
        return;
      }
      const draftEvery = target && target.closest ? target.closest("[data-draft-batch]") : null;
      if (draftEvery) { await runDraft(draftEvery, draftEvery.getAttribute("data-draft-batch") || "", true); return; }
      const reviewButton = target && target.closest ? target.closest("[data-review]") : null;
      if (reviewButton) { await reviewDraft(reviewButton, reviewButton.getAttribute("data-review") || ""); return; }
      const publishButton = target && target.closest ? target.closest("[data-publish-draft]") : null;
      if (publishButton) { await publishDraft(publishButton, publishButton.getAttribute("data-publish-draft") || ""); return; }
      const probeButton = target && target.closest ? target.closest("[data-probe-signals]") : null;
      if (probeButton) { await captureSignals(probeButton); return; } if (!(target instanceof Element)) return; const pageButton = target.closest("[data-page]"); if (pageButton) { await setPage(pageButton.getAttribute("data-page") || "overview"); return; } const listModeButton = target.closest("[data-list-mode]"); if (listModeButton) { state.mode = listModeButton.getAttribute("data-list-mode") || "current"; await refreshProjects(); render(); return; } if (target.id === "new-project" || target.id === "empty-new-project") { openDrawer(); return; } if (target.id === "close-drawer" || target.id === "cancel-draft" || target.id === "drawer-backdrop") { closeDrawer(); return; } if (target.id === "retry-catalog") { state.catalogState = "idle"; await loadCatalog(); return; } const opened = target.closest("[data-matrix-open]"); if (opened) { const key = opened.getAttribute("data-matrix-open") || ""; const at = state.matrixOpen.indexOf(key); if (at >= 0) state.matrixOpen.splice(at, 1); else state.matrixOpen.push(key); render(); return; } const expand = target.closest("[data-expand-panel]"); if (expand && !target.closest("button:not(.panel-open),a,select,input,textarea,label")) { openPanel(expand.getAttribute("data-expand-panel") || ""); return; } if (target.closest("[data-edit-board]")) { state.editingBoard = !state.editingBoard; render(); return; } const span = target.closest("[data-panel-span]"); if (span) { const parts = (span.getAttribute("data-panel-span") || "").split(":"); setPanelSpan(parts[0] || "", Number(parts[1])); render(); return; } const folded = target.closest("[data-fold]"); if (folded && target.closest("summary")) { const foldId = folded.getAttribute("data-fold") || ""; const foldAt = state.panelOpen.indexOf(foldId); if (foldAt >= 0) state.panelOpen.splice(foldAt, 1); else state.panelOpen.push(foldId); savePreference("panelOpen", state.panelOpen.join(",")); return; } const hide = target.closest("[data-panel-hide]"); if (hide) { togglePanelHidden(hide.getAttribute("data-panel-hide") || ""); render(); return; } if (target.closest("[data-reset-panels]")) { resetPanelOrder(); state.editingBoard = false; render(); return; } const tracked = target.closest("[data-track-question]"); if (tracked) { state.promptDraft = { topicId: "", text: tracked.getAttribute("data-track-question") || "", intent: "discovery" }; await setPage("prompts"); toast({ text: "Pick a topic for it under Add your own, then add it." }); return; } const brand = target.closest("[data-brand-evidence]"); if (brand) { await openBrandEvidence(brand.getAttribute("data-brand-evidence") || "", brand.getAttribute("data-brand-tone") || ""); return; } const dropped = target.closest("[data-drop-selection]"); if (dropped) { dropSelection(dropped.getAttribute("data-drop-selection") || ""); return; } if (target.id === "probe-engines") { await probeEngines((target as any)); return; }  if (target.id === "save-models") { await saveModels((target as any)); return; } if (target.id === "save-monitoring-configuration") { await saveMonitoringConfiguration(); return; } if (target.id === "archive-project") { const selected = project(); if (selected) await projectAction("archive", selected.id, (target as any)); return; } if (target.id === "delete-project") { const selected = project(); if (selected) await projectAction("delete", selected.id, (target as any)); return; } const action = target.closest("[data-project-action]"); if (action) { const projectId = action.getAttribute("data-project-id"); const name = action.getAttribute("data-project-action"); if (projectId && name) await projectAction(name, projectId, (action as any)); } });
    document.addEventListener("change", async (event) => { const target = el(event.target) as any; if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return; if (target.id === "project-select") { setSelectedProject(target.value); state.selectionsDirty = false; await refreshConfiguration(); loadLiveRun(); render(); return; } if (target instanceof HTMLInputElement && target.hasAttribute("data-model-checkbox")) { changeModel(target.getAttribute("data-model-checkbox") || "", target.checked); return; } if (target instanceof HTMLSelectElement && target.hasAttribute("data-model-mode")) { changeModelMode(target.getAttribute("data-model-mode") || "", target.value); return; } if (target instanceof HTMLSelectElement && target.hasAttribute("data-selected-model-mode")) { changeModelMode(target.getAttribute("data-selected-model-mode") || "", target.value); return; } });
    document.addEventListener("change", (event) => {
      const target = el(event.target);
      if (target instanceof HTMLInputElement && target.hasAttribute("data-crawler-log")) {
        const file = target.files && target.files[0];
        target.value = "";
        if (file) uploadCrawlerLog(file);
      }
    });
    document.addEventListener("change", (event) => { const target = el(event.target) as any; if (!(target instanceof HTMLSelectElement)) return; if (target.id === "model-provider-filter") { state.catalogProvider = target.value; render(); return; } if (target.id === "model-native-search-filter") { state.catalogNativeSearch = target.value; render(); return; } if (target.id === "model-catalog-sort") { state.catalogSort = target.value; render(); return; } if (target.hasAttribute("data-repetitions")) { state.repetitions = Number(target.value) || 1; savePreference("repetitions", String(state.repetitions)); render(); return; } if (target.hasAttribute("data-run-language")) { state.runLanguageId = target.value || "en"; savePreference("runLanguage", state.runLanguageId); render(); return; } if (target.hasAttribute("data-brand-tier")) { setTier(target.value); return; } if (target.hasAttribute("data-paste-count")) { state.pasteCount = Number(target.value) || 2; savePreference("pasteCount", String(state.pasteCount)); state.pasteState = "idle"; loadPaste(); render(); } });
    // The drawer filters in place rather than through a re-render, because a
    // re-render takes the focus out of the box you are typing in.
    const PANEL_ROWS = ".mrow, .rankrow, .panel-body li";

    function panelRowText(node: Element): string {
      return String(node.textContent || "").split("\n").join(" ").trim();
    }

    function filterPanel(query: string): void {
      const body = document.querySelector(".panel-body");
      const note = document.querySelector("[data-panel-filter-note]");
      if (!body) return;
      let shown = 0;
      let hidden = 0;
      for (const node of Array.from(body.querySelectorAll(PANEL_ROWS))) {
        if (node.classList.contains("mhead")) continue;
        const on = matchesQuery(panelRowText(node), query);
        (node as HTMLElement).hidden = !on;
        if (on) shown += 1; else hidden += 1;
      }
      if (note) note.textContent = filterSummary({ shown, hidden }, query);
    }

    /** Exports what is on screen, so a filtered panel exports the filtered set. */
    function exportPanel(): void {
      const body = document.querySelector(".panel-body");
      if (!body || !state.panel) return;
      const head = body.querySelector(".mhead");
      const columns = head
        ? Array.from(head.children).map((cell) => String(cell.textContent || "").trim())
        : ["Row"];
      const rows: string[][] = [];
      for (const node of Array.from(body.querySelectorAll(PANEL_ROWS))) {
        if (node.classList.contains("mhead") || (node as HTMLElement).hidden) continue;
        const cells = Array.from(node.children).map((cell) => panelRowText(cell));
        rows.push(cells.length ? cells : [panelRowText(node)]);
      }
      const csv = panelCsv(columns, rows);
      const name = exportName(String(state.panel.title || "panel"), new Date().toISOString().slice(0, 10));
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      // A detached anchor does not download in every browser, and revoking the
      // url in the same tick can cancel the download before it starts.
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      window.setTimeout(() => {
        link.remove();
        URL.revokeObjectURL(url);
      }, 0);
    }

    document.addEventListener("input", (event) => {
      const box = el(event.target) as any;
      if (box instanceof HTMLInputElement && box.hasAttribute("data-panel-search")) filterPanel(box.value);
    });

    document.addEventListener("click", (event) => {
      const target = el(event.target) as any;
      if (target instanceof Element && target.closest("[data-panel-export]")) exportPanel();
    });

    document.addEventListener("input", (event) => { const target = el(event.target) as any; if (target instanceof HTMLInputElement && target.id === "model-search") { state.query = target.value; refreshCatalogSearchResults(); return; } if (target instanceof HTMLInputElement && target.id === "prompt-search") { state.promptFilters.query = target.value; refreshPromptResults(); } });
    document.addEventListener("submit", (event) => { const target = el(event.target) as any; if (!(target instanceof HTMLFormElement)) return; if (target.id === "project-form") createDraft(event); if (target.id === "project-edit-form") saveProject(event); });
    // Nothing was painted until both of these resolved, so the whole product
    // was a blank page for as long as the first read took.
    render();
    refreshProjects().then(async () => { await refreshConfiguration(); state.booting = false; loadLiveRun(); render(); }).catch((error) => { app.innerHTML = '<main class="workspace"><div class="warning-box">' + html(error instanceof Error ? error.message : String(error)) + '</div></main>'; });
    function activeRecognitionRun() { const detail = state.recognitionDetail; return detail && (detail.run.status === "queued" || detail.run.status === "running") ? detail.run : null; }
    function recognitionDetailFor(modelRunId: any) { return state.recognitionModelDetails[modelRunId] || null; }
    function renderRecognitionRun(run: any) { const detail = state.recognitionDetail; const selected = detail && detail.run.id === run.id; const summary = selected ? recognitionRunSummary(detail, state.recognitionModelDetails) : "Plan " + run.plannedModelRunCount + "  models · open this run to see execution status"; return '<article class="run-row"><div class="run-row-head"><div><h3>Recognition test · ' + html(formatTime(run.createdAt)) + '</h3><p class="subtle">config v' + html(run.baselineVersion) + ' · ' + html(summary) + '</p></div><span class="tag ' + (run.status === "completed" ? "ready" : run.status === "partial" ? "warning" : run.status === "failed" ? "deleted" : "warning") + '">' + html(recognitionRunStatusText(run.status)) + '</span></div><div class="inline-actions">' + (selected ? '<span class="subtle">Viewing</span>' : button({ label: "View this run", kind: "quiet", on: { "data-recognition-run": run.id } })) + '</div></article>'; }
    function renderRecognitionPage() { const selected = project(); if (!selected) return '<section class="view"><div class="empty"><div class="empty-copy"><h2>Select a project first</h2><p class="subtle">A domain recognition test belongs to a single project.</p></div></div></section>'; const active = activeRecognitionRun(); const canStart = Boolean((selected as any).activeBaselineId) && state.recognitionActionState !== "loading" && !active; const startLabel = state.recognitionActionState === "loading" ? "Creating test…" : active ? "Running" : "Start recognition test"; const current = state.recognitionDetail; const currentRows = current ? '<section class="section-card"><div class="section-head"><div><h2>This run</h2><p class="subtle">Each model is called and archived independently. A model\'s description reflects only its own answer in this run.</p>' + recognitionCountStrip(current, state.recognitionModelDetails) + '</div><span class="tag">' + html(recognitionRunStatusText(current.run.status)) + '</span></div><div class="model-run-list">' + current.modelRuns.map((modelRun) => renderRecognitionModel(modelRun, recognitionDetailFor(modelRun.id))).join("") + '</div></section>' : '<section class="section-card"><p class="subtle">No recognition test records yet. Save a configuration to start one.</p></section>'; const history = state.recognitionRuns.length ? '<section class="section-card"><div class="section-head"><div><h2>Run records</h2><p class="subtle">Every record keeps its own model execution and evidence.</p></div></div><div class="run-list">' + state.recognitionRuns.map(renderRecognitionRun).join("") + '</div></section>' : ''; const unavailable = !(selected as any).activeBaselineId ? '<div class="warning-box">Save your models as a configuration first, on Choose models.</div>' : ''; return '<section class="view"><div class="heading"><div><h1>Results</h1><p class="subtle">Each model receives only the domain, language, monitoring protocol and its own web search mode. Offline and native-web results are recorded separately.</p></div>' + button({ label: startLabel, kind: "primary", disabled: !canStart, id: "start-recognition", testId: "start-recognition", on: { "data-action-state": state.recognitionActionState } }) + '</div>' + machineTabs() + '<div id="recognition-status" class="form-status ' + html(state.recognitionNotice.kind) + '" aria-live="polite">' + html(state.recognitionNotice.text) + '</div><div class="section-stack">' + unavailable + currentRows + history + '</div></section>'; }
    async function refreshRecognition() { const selected = project(); if (!selected) { state.recognitionRuns = []; state.recognitionDetail = null; state.recognitionModelDetails = {}; return; } const projectId = selected.id; const listed = await request("/api/projects/" + encodeURIComponent(projectId) + "/recognition-runs"); if (!isOpen(projectId, state.selectedId)) return; state.recognitionRuns = listed.runs || []; const runId = state.recognitionSelectedRunId || (state.recognitionRuns[0] ? state.recognitionRuns[0].id : ""); if (!runId) { state.recognitionDetail = null; state.recognitionModelDetails = {}; if (state.page === "recognition") render(); return; } const detail = await request("/api/projects/" + encodeURIComponent(projectId) + "/recognition-runs/" + encodeURIComponent(runId)); if (!isOpen(projectId, state.selectedId)) return; state.recognitionSelectedRunId = (detail as any).run.id; state.recognitionDetail = detail; const pairs = await Promise.all(detail.modelRuns.map(async (modelRun: any) => { try { return [modelRun.id, await request("/api/projects/" + encodeURIComponent(projectId) + "/recognition-runs/" + encodeURIComponent((detail as any).run.id) + "/model-runs/" + encodeURIComponent(modelRun.id))]; } catch { return [modelRun.id, null]; } })); if (!isOpen(projectId, state.selectedId)) return; state.recognitionModelDetails = {}; for (const pair of pairs) { if (pair[1]) state.recognitionModelDetails[pair[0]] = pair[1]; } if (state.page === "recognition") render(); if ((detail as any).run.status === "queued" || (detail as any).run.status === "running") { window.clearTimeout(state.recognitionRefreshTimer); state.recognitionRefreshTimer = window.setTimeout(() => { if (state.page === "recognition") refreshRecognition().catch(() => {}); }, 1000); } }
    async function startRecognition() { const selected = project(); if (!selected || activeRecognitionRun() || state.recognitionActionState === "loading") return; const idempotencyKey = crypto.randomUUID(); state.recognitionActionState = "loading"; state.recognitionNotice = { text:"Creating a separate execution record for each model…", kind:"loading" }; render(); try { const response = await request("/api/projects/" + encodeURIComponent(selected.id) + "/recognition-runs", { method:"POST", headers:{ "Idempotency-Key":idempotencyKey } }); if (!isOpen(selected.id, state.selectedId)) { state.recognitionActionState = "idle"; render(); return; } state.recognitionSelectedRunId = response.run.id; state.recognitionActionState = "success"; state.recognitionNotice = { text:"Recognition test started. Waiting for models to respond.", kind:"success" }; await refreshRecognition(); window.setTimeout(() => { state.recognitionActionState = "idle"; if (state.page === "recognition") render(); }, 850); } catch (error) { if (!isOpen(selected.id, state.selectedId)) { state.recognitionActionState = "idle"; render(); return; } state.recognitionActionState = "error"; state.recognitionNotice = { text: error instanceof Error ? error.message : (expectedErrorText.request_failed || "The request failed."), kind: "error" }; render(); } }
    async function retryRecognition(modelRunId: any, button: HTMLElement | null) { const selected = project(); const detail = state.recognitionDetail; if (!selected || !detail) return; try { await runAction(button, { loading:"Retrying…", success:"Started", error:"Retry failed" }, () => request("/api/projects/" + encodeURIComponent(selected.id) + "/recognition-runs/" + encodeURIComponent(((detail as any).run.id as any)) + "/model-runs/" + encodeURIComponent(modelRunId) + "/retry", { method:"POST" })); if (!isOpen(selected.id, state.selectedId)) return; state.recognitionNotice = { text:"A new execution attempt was created for this model.", kind:"success" }; await refreshRecognition(); } catch (error) { if (!isOpen(selected.id, state.selectedId)) return; state.recognitionNotice = { text: error instanceof Error ? error.message : (expectedErrorText.request_failed || "The request failed."), kind: "error" }; render(); } }
    async function reanalyzeRecognition(modelRunId: any, attemptId: any, button: HTMLElement | null) { const selected = project(); const detail = state.recognitionDetail; if (!selected || !detail || !attemptId) return; try { await runAction(button, { loading:"Parsing the saved answer…", success:"Local parse complete", error:"Parsing failed" }, () => request("/api/projects/" + encodeURIComponent(selected.id) + "/recognition-runs/" + encodeURIComponent(((detail as any).run.id as any)) + "/model-runs/" + encodeURIComponent(modelRunId) + "/attempts/" + encodeURIComponent(attemptId) + "/reanalyze", { method:"POST" })); if (!isOpen(selected.id, state.selectedId)) return; state.recognitionNotice = { text:"A new local parse was generated from the saved raw answer. No model was called.", kind:"success" }; await refreshRecognition(); } catch (error) { if (!isOpen(selected.id, state.selectedId)) return; state.recognitionNotice = { text: error instanceof Error ? error.message : (expectedErrorText.request_failed || "The request failed."), kind: "error" }; render(); } }
    const phase2Render = phase2RenderImpl;
    renderOverride = function renderWithRecognition() { if (window.__citegeoPhase5Active) return; if (state.page !== "recognition") return phase2Render(); const selected = project(); const options = state.currentProjects.length ? state.currentProjects.map((item) => '<option value="' + html(item.id) + '">' + html(item.name) + ' · ' + html(item.normalizedDomain) + '</option>').join("") : '<option value="">No projects yet</option>'; app.innerHTML = renderEvidence() + '<div class="shell">' + navScrim() + '<aside class="sidebar"><button type="button" class="brand" data-page="dashboard" aria-label="Back to the dashboard">' + brandLockup + '</button><div class="project-label">Project</div><select id="project-select" class="project-select" aria-label="Switch project" data-testid="project-select">' + options + '</select>' + sidebar({ page: state.page, options }) + '<div class="sidebar-bottom">Domain recognition</div></aside><main class="workspace"><header class="topbar"><div class="topbar-lead">' + navToggle() + '<div class="crumb"><button type="button" class="crumb-home" data-page="dashboard">' + html(CONFIG.productName) + '</button> / ' + html(selected ? selected.name : "Project") + '</div></div><div class="topbar-actions"><button type="button" class="theme-toggle" data-theme-toggle aria-label="Switch between light and dark">&#9681;</button>' + button({ label: "New project", id: "new-project", testId: "new-project" }) + '</div></header><section class="content">' + renderRecognitionPage() + '</section>' + renderFooter(state, footerActions) + '</main></div>'; const select = element("project-select"); if (select) select.value = state.selectedId; document.title = selected ? selected.name + " | " + CONFIG.productTitle + "" : "" + CONFIG.productTitle + ""; };
    document.addEventListener("click", async (event) => { const target = el(event.target) as any; if (!(target instanceof Element)) return; if (target.id === "start-recognition") { await startRecognition(); return; } const evidenceButton = target.closest("[data-evidence-target]"); if (evidenceButton) { const card = evidenceButton.closest("[data-testid=recognition-model-run]"); const details = card ? card.querySelector("details.evidence-details") : null; if (details) (details as any).open = true; const evidenceTarget = evidenceButton.getAttribute("data-evidence-target"); window.setTimeout(() => { const marked = evidenceTarget ? element(evidenceTarget) : null; if (marked) marked.scrollIntoView({ block:"center", behavior:"smooth" }); }, 0); return; } const runButton = target.closest("[data-recognition-run]"); if (runButton) { state.recognitionSelectedRunId = runButton.getAttribute("data-recognition-run") || ""; await refreshRecognition(); return; } const reanalyzeButton = target.closest("[data-recognition-reanalyze]"); if (reanalyzeButton) { await reanalyzeRecognition(reanalyzeButton.getAttribute("data-recognition-reanalyze") || "", reanalyzeButton.getAttribute("data-recognition-attempt") || "", (reanalyzeButton as any)); return; } const retryButton = target.closest("[data-recognition-retry]"); if (retryButton) { await retryRecognition(retryButton.getAttribute("data-recognition-retry") || "", (retryButton as any)); return; } const pageButton = target.closest("[data-page]"); if (pageButton && pageButton.getAttribute("data-page") === "recognition") { const startedFor = state.selectedId; window.setTimeout(() => refreshRecognition().catch((error) => { if (!isOpen(startedFor, state.selectedId)) return; state.recognitionNotice = { text: error instanceof Error ? error.message : (expectedErrorText.request_failed || "The request failed."), kind: "error" }; render(); }), 0); } if (pageButton && pageButton.getAttribute("data-page") !== "recognition") window.clearTimeout(state.recognitionRefreshTimer); });
    document.addEventListener("change", (event) => { const target = el(event.target) as any; if (target instanceof HTMLSelectElement && target.id === "project-select") { window.setTimeout(() => { if (state.page === "recognition") refreshRecognition().catch(() => {}); }, 0); } });
    wireNav();
    // The grid is replaced on every render, so the drag is delegated once and
    // a drop re-renders from the order it just saved.
    wirePanelDrag(() => render());
    wireChartHover();
    (window as any).__citegeoPhase2 = { state, app, html, element, project, formatTime, brandMark, brandLockup, request, refreshRecognition, machineTabs, phase2Render, render: () => render() };
}

// The shell renders the mount point and the configuration, then this runs.
boot();
