import { CONFIG } from "./config.js";
import { dashboardBody, dashboardPanels, heroStats, type DashboardData } from "./pages/dashboard-view.js";
import { emptyState, notice, section } from "./components/primitives.js";
import { button } from "./components/button.js";
import { navScrim, navToggle, wireNav } from "./components/nav.js";
import { hasPanelOrder, resetPanelOrder, setPanelSpan, togglePanelHidden, wirePanelDrag } from "./components/reorder.js";
import { wireChartHover } from "./components/chart-hover.js";
import { setupView, type CredentialRow, type IntegrationRow, type ProviderRow, type SetupData, type StorageCheck, type StorageSettings } from "./pages/setup-view.js";

/** What moved since the previous run, in sentences. Only built when
 * something did: a digest that usually says nothing stops being read. */
interface AnswerDigest {
  headline: string;
  newsworthy: boolean;
  lines: string[];
  builtAt: string;
}

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
    crawlers: Unshaped; crawlersState: LoadState;
    plan: Unshaped; planState: LoadState;
    signals: Unshaped; signalsState: LoadState;
    credentials: CredentialFile | null; credentialsState: LoadState; credentialNotice: Notice;
    integrations: IntegrationRow[]; integrationsState: LoadState;
    digest: AnswerDigest | null; digestState: LoadState;
    demand: Unshaped; demandState: LoadState;
    dashMetric: string; dashRange: string;
    catalog: CatalogModel[]; catalogState: LoadState; catalogError: string;
    query: string; catalogProvider: string; catalogNativeSearch: string; catalogSort: string;
    selections: SelectionRow[]; draftSelections: Map<string, string>; selectionsDirty: boolean;
    baselines: Unshaped[]; monitoringConfiguration: Payload | null; configurationState: LoadState;
    drawerSession: number; modelNotice: Notice; monitoringNotice: Notice;
    modelActionState: string; monitoringSaveState: string;
    recognitionRuns: Unshaped[]; recognitionDetail: Payload | null;
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
    home: Unshaped; homeState: LoadState;
    cited: Unshaped; citedState: LoadState;
    rivals: Unshaped; rivalsState: LoadState;
    segments: Unshaped; segmentsState: LoadState;
    storage: StorageSettings | null; storageState: LoadState;
    storageDraft: Record<string, string>; storageBackend: string; storageCheck: StorageCheck | null;
    filters: Record<string, string>;
    panel: Panel | null; panelState: LoadState; panelAnswers: AnswerRow[];
    liveRun: RunRow | null; lastRun: RunRow | null; runPollTimer: number;
    runFeed: AnswerRow[]; runFeedState: LoadState; runFeedTimer: number;
    rankPlan: Unshaped; rankPlanState: LoadState;
    brief: Unshaped; briefState: LoadState;
    outreach: Unshaped; outreachState: LoadState; harvesting: boolean;
    searchDemand: Unshaped; searchDemandState: LoadState; pulling: boolean;
    personas: Unshaped; personasState: LoadState;
    priority: Unshaped; priorityState: LoadState;
    referrals: Unshaped; referralsState: LoadState; pullingReferrals: boolean;
    engines: Unshaped; enginesState: LoadState;
    actions: Unshaped[]; actionsState: LoadState;
    matrixOpen: string[];
    editingBoard: boolean;
  }

    const state: State = { page:savedPreference("page", "dashboard"), mode:"current", projects:[], currentProjects:[], selectedId:new URL(window.location.href).searchParams.get("projectId") || localStorage.getItem("citegeo.product.projectId") || "", providers:[], providersState:"idle", insights:null, insightsState:"idle", crawlers:null, crawlersState:"idle", plan:null, planState:"idle", signals:null, signalsState:"idle", credentials:null, credentialsState:"idle", credentialNotice:{text:"",kind:""}, integrations:[], integrationsState:"idle", digest:null, digestState:"idle", demand:null, demandState:"idle", dashMetric:savedPreference("metric", "visibility"), dashRange:savedPreference("range", "all"), catalog:[], catalogState:"idle", catalogError:"", query:"", catalogProvider:"", catalogNativeSearch:"all", catalogSort:"name", selections:[], draftSelections:new Map(), selectionsDirty:false, baselines:[], monitoringConfiguration:null, configurationState:"idle", drawerSession:0, modelNotice:{ text:"", kind:"" }, monitoringNotice:{ text:"", kind:"" }, modelActionState:"idle", monitoringSaveState:"idle", recognitionRuns:[], recognitionDetail:null, recognitionModelDetails:{}, recognitionSelectedRunId:"", recognitionNotice:{ text:"", kind:"" }, recognitionActionState:"idle", recognitionRefreshTimer:0, topicSet:null, topicState:"idle", promptFilters:{ query:"", topicId:"", intent:"", status:"" }, promptSelection:[], answerEngine:null, answerEngineState:"idle", promptRunState:"idle", promptNotice:{ text:"", kind:"" }, promptDraft:{ topicId:"", text:"", intent:"discovery" }, schedule:null, scheduleState:"idle", regions:[], languages:[], home:null, homeState:"idle", cited:null, citedState:"idle", rivals:null, rivalsState:"idle", segments:null, segmentsState:"idle", storage:null, storageState:"idle", storageDraft:{}, storageBackend:"", storageCheck:null, filters:{ modelId:"", regionId:"", languageId:"", topicId:"" }, panel:null, panelState:"idle", panelAnswers:[], liveRun:null, lastRun:null, runPollTimer:0, runFeed:[], runFeedState:"idle", runFeedTimer:0, rankPlan:null, rankPlanState:"idle", brief:null, briefState:"idle", outreach:null, outreachState:"idle", harvesting:false, searchDemand:null, searchDemandState:"idle", pulling:false, personas:null, personasState:"idle", priority:null, priorityState:"idle", promptSort:"topic", referrals:null, referralsState:"idle", pullingReferrals:false, engines:null, enginesState:"idle", actions:[], actionsState:"idle", matrixOpen:[], editingBoard:false };
    const app = document.getElementById("app") as HTMLElement;
    let renderOverride: (() => void) | null = null;
    // render() was a hoisted declaration that a later line reassigned. A
    // module forbids that, and a let would put earlier calls in the dead zone.
    function render(): void { if (renderOverride) renderOverride(); else phase2RenderImpl(); }
    const element = (id: string) => document.getElementById(id) as any;
    const html = (value: unknown) => String(value).split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;").split('"').join("&quot;").split("'").join("&#39;");
    const project = () => state.currentProjects.find((item) => item.id === state.selectedId) || null;
    const formatTime = (value: string) => new Date(value).toLocaleString();
    const modeText = (mode: string) => mode === "provider_native" ? "Provider Native web search" : "Offline";
    const statusText = (status: string) => status === "draft" ? "Draft" : status === "active" ? "Running" : status === "archived" ? "Archived" : "Deleted";
    function setSelectedProject(projectId: string) { if (projectId !== state.selectedId) { state.liveRun = null; state.lastRun = null; state.insights = null; state.insightsState = "idle"; state.plan = null; state.planState = "idle"; state.rankPlan = null; state.rankPlanState = "idle"; state.engines = null; state.enginesState = "idle"; state.actions = []; state.actionsState = "idle"; state.outreach = null; state.outreachState = "idle"; state.searchDemand = null; state.searchDemandState = "idle"; state.personas = null; state.personasState = "idle"; state.priority = null; state.priorityState = "idle"; state.referrals = null; state.referralsState = "idle"; state.crawlers = null; state.crawlersState = "idle"; state.signals = null; state.signalsState = "idle"; } state.selectedId = projectId || ""; if (state.selectedId) localStorage.setItem("citegeo.product.projectId", state.selectedId); else localStorage.removeItem("citegeo.product.projectId"); const next = new URL(window.location.href); if (state.selectedId) next.searchParams.set("projectId", state.selectedId); else next.searchParams.delete("projectId"); window.history.replaceState({ projectId:state.selectedId }, "", next); }
    function setDrawer(open: boolean) { document.body.classList.toggle("drawer-open", open); element("project-drawer").setAttribute("aria-hidden", String(!open)); }
    function openDrawer() { state.drawerSession += 1; setFormStatus("", ""); setDrawer(true); window.setTimeout(() => element("project-domain").focus(), 0); }
    function closeDrawer() { state.drawerSession += 1; setDrawer(false); }
    function setFormStatus(message: string, kind: string) { const target = element("form-status"); target.textContent = message || ""; target.className = kind ? "form-status " + kind : "form-status"; }
    const expectedErrorText: Record<string, string | undefined> = { invalid_project_input:"Invalid project input. Check the domain and name.", project_not_found:"The project does not exist or has been deleted.", project_domain_conflict:"This domain is already used by another project.", project_state_conflict:"The project\'s current status does not allow this action.", project_endpoint_not_found:"The requested project action does not exist.", configuration_invalid:"Invalid configuration. Check the models and their web search modes.", baseline_unchanged:"The current configuration is already saved.", baseline_not_found:"That configuration version does not exist.", model_catalog_unavailable:"The model catalog is temporarily unavailable. Try again shortly.", configuration_operation_failed:"Could not save the configuration. Try again.", recognition_invalid:"The recognition test cannot start. Check the configuration, or wait for the running test to finish.", recognition_run_not_found:"That recognition test record does not exist.", recognition_model_run_not_found:"That model execution record does not exist.", recognition_operation_failed:"The recognition test action failed. Try again.", project_operation_failed:"The project action failed. Try again.", request_failed:"The request did not complete. Check your network and try again." };
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
    function currentList() { if (state.mode === "archived") return state.projects.filter((item) => item.status === "archived"); if (state.mode === "deleted") return state.projects.filter((item) => item.status === "deleted"); return state.projects.filter((item) => item.status === "draft" || item.status === "active"); }
    function listUrl() { if (state.mode === "archived") return "/api/projects?includeArchived=true"; if (state.mode === "deleted") return "/api/projects?includeDeleted=true"; return "/api/projects"; }
    async function refreshProjects() { const responses = state.mode === "current" ? [await request("/api/projects")] : await Promise.all([request("/api/projects"), request(listUrl())]); state.currentProjects = responses[0].projects; state.projects = state.mode === "current" ? state.currentProjects : responses[1].projects; if (!state.currentProjects.some((item) => item.id === state.selectedId)) setSelectedProject(state.currentProjects[0] ? state.currentProjects[0].id : ""); else setSelectedProject(state.selectedId); }
    function resetDraftSelections() { state.draftSelections = new Map(state.selections.map((selection) => [selection.modelId, selection.webSearchMode])); state.selectionsDirty = false; }
    async function refreshConfiguration() { const selected = project(); if (!selected) { state.selections = []; state.baselines = []; state.monitoringConfiguration = null; resetDraftSelections(); return; } state.configurationState = "loading"; render(); try { const result = await Promise.all([request("/api/projects/" + encodeURIComponent(selected.id) + "/models"), request("/api/projects/" + encodeURIComponent(selected.id) + "/baselines"), request("/api/projects/" + encodeURIComponent(selected.id) + "/monitoring-configuration")]); state.selections = result[0].selections; state.baselines = result[1].baselines; state.monitoringConfiguration = result[2].configuration; if (!state.selectionsDirty) resetDraftSelections(); state.configurationState = "ready"; } catch (error) { state.configurationState = "error"; state.monitoringNotice = { text: error instanceof Error ? error.message : (expectedErrorText.request_failed || "The request failed."), kind: "error" }; } render(); }
    async function loadCatalog() { if (state.catalogState === "loading" || state.catalogState === "ready") return; state.catalogState = "loading"; state.catalogError = ""; render(); try { const result = await request("/api/provider-models"); state.catalog = result.models; state.catalogState = "ready"; } catch (error) { state.catalogState = "error"; state.catalogError = error instanceof Error ? error.message : String(error); } render(); }
    function cardActions(item: any) { if (state.mode === "archived") return '<div class="card-actions">' + button({ label: "Restore project", kind: "quiet", on: { "data-project-action": "restore", "data-project-id": item.id } }) + '</div>'; if (state.mode === "deleted") return '<div class="card-actions">' + button({ label: "Restore project", kind: "quiet", on: { "data-project-action": "restore", "data-project-id": item.id } }) + button({ label: "Purge permanently", kind: "quiet", tone: "danger", on: { "data-project-action": "purge", "data-project-id": item.id } }) + '</div>'; return '<div class="card-actions">' + button({ label: "Archive", kind: "quiet", on: { "data-project-action": "archive", "data-project-id": item.id } }) + button({ label: "Delete", kind: "quiet", tone: "danger", on: { "data-project-action": "delete", "data-project-id": item.id } }) + '</div>'; }
    function renderProjectCards() { const rows = currentList(); if (rows.length === 0) { const title = state.mode === "current" ? "No projects yet" : state.mode === "archived" ? "No archived projects" : "No recently deleted projects"; const copy = state.mode === "current" ? "Once you enter a domain, the project is saved as a draft immediately." : "Project lifecycle records are kept here."; return '<div class="empty"><div class="empty-copy" data-testid="empty-state"><h2>' + title + '</h2><p class="subtle">' + copy + '</p>' + (state.mode === "current" ? button({ label: "New project", kind: "primary", id: "empty-new-project" }) : '') + '</div></div>'; }
      return '<div class="mtable" data-testid="project-list"><div class="mhead mcols-project"><span>Project</span><span>Domain</span><span>Status</span><span>Updated</span><span></span></div>' + rows.map((item) => '<div class="mrow mcols-project ' + (item.id === state.selectedId ? "is-selected" : "") + '" data-testid="project-card" data-project-id="' + html(item.id) + '"><button type="button" class="rowlink" data-project-action="select" data-project-id="' + html(item.id) + '" data-testid="project-title">' + html(item.name) + '</button><span class="mcell mono" data-testid="project-domain">' + html(item.normalizedDomain) + '</span><span class="tag ' + html(item.status) + '">' + statusText(item.status) + '</span><span class="mcell mono">' + html(formatTime((item.updatedAt as any))) + '</span>' + cardActions(item) + '</div>').join("") + '</div>'; }
    function monitoringConfiguration() { return state.monitoringConfiguration || { status:"no_version", currentVersion:null, nextVersion:1, currentBaseline:null, currentProtocol:{ protocolId:"domain-recognition", protocolVersion:"v1", inputType:"domain_only", requestedFields:[], promptTemplateHash:"" }, currentDomain:"", currentLanguage:"zh", currentModelSnapshots:[], diff:{ addedModels:[], removedModels:[], webSearchModeChanges:[], protocolVersionChange:null, domainChange:null, languageChange:null } }; }
    function activeBaseline() { return monitoringConfiguration().currentBaseline; }
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

    async function loadSegments() {
      if (!state.selectedId || state.segmentsState === "loading") return;
      state.segmentsState = "loading";
      try {
        state.segments = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/segments");
        state.segmentsState = "ready";
      } catch (error) {
        state.segmentsState = "error";
      }
      render();
    }

    function applySegment(filters: Record<string, string>) {
      state.filters = { modelId:"", regionId:"", languageId:"", topicId:"" };
      for (const key of ["topicId", "modelId", "regionId", "languageId"]) {
        if (filters[key]) state.filters[key] = filters[key];
      }
      state.answerEngineState = "idle";
      state.citedState = "idle";
      loadAnswerEngine();
    }

    async function saveSegment() {
      const name = window.prompt("Name this view");
      if (!name) return;
      await postPrompts("/segments", { name: name, filters: state.filters }, "saving", "View saved.");
      state.segmentsState = "idle";
      loadSegments();
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

    function filtersApplied() {
      return ["modelId", "regionId", "languageId", "topicId"].filter((key) => state.filters[key]).length;
    }

    async function loadAnswerEngine() {
      if (!state.selectedId || state.answerEngineState === "loading") return;
      state.answerEngineState = "loading";
      try {
        state.answerEngine = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/prompt-insights" + filterQuery());
        state.answerEngineState = "ready";
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
        else if (had) { state.answerEngineState = "idle"; state.rankPlanState = "idle"; state.actionsState = "idle"; state.outreachState = "idle"; loadAnswerEngine(); if (state.panel && state.panel.kind === "run") loadRunFeed(); }
        render();
      } catch (error) {
        state.liveRun = null;
      }
    }

    function selectAllShown() {
      const set = state.topicSet || { topics: [], prompts: [] };
      const rows = filteredPrompts(set, promptStandings());
      const all = rows.length > 0 && rows.every((prompt) => state.promptSelection.indexOf(prompt.id) >= 0);
      state.promptSelection = all ? [] : rows.map((prompt) => prompt.id);
      refreshPromptResults();
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
      await postPrompts("/prompt-runs", { promptIds: ids }, "running", "The run finished. Every answer is archived.");
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
      const view = dashboardView();
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
      if (report.state !== "ready" || !report.activity) {
        return head + '<div class="warning-box">' + html(report.detail) + '</div></section>';
      }
      const activity = report.activity;
      const rows = activity.crawlers.map((row: any) => '<div class="mrow mcols-crawler"><div class="mname"><strong>' + html(row.name) + '</strong><span>' + html(row.engine) + ' · ' + html(row.purpose === "live_fetch" ? "fetches when asked" : row.purpose === "training" ? "training crawl" : "search index") + '</span></div><span class="mcell">' + row.fetches + '</span><span class="mcell">' + row.pages + '</span><span class="mcell ' + (row.errorRate ? "state-flag" : "") + '">' + (row.errorRate === null ? "n/a" : Math.round(row.errorRate * 100) + "%") + '</span><span class="mcell mono">' + html(row.lastSeen ? row.lastSeen.slice(0, 10) : "unknown") + '</span></div>').join("");
      const absent = activity.allowedButAbsent.length
        ? '<div class="warning-box"><strong>' + activity.allowedButAbsent.length + ' allowed crawler(s) never arrived.</strong> Nothing links to you where they crawl: ' + html(activity.allowedButAbsent.slice(0, 8).join(", ")) + (activity.allowedButAbsent.length > 8 ? ", and more" : "") + '</div>'
        : '';
      const orphan = activity.citedNeverFetched.length
        ? '<p class="mlegend">' + activity.citedNeverFetched.length + ' cited page(s) were never seen being fetched, so those citations came from a cache, a training set or a third party.</p>'
        : '';
      return head
        + '<div class="countstrip"><span class="count"><strong>' + activity.totalFetches + '</strong>Crawler fetches</span><span class="count"><strong>' + activity.crawlers.length + '</strong>Bots seen</span><span class="count"><strong>' + activity.pages.length + '</strong>Pages fetched</span><span class="count"><strong>' + activity.fetchedNeverCited.length + '</strong>Fetched, never cited</span></div>'
        + absent
        + insightTable("mcols-crawler", ["Crawler", "Fetches", "Pages", "Errors", "Last seen"], rows ? [rows] : [], "No AI crawler appears in this log.")
        + orphan + '</section>';
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
    function savedPreference(key: string, fallback: string) {
      try { return window.localStorage.getItem("citegeo." + key) || fallback; } catch (error) { return fallback; }
    }
    function savePreference(key: string, value: any) {
      try { window.localStorage.setItem("citegeo." + key, value); } catch (error) { return; }
    }
    function rangeCutoff(range: string) {
      if (range === "all") return null;
      const days = range === "7d" ? 7 : 30;
      return Date.now() - days * 24 * 60 * 60 * 1000;
    }
    function trendInRange(trend: any, range: string) {
      const cutoff = rangeCutoff(range);
      if (cutoff === null) return trend;
      return trend.filter((point: any) => Date.parse(point.at) >= cutoff);
    }
    // A line chart drawn by hand. Points with no score leave a gap rather than
    // dropping to zero, because a run that parsed nothing is not 0% visibility.
    function trendChart(points: any[], label?: string) {
      const width = 640;
      const height = 170;
      const left = 34;
      const bottom = 26;
      if (!points.length) return '<p class="subtle">Nothing to plot in this range.</p>';
      const usable = points.filter((point) => point.value !== null);
      if (!usable.length) return '<p class="subtle">No measurable ' + html(label) + ' in this range.</p>';
      const max = points[0].axisMax || Math.max(1, ...usable.map((point) => point.value));
      const x = (index: any) => points.length === 1
        ? left + (width - left) / 2
        : left + index * (width - left - 8) / (points.length - 1);
      const y = (value: any) => 10 + (max - value) * (height - bottom - 10) / (max || 1);
      let path = "";
      let open = false;
      points.forEach((point, index) => {
        if (point.value === null) { open = false; return; }
        path += (open ? " L " : " M ") + x(index).toFixed(1) + " " + y(point.value).toFixed(1);
        open = true;
      });
      const dots = points.map((point, index) => point.value === null
        ? ''
        : '<circle cx="' + x(index).toFixed(1) + '" cy="' + y(point.value).toFixed(1) + '" r="3.5"><title>' + html(point.at.slice(0, 10)) + ': ' + html(point.display) + '</title></circle>').join("");
      const gridY = [0, max / 2, max];
      const grid = gridY.map((value) => '<line x1="' + left + '" x2="' + width + '" y1="' + y(value).toFixed(1) + '" y2="' + y(value).toFixed(1) + '" class="chart-grid"/><text x="0" y="' + (y(value) + 4).toFixed(1) + '" class="chart-axis">' + html(points[0].format(value)) + '</text>').join("");
      return '<svg class="trend" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + html(label) + ' over time">' + grid + '<path d="' + path + '" class="chart-line"/>' + dots + '</svg>';
    }
    function dashboardSeries(data: any, metric: string) {
      const core = data.insights;
      if (metric === "citations") {
        const total = core.citations.answersWithCitations || 0;
        return {
          label: "answers carrying a citation",
          points: data.trend.map((point: any) => ({ at:point.at, value:null, display:"", format:(v: any) => String(Math.round(v)) })),
          headline: total + " of " + core.answered,
          empty: "Citations arrive once a run has web search enabled.",
        };
      }
      if (metric === "voice") {
        const share = core.shareOfVoice.target.share;
        return {
          label: "share of voice",
          points: [],
          headline: share === null ? "not comparable" : Math.round(share * 100) + "%",
          empty: "Share of voice needs an answer that names a competitor.",
        };
      }
      return {
        label: "visibility",
        points: data.trend.map((point: any) => ({
          at: point.at,
          value: point.score === null ? null : point.score * 100,
          display: point.recognized + " of " + point.answered,
          axisMax: 100,
          format: (v: any) => Math.round(v) + "%",
        })),
        headline: core.visibility.score === null ? "n/a" : Math.round(core.visibility.score * 100) + "%",
        empty: "No parsed answers yet.",
      };
    }
    function renderDashboard() {
      if (state.insightsState === "idle") { loadInsights(); }
      const selected = project();
      if (!selected) return '<section class="view"><div class="empty"><div class="empty-copy"><h2>Create a project first</h2><p class="subtle">A dashboard reports on one domain.</p></div></div></section>';
      if (state.insightsState !== "ready" || !state.insights) {
        return '<section class="view"><div class="heading"><div><h1>Dashboard</h1><p class="subtle">How models answer about ' + html(selected.normalizedDomain) + '.</p></div></div><div class="empty"><div class="empty-copy"><h2>' + (state.insightsState === "error" ? "Could not read the evidence" : "Reading every archived answer") + '</h2></div></div></section>';
      }
      const data = state.insights;
      const core = data.insights;
      const metric = state.dashMetric;
      const range = state.dashRange;
      const series = dashboardSeries(data, metric);
      const points = trendInRange(series.points, range);
      const rangeButton = (value: any, label: any) => '<button type="button" class="filter ' + (range === value ? "active" : "") + '" data-dash-range="' + value + '">' + label + '</button>';
      const metricButton = (value: any, label: any) => '<button type="button" class="filter ' + (metric === value ? "active" : "") + '" data-dash-metric="' + value + '">' + label + '</button>';
      const modelRows = core.visibility.byModel.map((row: any) => '<div class="mrow mcols-rank"><div class="mname"><strong>' + html(row.displayName) + '</strong><span class="mono">' + html(row.modelId) + '</span></div><span class="mcell">' + row.recognized + ' / ' + row.answered + '</span><span class="mcell ' + (row.score ? "state-ok" : "state-flag") + '">' + (row.score === null ? "n/a" : Math.round(row.score * 100) + "%") + '</span></div>').join("");
      const criticals = (state.plan && state.plan.actions ? state.plan.actions : []).filter((action: any) => action.severity === "critical");
      const alert = criticals.length
        ? '<div class="warning-box"><strong>' + criticals.length + ' critical finding(s).</strong> ' + html(criticals[0].title) + '. ' + button({ label: "See what to do", kind: "link", on: { "data-page": "visibility" } }) + '</div>'
        : '';
      return '<section class="view"><div class="heading"><div><h1>Dashboard</h1><p class="subtle">Pooled from ' + data.runsConsidered + ' run(s) and ' + core.answered + ' parsed answer(s) for ' + html(data.domain) + '.</p></div><div class="inline-actions">' + button({ label: "Run a test", on: { "data-page": "recognition" } }) + '</div></div>'
        + '<div class="toolbar">' + rangeButton("7d", "7 days") + rangeButton("30d", "30 days") + rangeButton("all", "All time") + '</div>'
        + alert
        + '<div class="countstrip"><span class="count"><strong>' + html(series.headline) + '</strong>' + html(series.label) + '</span><span class="count"><strong>' + core.visibility.recognized + '</strong>Recognised</span><span class="count"><strong>' + core.answered + '</strong>Answers</span><span class="count"><strong>' + core.citations.targetCitedIn + '</strong>Citing you</span><span class="count"><strong>' + data.citationGap.length + '</strong>Citation gaps</span></div>'
        + '<section class="section-card"><div class="section-head"><div><h2>Movement</h2><p class="subtle">Each point is one complete run. A run that parsed nothing leaves a gap rather than dropping to zero.</p></div><div class="toolbar">' + metricButton("visibility", "Visibility") + metricButton("voice", "Share of voice") + metricButton("citations", "Citations") + '</div></div>'
        + '<div class="dash-split"><div>' + (points.length ? trendChart(points, series.label) : '<p class="subtle">' + html(series.empty) + '</p>') + '</div>'
        + '<div><div class="mtable"><div class="mhead mcols-rank"><span>Model</span><span>Recognised</span><span>Visibility</span></div>' + (modelRows || '<div class="mrow mcols-rank"><span class="mcell">No answers yet.</span></div>') + '</div></div></div></section></section>';
    }
    function renderActionPlan() {
      if (state.planState === "idle") { loadPlan(); }
      const head = '<section class="section-card"><div class="section-head"><div><h2>What to do next</h2><p class="subtle">Ordered by what decides whether a model can cite you at all. Every line names the observation behind it.</p></div><div class="inline-actions">' + button({ label: "Probe the site", on: { "data-probe-signals": true } }) + '</div></div>';
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
        + '<span class="step-label"><strong>' + html(action.title) + '</strong><br><span class="step-note">' + html(action.evidence) + '</span>'
        + (action.severity === "done" ? '' : '<br><span class="step-note state-ok">Fix: ' + html(action.fix) + '</span>')
        + '</span></li>';
      return head + changes
        + (open.length ? '<ol class="steps">' + open.map(row).join("") + '</ol>' : '<p class="subtle">Nothing outstanding.</p>')
        + (done.length ? '<details class="technical-details"><summary>' + done.length + ' already in place</summary><ol class="steps">' + done.map(row).join("") + '</ol></details>' : '')
        + '<p class="mlegend">Probed ' + html(plan.capturedAt ? plan.capturedAt.slice(0, 16).split("T").join(" ") : "never") + '.</p></section>';
    }
    function percent(value: any) { return value === null || value === undefined ? '<span class="state-flag">not comparable</span>' : '<strong>' + Math.round(value * 100) + '%</strong>'; }
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
      const modelRows = v.byModel.map((row: any) => '<div class="mrow mcols-vis"><div class="mname"><strong>' + html(row.displayName) + '</strong><span class="mono">' + html(row.modelId) + '</span></div><span class="mcell">' + row.recognized + ' / ' + row.answered + '</span><span class="mcell">' + percent(row.score) + '</span></div>').join("");
      const voiceRow = (row: any, isTarget: any) => '<div class="mrow mcols-voice"><div class="mname"><strong>' + html(row.name) + (isTarget ? ' <span class="state-ok">you</span>' : '') + '</strong>' + (row.domain ? '<span class="mono">' + html(row.domain) + '</span>' : '') + '</div><span class="mcell">' + row.mentions + '</span><span class="mcell">' + percent(row.share) + '</span></div>';
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
    function pct(value: any) { return value === null || value === undefined ? "Not measurable" : Math.round(value * 100) + "%"; }
    function scoreText(value: any) { return value === null || value === undefined ? "Not measurable" : String(value); }
    function intentLabel(intent: string) {
      return intent === "discovery" ? "Discovery" : intent === "comparison" ? "Comparison" : intent === "alternatives" ? "Alternatives" : intent === "brand" ? "Brand" : "Problem";
    }

    function bar(value: any) { return value === null || value === undefined ? '' : '<div class="bar"><i style="width:' + Math.round(value * 100) + '%"></i></div>'; }
    function stat(label: string, value: any, note: string, fraction?: number | null) {
      return '<div class="stat"><span>' + html(label) + '</span><strong>' + value + '</strong><small>' + html(note) + '</small>' + bar(fraction) + '</div>';
    }

    function renderScoreBreakdown(score: any) {
      if (!score || score.answers === 0) return '<p class="subtle">Nothing has been answered yet, so there is nothing to score. This is not a zero.</p>';
      return '<div class="statgrid" style="--tile-columns:3">'
        + stat("Presence", pct(score.presenceRate), score.appearances + ' of ' + score.answers + ' answers named you', score.presenceRate)
        + stat("Prominence", pct(score.prominence), score.prominence === null ? 'No answer gave a readable order' : 'Full marks means always named first', score.prominence)
        + stat("Sentiment", pct(score.sentiment), score.sentiment === null ? 'Nothing named, so nothing judged' : 'Full marks means always recommended', score.sentiment)
        + '</div>';
    }

    function renderAbsent(rows: any[]) {
      if (!rows || !rows.length) return '<p class="subtle">Every prompt with an answer named you at least once.</p>';
      return '<ul class="protocol-list">' + rows.slice(0, 12).map((row) => '<li class="is-clickable" data-evidence="' + html(row.promptId) + '" data-evidence-title="' + html(row.text) + '" tabindex="0" role="button"><strong>' + html(row.text) + '</strong><br><span class="subtle">' + row.score.answers + ' answer(s), none named you. '
        + (row.ahead.length ? 'Named instead: ' + row.ahead.map((entity: any) => html(entity.name)).join(", ") + '.' : 'No competitor was named either, so this question may not be about a product at all.')
        + '</span><br><span class="linklike">Open the brief</span></li>').join("") + '</ul>';
    }

    function renderModelRows(rows: any[]) {
      if (!rows || !rows.length) return '<p class="subtle">No model has answered yet.</p>';
      return '<div class="mtable"><div class="mhead mcols-aemodel"><span>AI assistant</span><span>Score</span><span>Presence</span><span>Answers</span></div>'
        + rows.map((row) => '<div class="mrow mcols-aemodel">'
          + '<div class="mname"><strong>' + html(row.displayName) + '</strong><span class="mono">' + html(row.providerId) + ' · ' + html(row.modelId) + '</span></div>'
          + '<span class="mcell">' + scoreText(row.score.score) + '</span>'
          + '<span class="mcell">' + pct(row.score.presenceRate) + '</span>'
          + '<span class="mcell">' + row.score.answers + '</span></div>').join("")
        + '</div>';
    }

    function renderPromptTrend(trend: any) {
      if (!trend || !trend.points.length) return '<p class="subtle">One run is a snapshot. Run the set again and this becomes a trend.</p>';
      const points = trend.points.map((point: any) => ({
        at: point.at,
        value: point.score.score,
        display: point.score.score === null ? "Not measurable" : point.score.score + " / 100",
        format: (value: any) => Math.round(value) + "",
        axisMax: 100,
      }));
      const change = trend.change === null
        ? '<span class="subtle">Not comparable yet</span>'
        : '<span class="' + (trend.change > 0 ? "state-ok" : trend.change < 0 ? "state-bad" : "") + '">' + (trend.change > 0 ? "+" : "") + trend.change + ' since ' + html(trend.since.slice(0, 10)) + '</span>';
      return '<div class="trend-head">' + change + '</div>' + trendChart(points, "answer engine score");
    }

    function renderRegionRows(rows: any[], caveat: string) {
      if (!rows || !rows.length) return '<p class="subtle">Only one market has been asked, so there is nothing to compare. Pick more when you run.</p>';
      return '<p class="subtle">' + html(caveat) + '</p><div class="mtable"><div class="mhead mcols-aemodel"><span>Market</span><span>Score</span><span>Presence</span><span>Rank</span></div>'
        + rows.map((row) => '<div class="mrow mcols-aemodel">'
          + '<div class="mname"><strong>' + html(row.label) + '</strong></div>'
          + '<span class="mcell">' + scoreText(row.score.score) + '</span>'
          + '<span class="mcell">' + pct(row.score.presenceRate) + '</span>'
          + '<span class="mcell">' + (row.rank === null ? "Not named" : "#" + row.rank) + '</span></div>').join("")
        + '</div>';
    }

    function renderSchedule() {
      if (state.scheduleState === "idle") { loadSchedule(); }
      const schedule = state.schedule;
      if (!schedule) return '<p class="subtle">Reading the schedule.</p>';
      const options = ["daily", "weekly", "monthly"].map((value) => '<option value="' + value + '"' + (schedule.rule.frequency === value ? " selected" : "") + '>' + value.charAt(0).toUpperCase() + value.slice(1) + '</option>').join("");
      const markets = (state.regions || []).map((row) => '<label class="checkline"><input type="checkbox" name="regionIds" value="' + html(row.id) + '"' + (schedule.regionIds.indexOf(row.id) >= 0 ? " checked" : "") + '> ' + html(row.label) + '</label>').join("");
      const next = schedule.enabled && schedule.nextRunAt ? 'Next run ' + html(schedule.nextRunAt.slice(0, 16).replace("T", " ")) + ' UTC.' : 'Not scheduled.';
      const failure = schedule.lastError ? '<div class="warning-box">The last scheduled run did not happen: ' + html(schedule.lastError) + '</div>' : '';
      return failure + '<form id="schedule-form" class="inline-form">'
        + '<label class="checkline"><input type="checkbox" name="enabled"' + (schedule.enabled ? " checked" : "") + '> Run automatically</label>'
        + '<select name="frequency" aria-label="How often">' + options + '</select>'
        + '' + button({ label: "Save schedule", submit: true }) + '</form>'
        + '<p class="subtle">' + next + ' The worker must be running: <span class="mono">npm run monitor:worker</span>.</p>'
        + '<details class="technical-details"><summary>Markets to ask in</summary><div class="checkgrid">' + markets + '</div></details>';
    }

    // A trend read at a glance: no axes, no grid, just the shape.
    function sparkline(points: any[], width?: number, height?: number) {
      const usable = points.filter((point) => point.score.score !== null);
      if (usable.length < 2) return '<span class="subtle">Run again to see movement</span>';
      const values = usable.map((point) => point.score.score);
      const max = Math.max(100, ...values);
      const x = (index: any) => index * (width as any) / (usable.length - 1);
      const y = (value: any) => (height as any) - 2 - (value / max) * ((height as any) - 4);
      const path = usable.map((point, index) => (index ? "L " : "M ") + x(index).toFixed(1) + " " + y(point.score.score).toFixed(1)).join(" ");
      const last = usable[usable.length - 1];
      return '<svg viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="none" role="img" aria-label="score over time" style="width:100%;height:' + height + 'px;overflow:visible">'
        + '<path d="' + path + '" fill="none" stroke="var(--accent)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>'
        + '<circle cx="' + x(usable.length - 1).toFixed(1) + '" cy="' + y(last.score.score).toFixed(1) + '" r="2.75" fill="var(--accent)"/></svg>';
    }

    function deltaPill(trend: any) {
      if (!trend || trend.change === null) return '<span class="pill flat">No movement yet</span>';
      const cls = trend.change > 0 ? "good" : trend.change < 0 ? "bad" : "flat";
      const arrow = trend.change > 0 ? "↑" : trend.change < 0 ? "↓" : "→";
      return '<span class="pill ' + cls + '">' + arrow + " " + Math.abs(trend.change) + '</span>';
    }

    function renderLiveRun() {
      const run = state.liveRun;
      if (!run) return "";
      const done = run.answersCompleted + run.answersFailed;
      const pctDone = run.answersRequested ? Math.round(done / run.answersRequested * 100) : 0;
      const doing = run.currentPromptText
        ? 'Asking ' + html(run.currentModelId || "a model") + ': \u201c' + html(run.currentPromptText) + '\u201d'
        : "Starting up";
      return '<div class="liverun is-clickable" data-open-run="' + html(run.id) + '" role="button" tabindex="0"><div class="liverun-top"><strong>' + (run.status === "cancelling" ? "Stopping" : "Running") + '</strong>'
        + '<span>' + done + ' of ' + run.answersRequested + ' answers</span>'
        + '<span class="spacer"></span>'
        + (run.status === "cancelling"
          ? '<span class="subtle">Finishing the answer in flight.</span>'
          : button({ label: "Stop", tone: "danger", on: { "data-stop-run": true } }))
        + '</div><div class="bar"><i style="width:' + pctDone + '%"></i></div>'
        + '<p class="subtle">' + doing + '. Open this to watch each question and answer as it lands.</p></div>';
    }

    function renderHero(data: any) {
      const rank = data.rank === null ? "Not named" : "#" + data.rank + " of " + data.leaderboard.length;
      const leader = data.leaderboard.find((row: any) => !row.isTarget);
      return '<div class="hero">'
        + '<div class="hero-figure"><span class="scorebig">' + scoreText(data.overall.score) + '</span>'
        + '<span class="hero-sub">' + deltaPill(data.trend) + '<span>' + html(rank) + '</span></span>'
        + '<span class="hero-spark">' + sparkline(data.trend.points, 150, 26) + '</span></div>'
        + '<div class="hero-stats">'
        + '<div class="hero-stat"><span>Presence</span><strong>' + pct(data.overall.presenceRate) + '</strong><small>' + data.overall.appearances + ' of ' + data.overall.answers + ' answers</small></div>'
        + '<div class="hero-stat"><span>Prominence</span><strong>' + pct(data.overall.prominence) + '</strong><small>how early you appear</small></div>'
        + '<div class="hero-stat"><span>Sentiment</span><strong>' + pct(data.overall.sentiment) + '</strong><small>recommended or listed</small></div>'
        + '<div class="hero-stat"><span>Ahead of you</span><strong>' + (leader ? html(leader.name) : "—") + '</strong><small>' + (leader ? leader.appearances + ' answers' : 'nobody named') + '</small></div>'
        + '</div></div>';
    }

    function option(value: any, label: string, selected: unknown) {
      return '<option value="' + html(value) + '"' + (selected === value ? " selected" : "") + '>' + html(label) + '</option>';
    }

    function renderSavedViews() {
      if (state.segmentsState === "idle") { loadSegments(); }
      const saved = state.segments ? state.segments.segments : [];
      if (!saved.length && !filtersApplied()) return "";
      const chips = saved.map((row: any) => '<button type="button" class="filter" data-segment="' + html(row.id) + '">' + html(row.name) + ' <span class="chev" data-segment-remove="' + html(row.id) + '">\u00d7</span></button>').join("");
      const save = filtersApplied() ? '<button type="button" class="filter" data-save-segment>+ Save this view</button>' : '';
      return '<div class="toolbar" style="margin:0 0 4px">' + chips + save + '</div>';
    }

    function renderSegment(data: any) {
      const models = [option("", "All models", state.filters.modelId)].concat(data.byModel.map((row: any) => option(row.modelId, row.displayName, state.filters.modelId)));
      const topics = [option("", "All topics", state.filters.topicId)].concat(data.topics.map((row: any) => option(row.topicId, row.name, state.filters.topicId)));
      const markets = [option("", "All markets", state.filters.regionId)].concat((state.regions || []).map((row) => option(row.id, row.label, state.filters.regionId)));
      const tongues = [option("", "All languages", state.filters.languageId)].concat((state.languages || []).map((row) => option(row.id, row.label, state.filters.languageId)));
      const applied = filtersApplied();
      // A dashed edge means nothing is chosen, a solid one means something is,
      // so the bar says what it is filtering by without a badge or a count.
      const set = (value: any) => value ? ' class="is-set"' : '';
      return '<div class="segment">'
        + '<select data-filter="topicId" aria-label="Topic"' + set(state.filters.topicId) + '>' + topics.join("") + '</select>'
        + '<select data-filter="modelId" aria-label="Model"' + set(state.filters.modelId) + '>' + models.join("") + '</select>'
        + '<select data-filter="regionId" aria-label="Market"' + set(state.filters.regionId) + '>' + markets.join("") + '</select>'
        + '<select data-filter="languageId" aria-label="Language"' + set(state.filters.languageId) + '>' + tongues.join("") + '</select>'
        + (applied ? '<button type="button" class="linklike applied" data-clear-filters>Clear ' + applied + '</button>' : '')
        + '<span class="spacer"></span>'
        + exportMenu() + '</div>';
    }

    const AGGREGATE_EXPORTS = [["scores", "Scores by question"], ["leaderboard", "Who was named"], ["topics", "Topics"], ["models", "By assistant"], ["markets", "By market"], ["trend", "Movement"], ["absent", "Absent from"]];
    const ANSWER_EXPORTS = [["answers", "Every answer"], ["mentions", "Every name in every answer"], ["citations", "Every source"]];

    // The filters travel with the file, so an export is the slice on screen.
    function exportMenu() {
      const link = (base: any, name: any, label: any) => '<a href="/api/projects/' + html(state.selectedId) + '/' + base + '/' + name + '.csv' + filterQuery() + '">' + label + '</a>';
      return '<details class="exportmenu"><summary class="button">Export CSV</summary><div class="exportlist">'
        + '<strong>Aggregates</strong>' + AGGREGATE_EXPORTS.map((row) => link("prompt-export", row[0], row[1])).join("")
        + '<strong>One row per answer</strong>' + ANSWER_EXPORTS.map((row) => link("answer-export", row[0], row[1])).join("")
        + '<span class="subtle">Every aggregate in this tool is built from the answer rows, so exporting them is how a number here gets checked rather than taken.</span>'
        + '</div></details>';
    }

    function renderLeaderboard(rows: any[]) {
      if (!rows || !rows.length) return '<p class="subtle">No organisation was named in any answer yet.</p>';
      const top = rows.slice(0, 12);
      const most = Math.max(1, ...top.map((row) => row.appearances));
      return '<div class="mtable"><div class="mhead mcols-board"><span>#</span><span>Organisation</span><span>Answers naming them</span><span>Prominence</span></div>'
        + top.map((row, index) => '<div class="mrow mcols-board">'
          + '<span class="mcell mono">' + (index + 1) + '</span>'
          + '<div class="mname"><strong>' + html(row.name) + (row.isTarget ? ' <span class="pill good">You</span>' : row.isTracked ? ' <span class="tag">Rival you track</span>' : ' <span class="tag">Named by the models</span>') + '</strong><span class="mono">' + html(row.domain || "no domain given") + '</span></div>'
          + '<span class="mcell"><span class="sharebar' + (row.isTarget ? " is-target" : "") + '"><i style="width:' + Math.round(row.appearances / most * 100) + '%"></i><b>' + row.appearances + ' · ' + pct(row.shareOfAnswers) + '</b></span></span>'
          + '<span class="mcell">' + pct(row.prominence) + '</span></div>').join("")
        + '</div>';
    }

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
      return last + button({ label: (busy ? "Starting…" : html(label)), kind: "primary", disabled: busy || enabled === false, on: { "data-run-prompts": true } });
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
      if (runIsLive()) state.runFeedTimer = window.setTimeout(loadRunFeed, 3000);
      // Patch in place: a full render would throw away the reader's scroll.
      const body = document.querySelector(".panel-body");
      const head = document.querySelector(".runpane-progress");
      if (!body) { render(); return; }
      const top = body.scrollTop;
      body.innerHTML = runFeedBody();
      body.scrollTop = top;
      if (head) head.innerHTML = runPaneProgress();
    }

    function paneRun() {
      const open = state.panel;
      if (!open || open.kind !== "run") return null;
      if (state.liveRun && state.liveRun.id === open.runId) return state.liveRun;
      return state.lastRun && state.lastRun.id === open.runId ? state.lastRun : null;
    }

    function runIsLive() {
      const run = paneRun();
      return Boolean(run && (run.status === "running" || run.status === "cancelling"));
    }

    function runPaneProgress() {
      const run = paneRun();
      if (!run) return '<span class="subtle">Every answer below is archived.</span>';
      if (run.status !== "running" && run.status !== "cancelling") {
        return '<span>' + html(run.status) + ' · ' + run.answersCompleted + ' answered, ' + run.answersFailed + ' failed, of ' + run.answersRequested + ' asked</span>';
      }
      const done = run.answersCompleted + run.answersFailed;
      const share = run.answersRequested ? Math.round(done / run.answersRequested * 100) : 0;
      return '<span>' + done + ' of ' + run.answersRequested + ' answers · ' + run.answersFailed + ' failed</span>'
        + '<div class="bar"><i style="width:' + share + '%"></i></div>';
    }

    function mentionChips(answer: AnswerRow) {
      const rows = (answer.mentions || []).slice().sort((left, right) => (left.firstMentionOffset === null ? 1 : 0) - (right.firstMentionOffset === null ? 1 : 0) || (left.firstMentionOffset || 0) - (right.firstMentionOffset || 0));
      if (!rows.length) return '<span class="subtle">No organisation was named.</span>';
      return rows.map((row, index) => '<span class="namechip' + (row.isTarget ? ' is-you' : '') + '">'
        + '<b>' + (index + 1) + '</b>' + html(row.name)
        + (row.recommendation && row.recommendation !== "unknown" ? ' <i>' + html(row.recommendation) + '</i>' : '')
        + '</span>').join("");
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
      const run = runIsLive() ? paneRun() : null;
      if (!run || !run.currentPromptText) return "";
      return '<article class="evidence is-live"><div class="evidence-head"><strong>' + html(run.currentModelId || "a model") + '</strong>'
        + '<span class="pill flat">asking now</span><span class="spacer"></span><span>waiting for the answer</span></div>'
        + '<div class="runfield"><span>Sent</span><p class="runtext">' + html(run.currentPromptText) + '</p></div></article>';
    }

    function runFeedBody() {
      if (state.runFeedState === "loading" && !state.runFeed.length) return '<p class="subtle">Reading what this run has archived so far.</p>';
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

    function effectLabel(effect: any) {
      return effect === "raises_visibility" ? "Raises the score"
        : effect === "unblocks_measurement" ? "Unblocks measurement"
        : "Widens what is measured";
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
        + (voice.prominence === null ? '' : ' · named ' + pct(voice.prominence) + ' of the way to first');
      const quotes = voice.quotes.length
        ? '<ul class="quotes">' + voice.quotes.map((quote: any) => '<li>' + html(quote) + '</li>').join("") + '</ul>'
        : '<p class="subtle">Named without a reason given.</p>';
      return '<div class="voice' + (voice.isTarget ? ' is-you' : '') + '"><div class="voice-top"><strong>' + html(voice.name) + '</strong>'
        + (voice.isTarget ? '<span class="pill good">You</span>' : '') + '<span class="subtle">' + html(spread) + '</span></div>' + quotes + '</div>';
    }

    function renderBrief() {
      if (state.briefState === "loading") return '<p class="subtle">Reading what the models credited here.</p>';
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

    async function harvestPages() {
      if (!state.selectedId || state.harvesting) return;
      state.harvesting = true;
      render();
      try {
        const result = await request("/api/projects/" + encodeURIComponent(state.selectedId) + "/source-pages", { method:"POST" });
        state.outreach = result.plan;
        state.outreachState = "ready";
        state.promptNotice = { text: result.read + " page(s) read, " + result.skipped + " already read or over the cap, " + result.failed + " would not load.", kind:"success" };
      } catch (error) {
        state.promptNotice = { text: error && (error as any).message ? (error as any).message : String(error), kind:"error" };
      }
      state.harvesting = false;
      render();
    }

    function outreachRow(target: any) {
      const rivals = target.rivals.length
        ? '<span class="namechips">' + target.rivals.slice(0, 8).map((named: any, index: any) => '<span class="namechip"><b>' + (index + 1) + '</b>' + html(named.name) + '</span>').join("") + '</span>'
        : '<span class="subtle">Nobody the answers named is on this page.</span>';
      return '<div class="mrow mcols-source">'
        + '<div class="mname"><strong><a href="' + html(target.url) + '" target="_blank" rel="noreferrer">' + html(target.title || target.url) + '</a></strong>'
        + '<span class="mono">' + html(target.host) + (target.words === null ? '' : ' · ' + target.words + ' words') + '</span>'
        + '<span class="subtle">' + html(target.why) + '</span>'
        + '<span class="subtle">Cited answering: ' + html(target.prompts.slice(0, 2).join(" · ")) + '</span>' + rivals + '</div>'
        + '<span class="mcell ' + (target.namesYou ? "state-ok" : "state-bad") + '">' + (target.namesYou ? "You are on it" : "You are not") + '</span>'
        + '<span class="mcell">' + target.citedBy + ' answer(s)</span></div>';
    }

    function renderOutreach() {
      if (state.outreachState === "idle") { loadOutreach(); }
      if (state.outreachState !== "ready" || !state.outreach) {
        return '<p class="subtle">' + (state.outreachState === "error" ? "Could not read the cited pages." : "Reading which pages the answers cited.") + '</p>';
      }
      const plan = state.outreach;
      const harvestAction = button({ label: (state.harvesting ? "Reading…" : "Read the cited pages"), disabled: state.harvesting, on: { "data-harvest-pages": true } });
      if (plan.unavailable) {
        return '<p class="subtle">No archived answer carried a source, so there is no page to read. That is a property of the models and surfaces that ran, not evidence that nobody cites you. Turn on a grounded provider or an answer surface and run again.</p>';
      }
      return '<p class="subtle">' + plan.cited + ' page(s) cited across ' + plan.answersWithCitations + ' of ' + plan.answersConsidered + ' answer(s). ' + plan.read + ' read back.</p>'
        + '<div class="inline-actions">' + harvestAction + '</div>'
        + '<div class="mtable"><div class="mhead mcols-source"><span>Page</span><span>You</span><span>Cited</span></div>'
        + plan.targets.slice(0, 20).map(outreachRow).join("") + '</div>';
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
        state.searchDemand = { ...(state.searchDemand || {}), configured:true, report: result.report };
        state.searchDemandState = "ready";
        state.promptNotice = { text: result.report.queries + " query row(s) read from Search Console.", kind:"success" };
      } catch (error) {
        state.promptNotice = { text: error && (error as any).message ? (error as any).message : String(error), kind:"error" };
      }
      state.pulling = false;
      render();
    }

    function searchDemandRow(row: any) {
      const matched = row.exact.concat(row.related).slice(0, 4);
      return '<div class="mrow mcols-search">'
        + '<div class="mname"><strong>' + html(row.text) + '</strong>'
        + (matched.length ? '<span class="subtle">' + html(matched.map((match: any) => match.query).join(" · ")) + '</span>' : '<span class="subtle">No query in the window shares its words.</span>')
        + (row.earnedInSearchAbsentInAnswers ? '<span class="tag warning">Found in search, absent from the answers</span>' : '') + '</div>'
        + '<span class="mcell">' + row.impressions + '</span>'
        + '<span class="mcell">' + row.clicks + '</span>'
        + '<span class="mcell">' + (row.position === null ? "Not ranked" : "#" + (Math.round(row.position * 10) / 10)) + '</span></div>';
    }

    function renderSearchDemand() {
      if (state.searchDemandState === "idle") { loadSearchDemand(); }
      if (state.searchDemandState !== "ready" || !state.searchDemand) {
        return '<p class="subtle">' + (state.searchDemandState === "error" ? "Could not read the Search Console settings." : "Checking for a Search Console key.") + '</p>';
      }
      const data = state.searchDemand;
      const pullAction = data.configured && data.siteUrl
        ? button({ label: (state.pulling ? "Reading…" : "Pull the last 90 days"), disabled: state.pulling, on: { "data-pull-search": true } })
        : button({ label: "Add the key in Setup", on: { "data-page": "setup" } });
      const head = '<p class="subtle">' + html(data.detail) + '</p><div class="inline-actions">' + pullAction + '</div>';
      const report = data.report;
      if (!report) return head;
      const gaps = report.prompts.filter((row: any) => row.earnedInSearchAbsentInAnswers).length;
      return head
        + '<p class="subtle">' + report.queries + ' query row(s), ' + report.totalImpressions + ' impression(s), ' + html(report.window.from) + ' to ' + html(report.window.to) + '. '
        + (gaps ? gaps + ' question(s) earn search impressions while no answer names you. Those are the clearest gaps here.' : 'No question earns search impressions while the answers leave you out.')
        + '</p>'
        + '<div class="mtable"><div class="mhead mcols-search"><span>Question, and the queries matching it</span><span>Impressions</span><span>Clicks</span><span>Position</span></div>'
        + report.prompts.slice(0, 20).map(searchDemandRow).join("") + '</div>'
        + '<p class="evidence-note">Search queries are not AI prompts and this does not pretend otherwise. It is measured demand for the same subject, from the one place that reports it.</p>';
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
            + '<span class="mcell">' + button({ label: "Stop asking", kind: "link", on: { "data-retire-persona": row.id } }) + '</span></div>').join("")
          + '</div>'
        : '<p class="subtle">No persona yet, so every question is asked on nobody\u2019s behalf. That is a real answer and stays comparable with every run so far.</p>';
      return rows
        + '<form id="add-persona-form" class="inline-form"><input name="label" type="text" placeholder="Beginner retail trader" aria-label="Persona name"><input name="describedAs" type="text" placeholder="someone new to investing, with a small account, who has never used a screener" aria-label="How the model is told to see them">' + button({ label: "Add", submit: true }) + '</form>'
        + '<p class="evidence-note">Each persona multiplies a run: every question is asked once per persona per model per market. The forecast on Prompts counts them.</p>';
    }

    function renderPersonaRows(rows: any[]) {
      if (!rows || !rows.length) return '<p class="subtle">One audience is the overall figure under another name, so this fills in once a run asks on behalf of more than one.</p>';
      return '<div class="mtable"><div class="mhead mcols-rank"><span>Persona</span><span>Score</span><span>Rank</span></div>'
        + rows.map((row) => '<div class="mrow mcols-rank">'
          + '<div class="mname"><strong>' + html(row.label) + '</strong><span class="subtle">' + row.score.answers + ' answer(s)</span></div>'
          + '<span class="mcell">' + scoreText(row.score.score) + '</span>'
          + '<span class="mcell">' + (row.rank === null ? "Not named" : "#" + row.rank) + '</span></div>').join("")
        + '</div>';
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
        state.referrals = { ...(state.referrals || {}), configured:true, report: result.report };
        state.promptNotice = { text:"Analytics read.", kind:"success" };
      } catch (error) {
        state.promptNotice = { text: error && (error as any).message ? (error as any).message : String(error), kind:"error" };
      }
      state.pullingReferrals = false;
      render();
    }

    function renderReferrals() {
      if (state.referralsState === "idle") { loadReferrals(); }
      if (state.referralsState !== "ready" || !state.referrals) {
        return '<p class="subtle">' + (state.referralsState === "error" ? "Could not read the Analytics settings." : "Checking for an Analytics property.") + '</p>';
      }
      const data = state.referrals;
      const pullAction = data.configured && data.propertyId
        ? button({ label: (state.pullingReferrals ? "Reading…" : "Pull the last 90 days"), disabled: state.pullingReferrals, on: { "data-pull-referrals": true } })
        : button({ label: "Add it in Setup", on: { "data-page": "setup" } });
      const head = '<p class="subtle">' + html(data.detail) + '</p><div class="inline-actions">' + pullAction + '</div>';
      const report = data.report;
      if (!report) return head;
      if (report.empty) return head + '<p class="subtle">The property reported no row at all for this window, which is a property with nothing in it rather than a property where nobody arrived from an assistant.</p>';
      if (!report.assistants.length) return head + '<p class="subtle">' + report.totalSessions + ' session(s) in the window and none from an assistant this tool knows. Being named is not the same as being visited.</p>';
      return head + '<div class="mtable"><div class="mhead mcols-rank"><span>Assistant</span><span>Sessions</span><span>Share of all</span></div>'
        + report.assistants.map((row: any) => '<div class="mrow mcols-rank">'
          + '<div class="mname"><strong>' + html(row.source) + '</strong><span class="subtle">' + (row.engaged === null ? "engagement not reported" : row.engaged + ' engaged') + '</span></div>'
          + '<span class="mcell">' + row.sessions + '</span>'
          + '<span class="mcell">' + (report.totalSessions ? Math.round(row.sessions / report.totalSessions * 1000) / 10 + '%' : "Not measurable") + '</span></div>').join("")
        + '</div><p class="evidence-note">Arriving is a different claim from being named. A high score with no sessions means the answers name you and nobody clicks through, which is the normal case and not a fault in either number.</p>';
    }

    function renderRunPane() {
      return '<div class="panel-scrim" data-close-panel></div><aside class="panel" role="dialog" aria-label="Live run">'
        + '<div class="panel-head"><div><h2>' + (runIsLive() ? "Live run" : "Finished run") + '</h2>'
        + '<p class="subtle">What went to each model and what came back, newest first.</p>'
        + '<div class="runpane-progress">' + runPaneProgress() + '</div></div>'
        + '<div class="panel-actions">'
        + (runIsLive() && state.liveRun && state.liveRun.status !== "cancelling" ? button({ label: "Stop", tone: "danger", on: { "data-stop-run": true } }) : '')
        + '<button type="button" class="close" data-close-panel aria-label="Close">×</button></div></div>'
        + '<div class="panel-body">' + runFeedBody() + '</div></aside>';
    }

    function renderEvidence() {
      if (!state.panel) return '<div class="panel-scrim" data-close-panel></div><aside class="panel" aria-hidden="true"></aside>';
      if (state.panel.kind === "run") return renderRunPane();
      if (state.panel.kind === "panel") {
        return '<div class="panel-scrim" data-close-panel></div><aside class="panel is-wide-panel" role="dialog" aria-label="' + html(state.panel.title) + '">'
          + '<div class="panel-head"><div><h2>' + html(state.panel.title) + '</h2><p class="subtle">' + html(String(state.panel.blurb || "")) + '</p></div>'
          + '<div class="panel-actions">' + button({ label: "Close", kind: "quiet", on: { "data-close-panel": true } }) + '</div></div>'
          + '<div class="panel-body">' + String(state.panel.body || "") + '</div></aside>';
      }
      const body = state.panelState === "loading"
        ? '<p class="subtle">Reading the archived answers.</p>'
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

    function alertPill(severity: any) {
      return severity === "critical" ? "bad" : severity === "warning" ? "flat" : "flat";
    }

    /** The dashboard is assembled by a module of its own, from the same
     * figures the answer engine reports, so two screens cannot disagree. */
    /** What the dashboard draws from. Built here rather than inside the
     * renderer, so the side pane can redraw one panel from the same figures. */
    /** Topics, their subtopics and their prompts against every brand named,
     * with the columns fixed by the overall order so rows stay comparable. */
    function buildMatrix(data: any): any {
      if (!data || !data.topics || !data.topics.length) return undefined;
      const columns = (data.leaderboard || []).slice(0, 8).map((row: any) => ({ name: String(row.name), isTarget: !!row.isTarget }));
      if (!columns.length) return undefined;
      const shareIn = (standing: any[]) => columns.map((column: any) => {
        const found = (standing || []).find((row: any) => row.name === column.name);
        return found ? (found.shareOfAnswers ?? null) : null;
      });
      const rows: any[] = [];
      for (const topic of data.topics) {
        const subs = topic.subtopics || [];
        const key = "t:" + topic.topicId;
        rows.push({ key, parent: "", depth: 0, label: topic.name, shares: shareIn(topic.standing), children: subs.length || (topic.prompts || []).length });
        for (const sub of subs) {
          const subKey = key + "/s:" + sub.name;
          rows.push({ key: subKey, parent: key, depth: 1, label: sub.name, shares: shareIn(sub.standing), children: (sub.prompts || []).length });
          for (const prompt of sub.prompts || []) {
            rows.push({ key: subKey + "/p:" + prompt.promptId, parent: subKey, depth: 2, label: prompt.text, shares: shareIn(prompt.standing), children: 0 });
          }
        }
        // A set nobody grouped opens straight onto its questions, rather than
        // onto one subtopic invented to fill the level.
        if (!subs.length) {
          for (const prompt of topic.prompts || []) {
            rows.push({ key: key + "/p:" + prompt.promptId, parent: key, depth: 1, label: prompt.text, shares: shareIn(prompt.standing), children: 0 });
          }
        }
      }
      return { columns, rows };
    }

    function dashboardView(): DashboardData | null {
      const selected = project();
      const home = state.home;
      if (!selected || !home) return null;
      const data = state.answerEngine;
      const outreach = state.outreach;
      const plan = state.rankPlan;
      const questions = data ? data.topics.reduce((total: number, topic: any) => total + topic.prompts.length, 0) : 0;
      const measurable = data ? data.topics.reduce((total: number, topic: any) => total + topic.prompts.filter((p: any) => p.measuresVisibility).length, 0) : 0;

      const view: DashboardData = {
        matrix: buildMatrix(data),
        matrixOpen: state.matrixOpen,
        domain: String(home.domain || selected.normalizedDomain),
        score: home.score ?? null,
        change: home.change ?? null,
        rank: home.rank ?? null,
        overall: data ? data.overall : { score: null, presenceRate: null, prominence: null, sentiment: null, answers: 0, appearances: 0 },
        leaderboard: data ? (data.leaderboard as any[]).map((row: any) => ({
          name: row.name,
          isTarget: row.isTarget,
          appearances: row.appearances,
          shareOfAnswers: row.shareOfAnswers,
          prominence: row.prominence ?? null,
          positive: row.positive ?? 0,
          negative: row.negative ?? 0,
        })) : [],
        byModel: data ? data.byModel.map((row: any) => ({ label: row.displayName, score: row.score.score, answers: row.score.answers, rank: null })) : [],
        byRegion: data ? data.byRegion.map((row: any) => ({ label: row.label, score: row.score.score, answers: row.score.answers, rank: row.rank })) : [],
        byPersona: data ? data.byPersona.map((row: any) => ({ label: row.label, score: row.score.score, answers: row.score.answers, rank: row.rank })) : [],
        questions,
        measurable,
        absent: data ? data.absentFrom.length : 0,
        assistants: data ? data.byModel.length : 0,
        assistantsNaming: data ? data.byModel.filter((row: any) => row.score.appearances > 0).length : 0,
        moves: plan ? (plan.moves as any[]).filter((m: any) => m.effect === "raises_visibility") : [],
        citationsUnavailable: data ? data.citationsUnavailable : false,
        citedPages: outreach ? outreach.cited : null,
        missingFrom: outreach ? (outreach.targets as any[]).filter((t: any) => !t.namesYou).length : null,
        spark: data ? sparkline(data.trend.points, 170, 30) : "",
        asked: (() => {
          if (!data) return undefined;
          const prompts = (data.topics as any[]).flatMap((topic: any) => topic.prompts as any[]);
          const earned = prompts.filter((row: any) => row.measuresVisibility);
          const byName = prompts.filter((row: any) => !row.measuresVisibility);
          const sum = (rows: any[], pick: (row: any) => number) => rows.reduce((total, row) => total + pick(row), 0);
          const judged = byName.filter((row: any) => row.score.sentiment !== null);
          return {
            unbranded: {
              prompts: earned.length,
              answers: sum(earned, (row) => row.score.answers),
              appearances: sum(earned, (row) => row.score.appearances),
              score: earned.length ? Math.round(sum(earned, (row) => row.score.score || 0) / earned.length) : null,
            },
            branded: {
              prompts: byName.length,
              answers: sum(byName, (row) => row.score.answers),
              // Averaging over the judged ones only: an unjudged answer is not a zero.
              sentiment: judged.length ? sum(judged, (row) => row.score.sentiment) / judged.length : null,
            },
          };
        })(),
        rivalTrend: data && data.trend && data.trend.rivals ? (data.trend.rivals as any[]).map((row: any) => ({
          name: row.name, isTarget: row.isTarget,
          points: (row.points as any[]).map((point: any) => ({ at: point.at, share: point.share })),
        })) : [],
        alerts: (home.alerts as any[]).length,
      };

      return view;
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
      if (state.demandState === "loading") return head + '<p class="subtle">Reading the corpus report.</p></section>';
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
          + '<span class="mcell">' + (row.shareOfCorpus === null ? "not comparable" : pct(row.shareOfCorpus)) + '</span></div>').join("");
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
      const heading = '<section class="view"><div class="heading"><div class="headmain"><h1>Brand visibility</h1>'
        + '<p class="subtle">Share of voice, who is named, how each one is described, what gets cited, and how often anyone asks.</p></div>'
        + '<div class="inline-actions">' + button({ label: "Full report", on: { "data-page": "answer-engine" } }) + runActionButton("Run prompts") + '</div></div>';
      const view = dashboardView();
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
      return heading + '<div class="dgrid">' + body + '</div>' + renderDemand() + '</section>';
    }

    function renderHome() {
      const selected = project();
      if (!selected) return '<section class="view">' + emptyState("Create a project first", "Everything here reports on one domain.") + '</section>';
      if (state.homeState === "idle") { loadHome(); }
      if (state.answerEngineState === "idle") { loadAnswerEngine(); }
      if (state.outreachState === "idle") { loadOutreach(); }
      if (state.rankPlanState === "idle") { loadRankingPlan(); }
      if (state.digestState === "idle") { loadDigest(); }

      const heading = (body: string): string => '<section class="view"><div class="heading"><div class="headmain"><h1>'
        + html(selected.name) + '</h1><p class="subtle">' + html(String((state.home && state.home.domain) || selected.normalizedDomain)) + '</p></div>'
        + '<div class="inline-actions">'
        + button({ label: state.editingBoard ? "Done arranging" : "Arrange board", kind: state.editingBoard ? "secondary" : "quiet", on: { "data-edit-board": true } })
        + (hasPanelOrder() ? button({ label: "Reset layout", kind: "quiet", on: { "data-reset-panels": true } }) : '')
        + button({ label: "Full report", on: { "data-page": "answer-engine" } }) + ''
        + runActionButton("Run prompts") + '</div></div>' + renderLiveRun() + body + '</section>';

      if (state.homeState === "error") return heading(notice("Could not read this project.", "error"));
      if (state.homeState !== "ready" || !state.home) return heading(dashboardBody({ status: "loading" }));

      const home = state.home;
      if (home.showSetupOnly) {
        const steps = (home.setup as any[]).map((step: any, index: number) => '<div class="mrow mcols-step" data-state="' + (step.done ? "done" : "todo") + '">'
          + '<span class="mcell mono">' + (step.done ? "\u2713" : String(index + 1)) + '</span>'
          + '<div class="mname"><strong>' + html(step.label) + '</strong><span class="subtle">' + html(step.detail) + '</span></div>'
          + '<span class="mcell">' + (step.done ? '<span class="state-ok">Done</span>' : button({ label: "Open", kind: "link", on: { "data-page": (step.id === "models" ? "models" : "prompts") } })) + '</span></div>').join("");
        return heading('<section class="section-card"><div class="mtable"><div class="mhead mcols-step"><span></span><span>Step</span><span></span></div>' + steps + '</div></section>');
      }

      const view = dashboardView();
      if (!view) return heading(dashboardBody({ status: "loading" }));
      const data = state.answerEngine;
      const hero = '<div class="hero"><div class="hero-figure"><span class="scorebig">' + scoreText(home.score) + '</span>'
        + '<span class="hero-sub">' + deltaPill(data ? data.trend : { change: home.change }) + '<span>'
        + (home.rank === null || home.rank === undefined ? "Not named" : "#" + home.rank + " of " + ((home.rivals || 0) + 1)) + '</span></span>'
        + '<span class="hero-spark">' + view.spark + '</span></div>' + heroStats(view.overall) + '</div>';

      const alerts = (home.alerts as any[]).length
        ? '<div class="alertlist">' + (home.alerts as any[]).map((alert: any) => '<div class="alertrow"><span class="pill ' + alertPill(alert.severity) + '">' + html(alert.severity) + '</span><div><strong>' + html(alert.headline) + '</strong><p class="subtle">' + html(alert.detail) + '</p></div></div>').join("") + '</div>'
        : '<p class="subtle">Nothing moved since the previous run.</p>';

      const digest = state.digest;
      const changed = state.digestState === "loading"
        ? '<p class="subtle">Reading what changed.</p>'
        : digest && digest.lines.length
          ? '<p class="changed-headline">' + html(digest.headline) + '</p><ul class="protocol-list">'
            + digest.lines.map((line: string) => '<li>' + html(line) + '</li>').join("") + '</ul>'
          : '<p class="subtle">Nothing has moved since the previous run.</p>';

      return heading(hero
        + dashboardBody({ status: "ready", value: view }, state.editingBoard)
        + '<section class="section-card"><div class="section-head"><div class="headmain"><h2>What changed</h2><p class="subtle">Read off the archived answers, in the words the evidence supports.</p></div></div>' + changed + '</section>'
        + '<section class="section-card"><div class="section-head"><div class="headmain"><h2>Needs attention</h2><p class="subtle">Only what moved, and only where both runs could be measured.</p></div></div>' + alerts + '</section>');
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
            + '<span class="mcell">' + pct(row.shareOfAnswers) + '</span>'
            + '<span class="mcell">' + button({ label: "Stop tracking", kind: "link", on: { "data-retire-rival": declaredIdFor(row.name) } }) + '</span></div>').join("") + '</div>'
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

    function renderCitedPages() {
      if (state.citedState === "idle") { loadCited(); }
      if (state.citedState !== "ready" || !state.cited) return '<p class="subtle">Reading the archived sources.</p>';
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

      return '<p class="subtle">' + data.answersWithCitations + ' of ' + data.answersConsidered + ' answers carried a source.</p>'
        + '<h3 style="margin-top:16px">Pages of yours the models reached for</h3>' + own
        + '<h3 style="margin-top:20px">Every domain cited</h3>' + rivals
        + '<h3 style="margin-top:20px">Pages that won a question you are absent from</h3>' + openings;
    }

    function renderAnswerEngine() {
      const selected = project();
      if (!selected) return '<section class="view"><div class="empty"><div class="empty-copy"><h2>Select a project first</h2></div></div></section>';
      if (state.answerEngineState === "idle") { loadAnswerEngine(); loadLiveRun(); }
      if (state.answerEngineState !== "ready") {
        return '<section class="view"><div class="heading"><div><h1>Answer engine</h1><p class="subtle">How the models answer the questions your buyers ask.</p></div></div><div class="empty"><div class="empty-copy"><h2>' + (state.answerEngineState === "error" ? "Could not read the answers" : "Reading the archived answers") + '</h2></div></div></section>';
      }
      const data = state.answerEngine;
      if (!data || data.answers === 0) {
        return '<section class="view"><div class="heading"><div><h1>Answer engine</h1><p class="subtle">How the models answer the questions your buyers ask.</p></div><div class="inline-actions">' + button({ label: "Set up prompts", kind: "primary", on: { "data-page": "prompts" } }) + '</div></div>'
          + '<div class="empty"><div class="empty-copy"><h2>No answers yet</h2><p class="subtle">Generate a prompt set, activate the questions worth tracking, then run them. Every number on this page traces back to an archived answer.</p></div></div></section>';
      }
      const weights = data.weights || { prominenceFloor: 0, sentimentFloor: 0 };
      const failedNote = data.answersFailed ? '<div class="warning-box">' + data.answersFailed + ' answer(s) failed and are excluded. They are not counted as answers that did not name you.</div>' : '';
      const identityNote = data.identityCaveat ? '<div class="warning-box"><strong>Your name is a word in your own category.</strong> ' + html(data.identityCaveat) + '</div>' : '';
      const citationNote = data.citationsUnavailable ? '<div class="warning-box">No answer carried a citation, so there are no sources to analyse. That is a property of the models you ran, not evidence that nobody cites you. A provider with web search will produce them.</div>' : '';
      return '<section class="view"><div class="heading"><div><h1>Answer engine</h1><p class="subtle">' + data.answers + ' answer(s) across ' + data.topics.length + ' topic(s) for ' + html(selected.normalizedDomain) + '. Click any question to read the answers behind it.</p></div><div class="inline-actions">' + button({ label: "Prompts", on: { "data-page": "prompts" } }) + '' + runActionButton("Run prompts") + '</div></div>'
        + renderLiveRun()
        + renderHero(data)
        + renderSavedViews()
        + renderSegment(data)
        + identityNote + failedNote + citationNote
        + '<section class="section-card"><div class="section-head"><div><h2>How the score is built</h2><p class="subtle">Presence scaled by where you appear and how you are described.</p></div></div>'
        + renderScoreBreakdown(data.overall)
        + '<details class="technical-details"><summary>The formula, and the judgement in it</summary><p class="subtle">score = presence × (' + weights.prominenceFloor + ' + ' + (1 - weights.prominenceFloor).toFixed(1) + ' × prominence) × (' + weights.sentimentFloor + ' + ' + (1 - weights.sentimentFloor).toFixed(1) + ' × sentiment) × 100.</p><p class="subtle">The two floors are a judgement, not a measurement: being named late and grudgingly is still better than not being named, so prominence and sentiment scale presence rather than replacing it. Every component above is reported separately so you can ignore the composite entirely.</p></details></section>'
        + '<section class="section-card"><div class="section-head"><div><h2>What would move this</h2><p class="subtle">Read off the archived answers, strongest lever first. None of it is an opinion about your marketing.</p></div></div>' + renderRankingPlan() + '</section>'
        + '<section class="section-card"><div class="section-head"><div><h2>Competitors named in the answers</h2><p class="subtle">Organisations the assistants named while answering your questions. Not the assistants themselves. Ranked by how many answers named them, then by how early.</p></div></div>' + renderLeaderboard(data.leaderboard) + '</section>'
        + '<section class="section-card"><div class="section-head"><div><h2>Rivals you name</h2><p class="subtle">Name a competitor here and it is tracked whether or not an answer mentions it. A tracked rival nobody named reads as zero, which is a finding; leaving it out would hide it.</p></div></div>' + renderRivals(data) + '</section>'
        + '<div class="section-head" style="margin-top:24px"><div><h2>Topics, weakest first</h2><p class="subtle">Where you are losing, in the order worth fixing. Every question opens its answers.</p></div></div>'
        + renderTopicRows(data.topics)
        + '<section class="section-card"><div class="section-head"><div><h2>Questions you never appear in</h2><p class="subtle">Answered, and you were not named once. Open one to read what the models credited the winners with, which is the standard that question is answered against.</p></div></div>' + renderAbsent(data.absentFrom) + '</section>'
        + '<section class="section-card"><div class="section-head"><div><h2>Movement</h2><p class="subtle">One point per run. A run where everything failed is left out rather than drawn as a drop.</p></div></div>' + renderPromptTrend(data.trend) + '</section>'
        + '<section class="section-card"><div class="section-head"><div><h2>By market</h2><p class="subtle">The same questions, asked for a different buyer.</p></div></div>' + renderRegionRows(data.byRegion, data.regionCaveat) + '</section>'
        + '<section class="section-card"><div class="section-head"><div><h2>By persona</h2><p class="subtle">The same questions, asked on behalf of someone else. A market says where a buyer is; a persona says what they are, which moves the answer further.</p></div></div>' + renderPersonaRows(data.byPersona) + '</section>'
        + '<section class="section-card"><div class="section-head"><div><h2>Who is asking</h2><p class="subtle">Add a persona and every run asks on their behalf as well.</p></div></div>' + renderPersonas() + '</section>'
        + '<section class="section-card"><div class="section-head"><div><h2>Sources</h2><p class="subtle">A domain says you are cited. A page says which one to write more of.</p></div></div>' + renderCitedPages() + '</section>'
        + '<section class="section-card"><div class="section-head"><div><h2>What people search for</h2><p class="subtle">Search Console, joined to the questions you track. Not AI prompt volume, but real demand for the same subject.</p></div></div>' + renderSearchDemand() + '</section>'
        + '<section class="section-card"><div class="section-head"><div><h2>Who arrived from an assistant</h2><p class="subtle">Analytics sessions by referring assistant. Being named is one claim; somebody arriving because of it is another.</p></div></div>' + renderReferrals() + '</section>'
        + '<section class="section-card"><div class="section-head"><div><h2>Pages the models read</h2><p class="subtle">Each cited page, fetched and read back: who is on it, in what order, and whether you are. A page cited on a question you lose, without you on it, is the most specific thing here.</p></div></div>' + renderOutreach() + '</section>'
        + '<section class="section-card"><div class="section-head"><div><h2>By AI assistant</h2><p class="subtle">The models you picked in Choose models, each answering the same questions. These are who was asked, not who you compete with.</p></div></div>' + renderModelRows(data.byModel) + '</section>'
        + '<section class="section-card"><div class="section-head"><div><h2>Keep it running</h2><p class="subtle">A tracker that is run by hand is a snapshot.</p></div></div>' + renderSchedule() + '</section></section>';
    }

    const PROMPT_INTENTS = ["discovery", "comparison", "alternatives", "brand", "problem"];
    const PROMPT_STATES = [["", "Any state"], ["tracked", "Tracked"], ["proposed", "Needs review"], ["absent", "Never named"], ["unmeasured", "Cannot measure"]];

    // Score and rank come from the answer engine, so a question shows whether
    // it is working rather than only that it is tracked.
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
    function fieldBadge(row: any) {
      if (!row || row.contest.state === "unknown") return '';
      const field = row.contest.state;
      const tone = field === "open" ? "ready" : field === "settled" ? "warning" : "";
      const label = field === "open" ? "Open field" : field === "settled" ? "Settled" : "Contested";
      return '<span class="tag ' + tone + '" title="' + html(row.contest.reason) + '">' + label + '</span>';
    }

    function demandBadge(row: any) {
      if (!row || !row.demand) return '';
      const match = row.demand.match;
      if (!match.exactTerms && !match.relatedTerms) return '<span class="tag">Nobody asked it in the corpus</span>';
      return '<span class="tag">Asked ' + match.exactTerms + ' · ' + match.relatedTerms + ' loosely</span>';
    }

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
      return { value: String(tracked * models), note: tracked + " question(s) by " + models + " model(s), one market, one language" };
    }

    function renderPromptStats(set: TopicSetShape, standings: any) {
      const live = livePrompts(set);
      const tracked = live.filter((prompt) => prompt.status === "active");
      const proposed = live.filter((prompt) => prompt.status === "proposed").length;
      const measuring = tracked.filter((prompt) => prompt.measuresVisibility).length;
      const answered = tracked.filter((prompt) => { const row = standings.get(prompt.id); return Boolean(row) && row.score.answers > 0; }).length;
      const forecast = runForecast(tracked.length);
      return '<div class="statgrid" style="--tile-columns:6">'
        + stat("Tracked", String(tracked.length), tracked.length ? "asked on every run" : "nothing is being asked", live.length ? tracked.length / live.length : null)
        + stat("Needs review", String(proposed), proposed ? "proposed, never asked until tracked" : "nothing waiting on you", null)
        + stat("Topics", String(set.topics.length), set.topics.length + " group(s) of questions", null)
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
      return '<section class="section-card"><div class="section-head"><div><h2>Coverage</h2><p class="subtle">A buyer arrives five ways. An intent with nothing tracked is a blind spot, not a zero.</p></div></div>'
        + '<div class="coverage">' + chips + '</div><p class="subtle">' + note + '</p></section>';
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
        + (shown ? '<button type="button" class="filter" data-prompt-select-all>Select all shown</button>' : '')
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
        ? button({ label: prompt.text, kind: "link", on: { "data-evidence": prompt.id, "data-evidence-title": prompt.text } })
        : html(prompt.text);
      const scoreClass = !standing || standing.score.score === null ? "" : standing.score.score > 0 ? "state-ok" : "state-bad";
      return '<div class="mrow mcols-promptrow">'
        + '<input type="checkbox" data-prompt-checkbox="' + html(prompt.id) + '"' + (checked ? ' checked' : '') + ' aria-label="Select this question">'
        + '<div class="mname"><strong>' + label + '</strong><span class="subtle">' + html(notes.join(" · ")) + (answers ? ' · ' + answers + ' answer(s)' : '') + '</span>'
        + (priority ? '<span class="rowtags">' + fieldBadge(priority) + demandBadge(priority) + '</span>' : '') + '</div>'
        + '<span class="mcell ' + scoreClass + '">' + (answers ? scoreText(standing.score.score) : "Not asked yet") + '</span>'
        + '<span class="mcell">' + (answers ? (standing.rank === null ? "Not named" : "#" + standing.rank) : "") + '</span>'
        + '<span class="mcell">' + (prompt.status === "active"
          ? button({ label: "Stop tracking", kind: "link", on: { "data-retire-prompt": prompt.id } })
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
          + '<div class="mtable"><div class="mhead mcols-promptrow"><span></span><span>Question</span><span>Score</span><span>Rank</span><span></span></div>'
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
      const selectAll = document.querySelector("[data-prompt-select-all]");
      if (selectAll) (selectAll as any).hidden = rows.length === 0;
      const bulk = document.querySelector(".prompt-bulk");
      if (bulk) bulk.innerHTML = promptBulkInner();
    }

    function promptAddForms(set: TopicSetShape) {
      if (!set.topics.length) return '';
      const topics = set.topics.map((topic) => '<option value="' + html(topic.id) + '">' + html(topic.name) + '</option>').join("");
      const intents = PROMPT_INTENTS.map((intent) => '<option value="' + intent + '">' + intentLabel(intent) + '</option>').join("");
      return '<section class="section-card"><div class="section-head"><div><h2>Add your own</h2><p class="subtle">A question you know buyers ask. It starts tracked.</p></div></div>'
        + '<form id="add-prompt-form" class="inline-form"><select name="topicId" aria-label="Topic">' + topics + '</select><input name="text" type="text" placeholder="best stock screener for indian markets" aria-label="Question"><select name="intent" aria-label="Intent">' + intents + '</select>' + button({ label: "Add", submit: true }) + '</form>'
        + '<details class="technical-details" style="margin-top:14px"><summary>Paste a list</summary>'
        + '<form id="bulk-prompt-form" class="inline-form"><select name="topicId" aria-label="Topic for the pasted questions">' + topics + '</select><select name="intent" aria-label="Intent for the pasted questions">' + intents + '</select><textarea name="text" rows="6" placeholder="One question per line" aria-label="Questions, one per line"></textarea>' + button({ label: "Add them all", submit: true }) + '</form>'
        + '<p class="subtle">One question per line, all under the same topic and intent. A question already in the set is skipped rather than added twice.</p></details></section>';
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
        return '<section class="view"><div class="heading"><div><h1>Prompts</h1><p class="subtle">The questions your buyers ask.</p></div></div><div class="empty"><div class="empty-copy"><h2>' + (state.topicState === "error" ? "Could not read the prompt set" : "Loading prompts") + '</h2></div></div></section>';
      }
      const set = state.topicSet || { topics: [], prompts: [] };
      const notice = state.promptNotice.text ? '<div class="' + (state.promptNotice.kind === "error" ? "warning-box" : "success-box") + '">' + html(state.promptNotice.text) + '</div>' : '';
      const live = livePrompts(set);
      const active = live.filter((prompt) => prompt.status === "active").length;
      const head = '<section class="view"><div class="heading"><div><h1>Prompts</h1><p class="subtle">The questions buyers type, grouped by topic. Every other number in this tool is these questions, asked and archived.</p></div><div class="inline-actions">' + button({ label: (state.promptRunState === "generating" ? "Proposing…" : "Propose a set"), on: { "data-generate-prompts": true } }) + '' + runActionButton("Run all " + active, active > 0) + '</div></div>' + notice + renderLiveRun();
      if (!live.length) {
        // Retiring the last question must not remove the only way to add one.
        return head + '<div class="empty"><div class="empty-copy"><h2>Nothing is being asked</h2><p class="subtle">Propose a set and a model will suggest the questions buyers ask about what you do, grouped into topics. Nothing runs until you have read them and chosen which to track, because what buyers ask is not something this tool can observe.</p></div></div>' + promptAddForms(set) + '</section>';
      }
      const standings = promptStandings();
      const rows = filteredPrompts(set, standings);
      const proposed = live.filter((prompt) => prompt.status === "proposed").length;
      const review = proposed
        ? '<div class="warning-box"><strong>' + proposed + ' question(s) are proposed and not tracked.</strong> A proposed question is never asked. Read them and track the ones buyers actually type. ' + button({ label: "Show only those", kind: "link", on: { "data-prompt-review": true } }) + '</div>'
        : '';
      return head
        + renderPromptStats(set, standings)
        + renderPromptCoverage(set)
        + review
        + promptToolbar(set, rows.length)
        + '<div class="prompt-bulk">' + promptBulkInner() + '</div>'
        + '<div class="prompt-results">' + renderPromptGroups(set, rows, standings, (topicStandings() as any)) + '</div>'
        + promptAddForms(set)
        + '</section>';
    }

    function resultsSwitch(active: any) {
      const has = state.recognitionRuns.length > 0;
      const tab = (page: any, label: any, enabled: any) => '<button type="button" class="filter ' + (active === page ? "active" : "") + '" data-page="' + page + '"' + (enabled ? "" : " disabled") + '>' + label + '</button>';
      return '<div class="toolbar">' + tab("reports", "Report", has) + tab("recognition", "Run detail", true) + '</div>';
    }

    function renderNextSteps(configuration: any) {
      const models = state.selections.length;
      const saved = Boolean(configuration.currentVersion);
      const runs = state.recognitionRuns.length;
      const steps = [
        { label: "Choose models and save them as a configuration", done: models > 0 && saved, note: models ? models + " selected" + (saved ? ", saved v" + configuration.currentVersion : ", not saved") : "None yet", page: "models", action: "Choose models" },
        
        { label: "Run a domain recognition test", done: runs > 0, note: runs ? runs + " run" + (runs === 1 ? "" : "s") : "Not run yet", page: "recognition", action: "Run test" },
        { label: "Read the results", done: runs > 0, note: runs ? "Ready" : "Waiting on a run", page: "reports", action: "Open results" },
      ];
      const next = steps.findIndex((step) => !step.done);
      const rows = steps.map((step, index) => {
        const state_ = step.done ? "done" : index === next ? "next" : "todo";
        const mark = step.done ? "Done" : index === next ? "Do this next" : "Later";
        const stepAction = index === next ? button({ label: step.action, kind: "primary", on: { "data-page": step.page } }) : "";
        return '<li class="step" data-state="' + state_ + '"><span class="step-index">' + (index + 1) + '</span><span class="step-label">' + html(step.label) + '</span><span class="step-note">' + html(step.note) + '</span><span class="step-mark">' + mark + '</span><span class="step-action">' + stepAction + '</span></li>';
      }).join("");
      return '<section class="section-card"><div class="section-head"><div><h2>Getting a result</h2><p class="subtle">Three steps, in order. Each one unlocks the next.</p></div></div><ol class="steps">' + rows + '</ol></section>';
    }
    function renderOverview() { const selected = project(); if (!selected) return '<section class="view"><div class="heading"><div><h1>Project</h1><p class="subtle">Create a project before configuring AI models and monitoring.</p></div></div>' + renderProjectCards() + '</section>'; const configuration = monitoringConfiguration(); return '<section class="view"><div class="heading"><div><h1>Project overview</h1><p class="subtle">A project is bound to one domain. Save models and web search modes as the fixed configuration for later monitoring.</p></div></div><div class="toolbar"><button type="button" class="filter ' + (state.mode === "current" ? "active" : "") + '" data-list-mode="current">Current</button><button type="button" class="filter ' + (state.mode === "archived" ? "active" : "") + '" data-list-mode="archived">Archived</button><button type="button" class="filter ' + (state.mode === "deleted" ? "active" : "") + '" data-list-mode="deleted">Recently deleted</button></div>' + renderNextSteps(configuration) + renderProjectCards() + '<section class="detail"><div class="card-header"><div><h2 data-testid="selected-project-title">' + html(selected.name) + '</h2><p class="subtle">The saved record for this project.</p></div></div><div class="detail-grid"><div class="detail-cell"><span>Primary domain</span><strong class="mono" data-testid="selected-project-domain">' + html(selected.normalizedDomain) + '</strong></div><div class="detail-cell"><span>Selected models</span><strong>' + state.selections.length + '</strong></div><div class="detail-cell"><span>Current version</span><strong>' + html(configuration.currentVersion ? "v" + configuration.currentVersion : "Not saved yet") + '</strong></div><div class="detail-cell"><span>Project ID</span><strong data-testid="selected-project-id">' + html(selected.id) + '</strong></div></div><form id="project-edit-form" class="form"><h3 class="form-title">Edit this project</h3><div class="field"><label for="edit-domain">Primary domain</label><input id="edit-domain" value="' + html(selected.primaryDomain) + '"></div><div class="field"><label for="edit-name">Project name</label><input id="edit-name" value="' + html(selected.name) + '"></div><div class="actions">' + button({ label: "Save project", kind: "primary", submit: true, testId: "save-project" }) + button({ label: "Archive", id: "archive-project", testId: "archive-project" }) + button({ label: "Delete project", tone: "danger", id: "delete-project", testId: "delete-project" }) + '</div></form></section></section>'; }
    function selectedRows() { const byId = new Map(state.catalog.map((item) => [item.modelId, item])); return Array.from(state.draftSelections.entries()).map(([modelId, webSearchMode]) => ({ model:byId.get(modelId) || state.selections.find((item) => item.modelId === modelId), inCatalog: state.catalogState !== "ready" || byId.has(modelId), modelId, webSearchMode })).filter((item) => item.model); }
    function providerShortLabel(providerId: any) { return providerId === "openrouter" ? "OpenRouter" : providerId === "azure-openai" ? "Azure" : "Local"; }
    function openRouterOutOfCredit() { return state.providers.some((provider) => provider.providerId === "openrouter" && provider.balance && !provider.balance.paidModelsRunnable); }
    function modelIsBlocked(model: any, modelId: any) { return Boolean(model) && model.providerId === "openrouter" && !modelId.endsWith(":free") && openRouterOutOfCredit(); }
    function runsNowCell(model: any, modelId: any) { if (model && model.available === false) return '<span class="mcell state-bad" title="' + html(model.unavailableReason || "") + '">Never</span>'; return modelIsBlocked(model, modelId) ? '<span class="mcell state-flag">No credit</span>' : '<span class="mcell state-ok">Yes</span>'; }
    function webSearchSelect(modelId: any, mode: any, nativeSupported: any, attribute: any) { return '<select data-' + attribute + '="' + html(modelId) + '" ' + (nativeSupported ? "" : "disabled") + '><option value="off" ' + (mode === "off" ? "selected" : "") + '>Offline</option><option value="provider_native" ' + (mode === "provider_native" ? "selected" : "") + '>Native web search</option></select>'; }
    /** A selection the server will refuse. Its catalogue checkbox is disabled
     * for the same reason, so the row has to offer the only way to clear it. */
    function blockedSelection(row: any) { return !row.inCatalog || (row.model && row.model.available === false); }
    function renderSelectedModels(readOnly?: any) { const rows = selectedRows(); if (rows.length === 0) return '<p class="subtle">No models selected yet.</p>'; const columns = readOnly ? "mcols-readonly" : "mcols-selected"; const head = '<div class="mhead ' + columns + '"><span>Model</span><span>Provider</span>' + (readOnly ? '' : '<span>Runs now</span>') + '<span>Web search</span></div>'; const body = rows.map((row) => { const nativeSupported = ((row.model as any).nativeWebSearchSupported as any) === true; const mode = readOnly ? '<span class="mcell">' + html(modeText(row.webSearchMode)) + '</span>' : webSearchSelect(row.modelId, row.webSearchMode, nativeSupported, "selected-model-mode"); return '<div class="mrow selection-row ' + columns + '"><div class="mname"><strong>' + html(((row.model as any).displayName as any)) + '</strong><span class="mono">' + html(row.modelId) + '</span></div><span class="mcell">' + html(providerShortLabel(((row.model as any).providerId as any))) + '</span>' + (readOnly ? '' : row.inCatalog ? runsNowCell(row.model, row.modelId) : '<span class="mcell state-bad" title="The provider no longer lists this model.">No longer offered</span>') + (readOnly || !blockedSelection(row) ? mode : button({ label: "Remove", kind: "quiet", tone: "danger", on: { "data-drop-selection": row.modelId } })) + '</div>'; }).join(""); return '<div class="mtable">' + head + body + '</div>' + (readOnly ? '' : '<p class="mlegend">Web search stays Offline for models with no provider-native search.</p>'); }
    function catalogVendor(item: any) { const supplied = typeof item.vendor === "string" ? item.vendor.trim() : ""; if (supplied) return supplied; const name = String(item.displayName || ""); const separator = name.indexOf(":"); if (separator > 0) return name.slice(0, separator).trim(); const modelId = String(item.modelId || ""); const namespaceEnd = modelId.indexOf("/"); return namespaceEnd > 0 ? modelId.slice(0, namespaceEnd) : modelId; }
    function catalogReleasedAt(item: any) { if (typeof item.releasedAt !== "string" || !item.releasedAt) return null; const timestamp = new Date(item.releasedAt).getTime(); return Number.isFinite(timestamp) ? timestamp : null; }
    function catalogVendors() { return Array.from(new Set(state.catalog.map((item) => catalogVendor(item)).filter((vendor) => vendor.length > 0))).sort((left, right) => left.localeCompare(right)); }
    function filteredCatalogModels() { const query = state.query.toLocaleLowerCase(); const results = state.catalog.filter((item) => { const vendor = catalogVendor(item); const matchesQuery = item.displayName.toLocaleLowerCase().includes(query) || item.modelId.toLocaleLowerCase().includes(query) || vendor.toLocaleLowerCase().includes(query); const matchesVendor = !state.catalogProvider || vendor === state.catalogProvider; const matchesSearch = state.catalogNativeSearch === "all" || (state.catalogNativeSearch === "supported" ? item.nativeWebSearchSupported : !item.nativeWebSearchSupported); return matchesQuery && matchesVendor && matchesSearch; }); results.sort((left, right) => { const leftVendor = catalogVendor(left); const rightVendor = catalogVendor(right); if (state.catalogSort === "vendor") { const vendorOrder = leftVendor.localeCompare(rightVendor); return vendorOrder || left.displayName.localeCompare(right.displayName); } if (state.catalogSort === "newest" || state.catalogSort === "oldest") { const leftReleasedAt = catalogReleasedAt(left); const rightReleasedAt = catalogReleasedAt(right); if (leftReleasedAt === null && rightReleasedAt === null) return left.displayName.localeCompare(right.displayName); if (leftReleasedAt === null) return 1; if (rightReleasedAt === null) return -1; return state.catalogSort === "newest" ? rightReleasedAt - leftReleasedAt : leftReleasedAt - rightReleasedAt; } return left.displayName.localeCompare(right.displayName); }); return results.slice(0, 80); }
    function catalogResultSummary(count: number) { return 'Show ' + count + '  models. When sorting by release date, models with no date in the catalog are listed last.'; }
    function catalogHead() { return '<div class="mhead mcols-catalog"><span></span><span>Model</span><span>Vendor</span><span>Runs now</span><span>Web search</span></div>'; }
    function renderCatalogModelRows(results: any) { return results.map((item: any) => { const chosen = state.draftSelections.get(item.modelId); const isChosen = chosen !== undefined; const vendor = catalogVendor(item); const releasedAt = catalogReleasedAt(item); const released = releasedAt === null ? ' \u00b7 no release date' : ' \u00b7 ' + new Date(releasedAt).toLocaleDateString(); const releasedTitle = releasedAt === null ? ' title="Catalog does not provide a release date"' : ''; return '<div class="mrow mcols-catalog" data-testid="catalog-model" data-model-id="' + html(item.modelId) + '" data-model-vendor="' + html(vendor) + '" data-model-released-at="' + html(releasedAt === null ? "" : String(releasedAt)) + '" data-native-search="' + String(item.nativeWebSearchSupported) + '"><input type="checkbox" data-model-checkbox="' + html(item.modelId) + '" ' + (isChosen ? "checked" : "") + (item.available ? "" : " disabled") + ' aria-label="Select ' + html(item.displayName) + '"><div class="mname"><strong>' + html(item.displayName) + '</strong><span class="mono"' + releasedTitle + '>' + html(item.modelId) + html(released) + '</span>' + (item.available ? '' : '<span class="state-bad">' + html(item.unavailableReason || "Unavailable") + '</span>') + '</div><span class="mcell">' + html(vendor) + '</span>' + runsNowCell(item, item.modelId) + webSearchSelect(item.modelId, chosen || "off", isChosen && item.nativeWebSearchSupported, "model-mode") + '</div>'; }).join(""); }
    // Repaints the rows alone. The whole page is 70KB of markup, so re-rendering
    // it per keystroke is felt; this needs .model-list to wrap only the rows.
    function refreshCatalogSearchResults() { const list = document.querySelector(".model-list"); const summary = document.querySelector(".catalog-result-summary"); if (!list || !summary || state.catalogState !== "ready") { render(); return; } const results = filteredCatalogModels(); summary.textContent = catalogResultSummary(results.length); list.innerHTML = results.length === 0 ? '<p class="subtle">No matching models.</p>' : renderCatalogModelRows(results); }
    function blockedSelectionBanner() {
      if (state.providersState !== "ready") return '';
      const stalled = state.providers.some((provider) => provider.providerId === "openrouter" && provider.balance && !provider.balance.paidModelsRunnable);
      if (!stalled) return '';
      const rows = selectedRows();
      const blocked = rows.filter((row) => row.model && (row.model as any).providerId === "openrouter" && !row.modelId.endsWith(":free"));
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

    function renderEngines() {
      if (state.enginesState === "idle") { loadEngines(); }
      if (state.enginesState !== "ready" || !state.engines) {
        return '<p class="subtle">' + (state.enginesState === "error" ? "Could not read the engines." : "Checking for a browser to drive.") + '</p>';
      }
      const data = state.engines;
      const reach = data.reachable === null
        ? '<div class="warning-box">Not checked yet.</div>'
        : data.reachable
          ? '<div class="success-box">Browser reachable at <span class="mono">' + html(data.endpoint) + '</span>. ' + html(data.detail) + '</div>'
          : '<div class="warning-box"><strong>No browser to drive at <span class="mono">' + html(data.endpoint) + '</span>.</strong> ' + html(data.detail)
            + ' Start Chrome with remote debugging and sign in to the surfaces you want read. Selecting an engine here is still saved; it just cannot run yet.</div>';
      const rows = data.engines.map((engine: any) => '<div class="mrow mcols-engine">'
        + '<input type="checkbox" data-engine-checkbox="' + html(engine.id) + '"' + (engine.selected ? ' checked' : '') + ' aria-label="Ask ' + html(engine.label) + '">'
        + '<div class="mname"><strong>' + html(engine.label) + '</strong><span class="subtle">' + html(engine.caveat) + '</span></div>'
        + '<span class="mcell ' + (engine.selected ? 'state-ok' : '') + '">' + (engine.selected ? "Asked on every run" : "Not asked") + '</span></div>').join("");
      return reach + '<div class="mtable"><div class="mhead mcols-engine"><span></span><span>Surface</span><span>State</span></div>' + rows + '</div>'
        + '<p class="subtle">These are the only sources here that search the web by construction, so they are where citations come from. Nothing signs in on your behalf; the answer is whatever your own signed-in session shows.</p>';
    }

    function renderModels() { if (state.providersState === "idle") { loadProviders(); } const selected = project(); if (!selected) return '<section class="view"><div class="empty"><div class="empty-copy"><h2>Select a project first</h2><p class="subtle">A model configuration belongs to a single project.</p></div></div></section>'; const vendors = catalogVendors(); const results = filteredCatalogModels(); const list = state.catalogState === "idle" || state.catalogState === "loading" ? '<p class="subtle">Loading the OpenRouter model catalog…</p>' : state.catalogState === "error" ? '<div class="warning-box"><strong>Model catalog unavailable</strong><p>' + html(state.catalogError) + '</p>' + button({ label: "Retry", id: "retry-catalog", testId: "retry-catalog" }) + '</div>' : results.length === 0 ? '<p class="subtle">No matching models.</p>' : '<p class="catalog-result-summary">' + catalogResultSummary(results.length) + '</p><div class="mtable">' + catalogHead() + '<div class="model-list">' + renderCatalogModelRows(results) + '</div></div>'; const notice = state.modelNotice.text || (state.selectionsDirty ? "Configuration not saved yet" : ""); const noticeClass = state.modelNotice.kind || (state.selectionsDirty ? "warning" : ""); const saveLabel = state.modelActionState === "error" ? "Retry saving model configuration" : "Save model configuration"; const vendorOptions = vendors.map((vendor) => '<option value="' + html(vendor) + '" ' + (state.catalogProvider === vendor ? "selected" : "") + '>' + html(vendor) + '</option>').join(""); const cfg = monitoringConfiguration(); return '<section class="view"><div class="heading"><div><h1>Choose models</h1><p class="subtle">Pick the models to ask, set each one\'s web search mode, then save them as this project\'s configuration. Currently ' + (cfg.currentVersion ? "saved as v" + cfg.currentVersion : "not saved") + '.</p></div><div class="inline-actions">' + button({ label: saveLabel, id: "save-models", testId: "save-models", on: { "data-action-state": state.modelActionState } }) + '' + saveConfigurationButton(cfg, state.selections.length > 0) + '</div></div><div id="models-status" class="form-status ' + noticeClass + '" aria-live="polite">' + html(notice) + '</div><div class="section-stack"><section class="section-card"><div class="section-head"><div><h2>Selected models</h2><p class="subtle">Select one or more models.</p></div><span class="tag">' + selectedRows().length + '  selected</span></div>' + blockedSelectionBanner() + renderSelectedModels() + '</section><section class="section-card"><div class="section-head"><div><h2>Answer surfaces</h2><p class="subtle">The products a buyer actually opens, read through your own browser. The only sources here that search the web.</p></div></div>' + renderEngines() + '</section><section class="section-card"><div class="section-head"><div><h2>Model catalog</h2><p class="subtle">Searchable and multi-select. A provider that is unreachable contributes nothing; no fabricated models are shown.</p></div><span class="tag ' + (state.catalogState === "ready" ? "ready" : state.catalogState === "error" ? "warning" : "") + '">' + (state.catalogState === "ready" ? "Catalog available" : state.catalogState === "error" ? "Catalog error" : "Loading") + '</span></div><input id="model-search" class="model-search" data-testid="model-search" type="search" value="' + html(state.query) + '" placeholder="Search by model name, model ID or vendor"><div class="model-catalog-controls"><label for="model-provider-filter">Model vendor<select id="model-provider-filter" data-testid="model-provider-filter"><option value="">All vendors</option>' + vendorOptions + '</select></label><label for="model-native-search-filter">Web search capability<select id="model-native-search-filter" data-testid="model-native-search-filter"><option value="all" ' + (state.catalogNativeSearch === "all" ? "selected" : "") + '>All</option><option value="supported" ' + (state.catalogNativeSearch === "supported" ? "selected" : "") + '>Supports native web search</option><option value="unsupported" ' + (state.catalogNativeSearch === "unsupported" ? "selected" : "") + '>Does not support native web search</option></select></label><label for="model-catalog-sort">Sort<select id="model-catalog-sort" data-testid="model-catalog-sort"><option value="name" ' + (state.catalogSort === "name" ? "selected" : "") + '>Name A-Z</option><option value="vendor" ' + (state.catalogSort === "vendor" ? "selected" : "") + '>Vendor A-Z</option><option value="newest" ' + (state.catalogSort === "newest" ? "selected" : "") + '>Release date: newest first</option><option value="oldest" ' + (state.catalogSort === "oldest" ? "selected" : "") + '>Release date: oldest first</option></select></label></div>' + list + '</section></div></section>'; }
    function configurationVisualState(configuration: any) { return state.monitoringSaveState === "idle" ? configuration.status : state.monitoringSaveState; }
    function renderConfigurationDiff(configuration: any) { const diff = configuration.diff; const rows = []; for (const item of diff.addedModels) rows.push("Models added: " + item.displayName); for (const item of diff.removedModels) rows.push("Models removed: " + item.displayName); for (const item of diff.webSearchModeChanges) rows.push("Web search mode change: " + item.displayName + " from \"" + modeText(item.previousMode) + "\" to \"" + modeText(item.currentMode) + "\""); if (diff.protocolVersionChange) rows.push("Protocol version change: " + diff.protocolVersionChange.previous + " → " + diff.protocolVersionChange.current); if (diff.domainChange) rows.push("Domain change: " + diff.domainChange.previous + " → " + diff.domainChange.current); if (diff.languageChange) rows.push("Output language change: " + diff.languageChange.previous + " → " + diff.languageChange.current); if (rows.length === 0) return ""; return '<section class="section-card" data-testid="configuration-diff"><div class="section-head"><div><h2>Changes in this run</h2><p class="subtle">Saving creates a new configuration version.</p></div></div><ul class="protocol-list">' + rows.map((row) => '<li>' + html(row) + '</li>').join("") + '</ul></section>'; }
    function renderConfigurationRows(configuration: any) { if (state.baselines.length === 0) return '<p class="subtle">No past configurations yet.</p>'; const currentId = configuration.currentBaseline ? configuration.currentBaseline.id : ""; return '<div class="baseline-list">' + state.baselines.map((baseline) => '<article class="baseline-row" data-testid="configuration-version-row" data-configuration-id="' + html(baseline.id) + '"><div><strong>config v' + baseline.version + (currentId === baseline.id ? " · Current version" : "") + '</strong><span>' + html(baseline.normalizedDomain) + ' · ' + baseline.modelSnapshots.length + '  models</span><span>' + baseline.modelSnapshots.map((item: any) => html(item.displayName + "（" + modeText(item.webSearchMode) + "）")).join(", ") + '</span></div><span class="tag mono">' + html(formatTime(baseline.createdAt)) + '</span></article>').join("") + '</div>'; }
    function renderTechnicalDetails(configuration: any) { const protocol = configuration.currentProtocol; const capabilities = configuration.currentModelSnapshots.length ? configuration.currentModelSnapshots.map((item: any) => '<li>' + html(item.displayName + " · " + formatTime(item.capabilityCheckedAt)) + '</li>').join("") : '<li>The capability check time is recorded once models are saved.</li>'; return '<details class="technical-details"><summary>Technical details</summary><div class="detail-grid"><div class="detail-cell"><span>Protocol</span><strong>' + html(protocol.protocolId + "/" + protocol.protocolVersion) + '</strong></div><div class="detail-cell"><span>Protocol hash</span><strong>' + html(protocol.promptTemplateHash || "Recorded on first save") + '</strong></div><div class="detail-cell"><span>Input scope</span><strong>Domain only</strong></div><div class="detail-cell"><span>Output language</span><strong>' + html(configuration.currentLanguage) + '</strong></div></div><p class="field-help">Model capability check time</p><ul class="protocol-list">' + capabilities + '</ul></details>'; }
    function saveConfigurationButton(configuration: any, hasModels: any) { const visual = configurationVisualState(configuration); const disabled = !hasModels || visual === "unchanged" || visual === "saving" || visual === "saved"; const label = visual === "no_version" ? "Save config v1" : visual === "unchanged" ? "✓ Current configuration saved" : visual === "changed" ? "Save as config v" + configuration.nextVersion : visual === "saving" ? "Saving…" : visual === "saved" ? "✓ Saved as v" + configuration.currentVersion : "Save again"; return button({ label: label, kind: "primary", disabled: disabled, id: "save-monitoring-configuration", testId: "save-monitoring-configuration", on: { "data-action-state": visual } }); }
    /** The page only draws. Loading stays here, because a view that fetches
     * is a view that cannot be rendered twice. */
    function renderSetup() {
      if (state.providersState === "idle") { loadProviders(); }
      if (state.storageState === "idle") { loadStorage(); }
      if (state.credentialsState === "idle") { loadCredentials(); }
      if (state.integrationsState === "idle") { loadIntegrations(); }
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
      });
    }

    function renderConfiguration() { const selected = project(); if (!selected) return '<section class="view"><div class="empty"><div class="empty-copy"><h2>Select a project first</h2><p class="subtle">A configuration belongs to a single project.</p></div></div></section>'; if (state.configurationState === "loading") return '<section class="view"><div class="heading"><div><h1>Configuration</h1><p class="subtle">Loading the current configuration…</p></div></div><div class="section-card inline-empty" aria-live="polite">Loading the domain, models and web search modes.</div></section>'; const configuration = monitoringConfiguration(); const hasModels = selectedRows().length > 0; const notice = state.monitoringNotice.text; const noticeKind = state.monitoringNotice.kind; const stateMessage = !hasModels ? "Select at least one available model before saving the configuration." : configuration.status === "no_version" ? "No configuration saved yet. Saving fixes the current domain, language, models and web search modes." : configuration.status === "changed" ? "The models or web search modes have changed. Saving creates a new configuration version." : "The current models and web search modes are saved."; const stateClass = !hasModels || configuration.status === "changed" ? "warning-box" : configuration.status === "unchanged" ? "success-box" : "warning-box"; return '<section class="view"><div class="heading"><div><h1>Configuration</h1><p class="subtle">Save the domain, output language and each model\'s web search mode as reusable monitoring conditions.</p></div>' + saveConfigurationButton(configuration, hasModels) + '</div><div id="monitoring-configuration-status" data-testid="monitoring-configuration-status" class="form-status ' + html(noticeKind) + '" aria-live="polite">' + html(notice) + '</div><div class="section-stack"><section class="section-card"><div class="section-head"><div><h2>Current version</h2><p class="subtle">Target domain: <span class="mono">' + html(selected.normalizedDomain) + '</span></p></div><span class="tag ' + (configuration.status === "unchanged" ? "ready" : "warning") + '">' + (configuration.currentVersion ? "v" + configuration.currentVersion : "Not saved yet") + '</span></div><div class="' + stateClass + '" data-testid="monitoring-configuration-summary">' + html(stateMessage) + '</div></section><section class="section-card"><div class="section-head"><div><h2>Current model configuration</h2><p class="subtle">Each model stores its own web search mode.</p></div>' + button({ label: "Adjust models", on: { "data-page": "models" } }) + '</div>' + renderSelectedModels(true) + '</section>' + renderConfigurationDiff(configuration) + '<section class="section-card"><div class="section-head"><div><h2>Past configurations</h2><p class="subtle">Read-only snapshot. Saving a new version does not overwrite past configurations.</p></div></div>' + renderConfigurationRows(configuration) + '</section>' + renderTechnicalDetails(configuration) + '</div></section>'; }
    const brandMark = CONFIG.brandMark;
    const brandLockup = CONFIG.brandLockup;
    // Says what the page is built from and when, so a tab left open overnight
    // is recognisable as stale rather than read as current.
    function renderFooter() {
      const home = state.home;
      const answers = home && typeof home.answers === "number" ? home.answers : null;
      const run = home && home.lastRun ? String(home.lastRun.at) : "";
      return '<footer class="appfoot">'
        + '<span>' + (answers === null ? 'Nothing archived yet' : answers + ' archived answer(s)')
        + (run ? ' \u00b7 last run ' + html(run.slice(0, 16).replace("T", " ")) : '') + '</span>'
        + '<span>Every figure here opens the answer it came from.</span></footer>';
    }

    function phase2RenderImpl() { if (window.__citegeoPhase5Active) return; const selected = project(); const options = state.currentProjects.length ? state.currentProjects.map((item) => '<option value="' + html(item.id) + '">' + html(item.name) + ' · ' + html(item.normalizedDomain) + '</option>').join("") : '<option value="">No projects yet</option>'; let view = state.page === "models" ? renderModels() : state.page === "configuration" ? renderConfiguration() : state.page === "setup" ? renderSetup() : state.page === "visibility" ? renderVisibility() : state.page === "brand-visibility" ? renderBrandVisibility() : state.page === "prompts" ? renderPrompts() : state.page === "answer-engine" ? renderAnswerEngine() : state.page === "dashboard" ? renderHome() : renderOverview(); app.innerHTML = renderEvidence() + '<div class="shell">' + navScrim() + '<aside class="sidebar"><button type="button" class="brand" data-page="dashboard" aria-label="Back to the dashboard">' + brandLockup + '</button><div class="project-label">Project</div><select id="project-select" class="project-select" aria-label="Switch project" data-testid="project-select">' + options + '</select><nav class="nav" aria-label="Project navigation"><button type="button" class="nav-item ' + (state.page === "dashboard" ? "active" : "") + '" data-page="dashboard"><span>Dashboard</span></button><div class="nav-label">Run a test</div><button type="button" class="nav-item ' + (state.page === "models" ? "active" : "") + '" data-page="models"><span class="nav-step">1</span><span>Choose models</span></button><button type="button" class="nav-item ' + (state.page === "recognition" || state.page === "reports" ? "active" : "") + '" data-page="recognition"><span class="nav-step">2</span><span>Results</span></button><button type="button" class="nav-item ' + (state.page === "visibility" ? "active" : "") + '" data-page="visibility"><span class="nav-step">3</span><span>Visibility</span></button><div class="nav-label">Answer engine</div><button type="button" class="nav-item ' + (state.page === "answer-engine" ? "active" : "") + '" data-page="answer-engine"><span>Scores</span></button><button type="button" class="nav-item ' + (state.page === "brand-visibility" ? "active" : "") + '" data-page="brand-visibility"><span>Brand visibility</span></button><button type="button" class="nav-item ' + (state.page === "prompts" ? "active" : "") + '" data-page="prompts"><span>Prompts</span></button><div class="nav-label">Over time</div><a class="nav-item" href="?view=measurements"><span>Continuous measurement</span></a><div class="nav-label">Machine</div><button type="button" class="nav-item ' + (state.page === "overview" ? "active" : "") + '" data-page="overview"><span>Projects</span></button><button type="button" class="nav-item ' + (state.page === "configuration" ? "active" : "") + '" data-page="configuration"><span>Configuration history</span></button><button type="button" class="nav-item ' + (state.page === "setup" ? "active" : "") + '" data-page="setup"><span>Setup</span></button></nav><div class="sidebar-bottom">Domain recognition</div></aside><main class="workspace"><header class="topbar"><div class="topbar-lead">' + navToggle() + '<div class="crumb"><button type="button" class="crumb-home" data-page="dashboard">' + html(CONFIG.productName) + '</button> / ' + html(selected ? selected.name : "Project") + '</div></div><div class="topbar-actions"><button type="button" class="theme-toggle" data-theme-toggle aria-label="Switch between light and dark">&#9681;</button>' + button({ label: "New project", kind: "primary", id: "new-project", testId: "new-project" }) + '</div></header><section class="content">' + view + '</section>' + renderFooter() + '</main></div>'; const select = element("project-select"); select.value = state.selectedId; document.title = selected ? selected.name + " | " + CONFIG.productTitle + "" : "" + CONFIG.productTitle + ""; }
    async function setPage(page: any) { state.page = page; savePreference("page", page); if (page === "configuration") { await refreshConfiguration(); return; } if (page === "reports" && window.__citegeoPhase4 && typeof window.__citegeoPhase4.open === "function") { await window.__citegeoPhase4.open(); return; } render(); if (page === "models") { await refreshConfiguration(); await loadCatalog(); } }
    async function createDraft(event: any) { event.preventDefault(); const control = element("save-draft"); const session = state.drawerSession; setFormStatus("Creating project draft", "loading"); try { const response = await runAction(control, { loading:"Saving…", success:"Saved", error:"Save failed" }, () => request("/api/projects", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ domain:element("project-domain").value, name:element("project-name").value }) })); state.mode = "current"; state.page = "overview"; setSelectedProject(response.project.id); await refreshProjects(); state.selections = []; state.baselines = []; resetDraftSelections(); setFormStatus("Draft saved", "success"); render(); window.setTimeout(() => { if (state.drawerSession === session) closeDrawer(); }, 850); } catch (error) { setFormStatus(error instanceof Error ? error.message : String(error), "error"); } }
    async function saveProject(event: any) { event.preventDefault(); const selected = project(); if (!selected) return; const control = event.currentTarget.querySelector('control[type="submit"]'); try { await runAction(control, { loading:"Saving…", success:"Saved", error:"Save failed" }, () => request("/api/projects/" + encodeURIComponent(selected.id), { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ domain:element("edit-domain").value, name:element("edit-name").value }) })); await refreshProjects(); render(); } catch (error) { window.alert(error instanceof Error ? error.message : String(error)); } }
    async function projectAction(action: string, projectId: string, button: HTMLElement | null) { if (action === "select") { setSelectedProject(projectId); state.selectionsDirty = false; await refreshConfiguration(); render(); return; } if (action === "delete" && !window.confirm("The project will be removed from the current list.")) return; if (action === "purge" && !window.confirm("A permanent purge cannot be undone.")) return; const path = "/api/projects/" + encodeURIComponent(projectId) + (action === "archive" ? "/archive" : action === "restore" ? "/restore" : action === "purge" ? "/purge" : ""); const method = action === "delete" || action === "purge" ? "DELETE" : "POST"; const labels = action === "archive" ? { loading:"Archiving…", success:"Archived", error:"Archive failed" } : action === "restore" ? { loading:"Restoring…", success:"Restored", error:"Restore failed" } : action === "purge" ? { loading:"Purging…", success:"Purged", error:"Purge failed" } : { loading:"Deleting…", success:"Deleted", error:"Delete failed" }; try { await runAction(button, labels, () => request(path, { method })); if (state.selectedId === projectId && (action === "archive" || action === "delete" || action === "purge")) setSelectedProject(""); if (action === "restore") { state.mode = "current"; setSelectedProject(projectId); } await refreshProjects(); await refreshConfiguration(); render(); } catch (error) { window.alert(error instanceof Error ? error.message : String(error)); } }
    function changeModel(modelId: any, checked: any) { const catalogItem = state.catalog.find((item) => item.modelId === modelId); if (!catalogItem) return; if (!checked) state.draftSelections.delete(modelId); else state.draftSelections.set(modelId, "off"); state.modelNotice = { text:"", kind:"" }; state.modelActionState = "idle"; state.selectionsDirty = true; render(); }
    /** Clears a selection the catalogue no longer offers. changeModel refuses
     * one, so without this the save stays rejected with no way to fix it. */
    function dropSelection(modelId: any) { state.draftSelections.delete(modelId); state.modelNotice = { text:"", kind:"" }; state.modelActionState = "idle"; state.selectionsDirty = true; render(); }
    function changeModelMode(modelId: any, mode: any) { const catalogItem = state.catalog.find((item) => item.modelId === modelId); if (!catalogItem || !state.draftSelections.has(modelId)) return; if (mode === "provider_native" && !catalogItem.nativeWebSearchSupported) return; state.modelNotice = { text:"", kind:"" }; state.modelActionState = "idle"; state.draftSelections.set(modelId, mode); state.selectionsDirty = true; render(); }
    async function saveModels(button: HTMLElement | null) { const selected = project(); if (!selected) return; const selections = Array.from(state.draftSelections.entries()).map(([modelId, webSearchMode]) => ({ modelId, webSearchMode })); state.modelNotice = { text:"Saving each model\'s own web search mode…", kind:"loading" }; try { const response = await runAction(button, { loading:"Saving…", success:"Saved", error:"Save failed" }, () => request("/api/projects/" + encodeURIComponent(selected.id) + "/models", { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ selections }) })); state.selections = response.selections; resetDraftSelections(); state.modelNotice = { text:"Model configuration saved", kind:"success" }; state.modelActionState = "success"; render(); window.setTimeout(() => { state.modelActionState = "idle"; if (state.page === "models") render(); }, 850); } catch (error) { state.modelNotice = { text:error instanceof Error ? error.message : String(error), kind:"error" }; state.modelActionState = "error"; render(); } }
    async function saveMonitoringConfiguration() { const selected = project(); const configuration = monitoringConfiguration(); if (!selected || configuration.status === "unchanged" || state.monitoringSaveState === "saving") return; if (selectedRows().length === 0) { state.monitoringNotice = { text:"Select at least one available model before saving the configuration.", kind:"error" }; state.monitoringSaveState = "failed"; render(); return; } state.monitoringSaveState = "saving"; state.monitoringNotice = { text:"Saving the current domain, language, models and web search modes…", kind:"loading" }; render(); try { const response = await request("/api/projects/" + encodeURIComponent(selected.id) + "/baselines", { method:"POST", headers:{"Content-Type":"application/json"}, body:"{}" }); state.currentProjects = state.currentProjects.map((item) => item.id === response.project.id ? response.project : item); state.projects = state.projects.map((item) => item.id === response.project.id ? response.project : item); await refreshConfiguration(); const version = response.baseline.version; state.monitoringSaveState = "saved"; state.monitoringNotice = { text:"Saved as config v" + version, kind:"success" }; render(); window.setTimeout(() => { state.monitoringSaveState = "idle"; if (state.page === "configuration") render(); }, 850); } catch (error) { if (errorCode(error) === "baseline_unchanged") { await refreshConfiguration(); state.monitoringSaveState = "idle"; state.monitoringNotice = { text:"The current configuration is already saved", kind:"success" }; render(); return; } state.monitoringSaveState = "failed"; state.monitoringNotice = { text: error instanceof Error ? error.message : (expectedErrorText.request_failed || "The request failed."), kind: "error" }; render(); } }
    document.addEventListener("click", async (event) => {
      const clicked = el(event.target) as any;
      if (!clicked || !clicked.closest) return;
      if (clicked.closest("[data-generate-prompts]")) { await postPrompts("/topics/generate", {}, "generating", "A set has been proposed. Read it, then track the questions worth tracking."); return; }
      if (clicked.closest("[data-run-prompts]")) { loadLiveRun(); await postPrompts("/prompt-runs", {}, "running", "The run finished. Every answer is archived."); loadLiveRun(); return; }
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
      if (clicked.closest("[data-prompt-select-all]")) { selectAllShown(); return; }
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
      if (target.closest("[data-pull-search]")) { pullSearchDemand(); return; }
      if (target.closest("[data-pull-referrals]")) { pullReferrals(); return; }
      if (target.closest("[data-stop-run]")) { stopRun(); return; }
      const openRun = target.closest("[data-open-run]");
      if (openRun) { openRunPane(openRun.getAttribute("data-open-run") || ""); return; }
      if (target.closest("[data-adopt-rivals]")) { rivalAction("/competitors/adopt", {}, "Adopted."); return; }
      if (target.closest("[data-save-segment]")) { saveSegment(); return; }
      const removeSegment = target.closest("[data-segment-remove]");
      if (removeSegment) {
        postPrompts("/segments/remove", { segmentIds: [removeSegment.getAttribute("data-segment-remove")] }, "saving", "View removed.")
          .then(() => { state.segmentsState = "idle"; loadSegments(); });
        return;
      }
      const segment = target.closest("[data-segment]");
      if (segment) {
        const saved = state.segments ? state.segments.segments : [];
        const found = saved.find((row: any) => row.id === segment.getAttribute("data-segment"));
        if (found) applySegment(found.filters);
        return;
      }
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
      await postPrompts("/prompts", { topicId: data.get("topicId"), text: data.get("text"), intent: data.get("intent") }, "saving", "Added and tracked.");
    });

    document.addEventListener("click", async (event) => { const target = el(event.target) as any; if (target && target.closest && target.closest("[data-reload-providers]")) { state.providersState = "idle"; loadProviders(); return; }
      if (target && target.closest && target.closest("[data-reload-insights]")) { state.insightsState = "idle"; state.crawlersState = "idle"; state.planState = "idle"; state.signalsState = "idle"; loadInsights(); loadCrawlers(); loadPlan(); loadSignals(); return; }
      const rangeButton = target && target.closest ? target.closest("[data-dash-range]") : null;
      if (rangeButton) { state.dashRange = rangeButton.getAttribute("data-dash-range") || "all"; savePreference("range", state.dashRange); render(); return; }
      const metricButton = target && target.closest ? target.closest("[data-dash-metric]") : null;
      if (metricButton) { state.dashMetric = metricButton.getAttribute("data-dash-metric") || "visibility"; savePreference("metric", state.dashMetric); render(); return; }
      const saveCred = target && target.closest ? target.closest("[data-credential-save]") : null;
      if (saveCred) { await saveCredential(saveCred.getAttribute("data-credential-save"), saveCred); return; }
      const clearCred = target && target.closest ? target.closest("[data-credential-clear]") : null;
      if (clearCred) { await clearCredential(clearCred.getAttribute("data-credential-clear"), clearCred); return; }
      const probeButton = target && target.closest ? target.closest("[data-probe-signals]") : null;
      if (probeButton) { await captureSignals(probeButton); state.signalsState = "idle"; loadSignals(); return; } if (!(target instanceof Element)) return; const pageButton = target.closest("[data-page]"); if (pageButton) { await setPage(pageButton.getAttribute("data-page") || "overview"); return; } const listModeButton = target.closest("[data-list-mode]"); if (listModeButton) { state.mode = listModeButton.getAttribute("data-list-mode") || "current"; await refreshProjects(); render(); return; } if (target.id === "new-project" || target.id === "empty-new-project") { openDrawer(); return; } if (target.id === "close-drawer" || target.id === "cancel-draft" || target.id === "drawer-backdrop") { closeDrawer(); return; } if (target.id === "retry-catalog") { state.catalogState = "idle"; await loadCatalog(); return; } const opened = target.closest("[data-matrix-open]"); if (opened) { const key = opened.getAttribute("data-matrix-open") || ""; const at = state.matrixOpen.indexOf(key); if (at >= 0) state.matrixOpen.splice(at, 1); else state.matrixOpen.push(key); render(); return; } const expand = target.closest("[data-expand-panel]"); if (expand && !target.closest("button:not(.panel-open),a,select,input,textarea,label")) { openPanel(expand.getAttribute("data-expand-panel") || ""); return; } if (target.closest("[data-edit-board]")) { state.editingBoard = !state.editingBoard; render(); return; } const span = target.closest("[data-panel-span]"); if (span) { const parts = (span.getAttribute("data-panel-span") || "").split(":"); setPanelSpan(parts[0] || "", Number(parts[1])); render(); return; } const hide = target.closest("[data-panel-hide]"); if (hide) { togglePanelHidden(hide.getAttribute("data-panel-hide") || ""); render(); return; } if (target.closest("[data-reset-panels]")) { resetPanelOrder(); state.editingBoard = false; render(); return; } const brand = target.closest("[data-brand-evidence]"); if (brand) { await openBrandEvidence(brand.getAttribute("data-brand-evidence") || "", brand.getAttribute("data-brand-tone") || ""); return; } const dropped = target.closest("[data-drop-selection]"); if (dropped) { dropSelection(dropped.getAttribute("data-drop-selection") || ""); return; } if (target.id === "save-models") { await saveModels((target as any)); return; } if (target.id === "save-monitoring-configuration") { await saveMonitoringConfiguration(); return; } if (target.id === "archive-project") { const selected = project(); if (selected) await projectAction("archive", selected.id, (target as any)); return; } if (target.id === "delete-project") { const selected = project(); if (selected) await projectAction("delete", selected.id, (target as any)); return; } const action = target.closest("[data-project-action]"); if (action) { const projectId = action.getAttribute("data-project-id"); const name = action.getAttribute("data-project-action"); if (projectId && name) await projectAction(name, projectId, (action as any)); } });
    document.addEventListener("change", async (event) => { const target = el(event.target) as any; if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return; if (target.id === "project-select") { setSelectedProject(target.value); state.selectionsDirty = false; await refreshConfiguration(); loadLiveRun(); render(); return; } if (target instanceof HTMLInputElement && target.hasAttribute("data-model-checkbox")) { changeModel(target.getAttribute("data-model-checkbox") || "", target.checked); return; } if (target instanceof HTMLSelectElement && target.hasAttribute("data-model-mode")) { changeModelMode(target.getAttribute("data-model-mode") || "", target.value); return; } if (target instanceof HTMLSelectElement && target.hasAttribute("data-selected-model-mode")) { changeModelMode(target.getAttribute("data-selected-model-mode") || "", target.value); return; } });
    document.addEventListener("change", (event) => { const target = el(event.target) as any; if (!(target instanceof HTMLSelectElement)) return; if (target.id === "model-provider-filter") { state.catalogProvider = target.value; render(); return; } if (target.id === "model-native-search-filter") { state.catalogNativeSearch = target.value; render(); return; } if (target.id === "model-catalog-sort") { state.catalogSort = target.value; render(); } });
    document.addEventListener("input", (event) => { const target = el(event.target) as any; if (target instanceof HTMLInputElement && target.id === "model-search") { state.query = target.value; refreshCatalogSearchResults(); return; } if (target instanceof HTMLInputElement && target.id === "prompt-search") { state.promptFilters.query = target.value; refreshPromptResults(); } });
    document.addEventListener("submit", (event) => { const target = el(event.target) as any; if (!(target instanceof HTMLFormElement)) return; if (target.id === "project-form") createDraft(event); if (target.id === "project-edit-form") saveProject(event); });
    refreshProjects().then(async () => { await refreshConfiguration(); loadLiveRun(); render(); }).catch((error) => { app.innerHTML = '<main class="workspace"><div class="warning-box">' + html(error instanceof Error ? error.message : String(error)) + '</div></main>'; });
    function recognitionRunStatusText(status: any) { return status === "queued" ? "Waiting to start" : status === "running" ? "Running" : status === "completed" ? "Completed" : status === "partial" ? "Partly complete" : "Execution failed"; }
    function recognitionModelStatusText(status: any) { return status === "queued" ? "Waiting to start" : status === "running" ? "Calling" : status === "response_saved" ? "Answer received" : status === "analysis_failed" ? "Local parse failed" : status === "completed" ? "Completed" : status === "unknown" ? "Model could not confirm" : status === "unsupported" ? "Model does not support it" : "Provider Call failed"; }
    function activeRecognitionRun() { return state.recognitionDetail && (((state.recognitionDetail as any).run.status as any) === "queued" || ((state.recognitionDetail as any).run.status as any) === "running") ? (state.recognitionDetail as any).run : null; }
    function recognitionDetailFor(modelRunId: any) { return state.recognitionModelDetails[modelRunId] || null; }
    function recognitionLink(url: any, label: string) { return '<a href="' + html(url) + '" target="_blank" rel="noreferrer">' + html(label) + '</a>'; }
    function recognitionUrlLabel(url: any) { try { const parsed = new URL(url); return parsed.hostname + parsed.pathname + parsed.search; } catch { return url; } }
    function recognitionEvidenceRows(archive: any) { const rows: any[] = []; const add = (id: any, evidence: any) => { if (evidence && typeof evidence.start === "number" && typeof evidence.end === "number") rows.push({ id, start:evidence.start, end:evidence.end }); }; add(archive.result.id + "-brand", archive.result.recognizedBrand.evidence); add(archive.result.id + "-business", archive.result.businessDescription.evidence); add(archive.result.id + "-detail", archive.result.detailedDescription?.evidence); add(archive.result.id + "-category", archive.result.productCategory.evidence); for (const competitor of archive.competitors) { add(competitor.id, competitor.evidence); add(competitor.id + "-business", competitor.businessDescription.evidence); add(competitor.id + "-category", competitor.productCategory.evidence); } for (const keyword of archive.brandKeywords) add(keyword.id, keyword.evidence); for (const keyword of archive.competitorKeywords) add(keyword.id, keyword.evidence); return rows; }
    function evidenceJump(id: string) { return '<button type="button" class="evidence-jump" data-evidence-target="' + html(id) + '">View evidence</button>'; }
    function evidenceValue(value: any, id: string) { return value ? html(value) + evidenceJump(id) : '<span class="state-flag">Unconfirmed</span>'; }
    function recognitionIssue(archive: any, field: string) { return (archive.result.fieldIssues || []).find((item: any) => item.field === field) || null; }
    function recognitionMissingText(archive: any, field: string, emptyText: any, missingText: any) { const issue = recognitionIssue(archive, field); return issue && issue.kind === "missing_field" ? '<span class="state-flag">' + html(missingText) + '</span>' : html(emptyText); }
    function highlightedRawAnswer(answer: AnswerRow, rows: any[]) { const sorted = rows.slice().sort((left, right) => left.start - right.start || left.end - right.end); const parts = []; let cursor = 0; for (const row of sorted) { if (row.start < cursor || row.end <= row.start || row.end > (answer as any).length) continue; parts.push(html((answer as any).slice(cursor, row.start))); parts.push('<mark id="' + html(row.id) + '">' + html((answer as any).slice(row.start, row.end)) + '</mark>'); cursor = row.end; } parts.push(html((answer as any).slice(cursor))); return parts.join(""); }
    function renderRecognitionEvidence(detail: any, modelRun: any) { const archive = detail.archive; const attempts = detail.attempts || []; const latest = attempts.length ? attempts[attempts.length - 1] : null; const providerCitations = archive && archive.providerCitations.length ? '<ul>' + archive.providerCitations.map((item: any) => '<li>' + recognitionLink(item.url, item.title || recognitionUrlLabel(item.url)) + '</li>').join("") + '</ul>' : '<p class="subtle">' + (modelRun.recognitionMode === "unaided_domain_recognition" ? "Provider-native web search was not used in this run." : "This model returned no provider citations in this run.") + '</p>'; const answerUrls = archive && archive.answerMentionedUrls.length ? '<ul>' + archive.answerMentionedUrls.map((item: any) => '<li>' + recognitionLink(item.url, recognitionUrlLabel(item.url)) + '</li>').join("") + '</ul>' : '<p class="subtle">The answer body has no URLs outside the confirmed citations.</p>'; const history = attempts.length ? attempts.map((item: any) => '<div class="attempt-row"><strong>Attempt ' + item.attemptNumber + ' · ' + html(recognitionModelStatusText(item.status)) + '</strong>' + (item.errorMessage ? '<span>' + html(item.errorMessage) + '</span>' : '') + '</div>').join("") : '<p class="subtle">No attempt records created yet.</p>'; const revisions = detail.analysisRevisions && detail.analysisRevisions.length ? '<ul>' + detail.analysisRevisions.map((revision: any, index: any) => '<li>Local parse version ' + (index + 1) + ' · ' + (revision.status === "complete" ? "Parsed" : revision.status === "partial" ? "Partly available" : "Parsing failed") + ' · No model was called</li>').join("") + '</ul>' : '<p class="subtle">No new local parse has been created yet.</p>'; const raw = latest && latest.rawAnswer ? '<pre class="raw-answer">' + highlightedRawAnswer(latest.rawAnswer, archive ? recognitionEvidenceRows(archive) : []) + '</pre>' : '<p class="subtle">This model has not returned a raw answer to show yet.</p>'; return '<details class="evidence-details"><summary>View raw answer and evidence</summary><div class="evidence-group"><h4>Provider Citation</h4>' + providerCitations + '</div><div class="evidence-group"><h4>Plain URLs in the answer</h4>' + answerUrls + '</div><div class="evidence-group"><h4>Raw answer</h4>' + raw + '</div><div class="evidence-group"><h4>Attempt records</h4>' + history + '</div><div class="evidence-group"><h4>Local parse version</h4>' + revisions + '</div></details>'; }
    function renderRecognitionSummary(detail: any) { const archive = detail.archive; if (!archive) return ''; const competitors = archive.competitors.length ? archive.competitors.map((item: any) => evidenceValue(item.name, item.id)).join(", ") : recognitionMissingText(archive, "competitors", "This answer listed no competitors", "This answer did not provide this field"); const keywords = archive.brandKeywords.length ? archive.brandKeywords.map((item: any) => evidenceValue(item.keyword, item.id)).join(", ") : recognitionMissingText(archive, "brandKeywords", "This answer listed no associated keywords", "This answer did not provide this field"); const competitorKeywords = archive.competitors.length ? archive.competitors.map((item: any) => { const values = archive.competitorKeywords.filter((keyword: any) => keyword.competitorRecognitionId === item.id).map((keyword: any) => evidenceValue(keyword.keyword, keyword.id)); return html(item.name) + ": " + (values.length ? values.join(", ") : "This answer did not provide this field"); }).join("; ") : recognitionMissingText(archive, "competitors", "This answer listed no competitors", "This answer did not provide this field"); const domainRecognition = archive.result.domainRecognition === null ? recognitionMissingText(archive, "domainRecognition", "This field does not match the required format", "This answer did not clearly return a recognition status") : archive.result.domainRecognition === "recognized" ? '<span class="state-ok">Model explicitly recognized it</span>' : archive.result.domainRecognition === "not_recognized" ? '<span class="state-bad">Model explicitly did not recognize it</span>' : '<span class="state-flag">Model said it could not confirm</span>'; const detailDescription = archive.result.detailedDescription?.value; const detailText = detailDescription ? evidenceValue(detailDescription, archive.result.id + "-detail") : '<span class="state-flag">This answer gave no detailed description</span>'; const issues = archive.result.fieldIssues && archive.result.fieldIssues.length ? '<details class="technical-details"><summary>Field parsing notes</summary><ul class="protocol-list">' + archive.result.fieldIssues.map((item: any) => '<li>' + html(item.field + " · " + item.kind + " · " + item.detail) + '</li>').join("") + '</ul></details>' : ""; return '<div class="recognition-summary"><div><span>Brand the model recognized in this run</span><strong>' + evidenceValue(archive.result.recognizedBrand.value, archive.result.id + "-brand") + '</strong></div><div><span>Recognition status</span><strong>' + domainRecognition + '</strong></div><div><span>Business description</span><strong>' + evidenceValue(archive.result.businessDescription.value, archive.result.id + "-business") + '</strong></div><div><span>Detailed description</span><strong>' + detailText + '</strong></div><div><span>Product category</span><strong>' + evidenceValue(archive.result.productCategory.value, archive.result.id + "-category") + '</strong></div><div><span>Recognized competitors</span><strong>' + competitors + '</strong></div><div><span>Associated keywords</span><strong>' + keywords + '</strong></div><div><span>Keywords per competitor</span><strong>' + competitorKeywords + '</strong></div></div>' + issues; }
    function recognitionRunCounts(detail: any) { const summary = { received:0, complete:0, partial:0, analysisFailed:0, requestLimited:0, running:0 }; for (const modelRun of detail.modelRuns) { const presentation = recognitionDetailFor(modelRun.id)?.presentation; if (!presentation) { if (modelRun.status === "queued" || modelRun.status === "running") summary.running += 1; continue; } if (presentation.requestExecution === "response_received") summary.received += 1; if (presentation.localAnalysis === "complete") summary.complete += 1; else if (presentation.localAnalysis === "partial") summary.partial += 1; else if (presentation.localAnalysis === "failed") summary.analysisFailed += 1; if (presentation.requestExecution === "request_rejected" || presentation.requestExecution === "transport_failed") summary.requestLimited += 1; if (presentation.requestExecution === "running" || presentation.requestExecution === "not_started") summary.running += 1; } return summary; }
    function recognitionCountLabels(summary: any) { return [["Answer received", summary.received], ["Fully parsed", summary.complete], ["Partly available", summary.partial], ["Parsing failed", summary.analysisFailed], ["Request throttled or failed", summary.requestLimited], ["Still running", summary.running]]; }
    function recognitionRunSummary(detail: any) { return recognitionCountLabels(recognitionRunCounts(detail)).map((entry) => entry[0] + " " + entry[1]).join(" · "); }
    function recognitionCountStrip(detail: any) { return '<div class="countstrip">' + recognitionCountLabels(recognitionRunCounts(detail)).map((entry) => '<span class="count' + (entry[1] ? "" : " is-zero") + '"><strong>' + entry[1] + '</strong>' + html(entry[0]) + '</span>').join("") + '</div>'; }
    function renderRecognitionModel(modelRun: any) { const detail = recognitionDetailFor(modelRun.id); const latest = detail && detail.attempts.length ? detail.attempts[detail.attempts.length - 1] : null; const presentation = detail ? detail.presentation : null; const mode = modelRun.recognitionMode === "native_web_domain_discovery" ? "Provider Native web findings" : "Offline domain recognition"; // Delivery, not recognition outcome. The report shows the other axis.
      const visibleStatus = "Answer: " + (presentation ? presentation.statusLabel : recognitionModelStatusText(modelRun.status)); const tagClass = presentation && presentation.localAnalysis === "complete" ? "ready" : presentation && (presentation.requestExecution === "response_received" || presentation.requestExecution === "running") ? "warning" : modelRun.status === "completed" || modelRun.status === "unknown" ? "ready" : "deleted"; const reanalyzeAction = presentation && presentation.primaryAction === "reanalyze_saved_answer" && latest ? button({ label: "Re-analyze existing answer", kind: "quiet", on: { "data-recognition-reanalyze": modelRun.id, "data-recognition-attempt": latest.id } }) : ''; const retryAction = presentation && presentation.primaryAction === "retry_request" ? button({ label: "Retry this model", kind: "quiet", on: { "data-recognition-retry": modelRun.id } }) : ''; const configurationAction = presentation && presentation.primaryAction === "check_model_configuration" ? button({ label: "Check model configuration", kind: "quiet", on: { "data-page": "models" } }) : ''; const settingsAction = presentation && presentation.primaryAction === "open_provider_settings" ? '<a class="card-action" href="https://openrouter.ai/settings/preferences" target="_blank" rel="noreferrer">Open OpenRouter settings</a>' : ''; const detailText = presentation && presentation.detail ? '<p class="subtle model-run-detail">' + html(presentation.detail) + '</p>' : ''; const technicalError = modelRun.errorMessage ? '<details class="technical-details"><summary>Technical details</summary><p>' + html(modelRun.errorMessage) + '</p></details>' : ''; return '<article class="model-run-card ' + html(modelRun.status) + '" data-testid="recognition-model-run"><div class="model-run-head"><div><h3>' + html(modelRun.modelSnapshot.displayName) + '</h3><p class="subtle">' + html(modelRun.modelSnapshot.modelId) + ' · ' + html(mode) + '</p></div><div class="inline-actions"><span class="tag ' + tagClass + '">' + html(visibleStatus) + '</span>' + reanalyzeAction + retryAction + configurationAction + settingsAction + '</div></div>' + detailText + (detail ? renderRecognitionSummary(detail) + renderRecognitionEvidence(detail, modelRun) : '<p class="subtle">Loading this model\'s archived result.</p>') + technicalError + '</article>'; }
    function renderRecognitionRun(run: any) { const selected = state.recognitionDetail && ((state.recognitionDetail as any).run.id as any) === run.id; const summary = selected ? recognitionRunSummary(state.recognitionDetail) : "Plan " + run.plannedModelRunCount + "  models · open this run to see execution status"; return '<article class="run-row"><div class="run-row-head"><div><h3>Recognition test · ' + html(formatTime(run.createdAt)) + '</h3><p class="subtle">config v' + html(run.baselineVersion) + ' · ' + html(summary) + '</p></div><span class="tag ' + (run.status === "completed" ? "ready" : run.status === "partial" ? "warning" : run.status === "failed" ? "deleted" : "warning") + '">' + html(recognitionRunStatusText(run.status)) + '</span></div><div class="inline-actions">' + (selected ? '<span class="subtle">Viewing</span>' : button({ label: "View this run", kind: "quiet", on: { "data-recognition-run": run.id } })) + '</div></article>'; }
    function renderRecognitionPage() { const selected = project(); if (!selected) return '<section class="view"><div class="empty"><div class="empty-copy"><h2>Select a project first</h2><p class="subtle">A domain recognition test belongs to a single project.</p></div></div></section>'; const active = activeRecognitionRun(); const canStart = Boolean((selected as any).activeBaselineId) && state.recognitionActionState !== "loading" && !active; const startLabel = state.recognitionActionState === "loading" ? "Creating test…" : active ? "Running" : "Start recognition test"; const current = state.recognitionDetail; const currentRows = current ? '<section class="section-card"><div class="section-head"><div><h2>This run</h2><p class="subtle">Each model is called and archived independently. A model\'s description reflects only its own answer in this run.</p>' + recognitionCountStrip(current) + '</div><span class="tag">' + html(recognitionRunStatusText(((current as any).run.status as any))) + '</span></div><div class="model-run-list">' + ((current as any).modelRuns.map(renderRecognitionModel) as any).join("") + '</div></section>' : '<section class="section-card"><p class="subtle">No recognition test records yet. Save a configuration to start one.</p></section>'; const history = state.recognitionRuns.length ? '<section class="section-card"><div class="section-head"><div><h2>Run records</h2><p class="subtle">Every record keeps its own model execution and evidence.</p></div></div><div class="run-list">' + state.recognitionRuns.map(renderRecognitionRun).join("") + '</div></section>' : ''; const unavailable = !(selected as any).activeBaselineId ? '<div class="warning-box">Save your models as a configuration first, on Choose models.</div>' : ''; return '<section class="view"><div class="heading"><div><h1>Results</h1><p class="subtle">Each model receives only the domain, language, monitoring protocol and its own web search mode. Offline and native-web results are recorded separately.</p></div>' + button({ label: startLabel, kind: "primary", disabled: !canStart, id: "start-recognition", testId: "start-recognition", on: { "data-action-state": state.recognitionActionState } }) + '</div>' + resultsSwitch("recognition") + '<div id="recognition-status" class="form-status ' + html(state.recognitionNotice.kind) + '" aria-live="polite">' + html(state.recognitionNotice.text) + '</div><div class="section-stack">' + unavailable + currentRows + history + '</div></section>'; }
    async function refreshRecognition() { const selected = project(); if (!selected) { state.recognitionRuns = []; state.recognitionDetail = null; state.recognitionModelDetails = {}; return; } const projectId = selected.id; const listed = await request("/api/projects/" + encodeURIComponent(projectId) + "/recognition-runs"); if (projectId !== state.selectedId) return; state.recognitionRuns = listed.runs || []; const runId = state.recognitionSelectedRunId || (state.recognitionRuns[0] ? state.recognitionRuns[0].id : ""); if (!runId) { state.recognitionDetail = null; state.recognitionModelDetails = {}; if (state.page === "recognition") render(); return; } const detail = await request("/api/projects/" + encodeURIComponent(projectId) + "/recognition-runs/" + encodeURIComponent(runId)); if (projectId !== state.selectedId) return; state.recognitionSelectedRunId = (detail as any).run.id; state.recognitionDetail = detail; const pairs = await Promise.all(detail.modelRuns.map(async (modelRun: any) => { try { return [modelRun.id, await request("/api/projects/" + encodeURIComponent(projectId) + "/recognition-runs/" + encodeURIComponent((detail as any).run.id) + "/model-runs/" + encodeURIComponent(modelRun.id))]; } catch { return [modelRun.id, null]; } })); state.recognitionModelDetails = {}; for (const pair of pairs) { if (pair[1]) state.recognitionModelDetails[pair[0]] = pair[1]; } if (state.page === "recognition") render(); if ((detail as any).run.status === "queued" || (detail as any).run.status === "running") { window.clearTimeout(state.recognitionRefreshTimer); state.recognitionRefreshTimer = window.setTimeout(() => { if (state.page === "recognition") refreshRecognition().catch(() => {}); }, 1000); } }
    async function startRecognition() { const selected = project(); if (!selected || activeRecognitionRun() || state.recognitionActionState === "loading") return; const idempotencyKey = crypto.randomUUID(); state.recognitionActionState = "loading"; state.recognitionNotice = { text:"Creating a separate execution record for each model…", kind:"loading" }; render(); try { const response = await request("/api/projects/" + encodeURIComponent(selected.id) + "/recognition-runs", { method:"POST", headers:{ "Idempotency-Key":idempotencyKey } }); state.recognitionSelectedRunId = response.run.id; state.recognitionActionState = "success"; state.recognitionNotice = { text:"Recognition test started. Waiting for models to respond.", kind:"success" }; await refreshRecognition(); window.setTimeout(() => { state.recognitionActionState = "idle"; if (state.page === "recognition") render(); }, 850); } catch (error) { state.recognitionActionState = "error"; state.recognitionNotice = { text: error instanceof Error ? error.message : (expectedErrorText.request_failed || "The request failed."), kind: "error" }; render(); } }
    async function retryRecognition(modelRunId: any, button: HTMLElement | null) { const selected = project(); const detail = state.recognitionDetail; if (!selected || !detail) return; try { await runAction(button, { loading:"Retrying…", success:"Started", error:"Retry failed" }, () => request("/api/projects/" + encodeURIComponent(selected.id) + "/recognition-runs/" + encodeURIComponent(((detail as any).run.id as any)) + "/model-runs/" + encodeURIComponent(modelRunId) + "/retry", { method:"POST" })); state.recognitionNotice = { text:"A new execution attempt was created for this model.", kind:"success" }; await refreshRecognition(); } catch (error) { state.recognitionNotice = { text: error instanceof Error ? error.message : (expectedErrorText.request_failed || "The request failed."), kind: "error" }; render(); } }
    async function reanalyzeRecognition(modelRunId: any, attemptId: any, button: HTMLElement | null) { const selected = project(); const detail = state.recognitionDetail; if (!selected || !detail || !attemptId) return; try { await runAction(button, { loading:"Parsing the saved answer…", success:"Local parse complete", error:"Parsing failed" }, () => request("/api/projects/" + encodeURIComponent(selected.id) + "/recognition-runs/" + encodeURIComponent(((detail as any).run.id as any)) + "/model-runs/" + encodeURIComponent(modelRunId) + "/attempts/" + encodeURIComponent(attemptId) + "/reanalyze", { method:"POST" })); state.recognitionNotice = { text:"A new local parse was generated from the saved raw answer. No model was called.", kind:"success" }; await refreshRecognition(); } catch (error) { state.recognitionNotice = { text: error instanceof Error ? error.message : (expectedErrorText.request_failed || "The request failed."), kind: "error" }; render(); } }
    const phase2Render = phase2RenderImpl;
    renderOverride = function renderWithRecognition() { if (window.__citegeoPhase5Active) return; if (state.page === "reports" && window.__citegeoPhase4 && typeof window.__citegeoPhase4.render === "function") return window.__citegeoPhase4.render(); if (state.page !== "recognition") return phase2Render(); const selected = project(); const options = state.currentProjects.length ? state.currentProjects.map((item) => '<option value="' + html(item.id) + '">' + html(item.name) + ' · ' + html(item.normalizedDomain) + '</option>').join("") : '<option value="">No projects yet</option>'; app.innerHTML = renderEvidence() + '<div class="shell">' + navScrim() + '<aside class="sidebar"><button type="button" class="brand" data-page="dashboard" aria-label="Back to the dashboard">' + brandLockup + '</button><div class="project-label">Project</div><select id="project-select" class="project-select" aria-label="Switch project" data-testid="project-select">' + options + '</select><nav class="nav" aria-label="Project navigation"><button type="button" class="nav-item" data-page="dashboard"><span>Dashboard</span></button><div class="nav-label">Run a test</div><button type="button" class="nav-item" data-page="models"><span class="nav-step">1</span><span>Choose models</span></button><button type="button" class="nav-item" data-page="recognition"><span class="nav-step">2</span><span>Results</span></button><button type="button" class="nav-item" data-page="visibility"><span class="nav-step">3</span><span>Visibility</span></button><div class="nav-label">Answer engine</div><button type="button" class="nav-item" data-page="answer-engine"><span>Scores</span></button><button type="button" class="nav-item" data-page="brand-visibility"><span>Brand visibility</span></button><button type="button" class="nav-item" data-page="prompts"><span>Prompts</span></button><div class="nav-label">Over time</div><a class="nav-item" href="?view=measurements"><span>Continuous measurement</span></a><div class="nav-label">Machine</div><button type="button" class="nav-item" data-page="overview"><span>Projects</span></button><button type="button" class="nav-item" data-page="configuration"><span>Configuration history</span></button><button type="button" class="nav-item" data-page="setup"><span>Setup</span></button></nav><div class="sidebar-bottom">Domain recognition</div></aside><main class="workspace"><header class="topbar"><div class="topbar-lead">' + navToggle() + '<div class="crumb"><button type="button" class="crumb-home" data-page="dashboard">' + html(CONFIG.productName) + '</button> / ' + html(selected ? selected.name : "Project") + '</div></div><div class="topbar-actions"><button type="button" class="theme-toggle" data-theme-toggle aria-label="Switch between light and dark">&#9681;</button>' + button({ label: "New project", kind: "primary", id: "new-project", testId: "new-project" }) + '</div></header><section class="content">' + renderRecognitionPage() + '</section>' + renderFooter() + '</main></div>'; const select = element("project-select"); if (select) select.value = state.selectedId; document.title = selected ? selected.name + " | " + CONFIG.productTitle + "" : "" + CONFIG.productTitle + ""; };
    document.addEventListener("click", async (event) => { const target = el(event.target) as any; if (!(target instanceof Element)) return; if (target.id === "start-recognition") { await startRecognition(); return; } const evidenceButton = target.closest("[data-evidence-target]"); if (evidenceButton) { const card = evidenceButton.closest("[data-testid=recognition-model-run]"); const details = card ? card.querySelector("details.evidence-details") : null; if (details) (details as any).open = true; const evidenceTarget = evidenceButton.getAttribute("data-evidence-target"); window.setTimeout(() => { const marked = evidenceTarget ? element(evidenceTarget) : null; if (marked) marked.scrollIntoView({ block:"center", behavior:"smooth" }); }, 0); return; } const runButton = target.closest("[data-recognition-run]"); if (runButton) { state.recognitionSelectedRunId = runButton.getAttribute("data-recognition-run") || ""; await refreshRecognition(); return; } const reanalyzeButton = target.closest("[data-recognition-reanalyze]"); if (reanalyzeButton) { await reanalyzeRecognition(reanalyzeButton.getAttribute("data-recognition-reanalyze") || "", reanalyzeButton.getAttribute("data-recognition-attempt") || "", (reanalyzeButton as any)); return; } const retryButton = target.closest("[data-recognition-retry]"); if (retryButton) { await retryRecognition(retryButton.getAttribute("data-recognition-retry") || "", (retryButton as any)); return; } const pageButton = target.closest("[data-page]"); if (pageButton && pageButton.getAttribute("data-page") === "recognition") { window.setTimeout(() => refreshRecognition().catch((error) => { state.recognitionNotice = { text: error instanceof Error ? error.message : (expectedErrorText.request_failed || "The request failed."), kind: "error" }; render(); }), 0); } if (pageButton && pageButton.getAttribute("data-page") !== "recognition") window.clearTimeout(state.recognitionRefreshTimer); });
    document.addEventListener("change", (event) => { const target = el(event.target) as any; if (target instanceof HTMLSelectElement && target.id === "project-select") { state.recognitionSelectedRunId = ""; window.setTimeout(() => { if (state.page === "recognition") refreshRecognition().catch(() => {}); }, 0); } });
    wireNav();
    // The grid is replaced on every render, so the drag is delegated once and
    // a drop re-renders from the order it just saved.
    wirePanelDrag(() => render());
    wireChartHover();
    (window as any).__citegeoPhase2 = { state, app, html, element, project, formatTime, brandMark, brandLockup, request, refreshRecognition, phase2Render, render: () => render() };
}

// The shell renders the mount point and the configuration, then this runs.
boot();
