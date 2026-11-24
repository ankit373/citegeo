import { CONFIG } from "./config.js";
import { html } from "./dom.js";
import { trendChart } from "./components/chart.js";
import { dashboardBody, dashboardPanels } from "./pages/dashboard-view.js";
import { buyingView, claimsView, conversationsView, draftsView, entityView, marketerView } from "./pages/marketer-view.js";
import { exportName, filterSummary, matchesQuery, panelCsv } from "./components/panel-tools.js";
import { emptyState, notice, section } from "./components/primitives.js";
import { button } from "./components/button.js";
import { formatTime, percent, score as scoreText } from "./format.js";
import { effectLabel, historyWord, intentLabel, reachInk, reachWords, recognitionRunStatusText } from "./labels.js";
import { demandBadge, fieldBadge } from "./components/badges.js";
import { overAppearances, renderLeaderboard, renderPersonaRows, stat } from "./pages/metric-cells.js";
import { crawlerUpload, languagePicker, pasteCountPicker, repetitionPicker } from "./components/pickers.js";
import { blockedSelection, catalogHead, catalogReleasedAt, catalogResultSummary, catalogVendor, modelIsBlocked, openRouterOutOfCredit, providerShortLabel, runsNowCell, selectedRows } from "./components/catalog-rows.js";
import { mentionChips, paneRun, renderLiveRun, runIsLive, runPaneProgress } from "./pages/run-pane.js";
import { renderDecoys, renderFraming, renderHumanCheck, renderExperiments, renderPhrasing, renderSchedule, renderStability, renderTier, renderVariance, renderVersions } from "./pages/trust-sections.js";
import { answerTasks, taskCta } from "./pages/task-views.js";
import { renderConcentration, renderCredit, renderDecomposition, renderUptake, renderInterference, renderKinds, renderOutreach, renderReferrals, renderSearchDemand, renderShape } from "./pages/source-sections.js";
import { dashboardView, renderHome, type AnswerDigest, type CitedPages, type ReferralsPayload } from "./pages/home-view.js";
import { renderFooter, renderOverview } from "./pages/overview-view.js";
import { recognitionCountStrip, recognitionRunSummary, renderRecognitionModel, type RecognitionRunDetail } from "./pages/recognition-view.js";
import { loading, skeletonCard, skeletonTable, skeletonText, skeletonTiles } from "./components/skeleton.js";
import { clearToasts, toast } from "./components/toast.js";
import { DESTINATIONS, navScrim, navToggle, sidebar, wireNav } from "./components/nav.js";
import { resetPanelOrder, setPanelSpan, togglePanelHidden, wirePanelDrag } from "./components/reorder.js";
import { wireChartHover } from "./components/chart-hover.js";
import { setupView, type CredentialRow, type IntegrationRow, type ProviderRow, type StorageCheck, type StorageSettings } from "./pages/setup-view.js";
import type { HomeSummary } from "../../product/alerts/home-summary.js";
import type { RankingPlan } from "../../product/topics/ranking-plan.js";
import type { OutreachPlan } from "../../product/citations/outreach.js";
import type { SearchConsoleStatus } from "../../product/search-console/search-console-service.js";
import { selectedModelTable, webSearchModeControl } from "./components/model-picker.js";

/** What the credentials endpoint answers with, or nothing when it refuses. */
type CredentialFile = { closed?: boolean; detail?: string; storageEnabled?: boolean; credentials?: CredentialRow[] };
import type {
  AnswerRow, CatalogModel, InsightsShape, LoadState, Notice, Panel, Payload,
  ProjectRow, RunRow, SelectionRow, TopicSetShape, Unshaped,
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
    externalMetrics: { snapshots: any[] } | null; externalMetricsState: LoadState;
    externalMetricsPulling: "" | "ahrefs" | "semrush"; externalMetricsNotice: Notice;
    digest: AnswerDigest | null; digestState: LoadState;
    demand: Unshaped; demandState: LoadState;
    catalog: CatalogModel[]; catalogState: LoadState; catalogError: string;
    query: string; catalogProvider: string; catalogNativeSearch: string; catalogSort: string;
    selections: SelectionRow[]; draftSelections: Map<string, string>; selectionsDirty: boolean;
    baselines: Unshaped[]; monitoringConfiguration: Payload | null; configurationState: LoadState;
    drawerSession: number; modelNotice: Notice; monitoringNotice: Notice;
    modelActionState: string; monitoringSaveState: string;
    recognitionRuns: Unshaped[]; recognitionDetail: RecognitionRunDetail | null;
    recognitionModelDetails: Record<string, Unshaped>; recognitionSelectedRunId: string;
    recognitionNotice: Notice; recognitionActionState: string; recognitionRefreshTimer: number;
    topicSet: TopicSetShape | null; topicState: LoadState;
    promptFilters: { query: string; topicId: string; intent: string; status: string };
    promptSelection: string[]; promptSort: string;
    answerEngine: InsightsShape | null; answerEngineState: LoadState;
    promptRunState: string; promptNotice: Notice;
    promptDraft: { topicId: string; text: string; intent: string };
    schedule: Unshaped; scheduleState: LoadState;
    regions: Array<{ id: string; label: string }>; languages: Array<{ id: string; label: string }>;
    home: HomeSummary | null; homeState: LoadState;
    cited: CitedPages | null; citedState: LoadState;
    rivals: Unshaped; rivalsState: LoadState;
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
    reach: Unshaped; reachState: LoadState;
    paste: Unshaped; pasteState: LoadState; pasteCount: number;
    repetitions: number;
    runLanguageId: string;
    searchDemand: SearchConsoleStatus | null; searchDemandState: LoadState; pulling: boolean;
    personas: Unshaped; personasState: LoadState;
    priority: Unshaped; priorityState: LoadState;
    referrals: ReferralsPayload | null; referralsState: LoadState; pullingReferrals: boolean;
    engines: Unshaped; enginesState: LoadState;
    actions: Unshaped[]; actionsState: LoadState;
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

    const state: State = { page:savedPreference("page", "dashboard"), mode:"current", projects:[], currentProjects:[], selectedId:new URL(window.location.href).searchParams.get("projectId") || localStorage.getItem("citegeo.product.projectId") || "", providers:[], providersState:"idle", insights:null, insightsState:"idle", crawlers:null, crawlersState:"idle", crawlerUploading:false, crawlerNotice:{ text:"", kind:"" }, plan:null, planState:"idle", marketer:null, drafts:null, claims:null, buying:null, conversations:null, entity:null, marketerState:"idle", marketerNotice:{ text:"", kind:"" }, signals:null, signalsState:"idle", credentials:null, credentialsState:"idle", credentialNotice:{text:"",kind:""}, integrations:[], integrationsState:"idle", externalMetrics:null, externalMetricsState:"idle", externalMetricsPulling:"", externalMetricsNotice:{text:"",kind:""}, digest:null, digestState:"idle", demand:null, demandState:"idle", repetitions:Number(savedPreference("repetitions", "1")) || 1, runLanguageId:savedPreference("runLanguage", "en"), catalog:[], catalogState:"idle", catalogError:"", query:"", catalogProvider:"", catalogNativeSearch:"all", catalogSort:"name", selections:[], draftSelections:new Map(), selectionsDirty:false, baselines:[], monitoringConfiguration:null, configurationState:"idle", drawerSession:0, modelNotice:{ text:"", kind:"" }, monitoringNotice:{ text:"", kind:"" }, modelActionState:"idle", monitoringSaveState:"idle", recognitionRuns:[], recognitionDetail:null, recognitionModelDetails:{}, recognitionSelectedRunId:"", recognitionNotice:{ text:"", kind:"" }, recognitionActionState:"idle", recognitionRefreshTimer:0, topicSet:null, topicState:"idle", promptFilters:{ query:"", topicId:"", intent:"", status:"" }, promptSelection:[], answerEngine:null, answerEngineState:"idle", promptRunState:"idle", promptNotice:{ text:"", kind:"" }, promptDraft:{ topicId:"", text:"", intent:"discovery" }, schedule:null, scheduleState:"idle", regions:[], languages:[], home:null, homeState:"idle", cited:null, citedState:"idle", history:null, historyState:"idle", rivals:null, rivalsState:"idle", storage:null, storageState:"idle", storageDraft:{}, storageBackend:"", storageCheck:null, filters:{ modelId:"", regionId:"", languageId:"", topicId:"" }, panel:null, panelState:"idle", panelAnswers:[], liveRun:null, lastRun:null, runPollTimer:0, runFeed:[], runFeedState:"idle", runFeedTimer:0, rankPlan:null, rankPlanState:"idle", brief:null, briefState:"idle", outreach:null, outreachState:"idle", harvesting:false, paste:null, pasteState:"idle", pasteCount:Number(savedPreference("pasteCount", "2")) || 2, uptake:null, uptakeState:"idle", interference:null, interferenceState:"idle", concentration:null, concentrationState:"idle", shape:null, shapeState:"idle", kinds:null, kindsState:"idle", experiments:null, experimentsState:"idle", check:null, checkState:"idle", credit:null, creditState:"idle", reach:null, reachState:"idle", searchDemand:null, searchDemandState:"idle", pulling:false, personas:null, personasState:"idle", priority:null, priorityState:"idle", promptSort:"topic", referrals:null, referralsState:"idle", pullingReferrals:false, engines:null, enginesState:"idle", actions:[], actionsState:"idle", matrixOpen:[], editingBoard:false, brandIcons:{}, panelViews:savedJson("panelViews"), matrixHidden:savedList("matrixHidden"), panelOpen:savedList("panelOpen"), booting:true };
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
    const footerActions = { loadHome };
    const homeActions = { loadHome, loadAnswerEngine, loadOutreach, loadRankingPlan, loadDigest, loadSearchDemand, loadReferrals };
    const trustActions = { loadCheck, loadExperiments, loadSchedule };
    const currentTasks = () => answerTasks(state.answerEngine);
    const sourceActions = { loadInterference, loadConcentration, loadShape, loadCredit, loadKinds, loadOutreach, loadSearchDemand, loadReferrals, loadUptake };
    const currentPaneRun = () => paneRun(state.panel, state.liveRun, state.lastRun);
    const modeText = (mode: string) => mode === "provider_native" ? "Provider Native web search" : "Offline";
    function setSelectedProject(projectId: string) { if (projectId !== state.selectedId) { state.liveRun = null; state.lastRun = null; state.insights = null; state.insightsState = "idle"; state.plan = null; state.planState = "idle"; state.rankPlan = null; state.rankPlanState = "idle"; state.engines = null; state.enginesState = "idle"; state.actions = []; state.actionsState = "idle"; state.outreach = null; state.outreachState = "idle"; state.paste = null; state.pasteState = "idle"; state.uptake = null; state.uptakeState = "idle"; state.interference = null; state.interferenceState = "idle"; state.concentration = null; state.concentrationState = "idle"; state.shape = null; state.shapeState = "idle"; state.kinds = null; state.kindsState = "idle"; state.experiments = null; state.experimentsState = "idle"; state.check = null; state.checkState = "idle"; state.credit = null; state.creditState = "idle"; state.reach = null; state.reachState = "idle"; state.searchDemand = null; state.searchDemandState = "idle"; state.personas = null; state.personasState = "idle"; state.priority = null; state.priorityState = "idle"; state.referrals = null; state.referralsState = "idle"; state.crawlers = null; state.crawlersState = "idle"; state.signals = null; state.signalsState = "idle"; state.externalMetrics = null; state.externalMetricsState = "idle"; state.externalMetricsPulling = ""; state.externalMetricsNotice = { text:"", kind:"" }; } state.selectedId = projectId || ""; if (state.selectedId) localStorage.setItem("citegeo.product.projectId", state.selectedId); else localStorage.removeItem("citegeo.product.projectId"); const next = new URL(window.location.href); if (state.selectedId) next.searchParams.set("projectId", state.selectedId); else next.searchParams.delete("projectId"); window.history.replaceState({ projectId:state.selectedId }, "", next); }
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
    async function refreshConfiguration() { const selected = project(); if (!selected) { state.selections = []; state.baselines = []; state.monitoringConfiguration = null; resetDraftSelections(); return; } state.configurationState = "loading"; render(); try { const result = await Promise.all([request("/api/projects/" + encodeURIComponent(selected.id) + "/models"), request("/api/projects/" + encodeURIComponent(selected.id) + "/baselines"), request("/api/projects/" + encodeURIComponent(selected.id) + "/monitoring-configuration")]); state.selections = result[0].selections; state.baselines = result[1].baselines; state.monitoringConfiguration = result[2].configuration; if (!state.selectionsDirty) resetDraftSelections(); state.configurationState = "ready"; } catch (error) { state.configurationState = "error"; state.monitoringNotice = { text: error instanceof Error ? error.message : (expectedErrorText.request_failed || "The request failed."), kind: "error" }; } render(); }
    async function loadCatalog() { if (state.catalogState === "loading" || state.catalogState === "ready") return; state.catalogState = "loading"; state.catalogError = ""; render(); try { const result = await request("/api/provider-models"); state.catalog = result.models; state.catalogState = "ready"; } catch (error) { state.catalogState = "error"; state.catalogError = error instanceof Error ? error.message : String(error); } render(); }
    function monitoringConfiguration() { return state.monitoringConfiguration || { status:"no_version", currentVersion:null, nextVersion:1, currentBaseline:null, currentProtocol:{ protocolId:"domain-recognition", protocolVersion:"v1", inputType:"domain_only", requestedFields:[], promptTemplateHash:"" }, currentDomain:"", currentLanguage:"zh", currentModelSnapshots:[], diff:{ addedModels:[], removedModels:[], webSearchModeChanges:[], protocolVersionChange:null, domainChange:null, languageChange:null } }; }
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
      try {
        state.topicSet = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/topics");
        state.topicState = "ready";
      } catch (error) {
        state.topicState = "error";
      }
      render();
    }

    async function loadRivals() {
      if (!state.selectedId || state.rivalsState === "loading") return;
      state.rivalsState = "loading";
      try {
        state.rivals = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/competitors");
        state.rivalsState = "ready";
      } catch (error) {
        state.rivalsState = "error";
      }
      render();
    }

    async function rivalAction(path: string, body: Payload, notice: string) {
      await postPrompts(path, body, "saving", notice);
      state.rivalsState = "idle";
      state.answerEngineState = "idle";
      loadRivals();
    }

    async function loadCited() {
      if (!state.selectedId || state.citedState === "loading") return;
      state.citedState = "loading";
      try {
        state.cited = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/cited-pages" + filterQuery());
        state.citedState = "ready";
      } catch (error) {
        state.citedState = "error";
      }
      render();
    }

    async function loadHome() {
      if (!state.selectedId || state.homeState === "loading") return;
      state.homeState = "loading";
      try {
        state.home = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/home");
        state.homeState = "ready";
      } catch (error) {
        state.homeState = "error";
      }
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
      try {
        const results = await Promise.all([
          request("/api/projects/" + encodeURIComponent(state.selectedId) + "/prompt-schedule"),
          request("/api/projects/" + encodeURIComponent(state.selectedId) + "/regions"),
        ]);
        state.schedule = results[0];
        state.regions = results[1].regions || [];
        state.languages = results[1].languages || [];
        state.scheduleState = "ready";
      } catch (error) {
        state.scheduleState = "error";
      }
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
      try {
        state.answerEngine = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/prompt-insights" + filterQuery());
        state.answerEngineState = "ready";
        const board = ((state.answerEngine as Unshaped).leaderboard as Unshaped[]) || [];
        loadBrandIcons(board.map((row) => String(row.domain || "")).filter(Boolean).slice(0, 24));
      } catch (error) {
        state.answerEngineState = "error";
      }
      render();
    }

    async function loadLiveRun() {
      if (!state.selectedId) return;
      try {
        const result = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/prompt-runs");
        const rows = result.runs || result || [];
        const live = rows.find ? rows.find((row: any) => row.status === "running" || row.status === "cancelling") : null;
        const had = Boolean(state.liveRun);
        state.liveRun = live || null;
        state.lastRun = rows.length ? rows[0] : null;
        window.clearTimeout(state.runPollTimer);
        if (live) state.runPollTimer = window.setTimeout(loadLiveRun, 4000);
        // A start takes a moment to appear, and one missed poll used to leave
        // the page claiming nothing was running for the length of the run.
        else if (state.promptRunState === "running") state.runPollTimer = window.setTimeout(loadLiveRun, 1500);
        else if (had) { state.answerEngineState = "idle"; state.rankPlanState = "idle"; state.actionsState = "idle"; state.outreachState = "idle"; state.uptakeState = "idle"; loadAnswerEngine(); if (state.panel && state.panel.kind === "run") loadRunFeed(); }
        render();
      } catch (error) {
        state.liveRun = null;
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
      try {
        const query = filterQuery();
        const joiner = query ? "&" : "?";
        const result = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/prompt-answers" + query + joiner + "promptId=" + encodeURIComponent(promptId));
        state.panelAnswers = result.answers || [];
        state.panelState = "ready";
      } catch (error) {
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
      try {
        const result = await request<{ answers: Unshaped[] }>("/api/projects/" + encodeURIComponent(state.selectedId) + "/prompt-answers");
        state.panelAnswers = (result.answers || []).filter((answer: Unshaped) =>
          (answer.mentions || []).some((row: Unshaped) => row.name === name && (!tone || row.recommendation === tone)));
        state.panelState = "ready";
      } catch (error) {
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
      document.body.classList.remove("panel-open");
      state.panel = null;
      state.panelAnswers = [];
      state.panelState = "idle";
      state.runFeed = [];
      state.runFeedState = "idle";
      state.brief = null;
      state.briefState = "idle";
      window.clearTimeout(state.runFeedTimer);
      render();
    }

    async function postPrompts(path: string, body: Payload, working: string, done: string) {
      if (!state.selectedId) return;
      state.promptRunState = working;
      state.promptNotice = { text:"", kind:"" };
      render();
      try {
        const verb = path === "/prompt-schedule" ? "PUT" : "POST";
        await request("/api/projects/" + encodeURIComponent(state.selectedId) + path, { method:verb, headers:{"Content-Type":"application/json"}, body: JSON.stringify(body || {}) });
        state.promptRunState = "idle";
        state.promptNotice = { text: done, kind: "success" };
        state.topicState = "idle";
        state.answerEngineState = "idle";
      } catch (error) {
        state.promptRunState = "idle";
        state.promptNotice = { text: error && (error as any).message ? (error as any).message : String(error), kind: "error" };
      }
      render();
    }

    async function loadInsights() {
      if (state.insightsState === "loading") return;
      const selected = project();
      if (!selected) return;
      state.insightsState = "loading";
      try {
        state.insights = await request("/api/projects/" + selected.id + "/insights");
        state.insightsState = "ready";
      } catch (error) {
        state.insightsState = "error";
      }
      render();
    }
    async function loadCrawlers() {
      if (state.crawlersState === "loading") return;
      const selected = project();
      if (!selected) return;
      state.crawlersState = "loading";
      try {
        state.crawlers = await request("/api/projects/" + selected.id + "/crawlers");
        state.crawlersState = "ready";
      } catch (error) {
        state.crawlersState = "error";
      }
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
      if (!selected || state.crawlerUploading) return;
      state.crawlerUploading = true;
      state.crawlerNotice = { text: "", kind: "" };
      render();
      try {
        const text = await file.text();
        const result = await request("/api/projects/" + selected.id + "/crawlers", {
          method: "POST",
          headers: { "content-type": "text/plain" },
          body: text,
        });
        state.crawlers = result;
        state.crawlersState = "ready";
        state.crawlerNotice = { text: result.detail, kind: result.linesParsed ? "" : "bad" };
      } catch (error) {
        state.crawlerNotice = { text: error instanceof Error ? error.message : String(error), kind: "bad" };
      }
      state.crawlerUploading = false;
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
      try {
        const [memo, agents, claims, buying, conversations, entity, llms] = await Promise.all([
          quietly("/aim"), quietly("/agents"), quietly("/factcheck"), quietly("/shopping"),
          quietly("/conversations"), quietly("/entity"), quietly("/llms-txt"),
        ]);
        state.marketer = memo?.memo || null;
        state.drafts = agents || null;
        // The report is absent until a check has run, which is not an empty one.
        state.claims = claims?.report ? { ...claims.report, ...claims } : null;
        state.buying = buying?.report || null;
        state.conversations = conversations?.explorations || [];
        state.entity = { alignment: entity?.alignment || null, llms: llms?.draft || null };
        state.marketerState = "ready";
      } catch (error) {
        state.marketerState = "error";
      }
      render();
    }

    async function loadPlan() {
      if (state.planState === "loading") return;
      const selected = project();
      if (!selected) return;
      state.planState = "loading";
      try {
        state.plan = await request("/api/projects/" + selected.id + "/action-plan");
        state.planState = "ready";
      } catch (error) {
        state.planState = "error";
      }
      render();
    }
    // Asking for more a day does not invent more. The shortfall is named, which
    // is the whole difference from a tool that ships a fixed number whatever is true.
    async function loadPaste() {
      if (!state.selectedId || state.pasteState === "loading") return;
      state.pasteState = "loading";
      try {
        state.paste = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/paste-fixes?count=" + state.pasteCount);
        state.pasteState = "ready";
      } catch (error) {
        state.pasteState = "error";
      }
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
      await runAction(button, { loading:"Probing…", success:"Probed", error:"Probe failed" }, () => request("/api/projects/" + selected.id + "/signals", { method:"POST" }));
      state.planState = "idle";
      loadPlan();
    }
    async function loadSignals() {
      if (state.signalsState === "loading") return;
      const selected = project();
      if (!selected) return;
      state.signalsState = "loading";
      try {
        const result = await request("/api/projects/" + selected.id + "/signals");
        state.signals = result.snapshots || [];
        state.signalsState = "ready";
      } catch (error) {
        state.signalsState = "error";
      }
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
      try {
        state.digest = await request<AnswerDigest>("/api/projects/" + encodeURIComponent(selected.id) + "/digest");
        state.digestState = "ready";
      } catch (error) {
        // Nothing to summarise is a state, not a failure.
        state.digest = null;
        state.digestState = "error";
      }
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
      try {
        state.externalMetrics = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/external-metrics");
        state.externalMetricsState = "ready";
      } catch (error) {
        state.externalMetricsState = "error";
      }
      render();
    }

    async function pullExternalMetrics(source: "ahrefs" | "semrush", control: HTMLElement | null) {
      if (!state.selectedId || state.externalMetricsPulling) return;
      state.externalMetricsPulling = source;
      state.externalMetricsNotice = { text:"", kind:"" };
      render();
      try {
        const result = await runAction(control, { loading:"Pulling…", success:"Saved", error:"Pull failed" }, () => request<{ snapshot: { source: string } }>("/api/projects/" + encodeURIComponent(state.selectedId) + "/external-metrics", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ source }) }));
        state.externalMetricsNotice = { text: (result.snapshot.source === "ahrefs" ? "Ahrefs" : "Semrush") + " estimate saved as a dated snapshot.", kind:"success" };
        state.externalMetricsState = "idle";
      } catch (error) {
        state.externalMetricsNotice = { text: error instanceof Error ? error.message : String(error), kind:"error" };
      }
      state.externalMetricsPulling = "";
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

    function renderAbsent(rows: any[]) {
      if (!rows || !rows.length) return '<p class="subtle">Every prompt with an answer named you at least once.</p>';
      return '<ul class="protocol-list">' + rows.slice(0, 12).map((row) => '<li class="is-clickable" data-evidence="' + html(row.promptId) + '" data-evidence-title="' + html(row.text) + '" tabindex="0" role="button"><strong>' + html(row.text) + '</strong><br><span class="subtle">' + row.score.answers + ' answer(s), none named you. '
        + (row.ahead.length ? 'Named instead: ' + row.ahead.map((entity: any) => html(entity.name)).join(", ") + '.' : 'No competitor was named either, so this question may not be about a product at all.')
        + '</span><br><span class="linklike">Open the brief</span></li>').join("") + '</ul>';
    }

    function renderModelRows(rows: any[]) {
      if (!rows || !rows.length) return '<p class="subtle">No model has answered yet.</p>';
      // A model is a proportion like any other here. One appearance in twenty
      // four answers reads as 4% and is consistent with anything from under one
      // per cent to twenty, so the range goes beside it rather than nowhere.
      const asked = rows.filter((row) => row.score.answers > 0);
      const silent = rows.length - asked.length;
      const band = (score: any) => score.presenceInterval && score.presenceInterval.low !== null
        ? '<small>' + Math.round(score.presenceInterval.low * 100) + ' to ' + Math.round(score.presenceInterval.high * 100) + '%</small>'
        : '';
      return '<div class="mtable"><div class="mhead mcols-aemodel"><span>AI assistant</span><span>Score</span><span>Presence</span><span>Answers</span></div>'
        + asked.map((row) => '<div class="mrow mcols-aemodel">'
          + '<div class="mname"><strong>' + html(row.displayName) + '</strong><span class="mono">' + html(row.providerId) + ' · ' + html(row.modelId) + '</span></div>'
          + '<span class="mcell">' + scoreText(row.score.score) + '</span>'
          + '<span class="mcell">' + percent(row.score.presenceRate) + band(row.score) + '</span>'
          + '<span class="mcell">' + row.score.answers + '</span></div>').join("")
        + '</div>'
        + (silent ? '<p class="subtle">' + silent + ' more model(s) are saved or have been seen and have never produced an answer, so there is nothing to read for them.</p>' : '');
    }

    function renderPromptTrend(trend: any) {
      if (!trend || !trend.points.length) return '<p class="subtle">One run is a snapshot. Run the set again and this becomes a trend.</p>';
      const points = trend.points.map((point: any) => ({
        at: point.at,
        value: point.score.score,
        thin: point.score.tooFewAnswers,
        note: point.score.answers + (point.score.answers === 1 ? " answer" : " answers"),
        display: point.score.score === null ? "Not measurable" : point.score.score + " / 100",
        format: (value: any) => Math.round(value) + "",
        axisMax: 100,
      }));
      const change = trend.change === null
        ? '<span class="subtle">' + (trend.readablePoints < 2
            ? 'Not comparable yet: ' + trend.readablePoints + ' of ' + trend.points.length + ' run(s) asked enough to read a figure off'
            : 'Not comparable yet') + '</span>'
        : '<span class="' + (trend.change > 0 ? "state-ok" : trend.change < 0 ? "state-bad" : "") + '">' + (trend.change > 0 ? "+" : "") + trend.change + ' since ' + html(trend.since.slice(0, 10)) + '</span>';
      // Named rather than only drawn faintly, because a chart whose shape comes
      // from run size reads as a finding to anybody who does not hover a dot.
      const thin = trend.thinPoints
        ? '<p class="subtle">' + trend.thinPoints + ' of ' + trend.points.length + ' run(s) asked too few answers to read a score off. They are plotted where they fell, and the line is not drawn through them.</p>'
        : '';
      return '<div class="trend-head">' + change + '</div>' + trendChart(points, "answer engine score") + thin;
    }

    function renderRegionRows(rows: any[], caveat: string) {
      if (!rows || !rows.length) return '<p class="subtle">Only one market has been asked, so there is nothing to compare. Pick more when you run.</p>';
      return '<p class="subtle">' + html(caveat) + '</p><div class="mtable"><div class="mhead mcols-aemodel"><span>Market</span><span>Score</span><span>Presence</span><span>Rank</span></div>'
        + rows.map((row) => '<div class="mrow mcols-aemodel">'
          + '<div class="mname"><strong>' + html(row.label) + '</strong></div>'
          + '<span class="mcell">' + scoreText(row.score.score) + '</span>'
          + '<span class="mcell">' + percent(row.score.presenceRate) + '</span>'
          + '<span class="mcell">' + (row.rank === null ? "Not named" : "#" + row.rank) + '</span></div>').join("")
        + '</div>';
    }

    // A trend read at a glance: no axes, no grid, just the shape.
    // A spark has no room to say which points it dropped, so it draws only the
    // runs that asked enough to read a figure off. A line through a one-answer
    // run is a picture of how big the run was.



    // The filters travel with the file, so an export is the slice on screen.

    function renderTopicRows(topics: any[]) {
      if (!topics || !topics.length) return '<p class="subtle">No topic has been answered yet.</p>';
      return topics.map((topic) => {
        const stateClass = topic.score.score === null ? "" : topic.score.score >= 50 ? "state-ok" : topic.score.score > 0 ? "state-flag" : "state-bad";
        const prompts = topic.prompts.map((prompt: any) => '<div class="mrow mcols-prompt is-clickable" data-evidence="' + html(prompt.promptId) + '" data-evidence-title="' + html(prompt.text) + '" tabindex="0" role="button">'
          + '<div class="mname"><strong>' + html(prompt.text) + '</strong><span class="subtle">' + intentLabel(prompt.intent) + ' · ' + prompt.score.answers + ' answer(s)' + (prompt.measuresVisibility ? '' : ' · names you') + '</span></div>'
          + '<span class="mcell ' + (prompt.score.score === null ? "" : prompt.score.score > 0 ? "state-ok" : "state-bad") + '">' + scoreText(prompt.score.score) + '</span>'
          + '<span class="mcell">' + (prompt.rank === null ? "Not named" : "#" + prompt.rank) + ' <span class="chev">›</span></span></div>').join("");
        return '<section class="section-card"><div class="section-head"><div><h2>' + html(topic.name) + '</h2><p class="subtle">' + html(topic.description || "") + '</p></div>'
          + '<div class="scorehead"><span style="font-family:var(--font-display);font-size:26px" class="' + stateClass + '">' + scoreText(topic.score.score) + '</span><span class="subtle">' + (topic.rank === null ? "Not named" : "rank #" + topic.rank) + '</span></div></div>'
          + '<div class="mtable"><div class="mhead mcols-prompt"><span>Question</span><span>Score</span><span>Rank</span></div>' + prompts + '</div></section>';
      }).join("");
    }

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
      const busy = state.promptRunState === "running";
      const last = state.lastRun ? button({ label: "Last run", on: { "data-open-run": state.lastRun.id } }) : '';
      return last + languagePicker(state.languages, state.runLanguageId) + repetitionPicker(state.repetitions) + button({ label: (busy ? "Starting…" : html(label)), kind: "primary", disabled: busy || enabled === false, on: { "data-run-prompts": true } });
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
      try {
        const result = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/prompt-answers?runId=" + encodeURIComponent((open.runId as any)));
        state.runFeed = result.answers || [];
        state.runFeedState = "ready";
      } catch (error) {
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
      try {
        state.rankPlan = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/ranking-plan" + filterQuery());
        state.rankPlanState = "ready";
      } catch (error) {
        state.rankPlanState = "error";
      }
      render();
    }

    async function loadActions() {
      if (!state.selectedId || state.actionsState === "loading") return;
      state.actionsState = "loading";
      try {
        const result = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/actions");
        state.actions = result.actions || [];
        state.actionsState = "ready";
      } catch (error) {
        state.actionsState = "error";
      }
      render();
    }

    async function setActionState(moveId: string, promptId: string, next: string) {
      if (!state.selectedId) return;
      try {
        await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/actions", {
          method:"PUT", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ moveId: moveId, promptId: promptId || null, state: next }),
        });
        state.actionsState = "idle";
        loadActions();
      } catch (error) {
        state.promptNotice = { text: error && (error as any).message ? (error as any).message : String(error), kind:"error" };
        render();
      }
    }

    function takenAction(moveId: string, promptId: string) {
      const id = promptId ? moveId + ":" + promptId : moveId;
      return state.actions.find((row) => row.id === id) || null;
    }

    function effectText(effect: any) {
      if (!effect) return "";
      if (effect.nothingRunSince) return "No answer has been archived since, so nothing can have moved yet.";
      const score = effect.scoreChange === null
        ? "the score could not be measured at both ends"
        : "score " + (effect.scoreChange > 0 ? "+" : "") + effect.scoreChange;
      const rank = effect.rankNow === null
        ? "still not named"
        : effect.rankThen === null ? "now ranked #" + effect.rankNow : "rank " + effect.rankThen + " to " + effect.rankNow;
      return effect.answersAdded + " answer(s) since · " + score + " · " + rank
        + (effect.appearancesAdded ? " · " + effect.appearancesAdded + " more answer(s) named you" : "");
    }

    function actionControls(move: any) {
      const taken = takenAction(move.id, move.promptId);
      const current = taken ? taken.state : "open";
      const moveAction = (value: any, label: any) => '<button type="button" class="card-action' + (current === value ? " is-on" : "") + '" data-action-move="' + html(move.id) + '" data-action-prompt="' + html(move.promptId || "") + '" data-action-state="' + value + '">' + label + '</button>';
      const effect = taken && taken.effect ? '<p class="evidence-note">Since you started: ' + html(effectText(taken.effect)) + '</p>' : '';
      return '<div class="move-actions">' + moveAction("doing", "Doing") + moveAction("done", "Done") + moveAction("dismissed", "Not doing")
        + (current === "open" ? '' : moveAction("open", "Reopen")) + '</div>' + effect;
    }

    function renderRankingPlan() {
      if (state.rankPlanState === "idle") { loadRankingPlan(); }
      if (state.actionsState === "idle") { loadActions(); }
      if (state.rankPlanState !== "ready" || !state.rankPlan) {
        return '<p class="subtle">' + (state.rankPlanState === "error" ? "Could not build a plan from the archived answers." : "Reading the answers to work out what would move this.") + '</p>';
      }
      const plan = state.rankPlan;
      const moves = plan.moves.length
        ? '<div class="plan">' + plan.moves.map((move: any) => '<div class="move ' + html(move.effect) + '">'
            + '<div class="move-top"><strong>' + html(move.title) + '</strong><span class="tag">' + html(effectLabel(move.effect)) + '</span>'
            + (takenAction(move.id, move.promptId) ? '<span class="pill good">' + html(takenAction(move.id, move.promptId).state) + '</span>' : '')
            + (move.answers === null ? '' : '<span class="subtle">' + move.answers + ' answer(s)</span>') + '</div>'
            + '<p class="why">' + html(move.why) + '</p>'
            + '<p class="evidence-note">' + html(move.evidence) + '</p>'
            + actionControls(move) + '</div>').join("") + '</div>'
        : '<p class="subtle">Nothing in the archived answers points at a specific move.</p>';
      return '<p class="subtle"><strong>' + html(plan.verdict) + '</strong></p>' + moves
        + '<details class="technical-details" style="margin-top:14px"><summary>Would tracking more questions make me rank higher?</summary><p class="subtle">' + html(plan.promptsNote) + '</p></details>';
    }

    async function loadBrief(promptId: string) {
      state.briefState = "loading";
      state.brief = null;
      try {
        const query = filterQuery();
        const joiner = query ? "&" : "?";
        state.brief = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/prompt-brief" + query + joiner + "promptId=" + encodeURIComponent(promptId));
        state.briefState = "ready";
      } catch (error) {
        state.briefState = "error";
      }
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
      try {
        state.outreach = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/source-pages");
        state.outreachState = "ready";
      } catch (error) {
        state.outreachState = "error";
      }
      render();
    }

    // Cited is not used. One engine cites twice as many pages as another and
    // takes a fifth as much from them, so the count is not the finding.
    async function loadUptake() {
      if (!state.selectedId || state.uptakeState === "loading") return;
      state.uptakeState = "loading";
      try {
        state.uptake = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/source-uptake");
        state.uptakeState = "ready";
      } catch (error) {
        state.uptakeState = "error";
      }
      render();
    }


    // Shapes, not findings. A rewrite aimed at being cited stays factually
    // consistent with the original, so nothing that checks facts catches one.
    async function loadInterference() {
      if (!state.selectedId || state.interferenceState === "loading") return;
      state.interferenceState = "loading";
      try {
        state.interference = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/source-interference");
        state.interferenceState = "ready";
      } catch (error) {
        state.interferenceState = "error";
      }
      render();
    }

    // Who supplies the answers in this category. A few domains holding most of
    // it makes getting onto them the whole game; a long tail means a new page
    // can still get in.
    async function loadConcentration() {
      if (!state.selectedId || state.concentrationState === "loading") return;
      state.concentrationState = "loading";
      try {
        state.concentration = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/source-concentration");
        state.concentrationState = "ready";
      } catch (error) {
        state.concentrationState = "error";
      }
      render();
    }

    // Presentation moves citation credit between pages making the same claim,
    // and the gain comes out of somebody else rather than out of nowhere.
    async function loadShape() {
      if (!state.selectedId || state.shapeState === "loading") return;
      state.shapeState = "loading";
      try {
        state.shape = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/source-shape");
        state.shapeState = "ready";
      } catch (error) {
        state.shapeState = "error";
      }
      render();
    }

    // Every figure here rests on a model classifying what another model wrote,
    // and nothing asked a person whether it got it right until this.
    async function loadCheck() {
      if (!state.selectedId || state.checkState === "loading") return;
      state.checkState = "loading";
      try {
        state.check = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/human-check");
        state.checkState = "ready";
      } catch (error) {
        state.checkState = "error";
      }
      render();
    }

    async function recordVerdict(control: Element) {
      const id = control.getAttribute("data-verdict-id") || "";
      const field = control.getAttribute("data-verdict-field") || "";
      const agreed = control.getAttribute("data-verdict-agreed") === "true";
      const correction = control.getAttribute("data-verdict-correction") || "";
      try {
        state.check = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/human-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, field, agreed, correction }),
        });
        state.checkState = "ready";
      } catch (error) {
        state.promptNotice = { text: error && (error as any).message ? (error as any).message : String(error), kind: "error" };
      }
      render();
    }

    // Where a page was credited against how much of the answer it accounts for.
    // A gap is consistent with credit going somewhere other than the content.
    async function loadCredit() {
      if (!state.selectedId || state.creditState === "loading") return;
      state.creditState = "loading";
      try {
        state.credit = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/source-credit");
        state.creditState = "ready";
      } catch (error) {
        state.creditState = "error";
      }
      render();
    }

    // The ranked best-of listicle was the most cited format in published work,
    // at about a fifth of all citations, and four in five went to a company's
    // own site. Both are worth knowing against what wins here.
    async function loadKinds() {
      if (!state.selectedId || state.kindsState === "loading") return;
      state.kindsState = "loading";
      try {
        state.kinds = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/source-kinds");
        state.kindsState = "ready";
      } catch (error) {
        state.kindsState = "error";
      }
      render();
    }

    async function harvestPages(refresh?: boolean) {
      if (!state.selectedId || state.harvesting) return;
      state.harvesting = true;
      render();
      try {
        const where = "/api/projects/" + encodeURIComponent(state.selectedId) + "/source-pages" + (refresh ? "?refresh=true" : "");
        const result = await request(where, { method:"POST" });
        state.outreach = result.plan;
        state.outreachState = "ready";
        state.promptNotice = { text: result.read + " page(s) read, " + result.skipped + " already read or over the cap, " + result.failed + " would not load.", kind:"success" };
        state.uptakeState = "idle";
        state.interferenceState = "idle";
        state.creditState = "idle";
        state.shapeState = "idle";
        state.kindsState = "idle";
      } catch (error) {
        state.promptNotice = { text: error && (error as any).message ? (error as any).message : String(error), kind:"error" };
      }
      state.harvesting = false;
      render();
    }

    async function loadSearchDemand() {
      if (!state.selectedId || state.searchDemandState === "loading") return;
      state.searchDemandState = "loading";
      try {
        state.searchDemand = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/search-demand");
        state.searchDemandState = "ready";
      } catch (error) {
        state.searchDemandState = "error";
      }
      render();
    }

    async function pullSearchDemand() {
      if (!state.selectedId || state.pulling) return;
      state.pulling = true;
      render();
      try {
        const result = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/search-demand", { method:"POST", headers:{"Content-Type":"application/json"}, body:"{}" });
        if (state.searchDemand) state.searchDemand = { ...state.searchDemand, configured:true, report: result.report };
        state.searchDemandState = "ready";
        state.promptNotice = { text: result.report.queries + " query row(s) read from Search Console.", kind:"success" };
      } catch (error) {
        state.promptNotice = { text: error && (error as any).message ? (error as any).message : String(error), kind:"error" };
      }
      state.pulling = false;
      render();
    }

    async function loadPersonas() {
      if (!state.selectedId || state.personasState === "loading") return;
      state.personasState = "loading";
      try {
        state.personas = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/personas");
        state.personasState = "ready";
      } catch (error) {
        state.personasState = "error";
      }
      render();
    }

    async function personaAction(path: string, body: Payload, done: string) {
      await postPrompts(path, body, "saving", done);
      state.personasState = "idle";
      loadPersonas();
    }

    function renderPersonas() {
      if (state.personasState === "idle") { loadPersonas(); }
      if (state.personasState !== "ready" || !state.personas) {
        return '<p class="subtle">' + (state.personasState === "error" ? "Could not read the personas." : "Reading the personas.") + '</p>';
      }
      const tracked = state.personas.personas.filter((row: any) => row.tracked);
      const rows = tracked.length
        ? '<div class="mtable"><div class="mhead mcols-persona"><span>Persona</span><span>Told to the model as</span><span></span></div>'
          + tracked.map((row: any) => '<div class="mrow mcols-persona">'
            + '<div class="mname"><strong>' + html(row.label) + '</strong></div>'
            + '<span class="mcell">' + html(row.describedAs) + '</span>'
            + '<span class="mcell">' + button({ label: "Stop asking", kind: "link", tone: "danger", on: { "data-retire-persona": row.id } }) + '</span></div>').join("")
          + '</div>'
        : '<p class="subtle">No persona yet, so every question is asked on nobody\u2019s behalf. That is a real answer and stays comparable with every run so far.</p>';
      return rows
        + '<form id="add-persona-form" class="inline-form"><input name="label" type="text" placeholder="Beginner retail trader" aria-label="Persona name"><input name="describedAs" type="text" placeholder="someone new to investing, with a small account, who has never used a screener" aria-label="How the model is told to see them">' + button({ label: "Add", submit: true }) + '</form>'
        + '<p class="evidence-note">Each persona multiplies a run: every question is asked once per persona per model per market. The forecast on Prompts counts them.</p>';
    }

    async function loadReferrals() {
      if (!state.selectedId || state.referralsState === "loading") return;
      state.referralsState = "loading";
      try {
        state.referrals = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/assistant-referrals");
        state.referralsState = "ready";
      } catch (error) {
        state.referralsState = "error";
      }
      render();
    }

    async function pullReferrals() {
      if (!state.selectedId || state.pullingReferrals) return;
      state.pullingReferrals = true;
      render();
      try {
        const result = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/assistant-referrals", { method:"POST", headers:{"Content-Type":"application/json"}, body:"{}" });
        if (state.referrals) state.referrals = { ...state.referrals, configured:true, report: result.report };
        state.promptNotice = { text:"Analytics read.", kind:"success" };
      } catch (error) {
        state.promptNotice = { text: error && (error as any).message ? (error as any).message : String(error), kind:"error" };
      }
      state.pullingReferrals = false;
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
      try {
        state.demand = await request("/api/projects/" + encodeURIComponent(selected.id) + "/prompt-demand");
        state.demandState = "ready";
      } catch (error) {
        state.demand = null;
        state.demandState = "error";
      }
      render();
    }

    /** How often anyone actually asks the questions being tracked. A corpus
     * figure is a historical sample, so it says so wherever it appears. */
    function renderDemand() {
      if (state.demandState === "idle") { loadDemand(); }
      const head = '<section class="section-card"><div class="section-head"><div class="headmain"><h2>Prompt volume</h2>'
        + '<p class="subtle">How often anyone asked something like each tracked question, in an openly licensed corpus of real conversations.</p></div></div>';
      if (state.demandState === "loading") return head + loading("the corpus report", skeletonTiles(3) + skeletonTable({ rows: 4 })) + '</section>';
      const report = state.demand;
      if (!report || !report.prompts) {
        // Not built is not zero demand, and the difference matters here.
        return head + '<div class="warning-box"><strong>No corpus is indexed.</strong>'
          + '<p>Nothing has been counted, which is not the same as nobody asking. Index a corpus and the counts fill in; see '
          + '<span class="mono">docs/prompt-demand.md</span>.</p></div></section>';
      }
      const rows = (report.prompts as Unshaped[])
        .slice()
        .sort((left: Unshaped, right: Unshaped) => (right.match.relatedTerms || 0) - (left.match.relatedTerms || 0))
        .slice(0, 12)
        .map((row: Unshaped) => '<div class="mrow mcols-demand"><div class="mname"><strong>' + html(row.text) + '</strong>'
          + ((row.match.examples || []).length ? '<span class="subtle">' + html(String(row.match.examples[0])) + '</span>' : '')
          + '</div><span class="mcell">' + row.match.exactTerms + '</span><span class="mcell">' + row.match.relatedTerms + '</span>'
          + '<span class="mcell">' + (row.shareOfCorpus === null ? "not comparable" : percent(row.shareOfCorpus)) + '</span></div>').join("");
      const uncovered = (report.uncoveredTerms as Unshaped[] || []).slice(0, 12);
      return head
        + '<p class="subtle">' + html(String(report.caveat || "")) + '</p>'
        + '<div class="mtable"><div class="mhead mcols-demand"><span>Question</span><span>Asked exactly</span><span>Asked similarly</span><span>Share of corpus</span></div>' + rows + '</div>'
        + (uncovered.length
          ? '<h3 class="mt-lg">Asked about, and not tracked</h3><p class="subtle">Words common in the corpus that no tracked question covers.</p>'
            + '<div class="tagrow">' + uncovered.map((row: Unshaped) => '<span class="tag">' + html(row.term) + ' \u00b7 ' + row.questions + '</span>').join("") + '</div>'
          : '')
        + '</section>';
    }

    /** One board for everything about how the brand appears, rather than four
     * pages each holding one panel. */
    function renderBrandVisibility() {
      const selected = project();
      if (!selected) return '<section class="view">' + emptyState("Create a project first", "Everything here reports on one domain.") + '</section>';
      if (state.homeState === "idle") { loadHome(); }
      if (state.answerEngineState === "idle") { loadAnswerEngine(); }
      if (state.outreachState === "idle") { loadOutreach(); }
      if (state.rankPlanState === "idle") { loadRankingPlan(); }
      const heading = '<section class="view"><div class="heading"><div class="headmain"><h1>Rivals</h1>'
        + '<p class="subtle">Who the models name instead of you, and where. Counted once per answer however often a name appears in it, and how often anyone asks.</p></div>'
        // A page that offers a run has to show the run, or starting one from
        // here looked like nothing happened.
        + '<div class="inline-actions">' + button({ label: "Full report", on: { "data-page": "answer-engine" } }) + runActionButton("Run prompts") + '</div></div>' + renderLiveRun(state.liveRun);
      if (state.answerEngineState === "error") return heading + notice("Could not read this project.", "error") + '</section>';
      const view = dashboardView(state, project());
      if (!view) return heading + dashboardBody({ status: "loading" }) + '</section>';
      const wanted = ["trend", "named", "described", "sources"];
      const panels = dashboardPanels(view).filter((panel) => wanted.includes(panel.id));
      const body = panels.map((panel) => section({
        id: panel.id,
        title: panel.title,
        blurb: panel.blurb,
        body: panel.body,
        wide: true,
        open: panel.id,
      })).join("");
      // The board first, then what sits behind it. One destination, one page.
      return heading + '<div class="dgrid">' + body + '</div>' + renderDemand() + rivalDetail() + '</section>';
    }

    function renderRivals(data: any) {
      if (state.rivalsState === "idle") { loadRivals(); }
      const tracked = data && data.trackedRivals ? data.trackedRivals : [];
      const declared = state.rivals ? state.rivals.competitors.filter((row: any) => row.tracked) : [];
      const body = tracked.length
        ? '<div class="mtable"><div class="mhead mcols-aemodel"><span>Who</span><span>Answers</span><span>Share</span><span></span></div>'
          + tracked.map((row: any) => '<div class="mrow mcols-aemodel">'
            + '<div class="mname"><strong>' + html(row.name) + '</strong><span class="mono">' + html(row.domain || "no domain") + '</span></div>'
            + '<span class="mcell ' + (row.appearances ? "" : "state-bad") + '">' + row.appearances + '</span>'
            + '<span class="mcell">' + percent(row.shareOfAnswers) + '</span>'
            + '<span class="mcell">' + button({ label: "Stop tracking", kind: "link", tone: "danger", on: { "data-retire-rival": declaredIdFor(row.name) } }) + '</span></div>').join("") + '</div>'
        : '<p class="subtle">No rival is tracked yet. Adopt the ones your site and your answers already name, or add one by hand.</p>';
      return body
        + '<div class="inline-actions" style="margin-top:14px">' + button({ label: "Adopt the ones already named", on: { "data-adopt-rivals": true } }) + '</div>'
        + '<form id="add-rival-form" class="inline-form"><input name="name" type="text" placeholder="Competitor name" aria-label="Competitor name"><input name="domain" type="text" placeholder="domain.com (optional)" aria-label="Competitor domain">' + button({ label: "Add", submit: true }) + '</form>'
        + '<p class="subtle">A rival you track and never see reads as zero rather than disappearing, because that is the finding.</p>'
        + (declared.length ? '' : '');
    }

    function declaredIdFor(name: string) {
      const rows = state.rivals ? state.rivals.competitors : [];
      const found = rows.find((row: any) => row.name.toLowerCase() === String(name).toLowerCase());
      return found ? found.id : "";
    }

    async function loadHistory() {
      if (!state.selectedId || state.historyState === "loading") return;
      state.historyState = "loading";
      try {
        state.history = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/source-history");
        state.historyState = "ready";
      } catch (error) {
        state.historyState = "error";
      }
      render();
    }

    // Pages that stopped being cited, which is a claim no single run can make.
    function renderCitationHistory() {
      if (state.historyState === "idle") { loadHistory(); }
      if (state.historyState === "error") return '<p class="subtle">Could not read what each page did over time.</p>';
      if (state.historyState !== "ready" || !state.history) return loading("the citation history", skeletonTable({ rows: 4, columns: "minmax(0,1fr) 96px 110px 96px" }));
      const data = state.history as any;
      if (data.measurableRuns < 2) {
        return '<p class="subtle">' + data.measurableRuns + ' run(s) carried a citation. Two are needed before a page can be shown to have changed either way.</p>';
      }
      const worth = ["dropped", "slipping", "cited_once"];
      const rows = (data.pages || []).filter((row: any) => worth.indexOf(row.verdict) >= 0).slice(0, 12);
      const table = rows.length
        ? '<div class="mtable"><div class="mhead mcols-aemodel"><span>Page</span><span>Answers</span><span>Last cited</span><span>State</span></div>'
          + rows.map((row: any) => '<div class="mrow mcols-aemodel">'
            + '<div class="mname"><strong>' + html(row.host) + '</strong><span class="mono">' + html(row.url) + '</span></div>'
            + '<span class="mcell">' + row.answers + '</span>'
            + '<span class="mcell mono">' + html(row.lastCitedAt ? row.lastCitedAt.slice(0, 10) : "never") + '</span>'
            + '<span class="mcell">' + historyWord(row.verdict) + '</span></div>').join("") + '</div>'
        : '<p class="subtle">Every page cited before is still being cited.</p>';
      return '<p class="subtle">Across ' + data.measurableRuns + ' run(s) that cited something'
        + (data.silentRuns ? ', ignoring ' + data.silentRuns + ' that cited nothing at all' : '') + '.</p>'
        + table + '<p class="subtle">' + html(data.caveat) + '</p>';
    }

    function renderCitedPages() {
      if (state.citedState === "idle") { loadCited(); }
      if (state.citedState === "error") return '<p class="subtle">Could not read the archived sources.</p>';
      if (state.citedState !== "ready" || !state.cited) return loading("the archived sources", skeletonTable({ rows: 5, columns: "minmax(0,1fr) 96px 82px 90px" }));
      const data = state.cited;
      if (data.unavailable) {
        return '<div class="warning-box">No answer carried a source, so there are no pages to analyse. That is a property of the models you ran, not evidence that nobody cites you.</div>';
      }
      if (!data.answersWithCitations) return '<p class="subtle">Nothing has been answered with a source yet.</p>';

      const own = data.ownPages.length
        ? '<div class="mtable"><div class="mhead mcols-aemodel"><span>Your page</span><span>Answers</span><span>Questions</span><span></span></div>'
          + data.ownPages.slice(0, 12).map((page: any) => '<div class="mrow mcols-aemodel">'
            + '<div class="mname"><strong>' + html(page.path) + '</strong><span class="mono">' + html(page.url) + '</span></div>'
            + '<span class="mcell">' + page.answers + '</span>'
            + '<span class="mcell">' + page.prompts.length + '</span>'
            + '<span class="mcell"><a href="' + html(page.url) + '" target="_blank" rel="noreferrer">Open</a></span></div>').join("") + '</div>'
        : '<p class="subtle">No answer cited a page of yours. Every source below belongs to somebody else.</p>';

      const rivals = '<div class="mtable"><div class="mhead mcols-aemodel"><span>Domain</span><span>Answers</span><span>Pages</span><span>Without you</span></div>'
        + data.domains.slice(0, 12).map((row: any) => '<div class="mrow mcols-aemodel">'
          + '<div class="mname"><strong>' + html(row.domain) + (row.isTarget ? ' <span class="pill good">You</span>' : '') + '</strong></div>'
          + '<span class="mcell">' + row.answers + '</span>'
          + '<span class="mcell">' + row.pages + '</span>'
          + '<span class="mcell">' + row.answersWithoutYou + '</span></div>').join("") + '</div>';

      const openings = data.openings.length
        ? '<ul class="protocol-list">' + data.openings.slice(0, 8).map((row: any) => '<li><strong>' + html(row.domain) + '</strong><br><span class="subtle">won "' + html(row.prompt) + '"</span><br><span class="mono">' + html(row.url) + '</span></li>').join("") + '</ul>'
        : '<p class="subtle">No page won a question you were absent from.</p>';

      // Four tables stacked under one heading was five screens. What the page
      // is for stays open; each table folds.
      return '<p class="subtle">' + data.answersWithCitations + ' of ' + data.answersConsidered + ' answers carried a source.</p>'
        + renderDecomposition(data.decomposition, currentTasks())
        + foldCard("sources-own", "Pages of yours the models reached for",
          "The pages that did the work, so you know which ones to keep.", own)
        + foldCard("sources-domains", "Every domain cited",
          "Who else is in the answer, and how often without you.", rivals)
        + foldCard("sources-openings", "Pages that won a question you are absent from",
          "A question somebody else answered. This is the shortest list to act on.", openings)
        + foldCard("sources-history", "Pages that stopped being cited",
          "A page cited before and not now, which is a change rather than a level.", renderCitationHistory());
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
        state.answerEngineState = "idle";
        loadAnswerEngine();
      } catch (error) {
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
      try {
        state.experiments = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/experiments");
        state.experimentsState = "ready";
      } catch (error) {
        state.experimentsState = "error";
      }
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
      try {
        state.experiments = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/experiments", {
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
        state.experimentsState = "ready";
        state.promptNotice = { text: "Experiment started. Run the questions again and the comparison fills.", kind: "success" };
      } catch (error) {
        state.promptNotice = { text: error && (error as any).message ? (error as any).message : String(error), kind: "error" };
      }
      render();
    }

    async function stopExperiment(id: string) {
      try {
        state.experiments = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/experiments/" + encodeURIComponent(id) + "/stop", { method: "POST" });
        state.experimentsState = "ready";
      } catch (error) {
        state.promptNotice = { text: error && (error as any).message ? (error as any).message : String(error), kind: "error" };
      }
      render();
    }

    // One shell for the three pages built on the same archive: the loading,
    // the empty state and every notice live here once rather than three times.
    function answerPage(title: string, subtitle: string, body: (data: any, page: { objective: string; weights: any }) => string) {
      const selected = project();
      if (!selected) return '<section class="view"><div class="empty"><div class="empty-copy"><h2>Select a project first</h2></div></div></section>';
      if (state.answerEngineState === "idle") { loadAnswerEngine(); loadLiveRun(); }
      if (state.answerEngineState !== "ready") {
        return '<section class="view"><div class="heading"><div><h1>' + html(title) + '</h1><p class="subtle">' + html(subtitle) + '</p></div></div><div class="empty"><div class="empty-copy"><h2>' + (state.answerEngineState === "error" ? "Could not read the answers" : "Reading the archived answers") + '</h2></div></div></section>';
      }
      const data = state.answerEngine;
      if (!data || data.answers === 0) {
        return '<section class="view"><div class="heading"><div><h1>' + html(title) + '</h1><p class="subtle">' + html(subtitle) + '</p></div><div class="inline-actions">' + button({ label: "Set up prompts", kind: "primary", on: { "data-page": "prompts" } }) + '</div></div>'
          + '<div class="empty"><div class="empty-copy"><h2>No answers yet</h2><p class="subtle">Generate a prompt set, activate the questions worth tracking, then run them. Every number on this page traces back to an archived answer.</p></div></div></section>';
      }
      const weights = data.weights || { prominenceFloor: 0, sentimentFloor: 0 };
      const objective = weights.objective
        ? '<p class="subtle"><strong>What it is built to maximise.</strong> ' + html(weights.objective) + '</p>'
          + '<p class="subtle"><strong>What it cannot be used for.</strong> ' + html(weights.limits || "") + '</p>'
        : '';
      // Asking everything again is the wrong price for a retry, so the button
      // asks only the combinations that failed, where they failed.
      const retryButton = state.lastRun && state.lastRun.answersFailed && !state.liveRun
        ? '<div class="inline-actions">' + button({ label: (state.promptRunState === "running" ? "Asking\u2026" : "Ask the " + state.lastRun.answersFailed + " that failed again"), kind: "quiet", disabled: state.promptRunState === "running", on: { "data-retry-run": state.lastRun.id } }) + '</div>'
        : '';
      // Two codes can share one wording, and printing both reads as a bug.
      const byWords = new Map<string, { count: number; models: string[] }>();
      for (const reason of data.failureReasons || []) {
        if (!reason.count) continue;
        const held = byWords.get(reason.label) || { count: 0, models: [] };
        held.count += reason.count;
        for (const name of reason.models || []) {
          if (!held.models.includes(name)) held.models.push(name);
        }
        byWords.set(reason.label, held);
      }
      const causes = [...byWords.entries()].map(([label, held]) => ({ label, ...held })).sort((left, right) => right.count - left.count);
      const causeList = causes.length
        ? '<details class="technical-details"><summary>What failed, and why (' + causes.length + ')</summary><ul class="protocol-list">'
          + causes.map((reason) => '<li>' + reason.count + ' to ' + html(reason.label)
            + (reason.models.length ? '<br><span class="subtle">' + html(reason.models.slice(0, 3).join(", ")) + '</span>' : '')
            + '</li>').join("")
          + '</ul></details>'
        : '';
      const failedNote = data.answersFailed ? '<div class="warning-box">' + data.answersFailed + ' answer(s) failed and are excluded. They are not counted as answers that did not name you.' + causeList + taskCta(currentTasks(), "answers-failed") + retryButton + '</div>' : '';
      // A question you retired is one you said is not your business. Its old
      // answers stay archived and stop supplying the figures, and the reader
      // is told rather than left wondering where the count went.
      const retiredNote = data.answersRetired
        ? '<div class="warning-box">' + data.answersRetired + ' archived answer(s) belong to questions since retired, and are left out of every figure here. They are still in the archive. A retired question is not this brand\u2019s category, so it does not get to say who the rivals are.</div>'
        : '';
      const identityNote = data.identityCaveat ? '<div class="warning-box"><strong>Your name is a word in your own category.</strong> ' + html(data.identityCaveat) + '</div>' : '';
      const corr = data.corroboration;
      // Absent on an archive answered before the check existed, so nothing is
      // claimed about those rather than counting them as unverified.
      const corroborationNote = corr && corr.reported
        ? '<div class="warning-box"><strong>What the model said it named, checked against what it wrote.</strong> '
          + corr.measured + ' of ' + corr.reported + ' mentions were found in the answer and their position measured from it'
          + (corr.absentFromAnswer ? ', and ' + corr.absentFromAnswer + ' named nothing the answer actually contains' : '')
          + '. ' + (corr.quotesChecked ? corr.quotesFound + ' of ' + corr.quotesChecked + ' quoted lines are really in the answer.' : '')
          + '<details class="technical-details"><summary>What that does and does not prove</summary><p>' + html(corr.caveat) + '</p></details>'
          + taskCta(currentTasks(), "quotes-not-found") + taskCta(currentTasks(), "mentions-absent") + '</div>'
        : '';
      // Naming the cause matters more than naming the symptom. Telling somebody
      // to get a provider with web search is wrong when they have one, switched off.
      const act0 = data.activation;
      const citationCause = !act0 || !act0.considered
        ? 'A provider with web search will produce them.'
        : act0.notRequested && !act0.activated
          ? act0.notRequested + ' answer(s) came from a model that can search the web and was told not to. Web search is off in Choose models, so no run could have produced a citation.'
          : act0.unavailable === act0.considered
            ? 'None of the models that ran can search the web at all, so no citation was ever possible.'
            : 'A provider with web search will produce them.';
      const citationFix = taskCta(currentTasks(), "search-switched-off") || taskCta(currentTasks(), "no-model-can-search") || taskCta(currentTasks(), "no-sources-returned");
      const citationNote = data.citationsUnavailable
        ? '<div class="warning-box">No answer carried a citation, so there are no sources to analyse. That is a property of the models you ran, not evidence that nobody cites you. '
          + html(citationCause) + citationFix + '</div>'
        : '';
      // An action stays where it can be taken. An explanation folds, because
      // five amber boxes above a page is two screens before any content.
      const notes = [identityNote, failedNote, retiredNote, citationNote, corroborationNote].filter(Boolean);
      const acts = notes.filter((note) => note.indexOf("task-cta") >= 0 || note.indexOf("data-retry-run") >= 0);
      const explains = notes.filter((note) => acts.indexOf(note) < 0);
      const caveats = explains.length
        ? '<details class="caveats" data-fold="answer-caveats"' + (state.panelOpen.indexOf("answer-caveats") >= 0 ? " open" : "")
          + '><summary>What these numbers do and do not cover (' + explains.length + ')</summary>' + explains.join("") + '</details>'
        : '';
      return '<section class="view"><div class="heading"><div><h1>' + html(title) + '</h1>'
        + '<p class="subtle">' + html(subtitle) + '</p></div><div class="inline-actions">' + runActionButton("Ask the questions") + '</div></div>'
        + renderLiveRun(state.liveRun)
        + acts.join("") + caveats
        + body(data, { objective, weights })
        + '</section>';
    }

    // What the page answers stays open. The eight cards that explain it fold.
    const SOURCE_LEAD = ["source-pages", "source-uptake"];

    function renderAnswerEngine() {
      const card = (id: string, title: string, blurb: string, body: string) => section({
        id, title, blurb, body, wide: true,
        ...(SOURCE_LEAD.includes(id) ? {} : { folded: !state.panelOpen.includes(id) }),
      });
      return answerPage("Sources", "What the answers cited, and whether the answer used it. A citation is an address until the page behind it is read.", () => ''
        + card("source-pages", "Sources", "A domain says you are cited. A page says which one to write more of.", renderCitedPages())
        + card("source-uptake", "Cited, or actually used", "A citation says a page was listed. This says how much of the answer came from it. A page cited and used for nothing is the finding worth having.", renderUptake(state.uptakeState, state.uptake, currentTasks(), sourceActions))
        + card("source-outreach", "Pages the models read", "Each cited page, fetched and read back: who is on it, in what order, and whether you are. A page cited on a question you lose, without you on it, is the most specific thing here.", renderOutreach(state.outreachState, state.outreach, state.harvesting, sourceActions))
        + card("source-demand", "What people search for", "Search Console, joined to the questions you track. Not AI prompt volume, but real demand for the same subject.", renderSearchDemand(state.searchDemandState, state.searchDemand, state.pulling, sourceActions))
        + card("source-referrals", "Who arrived from an assistant", "Analytics sessions by referring assistant. Being named is one claim; somebody arriving because of it is another.", renderReferrals(state.referralsState, state.referrals, state.pullingReferrals, sourceActions))
        + card("source-credit", "Who gets the credit", "Where a page was cited against how much of the answer it actually accounts for. A page credited first that the answer took nothing from was credited for something other than its content.", renderCredit(state.creditState, state.credit, sourceActions))
        + card("source-kinds", "What kind of page gets cited", "The ranked best-of listicle was the most cited format in published work, at about a fifth of everything. What wins here is a different question, and this is the answer to it.", renderKinds(state.kindsState, state.kinds, sourceActions))
        + card("source-shape", "How the pages that beat you are built", "The same facts rendered as structure instead of prose were measured to take citation credit from the page that stayed prose. This is the one lever here with a causal test behind it.", renderShape(state.shapeState, state.shape, sourceActions))
        + card("source-concentration", "Who supplies these answers", "A category where a handful of domains account for most citations is one where getting onto those domains is the whole game. A long tail is one where a new page can still get in.", renderConcentration(state.concentrationState, state.concentration, sourceActions))
        + card("source-interference", "Someone else is working on this answer", "A document rewritten to match what an engine likes to cite stays factually consistent with the original, so nothing that checks facts will catch one. What is left is shape.", renderInterference(state.interferenceState, state.interference, sourceActions))
      );
    }

    /** The detail behind the board: who was named, under which topic, and
     * which questions never named you at all. */
    // What the page answers stays open. The eight cards that explain it fold.
    const RIVAL_LEAD = ["rival-plan", "rival-leaderboard"];

    function rivalDetail() {
      const data = state.answerEngine;
      if (state.answerEngineState !== "ready" || !data || !data.answers) return '';
      const card = (id: string, title: string, blurb: string, body: string) => section({
        id, title, blurb, body, wide: true,
        ...(RIVAL_LEAD.includes(id) ? {} : { folded: !state.panelOpen.includes(id) }),
      });
      return ''
        + card("rival-plan", "What would move this", "Read off the archived answers, strongest lever first. None of it is an opinion about your marketing.", renderRankingPlan())
        + card("rival-leaderboard", "Competitors named in the answers", "Organisations the assistants named while answering your questions. Not the assistants themselves. Ranked by how many answers named them, then by how early.", renderLeaderboard(data.leaderboard))
        + card("rival-absent", "Questions you never appear in", "Answered, and you were not named once. Open one to read what the models credited the winners with, which is the standard that question is answered against.", renderAbsent(data.absentFrom) + taskCta(currentTasks(), "absent-questions"))
        + card("rival-topics", "Topics, weakest first", "Where you are losing, in the order worth fixing. Every question opens its answers.", renderTopicRows(data.topics))
        + card("rival-named", "Rivals you name", "Name a competitor here and it is tracked whether or not an answer mentions it. A tracked rival nobody named reads as zero, which is a finding; leaving it out would hide it.", renderRivals(data))
        + card("rival-trend", "Movement", "One point per run. A run where everything failed is left out rather than drawn as a drop.", renderPromptTrend(data.trend))
        + card("rival-region", "By market", "The same questions, asked for a different buyer.", renderRegionRows(data.byRegion, data.regionCaveat))
        + card("rival-persona", "By persona", "The same questions, asked on behalf of someone else. A market says where a buyer is; a persona says what they are, which moves the answer further.", renderPersonaRows(data.byPersona))
        + card("rival-personas", "Who is asking", "Add a persona and every run asks on their behalf as well.", renderPersonas())
        + card("rival-model", "By AI assistant", "The models you picked in Choose models, each answering the same questions. These are who was asked, not who you compete with.", renderModelRows(data.byModel));
    }

    // Cards nested inside a card, none of which could fold. Each is a card of
    // its own now, on the module that already knows how to fold one.
    function foldCard(id: string, title: string, blurb: string, body: string, aside = "") {
      return section({ id, title, blurb, body, aside, wide: true, folded: state.panelOpen.indexOf(id) < 0 });
    }

    function renderTrustPage() {
      return answerPage("Trust", "The instrument rather than the brand. Every figure on the other pages is worth what this page says it is.", (data, page) => ''
        + section({ id: "trust-score", title: "How the score is built", wide: true,
          blurb: "Presence scaled by where you appear and how you are described.",
          body: renderScoreBreakdown(data.overall)
            + '<details class="technical-details"><summary>The formula, and the judgement in it</summary>' + page.objective + '<p class="subtle">score = presence \u00d7 (' + page.weights.prominenceFloor + ' + ' + (1 - page.weights.prominenceFloor).toFixed(1) + ' \u00d7 prominence) \u00d7 (' + page.weights.sentimentFloor + ' + ' + (1 - page.weights.sentimentFloor).toFixed(1) + ' \u00d7 sentiment) \u00d7 100.</p><p class="subtle">The two floors are a judgement, not a measurement: being named late and grudgingly is still better than not being named, so prominence and sentiment scale presence rather than replacing it. Every component above is reported separately so you can ignore the composite entirely.</p></details>' })
        + renderTier(data.tier, foldCard)
        + renderVersions(data.versions, foldCard)
        + renderDecoys(data.decoys, foldCard)
        + renderVariance(data.variance, foldCard)
        + taskCta(currentTasks(), "too-few-answers")
        + renderStability(data.stability, currentTasks(), foldCard)
        + renderPhrasing(data.phrasing, foldCard)
        + renderFraming(data.framing, foldCard)
        + foldCard("trust-check", "Check the machine", "Every figure here rests on a model classifying what another model wrote. Judge a few yourself and the agreement rate becomes the confidence in the whole column.", renderHumanCheck(state.checkState, state.check, trustActions))
        + foldCard("trust-experiments", "Did your change do anything", "Everything else here watches. This tests. Change something, leave a comparable set of questions alone, and whatever moved for both is subtracted rather than claimed.", renderExperiments(state.experimentsState, state.experiments, trustActions))
        + foldCard("trust-schedule", "Keep it running", "A tracker that is run by hand is a snapshot.", renderSchedule(state.scheduleState, state.schedule, state.regions, trustActions))
      );
    }


    const PROMPT_INTENTS = ["discovery", "comparison", "alternatives", "brand", "problem"];
    const PROMPT_STATES = [["", "Any state"], ["tracked", "Tracked"], ["proposed", "Needs review"], ["absent", "Never named"], ["unmeasured", "Cannot measure"]];

    // Score and rank come from the answer engine, so a question shows whether
    // it is working rather than only that it is tracked.
    // The comparison had no way to be fed from the product at all: it shipped
    // with the measurement and without a door into it.
    async function suggestWordings(control: Element) {
      const promptId = control.getAttribute("data-reword-prompt") || "";
      await runAction(control, { loading: "Asking\u2026", success: "Added", error: "Failed" }, async () => {
        const result = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/prompts/suggest-wordings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promptId, count: 3 }),
        });
        state.topicSet = result.set || result;
        state.promptNotice = result.added === undefined
          ? { text: "Wordings added.", kind: "success" }
          : { text: result.added + " wording(s) added, " + result.skipped + " skipped as blank or already there.", kind: result.added ? "success" : "warning" };
        render();
      }).catch(() => {
        state.promptNotice = { text: "Could not get rewordings. The model that writes them needs to be reachable.", kind: "error" };
        render();
      });
    }

    async function addWordingByHand(promptId: string, text: string) {
      if (!text.trim()) return;
      try {
        const result = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/prompts/wordings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promptId, texts: [text] }),
        });
        state.topicSet = result.set || result;
        state.promptNotice = { text: result.added ? "Wording added." : "That wording is already there.", kind: result.added ? "success" : "warning" };
      } catch (error) {
        state.promptNotice = { text: error && (error as any).message ? (error as any).message : String(error), kind: "error" };
      }
      render();
    }

    // Declared the same way a rival is, so it retires and resolves like one,
    // and every count that means rival leaves it out.
    async function addDecoy(name: string) {
      try {
        await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/competitors/decoy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        state.answerEngineState = "idle";
        state.rivalsState = "idle";
        state.promptNotice = { text: "Decoy added. The next read of the answers reports how often it turns up.", kind: "success" };
        loadAnswerEngine();
      } catch (error) {
        state.promptNotice = { text: error && (error as any).message ? (error as any).message : String(error), kind: "error" };
      }
      render();
    }

    async function loadPriority() {
      if (!state.selectedId || state.priorityState === "loading") return;
      state.priorityState = "loading";
      try {
        state.priority = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/question-priority");
        state.priorityState = "ready";
      } catch (error) {
        state.priorityState = "error";
      }
      render();
    }

    function priorityOf(promptId: string) {
      if (!state.priority) return null;
      return state.priority.questions.find((row: any) => row.promptId === promptId) || null;
    }

    // Open beats settled, and the reason is on the badge, because the order is
    // a judgement and the figures it came from are not.
    const FIELD_ORDER = { open: 0, contested: 1, settled: 2, unknown: 3 };

    function sortedPrompts(rows: any[], standings: any) {
      if (state.promptSort === "topic") return rows;
      const copy = rows.slice();
      if (state.promptSort === "open") {
        copy.sort((left, right) => {
          const a = priorityOf(left.id);
          const b = priorityOf(right.id);
          return ((FIELD_ORDER as any)[a ? a.contest.state : "unknown"] || 0) - ((FIELD_ORDER as any)[b ? b.contest.state : "unknown"] || 0);
        });
        return copy;
      }
      // A question with no answer has no score, so it sorts after the scored
      // ones rather than ahead of them as a zero would.
      copy.sort((left, right) => {
        const a = standings.get(left.id);
        const b = standings.get(right.id);
        const scoreOf = (row: any) => (row && row.score.answers ? (row.score.score === null ? 101 : row.score.score) : 102);
        return scoreOf(a) - scoreOf(b);
      });
      return copy;
    }

    function promptStandings() {
      const rows = new Map();
      const data = state.answerEngine;
      if (!data || !data.topics) return rows;
      for (const topic of data.topics) {
        for (const prompt of topic.prompts) rows.set(prompt.promptId, prompt);
      }
      return rows;
    }

    function topicStandings() {
      const rows = new Map();
      const data = state.answerEngine;
      if (!data || !data.topics) return rows;
      for (const topic of data.topics) rows.set(topic.topicId, topic);
      return rows;
    }

    function livePrompts(set: TopicSetShape) { return set.prompts.filter((prompt) => prompt.status !== "retired"); }
    /** Every tile on this row counts live prompts, and the topic tile counted
     * every topic ever generated, so a project regenerated against the right
     * category read as having eight groups of questions and twenty five
     * questions in five of them. */
    function liveTopics(set: TopicSetShape) { return set.topics.filter((topic: any) => topic.status !== "retired"); }

    function filteredPrompts(set: TopicSetShape, standings: any) {
      const filters = state.promptFilters;
      const query = filters.query.trim().toLocaleLowerCase();
      return livePrompts(set).filter((prompt) => {
        if (filters.topicId && prompt.topicId !== filters.topicId) return false;
        if (filters.intent && prompt.intent !== filters.intent) return false;
        if (filters.status === "tracked" && prompt.status !== "active") return false;
        if (filters.status === "proposed" && prompt.status !== "proposed") return false;
        if (filters.status === "unmeasured" && prompt.measuresVisibility) return false;
        if (filters.status === "absent") {
          const standing = standings.get(prompt.id);
          if (!standing || standing.score.answers === 0 || standing.score.appearances > 0) return false;
        }
        return !query || prompt.text.toLocaleLowerCase().includes(query);
      });
    }

    function promptResultSummary(shown: number, total: any) {
      return shown === total ? "Showing all " + total + " question(s)" : "Showing " + shown + " of " + total + " question(s)";
    }

    // A forecast of one run at the saved model set, in one market and one
    // language. An unknown model count says so rather than standing in as one.
    function runForecast(tracked: any) {
      const models = state.home && typeof state.home.modelCount === "number" ? state.home.modelCount : null;
      if (models === null) return { value: "Unknown", note: "the saved model count has not loaded" };
      if (!models) return { value: "None", note: "no models are saved, so a run cannot ask anything" };
      if (!tracked) return { value: "None", note: "nothing is tracked, so a run has nothing to ask" };
      // A run covers nobody in particular plus every tracked persona, so a
      // forecast that leaves them out is short by exactly that multiple.
      if (state.personasState === "idle") { loadPersonas(); }
      if (state.personasState !== "ready" || !state.personas) {
        return { value: "Unknown", note: "the personas a run covers have not loaded" };
      }
      const personas = state.personas.personas.filter((row: any) => row.tracked).length;
      const arms = personas + 1;
      const note = tracked + " question(s) by " + models + " model(s)"
        + (personas ? " on behalf of nobody and " + personas + " persona(s)" : "")
        + ", one market, one language";
      return { value: String(tracked * models * arms), note };
    }

    function renderPromptStats(set: TopicSetShape, standings: any) {
      const live = livePrompts(set);
      const tracked = live.filter((prompt) => prompt.status === "active");
      const proposed = live.filter((prompt) => prompt.status === "proposed").length;
      const measuring = tracked.filter((prompt) => prompt.measuresVisibility).length;
      const answered = tracked.filter((prompt) => { const row = standings.get(prompt.id); return Boolean(row) && row.score.answers > 0; }).length;
      const forecast = runForecast(tracked.length);
      return '<div class="statgrid">'
        + stat("Tracked", String(tracked.length), tracked.length ? "asked on every run" : "nothing is being asked", live.length ? tracked.length / live.length : null)
        + stat("Needs review", String(proposed), proposed ? "proposed, never asked until tracked" : "nothing waiting on you", null)
        + stat("Topics", String(liveTopics(set).length),
            (set.topics.length - liveTopics(set).length)
              ? (set.topics.length - liveTopics(set).length) + " more retired, and left out of every figure"
              : liveTopics(set).length + " group(s) of questions", null)
        + stat("Answers per run", forecast.value, forecast.note, null)
        + stat("Measures visibility", measuring + " of " + tracked.length, "the rest name you, so presence is not earned", tracked.length ? measuring / tracked.length : null)
        + stat("Has an answer", answered + " of " + tracked.length, answered ? "tracked question(s) with archived answers" : "no tracked question has been answered yet", tracked.length ? answered / tracked.length : null)
        + '</div>';
    }

    function renderPromptCoverage(set: TopicSetShape) {
      const live = livePrompts(set);
      const tracked = live.filter((prompt) => prompt.status === "active");
      // Tracked over proposed, because a chip reading 0 that filters to rows
      // looked like a contradiction rather than a blind spot.
      const chips = PROMPT_INTENTS.map((intent) => {
        const count = tracked.filter((prompt) => prompt.intent === intent).length;
        const total = live.filter((prompt) => prompt.intent === intent).length;
        const active = state.promptFilters.intent === intent ? ' active' : '';
        return '<button type="button" class="tag' + (count ? '' : ' warning') + active + '" data-prompt-intent="' + intent + '">' + intentLabel(intent) + ' · ' + count + ' of ' + total + ' tracked</button>';
      }).join("");
      const thin = set.topics.filter((topic) => !tracked.some((prompt) => prompt.topicId === topic.id));
      const note = thin.length
        ? thin.length + ' topic(s) have nothing tracked: ' + thin.map((topic) => html(topic.name)).join(", ") + '.'
        : 'Every topic has at least one tracked question.';
      return section({
        id: "prompt-coverage", title: "Coverage", wide: true,
        blurb: "A buyer arrives five ways. An intent with nothing tracked is a blind spot, not a zero.",
        body: '<div class="coverage">' + chips + '</div><p class="subtle">' + note + '</p>',
        folded: state.panelOpen.indexOf("prompt-coverage") < 0,
      });
    }

    function promptToolbar(set: TopicSetShape, shown: number) {
      const filters = state.promptFilters;
      const topics = set.topics.map((topic) => '<option value="' + html(topic.id) + '"' + (filters.topicId === topic.id ? ' selected' : '') + '>' + html(topic.name) + '</option>').join("");
      const intents = PROMPT_INTENTS.map((intent) => '<option value="' + intent + '"' + (filters.intent === intent ? ' selected' : '') + '>' + intentLabel(intent) + '</option>').join("");
      const states = PROMPT_STATES.map((row) => '<option value="' + row[0] + '"' + (filters.status === row[0] ? ' selected' : '') + '>' + row[1] + '</option>').join("");
      return '<div class="promptbar">'
        + '<input id="prompt-search" type="search" placeholder="Search questions" aria-label="Search questions" value="' + html(filters.query) + '">'
        + '<select data-prompt-filter="topicId" aria-label="Filter by topic"' + (filters.topicId ? ' class="is-set"' : '') + '><option value="">All topics</option>' + topics + '</select>'
        + '<select data-prompt-filter="intent" aria-label="Filter by intent"' + (filters.intent ? ' class="is-set"' : '') + '><option value="">Any intent</option>' + intents + '</select>'
        + '<select data-prompt-filter="status" aria-label="Filter by state"' + (filters.status ? ' class="is-set"' : '') + '>' + states + '</select>'
        + '<select data-prompt-sort aria-label="Order" class="is-set"><option value="topic"' + (state.promptSort === "topic" ? " selected" : "") + '>Group by topic</option><option value="open"' + (state.promptSort === "open" ? " selected" : "") + '>Open fields first</option><option value="worst"' + (state.promptSort === "worst" ? " selected" : "") + '>Worst score first</option></select>'
        + '<span class="prompt-result-summary subtle">' + promptResultSummary(shown, livePrompts(set).length) + '</span></div>';
    }

    function promptBulkInner() {
      const ids = state.promptSelection;
      if (!ids.length) return '';
      const set = state.topicSet || { topics: [], prompts: [] };
      const chosen = set.prompts.filter((prompt) => ids.indexOf(prompt.id) >= 0);
      const proposed = chosen.filter((prompt) => prompt.status === "proposed").length;
      const tracked = chosen.filter((prompt) => prompt.status === "active").length;
      return '<div class="bulkbar"><strong>' + chosen.length + ' selected</strong>'
        + (proposed ? button({ label: "Track " + (proposed), on: { "data-bulk-activate": true } }) : '')
        + (tracked ? button({ label: "Stop tracking " + (tracked), on: { "data-bulk-retire": true } }) : '')
        + (tracked && !state.liveRun ? button({ label: "Run these " + (tracked), kind: "primary", on: { "data-bulk-run": true } }) : '')
        + '<span class="spacer"></span>' + button({ label: "Clear", kind: "link", on: { "data-bulk-clear": true } }) + '</div>';
    }

    function promptRow(prompt: any, standing: any) {
      const checked = state.promptSelection.indexOf(prompt.id) >= 0;
      const notes = [intentLabel(prompt.intent)];
      if (prompt.status === "proposed") notes.push("proposed, not asked yet");
      if (!prompt.measuresVisibility) notes.push("names you, so it cannot measure visibility");
      const priority = priorityOf(prompt.id);
      const answers = standing ? standing.score.answers : 0;
      const label = answers
        ? button({ label: prompt.text, kind: "title", on: { "data-evidence": prompt.id, "data-evidence-title": prompt.text } })
        : html(prompt.text);
      const scoreClass = !standing || standing.score.score === null ? "" : standing.score.score > 0 ? "state-ok" : "state-bad";
      return '<div class="mrow mcols-promptrow">'
        + '<input type="checkbox" data-prompt-checkbox="' + html(prompt.id) + '"' + (checked ? ' checked' : '') + ' aria-label="Select this question">'
        + '<div class="mname"><strong>' + label + '</strong><span class="subtle">' + html(notes.join(" · ")) + (answers ? ' · ' + answers + ' answer(s)' : '') + '</span>'
        + (priority ? '<span class="rowtags">' + fieldBadge(priority) + demandBadge(priority) + '</span>' : '') + '</div>'
        + '<span class="mcell ' + scoreClass + '">' + (answers ? scoreText(standing.score.score) : "Not asked yet") + '</span>'
        + '<span class="mcell">' + (answers ? (standing.rank === null ? "Not named" : "#" + standing.rank) : "") + '</span>'
        + '<span class="mcell">'
        + (prompt.variantOf ? '<span class="subtle">a rewording</span>' : button({ label: "Reword it", kind: "link", on: { "data-reword-prompt": prompt.id, "data-reword-text": prompt.text } }))
        + '</span>'
        + '<span class="mcell">' + (prompt.status === "active"
          ? button({ label: "Stop tracking", kind: "link", tone: "danger", on: { "data-retire-prompt": prompt.id } })
          : button({ label: "Track it", kind: "link", on: { "data-activate-prompt": prompt.id } })) + '</span></div>';
    }

    function renderPromptGroups(set: TopicSetShape, rows: any[], standings: any, topics: any[]) {
      if (!set.topics.length) return '<p class="subtle">No topics yet.</p>';
      if (!rows.length) return '<p class="subtle">No question matches these filters.</p>';
      return set.topics.filter((topic) => rows.some((prompt) => prompt.topicId === topic.id)).map((topic) => {
        const mine = rows.filter((prompt) => prompt.topicId === topic.id);
        const proposed = mine.filter((prompt) => prompt.status === "proposed").length;
        const tracked = mine.filter((prompt) => prompt.status === "active").length;
        const standing = (topics as any).get(topic.id);
        const score = standing && standing.score.answers
          ? '<div class="scorehead"><span class="scoremid">' + scoreText(standing.score.score) + '</span><span class="subtle">' + (standing.rank === null ? "not named" : "rank #" + standing.rank) + '</span></div>'
          : '';
        const bulk = proposed ? button({ label: "Track all " + (proposed), kind: "quiet", on: { "data-activate-topic": topic.id } }) : '';
        const description = topic.description ? html(topic.description) + ' · ' : '';
        return '<section class="section-card"><div class="section-head"><div class="headmain"><h2>' + html(topic.name) + '</h2><p class="subtle">' + description + tracked + ' of ' + mine.length + ' shown tracked</p></div><div class="headaside">' + bulk + score + '</div></div>'
          + '<div class="mtable"><div class="mhead mcols-promptrow"><span></span><span>Question</span><span>Score</span><span>Rank</span><span>Wordings</span><span></span></div>'
          + sortedPrompts(mine, standings).map((prompt) => promptRow(prompt, standings.get(prompt.id))).join("") + '</div></section>';
      }).join("");
    }

    function refreshPromptResults() {
      const list = document.querySelector(".prompt-results");
      if (!list || state.page !== "prompts" || state.topicState !== "ready") { render(); return; }
      const set = state.topicSet || { topics: [], prompts: [] };
      const standings = promptStandings();
      const rows = filteredPrompts(set, standings);
      list.innerHTML = renderPromptGroups(set, rows, standings, (topicStandings() as any));
      const summary = document.querySelector(".prompt-result-summary");
      if (summary) summary.textContent = promptResultSummary(rows.length, livePrompts(set).length);
      // The toolbar is not re-rendered on a filter, so the button that acts on
      // the rows has to be told when there are none to act on.
      const bulk = document.querySelector(".prompt-bulk");
      if (bulk) bulk.innerHTML = promptBulkInner();
    }

    function promptAddForms(set: TopicSetShape, folds = true) {
      if (!set.topics.length) return '';
      const topics = set.topics.map((topic) => '<option value="' + html(topic.id) + '">' + html(topic.name) + '</option>').join("");
      const intents = PROMPT_INTENTS.map((intent) => '<option value="' + intent + '">' + intentLabel(intent) + '</option>').join("");
      const body = ''
        + '<form id="add-prompt-form" class="inline-form"><select name="topicId" aria-label="Topic">' + topics + '</select><input name="text" type="text" value="' + html(state.promptDraft.text) + '" placeholder="best stock screener for indian markets" aria-label="Question"><select name="intent" aria-label="Intent">' + intents + '</select>' + button({ label: "Add", submit: true }) + '</form>'
        + '<details class="technical-details" style="margin-top:14px"><summary>Paste a list</summary>'
        + '<form id="bulk-prompt-form" class="inline-form"><select name="topicId" aria-label="Topic for the pasted questions">' + topics + '</select><select name="intent" aria-label="Intent for the pasted questions">' + intents + '</select><textarea name="text" rows="6" placeholder="One question per line" aria-label="Questions, one per line"></textarea>' + button({ label: "Add them all", submit: true }) + '</form>'
        + '<p class="subtle">One question per line, all under the same topic and intent. A question already in the set is skipped rather than added twice.</p></details>';
      return section({
        id: "prompt-add", title: "Add your own", body, wide: true,
        blurb: "A question you know buyers ask. It starts tracked.",
        ...(folds ? { folded: state.panelOpen.indexOf("prompt-add") < 0 } : {}),
      });
    }

    /** The first paint, before any read has landed. The page's own name is
     * known without asking, so only the figures and the table are shadows. */
    function bootShape() {
      return '<section class="view"><div class="heading"><div><h1>' + html(DESTINATIONS.find((row) => row.page === state.page || (row.also || []).includes(state.page))?.label || CONFIG.productName) + '</h1></div></div>'
        + loading("this page", skeletonTiles(4) + skeletonCard({ rows: 5 })) + '</section>';
    }

    function renderPrompts() {
      const selected = project();
      if (!selected) return '<section class="view"><div class="empty"><div class="empty-copy"><h2>Select a project first</h2></div></div></section>';
      if (state.topicState === "idle") { loadTopics(); }
      if (state.answerEngineState === "idle") { loadAnswerEngine(); }
      if (state.homeState === "idle") { loadHome(); }
      if (state.scheduleState === "idle") { loadSchedule(); }
      if (state.priorityState === "idle") { loadPriority(); }
      if (state.topicState !== "ready") {
        const head = '<section class="view"><div class="heading"><div><h1>Questions</h1><p class="subtle">The questions your buyers ask.</p></div></div>';
        // An error is a sentence. A wait is the shape of what is coming, which
        // holds the space the figures and the table are about to take.
        if (state.topicState === "error") {
          return head + '<div class="empty"><div class="empty-copy"><h2>Could not read the prompt set</h2></div></div></section>';
        }
        return head + loading("the questions", skeletonTiles(6)
          + skeletonCard({ rows: 6, columns: "minmax(0,1fr) 96px 82px 96px 104px" })) + '</section>';
      }
      const set = state.topicSet || { topics: [], prompts: [] };
      const notice = state.promptNotice.text ? '<div class="' + (state.promptNotice.kind === "error" ? "warning-box" : "success-box") + '">' + html(state.promptNotice.text) + '</div>' : '';
      const live = livePrompts(set);
      const active = live.filter((prompt) => prompt.status === "active").length;
      const head = '<section class="view"><div class="heading"><div><h1>Questions</h1><p class="subtle">The questions buyers type, grouped by topic. Every other number in this tool is these questions, asked and archived.</p></div><div class="inline-actions">' + button({ label: (state.promptRunState === "generating" ? "Proposing…" : "Propose a set"), on: { "data-generate-prompts": true } }) + '' + runActionButton("Run all " + active, active > 0) + '</div></div>' + notice + renderLiveRun(state.liveRun);
      if (!live.length) {
        // Retiring the last question must not remove the only way to add one.
        return head + '<div class="empty"><div class="empty-copy"><h2>Nothing is being asked</h2><p class="subtle">Propose a set and a model will suggest the questions buyers ask about what you do, grouped into topics. Nothing runs until you have read them and chosen which to track, because what buyers ask is not something this tool can observe.</p></div></div>' + promptAddForms(set, false) + '</section>';
      }
      const standings = promptStandings();
      const rows = filteredPrompts(set, standings);
      const proposed = live.filter((prompt) => prompt.status === "proposed").length;
      const review = proposed
        ? '<div class="warning-box"><strong>' + proposed + ' question(s) are proposed and not tracked.</strong> A proposed question is never asked. Read them and track the ones buyers actually type. ' + button({ label: "Show only those", kind: "link", on: { "data-prompt-review": true } }) + '</div>'
        : '';
      // A set proposed with nothing established about the business was written
      // off the domain name. Read it that way or it reads like a finding.
      const blind = set.generatedWithoutFacts
        ? '<div class="warning-box"><strong>These were proposed without anything established about the business.</strong> The site read returned no description and no category, so the model had the brand name and the domain and guessed from them. Read every one before tracking it, and say what the company does on Setup to propose a better set.</div>'
        : '';
      // The same rule the answer pages use: what can be acted on stays, what
      // only explains folds into one line above the list.
      const said = [blind, grounding(set), review].filter(Boolean);
      const doable = said.filter((note) => note.indexOf("<button") >= 0);
      const toldOnly = said.filter((note) => doable.indexOf(note) < 0);
      const folded = toldOnly.length
        ? '<details class="caveats" data-fold="prompt-caveats"' + (state.panelOpen.indexOf("prompt-caveats") >= 0 ? " open" : "")
          + '><summary>How this set was written (' + toldOnly.length + ')</summary>' + toldOnly.join("") + '</details>'
        : '';
      return head
        + renderPromptStats(set, standings)
        + doable.join("") + folded
        + renderPromptCoverage(set)
        + promptToolbar(set, rows.length)
        + '<div class="prompt-bulk">' + promptBulkInner() + '</div>'
        + '<div class="prompt-results">' + renderPromptGroups(set, rows, standings, (topicStandings() as any)) + '</div>'
        + promptAddForms(set)
        + '</section>';
    }

    // What a proposal was grounded in decides how much of it is observation
    // and how much is supposition, which does not show on the questions.
    function grounding(set: any) {
      if (!set || !set.generatedAt) return '';
      const held = set.groundedIn;
      if (!held) {
        return '<div class="warning-box"><strong>This set was proposed before observed demand could ground one.</strong> What anyone really asks was not read when these were written, so they are the model\'s supposition about what buyers type. Propose again to ground the next set in what has been observed.</div>';
      }
      if (!held.observed) {
        return '<div class="warning-box"><strong>Nothing observed grounded these questions.</strong> No search queries and no conversations were available when they were proposed, so every one is the model\'s supposition about what buyers type. Connect Search Console on Setup and propose again.</div>';
      }
      const parts = [];
      if (held.searchQueries) parts.push(held.searchQueries + ' search quer(ies)');
      if (held.corpusQuestions) parts.push(held.corpusQuestions + ' past conversation(s)');
      return '<div class="success-box"><strong>Grounded in ' + held.observed + ' question(s) people really asked</strong>, drawn from ' + parts.join(' and ')
        + '. Those are search and conversation records, not a measure of how often anyone asks an assistant, and a subject missing from them is not a subject nobody asks about.</div>';
    }

    function renderSelectedModels(readOnly?: any) { return selectedModelTable({ readOnly, rows: selectedRows(state.catalog, state.selections, state.draftSelections, state.catalogState).map((row) => ({ modelId: row.modelId, displayName: String((row.model as any).displayName), providerLabel: providerShortLabel(state.providers, (row.model as any).providerId), webSearchMode: row.webSearchMode === "provider_native" ? "provider_native" as const : "off" as const, nativeWebSearchSupported: (row.model as any).nativeWebSearchSupported === true, runnable: row.inCatalog ? runsNowCell(row.model, row.modelId, state.providers) : "", unavailable: blockedSelection(row) })) }); }
    function catalogVendors() { return Array.from(new Set(state.catalog.map((item) => catalogVendor(item)).filter((vendor) => vendor.length > 0))).sort((left, right) => left.localeCompare(right)); }
    function filteredCatalogModels() { const query = state.query.toLocaleLowerCase(); const results = state.catalog.filter((item) => { const vendor = catalogVendor(item); const matchesQuery = item.displayName.toLocaleLowerCase().includes(query) || item.modelId.toLocaleLowerCase().includes(query) || vendor.toLocaleLowerCase().includes(query); const matchesVendor = !state.catalogProvider || vendor === state.catalogProvider; const matchesSearch = state.catalogNativeSearch === "all" || (state.catalogNativeSearch === "supported" ? item.nativeWebSearchSupported : !item.nativeWebSearchSupported); return matchesQuery && matchesVendor && matchesSearch; }); results.sort((left, right) => { const leftVendor = catalogVendor(left); const rightVendor = catalogVendor(right); if (state.catalogSort === "vendor") { const vendorOrder = leftVendor.localeCompare(rightVendor); return vendorOrder || left.displayName.localeCompare(right.displayName); } if (state.catalogSort === "newest" || state.catalogSort === "oldest") { const leftReleasedAt = catalogReleasedAt(left); const rightReleasedAt = catalogReleasedAt(right); if (leftReleasedAt === null && rightReleasedAt === null) return left.displayName.localeCompare(right.displayName); if (leftReleasedAt === null) return 1; if (rightReleasedAt === null) return -1; return state.catalogSort === "newest" ? rightReleasedAt - leftReleasedAt : leftReleasedAt - rightReleasedAt; } return left.displayName.localeCompare(right.displayName); }); return results.slice(0, 80); }
    function renderCatalogModelRows(results: any) { return results.map((item: any) => { const chosen = state.draftSelections.get(item.modelId); const isChosen = chosen !== undefined; const vendor = catalogVendor(item); const releasedAt = catalogReleasedAt(item); const released = releasedAt === null ? ' \u00b7 no release date' : ' \u00b7 ' + new Date(releasedAt).toLocaleDateString(); const releasedTitle = releasedAt === null ? ' title="Catalog does not provide a release date"' : ''; return '<div class="mrow mcols-catalog" data-testid="catalog-model" data-model-id="' + html(item.modelId) + '" data-model-vendor="' + html(vendor) + '" data-model-released-at="' + html(releasedAt === null ? "" : String(releasedAt)) + '" data-native-search="' + String(item.nativeWebSearchSupported) + '"><input type="checkbox" data-model-checkbox="' + html(item.modelId) + '" ' + (isChosen ? "checked" : "") + (item.available ? "" : " disabled") + ' aria-label="Select ' + html(item.displayName) + '"><div class="mname"><strong>' + html(item.displayName) + '</strong><span class="mono"' + releasedTitle + '>' + html(item.modelId) + html(released) + '</span>' + (item.available ? '' : '<span class="state-bad">' + html(item.unavailableReason || "Unavailable") + '</span>') + '</div><span class="mcell">' + html(vendor) + '</span>' + runsNowCell(item, item.modelId, state.providers) + webSearchModeControl({ modelId:item.modelId, mode:chosen === "provider_native" ? "provider_native" : "off", supported:isChosen && item.nativeWebSearchSupported, attribute:"model-mode" }) + '</div>'; }).join(""); }
    // Repaints the rows alone. The whole page is 70KB of markup, so re-rendering
    // it per keystroke is felt; this needs .model-list to wrap only the rows.
    function refreshCatalogSearchResults() { const list = document.querySelector(".model-list"); const summary = document.querySelector(".catalog-result-summary"); if (!list || !summary || state.catalogState !== "ready") { render(); return; } const results = filteredCatalogModels(); summary.textContent = catalogResultSummary(results.length); list.innerHTML = results.length === 0 ? '<p class="subtle">No matching models.</p>' : renderCatalogModelRows(results); }
    function blockedSelectionBanner() {
      if (state.providersState !== "ready") return '';
      if (!openRouterOutOfCredit(state.providers)) return '';
      const rows = selectedRows(state.catalog, state.selections, state.draftSelections, state.catalogState);
      const blocked = rows.filter((row) => modelIsBlocked(row.model, row.modelId, state.providers));
      if (!blocked.length) return '';
      return '<div class="warning-box">' + blocked.length + ' of these ' + rows.length + ' models cannot run right now. This OpenRouter account has no credit, so each one answers HTTP 402 and returns no answer. Models ending in :free still run, and local gateway models cost nothing. Setup shows the full picture.</div>';
    }
    async function loadEngines() {
      if (!state.selectedId || state.enginesState === "loading") return;
      state.enginesState = "loading";
      try {
        state.engines = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/engines");
        state.enginesState = "ready";
      } catch (error) {
        state.enginesState = "error";
      }
      render();
    }

    // Asked for by name, because reaching into a signed-in browser is not
    // something opening a settings page should do on the reader's behalf.
    async function probeEngines(button: any) {
      if (!state.selectedId) return;
      try {
        state.engines = await runAction(button, { loading: "Looking\u2026", success: "Found", error: "Not found" },
          () => request("/api/projects/" + encodeURIComponent(state.selectedId) + "/engines?probe=true"));
        state.enginesState = "ready";
      } catch (error) {
        state.modelNotice = { text: error instanceof Error ? error.message : String(error), kind: "error" };
      }
      render();
    }

    async function saveEngines(engineIds: any) {
      if (!state.selectedId) return;
      try {
        state.engines = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/engines", {
          method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ engineIds: engineIds }),
        });
        state.enginesState = "ready";
      } catch (error) {
        state.enginesState = "error";
      }
      render();
    }

    // Which surfaces this browser can drive, asked before a run rather than
    // discovered by spending one. It loads each once and asks none of them.
    async function probeReachNow(button: any) {
      if (!state.selectedId) return;
      state.reachState = "loading";
      render();
      try {
        state.reach = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/engine-reach");
        state.reachState = "ready";
      } catch (error) {
        state.reachState = "error";
        state.modelNotice = { text: error && (error as any).message ? (error as any).message : String(error), kind: "error" };
      }
      restoreButton(button);
      render();
    }

    function renderReach() {
      const action = '<div class="inline-actions">'
        + button({ label: state.reachState === "loading" ? "Checking\u2026" : "Check what this browser can reach", kind: "quiet", disabled: state.reachState === "loading", on: { "data-probe-reach": "true" } })
        + '</div>';
      if (state.reachState !== "ready" || !state.reach) {
        return action + (state.reachState === "error" ? '<p class="subtle">Could not check. The browser may not be running.</p>' : '');
      }
      const rows = state.reach.engines.map((row: any) => '<div class="mrow mcols-reach"><div class="mname"><strong>' + html(row.label) + '</strong>'
        + '<span class="subtle">' + html(row.detail) + '</span></div>'
        + '<span class="mcell ' + reachInk(row.reach) + '">' + html(reachWords(row.reach)) + '</span>'
        + '<span class="mcell mono">' + html((row.landedOn || row.home).slice(0, 34)) + '</span></div>').join("");
      const where = state.reach.found ? '<p class="subtle">' + html(state.reach.found) + '</p>' : '';
      return action + where + '<div class="mtable"><div class="mhead mcols-reach"><span>Surface</span><span>State</span><span>Landed on</span></div>' + rows + '</div>'
        + '<p class="mlegend">' + html(state.reach.caveat) + '</p>';
    }

    function renderEngines() {
      if (state.enginesState === "idle") { loadEngines(); }
      if (state.enginesState !== "ready" || !state.engines) {
        return '<p class="subtle">' + (state.enginesState === "error" ? "Could not read the engines." : "Checking for a browser to drive.") + '</p>';
      }
      const data = state.engines;
      const looked = (data.looked || []).length
        ? '<p class="subtle">Looked at: ' + (data.looked || []).map((where: string) => '<span class="mono">' + html(where) + '</span>').join(", ") + '.</p>'
        : '';
      const reach = data.reachable === null
        ? '<div class="warning-box"><strong>Not checked.</strong> Nothing here has looked at your browser. '
          + button({ label: "Check for a browser", id: "probe-engines", testId: "probe-engines" }) + '</div>'
        : data.reachable
          ? '<div class="success-box">' + html(data.detail) + ' <span class="mono">' + html(data.endpoint) + '</span></div>'
          : '<div class="warning-box"><strong>No browser to drive.</strong> ' + html(data.detail)
            + ' Start the browser with remote debugging, or switch it on from the browser\'s own inspect page. Selecting a surface here is still saved; it just cannot run yet.'
            + looked + '</div>';
      const rows = data.engines.map((engine: any) => '<div class="mrow mcols-engine">'
        + '<input type="checkbox" data-engine-checkbox="' + html(engine.id) + '"' + (engine.selected ? ' checked' : '') + ' aria-label="Ask ' + html(engine.label) + '">'
        + '<div class="mname"><strong>' + html(engine.label) + '</strong><span class="subtle">' + html(engine.caveat) + '</span></div>'
        + '<span class="mcell ' + (engine.selected ? 'state-ok' : '') + '">' + (engine.selected ? "Asked on every run" : "Not asked") + '</span></div>').join("");
      return reach + '<div class="mtable"><div class="mhead mcols-engine"><span></span><span>Surface</span><span>State</span></div>' + rows + '</div>' + renderReach()
        + '<p class="subtle">These are the only sources here that search the web by construction, so they are where citations come from. Nothing signs in on your behalf; the answer is whatever your own signed-in session shows.</p>';
    }

    function renderModels() { if (state.providersState === "idle") { loadProviders(); } const selected = project(); if (!selected) return '<section class="view"><div class="empty"><div class="empty-copy"><h2>Select a project first</h2><p class="subtle">A model configuration belongs to a single project.</p></div></div></section>'; const vendors = catalogVendors(); const results = filteredCatalogModels(); const list = state.catalogState === "idle" || state.catalogState === "loading" ? '<p class="subtle">Loading the OpenRouter model catalog…</p>' : state.catalogState === "error" ? '<div class="warning-box"><strong>Model catalog unavailable</strong><p>' + html(state.catalogError) + '</p>' + button({ label: "Retry", id: "retry-catalog", testId: "retry-catalog" }) + '</div>' : results.length === 0 ? '<p class="subtle">No matching models.</p>' : '<p class="catalog-result-summary">' + catalogResultSummary(results.length) + '</p><div class="mtable">' + catalogHead() + '<div class="model-list">' + renderCatalogModelRows(results) + '</div></div>'; const notice = state.modelNotice.text || (state.selectionsDirty ? "Configuration not saved yet" : ""); const noticeClass = state.modelNotice.kind || (state.selectionsDirty ? "warning" : ""); const saveLabel = state.modelActionState === "error" ? "Retry saving model configuration" : "Save model configuration"; const vendorOptions = vendors.map((vendor) => '<option value="' + html(vendor) + '" ' + (state.catalogProvider === vendor ? "selected" : "") + '>' + html(vendor) + '</option>').join(""); const cfg = monitoringConfiguration(); return '<section class="view"><div class="heading"><div><h1>Choose models</h1><p class="subtle">Pick the models to ask, set each one\'s web search mode, then save them as this project\'s configuration. Currently ' + (cfg.currentVersion ? "saved as v" + cfg.currentVersion : "not saved") + '.</p></div><div class="inline-actions">' + button({ label: saveLabel, kind: state.selectionsDirty || state.modelActionState === "error" ? "primary" : "secondary", id: "save-models", testId: "save-models", on: { "data-action-state": state.modelActionState } }) + '' + saveConfigurationButton(cfg, state.selections.length > 0, false) + '</div></div>' + machineTabs() + '<div id="models-status" class="form-status ' + noticeClass + '" aria-live="polite">' + html(notice) + '</div><div class="section-stack"><section class="section-card"><div class="section-head"><div><h2>Selected models</h2><p class="subtle">Select one or more models.</p></div><span class="tag">' + selectedRows(state.catalog, state.selections, state.draftSelections, state.catalogState).length + '  selected</span></div>' + blockedSelectionBanner() + renderSelectedModels() + '</section><section class="section-card"><div class="section-head"><div><h2>Answer surfaces</h2><p class="subtle">The products a buyer actually opens, read through your own browser. The only sources here that search the web.</p></div></div>' + renderEngines() + '</section><section class="section-card"><div class="section-head"><div><h2>Model catalog</h2><p class="subtle">Searchable and multi-select. A provider that is unreachable contributes nothing; no fabricated models are shown.</p></div><span class="tag ' + (state.catalogState === "ready" ? "ready" : state.catalogState === "error" ? "warning" : "") + '">' + (state.catalogState === "ready" ? "Catalog available" : state.catalogState === "error" ? "Catalog error" : "Loading") + '</span></div><input id="model-search" class="model-search" data-testid="model-search" type="search" value="' + html(state.query) + '" placeholder="Search by model name, model ID or vendor"><div class="model-catalog-controls"><label for="model-provider-filter">Model vendor<select id="model-provider-filter" data-testid="model-provider-filter"><option value="">All vendors</option>' + vendorOptions + '</select></label><label for="model-native-search-filter">Web search capability<select id="model-native-search-filter" data-testid="model-native-search-filter"><option value="all" ' + (state.catalogNativeSearch === "all" ? "selected" : "") + '>All</option><option value="supported" ' + (state.catalogNativeSearch === "supported" ? "selected" : "") + '>Supports native web search</option><option value="unsupported" ' + (state.catalogNativeSearch === "unsupported" ? "selected" : "") + '>Does not support native web search</option></select></label><label for="model-catalog-sort">Sort<select id="model-catalog-sort" data-testid="model-catalog-sort"><option value="name" ' + (state.catalogSort === "name" ? "selected" : "") + '>Name A-Z</option><option value="vendor" ' + (state.catalogSort === "vendor" ? "selected" : "") + '>Vendor A-Z</option><option value="newest" ' + (state.catalogSort === "newest" ? "selected" : "") + '>Release date: newest first</option><option value="oldest" ' + (state.catalogSort === "oldest" ? "selected" : "") + '>Release date: oldest first</option></select></label></div>' + list + '</section></div></section>'; }
    function configurationVisualState(configuration: any) { return state.monitoringSaveState === "idle" ? configuration.status : state.monitoringSaveState; }
    function renderConfigurationDiff(configuration: any) { const diff = configuration.diff; const rows = []; for (const item of diff.addedModels) rows.push("Models added: " + item.displayName); for (const item of diff.removedModels) rows.push("Models removed: " + item.displayName); for (const item of diff.webSearchModeChanges) rows.push("Web search mode change: " + item.displayName + " from \"" + modeText(item.previousMode) + "\" to \"" + modeText(item.currentMode) + "\""); if (diff.protocolVersionChange) rows.push("Protocol version change: " + diff.protocolVersionChange.previous + " → " + diff.protocolVersionChange.current); if (diff.domainChange) rows.push("Domain change: " + diff.domainChange.previous + " → " + diff.domainChange.current); if (diff.languageChange) rows.push("Output language change: " + diff.languageChange.previous + " → " + diff.languageChange.current); if (rows.length === 0) return ""; return '<section class="section-card" data-testid="configuration-diff"><div class="section-head"><div><h2>Changes in this run</h2><p class="subtle">Saving creates a new configuration version.</p></div></div><ul class="protocol-list">' + rows.map((row) => '<li>' + html(row) + '</li>').join("") + '</ul></section>'; }
    function renderConfigurationRows(configuration: any) { if (state.baselines.length === 0) return '<p class="subtle">No past configurations yet.</p>'; const currentId = configuration.currentBaseline ? configuration.currentBaseline.id : ""; return '<div class="baseline-list">' + state.baselines.map((baseline) => '<article class="baseline-row" data-testid="configuration-version-row" data-configuration-id="' + html(baseline.id) + '"><div><strong>config v' + baseline.version + (currentId === baseline.id ? " · Current version" : "") + '</strong><span>' + html(baseline.normalizedDomain) + ' · ' + baseline.modelSnapshots.length + '  models</span><span>' + baseline.modelSnapshots.map((item: any) => html(item.displayName + "（" + modeText(item.webSearchMode) + "）")).join(", ") + '</span></div><span class="tag mono">' + html(formatTime(baseline.createdAt)) + '</span></article>').join("") + '</div>'; }
    function renderTechnicalDetails(configuration: any) { const protocol = configuration.currentProtocol; const capabilities = configuration.currentModelSnapshots.length ? configuration.currentModelSnapshots.map((item: any) => '<li>' + html(item.displayName + " · " + formatTime(item.capabilityCheckedAt)) + '</li>').join("") : '<li>The capability check time is recorded once models are saved.</li>'; return '<details class="technical-details"><summary>Technical details</summary><div class="detail-grid"><div class="detail-cell"><span>Protocol</span><strong>' + html(protocol.protocolId + "/" + protocol.protocolVersion) + '</strong></div><div class="detail-cell"><span>Protocol hash</span><strong>' + html(protocol.promptTemplateHash || "Recorded on first save") + '</strong></div><div class="detail-cell"><span>Input scope</span><strong>Domain only</strong></div><div class="detail-cell"><span>Output language</span><strong>' + html(configuration.currentLanguage) + '</strong></div></div><p class="field-help">Model capability check time</p><ul class="protocol-list">' + capabilities + '</ul></details>'; }
    // A disabled button reading "✓ saved" is a status wearing the loudest paint
    // on the page. It stops leading the moment there is nothing to press.
    function saveConfigurationButton(configuration: any, hasModels: any, lead = true) { const visual = configurationVisualState(configuration); const disabled = !hasModels || visual === "unchanged" || visual === "saving" || visual === "saved"; const label = visual === "no_version" ? "Save config v1" : visual === "unchanged" ? "✓ Current configuration saved" : visual === "changed" ? "Save as config v" + configuration.nextVersion : visual === "saving" ? "Saving…" : visual === "saved" ? "✓ Saved as v" + configuration.currentVersion : "Save again"; return button({ label: label, kind: lead && !disabled ? "primary" : "secondary", disabled: disabled, id: "save-monitoring-configuration", testId: "save-monitoring-configuration", on: { "data-action-state": visual } }); }
    /** The page only draws. Loading stays here, because a view that fetches
     * is a view that cannot be rendered twice. */
    function renderSetup() {
      if (state.providersState === "idle") { loadProviders(); }
      if (state.storageState === "idle") { loadStorage(); }
      if (state.credentialsState === "idle") { loadCredentials(); }
      if (state.integrationsState === "idle") { loadIntegrations(); }
      if (state.externalMetricsState === "idle" && state.selectedId) { loadExternalMetrics(); }
      return setupView({
        providers: state.providers,
        providersState: state.providersState,
        storage: state.storage,
        storageState: state.storageState,
        storageBackend: state.storageBackend,
        storageCheck: state.storageCheck,
        credentials: state.credentials,
        credentialsState: state.credentialsState,
        credentialNotice: state.credentialNotice,
        integrations: state.integrations,
        integrationsState: state.integrationsState,
        externalMetrics: state.externalMetrics?.snapshots || [],
        externalMetricsState: state.externalMetricsState,
        externalMetricsPulling: state.externalMetricsPulling,
        externalMetricsNotice: state.externalMetricsNotice,
        selectedProject: Boolean(project()),
      });
    }

    function renderConfiguration() { const selected = project(); if (!selected) return '<section class="view"><div class="empty"><div class="empty-copy"><h2>Select a project first</h2><p class="subtle">A configuration belongs to a single project.</p></div></div></section>'; if (state.configurationState === "loading") return '<section class="view"><div class="heading"><div><h1>Configuration</h1><p class="subtle">Loading the current configuration…</p></div></div>' + machineTabs() + '<div class="section-card inline-empty" aria-live="polite">Loading the domain, models and web search modes.</div></section>'; const configuration = monitoringConfiguration(); const hasModels = selectedRows(state.catalog, state.selections, state.draftSelections, state.catalogState).length > 0; const notice = state.monitoringNotice.text; const noticeKind = state.monitoringNotice.kind; const stateMessage = !hasModels ? "Select at least one available model before saving the configuration." : configuration.status === "no_version" ? "No configuration saved yet. Saving fixes the current domain, language, models and web search modes." : configuration.status === "changed" ? "The models or web search modes have changed. Saving creates a new configuration version." : "The current models and web search modes are saved."; const stateClass = !hasModels || configuration.status === "changed" ? "warning-box" : configuration.status === "unchanged" ? "success-box" : "warning-box"; return '<section class="view"><div class="heading"><div><h1>Configuration</h1><p class="subtle">Save the domain, output language and each model\'s web search mode as reusable monitoring conditions.</p></div>' + saveConfigurationButton(configuration, hasModels) + '</div>' + machineTabs() + '<div id="monitoring-configuration-status" data-testid="monitoring-configuration-status" class="form-status ' + html(noticeKind) + '" aria-live="polite">' + html(notice) + '</div><div class="section-stack"><section class="section-card"><div class="section-head"><div><h2>Current version</h2><p class="subtle">Target domain: <span class="mono">' + html(selected.normalizedDomain) + '</span></p></div><span class="tag ' + (configuration.status === "unchanged" ? "ready" : "warning") + '">' + (configuration.currentVersion ? "v" + configuration.currentVersion : "Not saved yet") + '</span></div><div class="' + stateClass + '" data-testid="monitoring-configuration-summary">' + html(stateMessage) + '</div></section><section class="section-card"><div class="section-head"><div><h2>Current model configuration</h2><p class="subtle">Each model stores its own web search mode.</p></div>' + button({ label: "Adjust models", on: { "data-page": "models" } }) + '</div>' + renderSelectedModels(true) + '</section>' + renderConfigurationDiff(configuration) + '<section class="section-card"><div class="section-head"><div><h2>Past configurations</h2><p class="subtle">Read-only snapshot. Saving a new version does not overwrite past configurations.</p></div></div>' + renderConfigurationRows(configuration) + '</section>' + renderTechnicalDetails(configuration) + '</div></section>'; }
    const brandMark = CONFIG.brandMark;
    const brandLockup = CONFIG.brandLockup;
    function phase2RenderImpl() { if (window.__citegeoPhase5Active) return; const selected = project(); const options = state.currentProjects.length ? state.currentProjects.map((item) => '<option value="' + html(item.id) + '">' + html(item.name) + ' · ' + html(item.normalizedDomain) + '</option>').join("") : '<option value="">No projects yet</option>'; let view = state.booting ? bootShape() : state.page === "marketer" ? renderMarketer() : state.page === "drafts" ? renderDrafts() : state.page === "claims" ? renderClaims() : state.page === "buying" ? renderBuying() : state.page === "conversations" ? renderConversations() : state.page === "entity" ? renderEntity() : state.page === "reports" ? renderReport() : state.page === "models" ? renderModels() : state.page === "configuration" ? renderConfiguration() : state.page === "setup" ? renderSetup() : state.page === "visibility" ? renderVisibility() : state.page === "brand-visibility" ? renderBrandVisibility() : state.page === "trust" ? renderTrustPage() : state.page === "prompts" ? renderPrompts() : state.page === "answer-engine" ? renderAnswerEngine() : state.page === "dashboard" ? renderHome(state, project(), currentTasks(), runActionButton, homeActions) : renderOverview(state, project(), monitoringConfiguration().currentVersion); app.innerHTML = renderEvidence() + '<div class="shell">' + navScrim() + '<aside class="sidebar"><button type="button" class="brand" data-page="dashboard" aria-label="Back to the dashboard">' + brandLockup + '</button><div class="project-label">Project</div><select id="project-select" class="project-select" aria-label="Switch project" data-testid="project-select">' + options + '</select>' + sidebar({ page: state.page, options }) + '<div class="sidebar-bottom">Domain recognition</div></aside><main class="workspace"><header class="topbar"><div class="topbar-lead">' + navToggle() + '<div class="crumb"><button type="button" class="crumb-home" data-page="dashboard">' + html(CONFIG.productName) + '</button> / ' + html(selected ? selected.name : "Project") + '</div></div><div class="topbar-actions"><button type="button" class="theme-toggle" data-theme-toggle aria-label="Switch between light and dark">&#9681;</button>' + button({ label: "New project", id: "new-project", testId: "new-project" }) + '</div></header><section class="content">' + view + '</section>' + renderFooter(state, footerActions) + '</main></div>'; const select = element("project-select"); select.value = state.selectedId; document.title = selected ? selected.name + " | " + CONFIG.productTitle + "" : "" + CONFIG.productTitle + ""; }
    async function setPage(page: any) { clearToasts(); state.page = page; savePreference("page", page); if (page === "configuration") { await refreshConfiguration(); return; } if (page === "reports" && window.__citegeoPhase4 && typeof window.__citegeoPhase4.open === "function") { await window.__citegeoPhase4.open(); return; } render(); if (page === "models") { await refreshConfiguration(); await loadCatalog(); } }
    async function createDraft(event: any) { event.preventDefault(); const control = element("save-draft"); const session = state.drawerSession; setFormStatus("Creating project draft", "loading"); try { const response = await runAction(control, { loading:"Saving…", success:"Saved", error:"Save failed" }, () => request("/api/projects", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ domain:element("project-domain").value, name:element("project-name").value }) })); state.mode = "current"; state.page = "overview"; setSelectedProject(response.project.id); await refreshProjects(); state.selections = []; state.baselines = []; resetDraftSelections(); setFormStatus("Draft saved", "success"); render(); window.setTimeout(() => { if (state.drawerSession === session) closeDrawer(); }, 850); } catch (error) { setFormStatus(error instanceof Error ? error.message : String(error), "error"); } }
    async function saveProject(event: any) { event.preventDefault(); const selected = project(); if (!selected) return; const control = event.currentTarget.querySelector('button[type="submit"]'); try { await runAction(control, { loading:"Saving…", success:"Saved", error:"Save failed" }, () => request("/api/projects/" + encodeURIComponent(selected.id), { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ domain:element("edit-domain").value, name:element("edit-name").value }) })); await refreshProjects(); render(); } catch (error) { toast({ text: error instanceof Error ? error.message : String(error), kind: "error" }); } }
    async function projectAction(action: string, projectId: string, button: HTMLElement | null) { if (action === "select") { setSelectedProject(projectId); state.selectionsDirty = false; await refreshConfiguration(); render(); return; } if (action === "delete" && !window.confirm("The project will be removed from the current list.")) return; if (action === "purge" && !window.confirm("A permanent purge cannot be undone.")) return; const path = "/api/projects/" + encodeURIComponent(projectId) + (action === "archive" ? "/archive" : action === "restore" ? "/restore" : action === "purge" ? "/purge" : ""); const method = action === "delete" || action === "purge" ? "DELETE" : "POST"; const labels = action === "archive" ? { loading:"Archiving…", success:"Archived", error:"Archive failed" } : action === "restore" ? { loading:"Restoring…", success:"Restored", error:"Restore failed" } : action === "purge" ? { loading:"Purging…", success:"Purged", error:"Purge failed" } : { loading:"Deleting…", success:"Deleted", error:"Delete failed" }; try { await runAction(button, labels, () => request(path, { method })); if (state.selectedId === projectId && (action === "archive" || action === "delete" || action === "purge")) setSelectedProject(""); if (action === "restore") { state.mode = "current"; setSelectedProject(projectId); } await refreshProjects(); await refreshConfiguration(); render(); } catch (error) { toast({ text: error instanceof Error ? error.message : String(error), kind: "error" }); } }
    function changeModel(modelId: any, checked: any) { const catalogItem = state.catalog.find((item) => item.modelId === modelId); if (!catalogItem) return; if (!checked) state.draftSelections.delete(modelId); else state.draftSelections.set(modelId, "off"); state.modelNotice = { text:"", kind:"" }; state.modelActionState = "idle"; state.selectionsDirty = true; render(); }
    /** Clears a selection the catalogue no longer offers. changeModel refuses
     * one, so without this the save stays rejected with no way to fix it. */
    function dropSelection(modelId: any) { state.draftSelections.delete(modelId); state.modelNotice = { text:"", kind:"" }; state.modelActionState = "idle"; state.selectionsDirty = true; render(); }
    function changeModelMode(modelId: any, mode: any) { const catalogItem = state.catalog.find((item) => item.modelId === modelId); if (!catalogItem || !state.draftSelections.has(modelId)) return; if (mode === "provider_native" && !catalogItem.nativeWebSearchSupported) return; state.modelNotice = { text:"", kind:"" }; state.modelActionState = "idle"; state.draftSelections.set(modelId, mode); state.selectionsDirty = true; render(); }
    async function saveModels(button: HTMLElement | null) { const selected = project(); if (!selected) return; const selections = Array.from(state.draftSelections.entries()).map(([modelId, webSearchMode]) => ({ modelId, webSearchMode })); state.modelNotice = { text:"Saving each model's own web search mode…", kind:"loading" }; try { const response = await runAction(button, { loading:"Saving…", success:"Saved", error:"Save failed" }, () => request("/api/projects/" + encodeURIComponent(selected.id) + "/models", { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ selections }) })); state.selections = response.selections; resetDraftSelections(); state.modelNotice = { text:"Model configuration saved", kind:"success" }; state.modelActionState = "success"; render(); window.setTimeout(() => { state.modelActionState = "idle"; if (state.page === "models") render(); }, 850); } catch (error) { state.modelNotice = { text:error instanceof Error ? error.message : String(error), kind:"error" }; state.modelActionState = "error"; render(); } }
    async function saveMonitoringConfiguration() { const selected = project(); const configuration = monitoringConfiguration(); if (!selected || configuration.status === "unchanged" || state.monitoringSaveState === "saving") return; if (selectedRows(state.catalog, state.selections, state.draftSelections, state.catalogState).length === 0) { state.monitoringNotice = { text:"Select at least one available model before saving the configuration.", kind:"error" }; state.monitoringSaveState = "failed"; render(); return; } state.monitoringSaveState = "saving"; state.monitoringNotice = { text:"Saving the current domain, language, models and web search modes…", kind:"loading" }; render(); try { const response = await request("/api/projects/" + encodeURIComponent(selected.id) + "/baselines", { method:"POST", headers:{"Content-Type":"application/json"}, body:"{}" }); state.currentProjects = state.currentProjects.map((item) => item.id === response.project.id ? response.project : item); state.projects = state.projects.map((item) => item.id === response.project.id ? response.project : item); await refreshConfiguration(); const version = response.baseline.version; state.monitoringSaveState = "saved"; state.monitoringNotice = { text:"Saved as config v" + version, kind:"success" }; render(); window.setTimeout(() => { state.monitoringSaveState = "idle"; if (state.page === "configuration") render(); }, 850); } catch (error) { if (errorCode(error) === "baseline_unchanged") { await refreshConfiguration(); state.monitoringSaveState = "idle"; state.monitoringNotice = { text:"The current configuration is already saved", kind:"success" }; render(); return; } state.monitoringSaveState = "failed"; state.monitoringNotice = { text: error instanceof Error ? error.message : (expectedErrorText.request_failed || "The request failed."), kind: "error" }; render(); } }
    document.addEventListener("click", async (event) => {
      const clicked = el(event.target) as any;
      if (!clicked || !clicked.closest) return;
      if (clicked.closest("[data-generate-prompts]")) { await postPrompts("/topics/generate", {}, "generating", "A set has been proposed. Read it, then track the questions worth tracking."); return; }
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
        const ids = filteredPrompts(set, promptStandings())
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
        if (bar) bar.innerHTML = promptBulkInner();
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
      if (probeButton) { await captureSignals(probeButton); state.signalsState = "idle"; loadSignals(); return; } if (!(target instanceof Element)) return; const pageButton = target.closest("[data-page]"); if (pageButton) { await setPage(pageButton.getAttribute("data-page") || "overview"); return; } const listModeButton = target.closest("[data-list-mode]"); if (listModeButton) { state.mode = listModeButton.getAttribute("data-list-mode") || "current"; await refreshProjects(); render(); return; } if (target.id === "new-project" || target.id === "empty-new-project") { openDrawer(); return; } if (target.id === "close-drawer" || target.id === "cancel-draft" || target.id === "drawer-backdrop") { closeDrawer(); return; } if (target.id === "retry-catalog") { state.catalogState = "idle"; await loadCatalog(); return; } const opened = target.closest("[data-matrix-open]"); if (opened) { const key = opened.getAttribute("data-matrix-open") || ""; const at = state.matrixOpen.indexOf(key); if (at >= 0) state.matrixOpen.splice(at, 1); else state.matrixOpen.push(key); render(); return; } const expand = target.closest("[data-expand-panel]"); if (expand && !target.closest("button:not(.panel-open),a,select,input,textarea,label")) { openPanel(expand.getAttribute("data-expand-panel") || ""); return; } if (target.closest("[data-edit-board]")) { state.editingBoard = !state.editingBoard; render(); return; } const span = target.closest("[data-panel-span]"); if (span) { const parts = (span.getAttribute("data-panel-span") || "").split(":"); setPanelSpan(parts[0] || "", Number(parts[1])); render(); return; } const folded = target.closest("[data-fold]"); if (folded && target.closest("summary")) { const foldId = folded.getAttribute("data-fold") || ""; const foldAt = state.panelOpen.indexOf(foldId); if (foldAt >= 0) state.panelOpen.splice(foldAt, 1); else state.panelOpen.push(foldId); savePreference("panelOpen", state.panelOpen.join(",")); return; } const hide = target.closest("[data-panel-hide]"); if (hide) { togglePanelHidden(hide.getAttribute("data-panel-hide") || ""); render(); return; } if (target.closest("[data-reset-panels]")) { resetPanelOrder(); state.editingBoard = false; render(); return; } const tracked = target.closest("[data-track-question]"); if (tracked) { state.promptDraft = { topicId: "", text: tracked.getAttribute("data-track-question") || "", intent: "discovery" }; await setPage("prompts"); toast({ text: "Pick a topic for it under Add your own, then add it." }); return; } const brand = target.closest("[data-brand-evidence]"); if (brand) { await openBrandEvidence(brand.getAttribute("data-brand-evidence") || "", brand.getAttribute("data-brand-tone") || ""); return; } const dropped = target.closest("[data-drop-selection]"); if (dropped) { dropSelection(dropped.getAttribute("data-drop-selection") || ""); return; } if (target.id === "probe-engines") { await probeEngines((target as any)); return; }  if (target.id === "save-models") { await saveModels((target as any)); return; } if (target.id === "save-monitoring-configuration") { await saveMonitoringConfiguration(); return; } if (target.id === "archive-project") { const selected = project(); if (selected) await projectAction("archive", selected.id, (target as any)); return; } if (target.id === "delete-project") { const selected = project(); if (selected) await projectAction("delete", selected.id, (target as any)); return; } const action = target.closest("[data-project-action]"); if (action) { const projectId = action.getAttribute("data-project-id"); const name = action.getAttribute("data-project-action"); if (projectId && name) await projectAction(name, projectId, (action as any)); } });
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
    async function refreshRecognition() { const selected = project(); if (!selected) { state.recognitionRuns = []; state.recognitionDetail = null; state.recognitionModelDetails = {}; return; } const projectId = selected.id; const listed = await request("/api/projects/" + encodeURIComponent(projectId) + "/recognition-runs"); if (projectId !== state.selectedId) return; state.recognitionRuns = listed.runs || []; const runId = state.recognitionSelectedRunId || (state.recognitionRuns[0] ? state.recognitionRuns[0].id : ""); if (!runId) { state.recognitionDetail = null; state.recognitionModelDetails = {}; if (state.page === "recognition") render(); return; } const detail = await request("/api/projects/" + encodeURIComponent(projectId) + "/recognition-runs/" + encodeURIComponent(runId)); if (projectId !== state.selectedId) return; state.recognitionSelectedRunId = (detail as any).run.id; state.recognitionDetail = detail; const pairs = await Promise.all(detail.modelRuns.map(async (modelRun: any) => { try { return [modelRun.id, await request("/api/projects/" + encodeURIComponent(projectId) + "/recognition-runs/" + encodeURIComponent((detail as any).run.id) + "/model-runs/" + encodeURIComponent(modelRun.id))]; } catch { return [modelRun.id, null]; } })); state.recognitionModelDetails = {}; for (const pair of pairs) { if (pair[1]) state.recognitionModelDetails[pair[0]] = pair[1]; } if (state.page === "recognition") render(); if ((detail as any).run.status === "queued" || (detail as any).run.status === "running") { window.clearTimeout(state.recognitionRefreshTimer); state.recognitionRefreshTimer = window.setTimeout(() => { if (state.page === "recognition") refreshRecognition().catch(() => {}); }, 1000); } }
    async function startRecognition() { const selected = project(); if (!selected || activeRecognitionRun() || state.recognitionActionState === "loading") return; const idempotencyKey = crypto.randomUUID(); state.recognitionActionState = "loading"; state.recognitionNotice = { text:"Creating a separate execution record for each model…", kind:"loading" }; render(); try { const response = await request("/api/projects/" + encodeURIComponent(selected.id) + "/recognition-runs", { method:"POST", headers:{ "Idempotency-Key":idempotencyKey } }); state.recognitionSelectedRunId = response.run.id; state.recognitionActionState = "success"; state.recognitionNotice = { text:"Recognition test started. Waiting for models to respond.", kind:"success" }; await refreshRecognition(); window.setTimeout(() => { state.recognitionActionState = "idle"; if (state.page === "recognition") render(); }, 850); } catch (error) { state.recognitionActionState = "error"; state.recognitionNotice = { text: error instanceof Error ? error.message : (expectedErrorText.request_failed || "The request failed."), kind: "error" }; render(); } }
    async function retryRecognition(modelRunId: any, button: HTMLElement | null) { const selected = project(); const detail = state.recognitionDetail; if (!selected || !detail) return; try { await runAction(button, { loading:"Retrying…", success:"Started", error:"Retry failed" }, () => request("/api/projects/" + encodeURIComponent(selected.id) + "/recognition-runs/" + encodeURIComponent(((detail as any).run.id as any)) + "/model-runs/" + encodeURIComponent(modelRunId) + "/retry", { method:"POST" })); state.recognitionNotice = { text:"A new execution attempt was created for this model.", kind:"success" }; await refreshRecognition(); } catch (error) { state.recognitionNotice = { text: error instanceof Error ? error.message : (expectedErrorText.request_failed || "The request failed."), kind: "error" }; render(); } }
    async function reanalyzeRecognition(modelRunId: any, attemptId: any, button: HTMLElement | null) { const selected = project(); const detail = state.recognitionDetail; if (!selected || !detail || !attemptId) return; try { await runAction(button, { loading:"Parsing the saved answer…", success:"Local parse complete", error:"Parsing failed" }, () => request("/api/projects/" + encodeURIComponent(selected.id) + "/recognition-runs/" + encodeURIComponent(((detail as any).run.id as any)) + "/model-runs/" + encodeURIComponent(modelRunId) + "/attempts/" + encodeURIComponent(attemptId) + "/reanalyze", { method:"POST" })); state.recognitionNotice = { text:"A new local parse was generated from the saved raw answer. No model was called.", kind:"success" }; await refreshRecognition(); } catch (error) { state.recognitionNotice = { text: error instanceof Error ? error.message : (expectedErrorText.request_failed || "The request failed."), kind: "error" }; render(); } }
    const phase2Render = phase2RenderImpl;
    renderOverride = function renderWithRecognition() { if (window.__citegeoPhase5Active) return; if (state.page !== "recognition") return phase2Render(); const selected = project(); const options = state.currentProjects.length ? state.currentProjects.map((item) => '<option value="' + html(item.id) + '">' + html(item.name) + ' · ' + html(item.normalizedDomain) + '</option>').join("") : '<option value="">No projects yet</option>'; app.innerHTML = renderEvidence() + '<div class="shell">' + navScrim() + '<aside class="sidebar"><button type="button" class="brand" data-page="dashboard" aria-label="Back to the dashboard">' + brandLockup + '</button><div class="project-label">Project</div><select id="project-select" class="project-select" aria-label="Switch project" data-testid="project-select">' + options + '</select>' + sidebar({ page: state.page, options }) + '<div class="sidebar-bottom">Domain recognition</div></aside><main class="workspace"><header class="topbar"><div class="topbar-lead">' + navToggle() + '<div class="crumb"><button type="button" class="crumb-home" data-page="dashboard">' + html(CONFIG.productName) + '</button> / ' + html(selected ? selected.name : "Project") + '</div></div><div class="topbar-actions"><button type="button" class="theme-toggle" data-theme-toggle aria-label="Switch between light and dark">&#9681;</button>' + button({ label: "New project", id: "new-project", testId: "new-project" }) + '</div></header><section class="content">' + renderRecognitionPage() + '</section>' + renderFooter(state, footerActions) + '</main></div>'; const select = element("project-select"); if (select) select.value = state.selectedId; document.title = selected ? selected.name + " | " + CONFIG.productTitle + "" : "" + CONFIG.productTitle + ""; };
    document.addEventListener("click", async (event) => { const target = el(event.target) as any; if (!(target instanceof Element)) return; if (target.id === "start-recognition") { await startRecognition(); return; } const evidenceButton = target.closest("[data-evidence-target]"); if (evidenceButton) { const card = evidenceButton.closest("[data-testid=recognition-model-run]"); const details = card ? card.querySelector("details.evidence-details") : null; if (details) (details as any).open = true; const evidenceTarget = evidenceButton.getAttribute("data-evidence-target"); window.setTimeout(() => { const marked = evidenceTarget ? element(evidenceTarget) : null; if (marked) marked.scrollIntoView({ block:"center", behavior:"smooth" }); }, 0); return; } const runButton = target.closest("[data-recognition-run]"); if (runButton) { state.recognitionSelectedRunId = runButton.getAttribute("data-recognition-run") || ""; await refreshRecognition(); return; } const reanalyzeButton = target.closest("[data-recognition-reanalyze]"); if (reanalyzeButton) { await reanalyzeRecognition(reanalyzeButton.getAttribute("data-recognition-reanalyze") || "", reanalyzeButton.getAttribute("data-recognition-attempt") || "", (reanalyzeButton as any)); return; } const retryButton = target.closest("[data-recognition-retry]"); if (retryButton) { await retryRecognition(retryButton.getAttribute("data-recognition-retry") || "", (retryButton as any)); return; } const pageButton = target.closest("[data-page]"); if (pageButton && pageButton.getAttribute("data-page") === "recognition") { window.setTimeout(() => refreshRecognition().catch((error) => { state.recognitionNotice = { text: error instanceof Error ? error.message : (expectedErrorText.request_failed || "The request failed."), kind: "error" }; render(); }), 0); } if (pageButton && pageButton.getAttribute("data-page") !== "recognition") window.clearTimeout(state.recognitionRefreshTimer); });
    document.addEventListener("change", (event) => { const target = el(event.target) as any; if (target instanceof HTMLSelectElement && target.id === "project-select") { state.recognitionSelectedRunId = ""; window.setTimeout(() => { if (state.page === "recognition") refreshRecognition().catch(() => {}); }, 0); } });
    wireNav();
    // The grid is replaced on every render, so the drag is delegated once and
    // a drop re-renders from the order it just saved.
    wirePanelDrag(() => render());
    wireChartHover();
    (window as any).__citegeoPhase2 = { state, app, html, element, project, formatTime, brandMark, brandLockup, request, refreshRecognition, machineTabs, phase2Render, render: () => render() };
}

// The shell renders the mount point and the configuration, then this runs.
boot();
