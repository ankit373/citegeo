import { renderMotionRuntime } from "./motion-runtime.js";

export function renderWorkbenchScript(): string {
  return String.raw`
  <script>
    const state = { providers: [], modelCatalogs: [], modelCatalogError: "", latestResult: null, latestRuns: null, auditPlan: null };
    Object.assign(state, {
      projects: [],
      currentProjectId: "",
      project: null,
      dashboard: null,
      baselines: [],
      tasks: [],
      runs: [],
      observations: [],
      workbench: null,
      view: "overview",
      period: "all",
      model: "all",
      searchUsed: "all",
      trendMode: "metrics",
      comparisonMetric: "brand_discovery",
      visibleMetrics: new Set(["brand_discovery", "candidate_inclusion", "explicit_recommendation"]),
      wizardStep: 1,
      wizardReview: false,
      promptFilter: "all",
      detailObservationIds: [],
      planSemanticsDirty: false,
      viewScrollPositions: {},
      schedulePreviewRequest: 0
    });

    const $ = (id) => document.getElementById(id);
    const translations = {
      en: {
        project: "Project",
        noProjects: "No monitoring projects yet",
        newProject: "New project",
        importRuns: "Import saved runs",
        overview: "Overview",
        prompts: "Questions",
        visibility: "Visibility",
        competitorsNav: "Competitors",
        citations: "Citations",
        monitoring: "Monitoring",
        runRecords: "Run records",
        providersNav: "Providers",
        settings: "Settings",
        languageSwitch: "Language",
        serverOnline: "Online",
        serverError: "Server error",
        workspaceSubtitle: "Evidence from real provider observations",
        allModels: "All models",
        allSearch: "All search modes",
        apiRegion: "Region unavailable for API data",
        last24Hours: "24 hours",
        last7Days: "7 days",
        last30Days: "30 days",
        allTime: "All time",
        whatChanged: "What happened",
        whatChangedHelp: "Changes only appear after two fully comparable runs.",
        noComparableChanges: "A second comparable run is required before changes can be calculated.",
        brandAppearedNew: "The brand started appearing in {count} new questions.",
        brandDisappeared: "The brand disappeared from {count} questions.",
        newCitations: "AI cited {count} new sources.",
        newCompetitors: "{count} newly observed competitors or related entities appeared.",
        brandDiscovery: "Discovered in unbranded questions",
        brandDiscoveryBasis: "Only unbranded discovery observations are included.",
        candidateEntry: "Candidate list",
        candidateEntryBasis: "Only questions classified before the run as candidate decisions are included.",
        explicitRecommendation: "Explicitly recommended",
        explicitRecommendationBasis: "Only questions classified before the run as recommendation decisions are included.",
        officialCitation: "Official source cited",
        officialCitationBasis: "Only successful observations where native search was requested are included.",
        validObservations: "valid observations",
        latestRun: "Latest run",
        openEvidence: "View evidence",
        visibilityTrend: "Visibility over time",
        visibilityTrendHelp: "Only complete observations under the same baseline are connected.",
        brandAppearsLegend: "Brand appears",
        recommendationLegend: "Recommended",
        citationLegend: "Official citation",
        competitorRanking: "Observed competitors",
        competitorRankingHelp: "Confirmed entities only; counts are answer coverage, not market share.",
        noTrend: "No comparable trend is available yet.",
        noConfirmedCompetitors: "No competitor has enough entity evidence to be confirmed.",
        pendingEntities: "Entities awaiting confirmation",
        whyCompetitor: "Why it competes",
        observations: "Observations",
        recommendations: "Recommendations",
        sourcesCount: "Sources",
        promptAsset: "Monitoring questions",
        promptAssetHelp: "Questions belong to a baseline and are compared only under identical conditions.",
        question: "Question",
        result: "Brand result",
        modelCoverage: "Model coverage",
        change: "Change",
        mentioned: "Appeared",
        candidate: "Candidate",
        recommended: "Recommended",
        absent: "Not present",
        sourceLandscape: "Citation sources",
        sourceLandscapeHelp: "Only links returned by the provider or present in the answer are counted.",
        officialDomainCoverageTitle: "Official domain coverage",
        citedPageBreakdown: "Cited page breakdown",
        source: "Source",
        type: "Type",
        questionCoverage: "Question coverage",
        providerModels: "Provider models",
        targetSource: "Owned website",
        competitorSource: "Competitor website",
        thirdPartySource: "Third party",
        unknownSource: "Unclassified",
        baselines: "Baselines",
        schedule: "Schedule",
        nextRun: "Next run",
        runNow: "Run now",
        createSchedule: "Create schedule",
        manual: "Run once",
        daily: "Daily",
        weekly: "Weekly",
        cron: "Custom Cron",
        timezone: "Timezone",
        scheduleSaved: "Monitoring schedule created.",
        time: "Time",
        baseline: "Baseline",
        planned: "Planned",
        successful: "Successful",
        failed: "Failed",
        search: "Search",
        status: "Status",
        openSnapshot: "Open snapshot",
        completed: "Completed",
        partial: "Partial",
        running: "Running",
        providerCatalog: "Provider catalog",
        providerCatalogHelp: "Keys remain provider-specific. OpenRouter can route supported models through one configured key.",
        configured: "Configured",
        missing: "Missing key",
        nativeSearch: "Native web search",
        noNativeSearch: "No native web search",
        searchModels: "Search models",
        searchModelsPlaceholder: "Enter a model name or ID",
        modelCount: "{count} models",
        nativeSearchModelCount: "{count} support native web search",
        showAllModels: "Show every model and its search capability",
        modelCatalogUnavailable: "Model capability catalog is unavailable",
        selectedModelSearchUnsupported: "At least one selected model does not support native web search.",
        projectSettings: "Project settings",
        projectSettingsHelp: "Current stored project identity and comparison scope.",
        aliases: "Aliases",
        language: "Language",
        projectStatus: "Project status",
        dataBoundary: "Data source",
        dataBoundaryBody: "This workspace shows provider API observations. It does not label them as consumer web or regional results.",
        wizardTitle: "Create monitoring project",
        wizardSubtitle: "Review every question before any real provider request runs.",
        close: "Close",
        back: "Back",
        next: "Next",
        identifyAndReview: "Identify and review questions",
        stepDomain: "Domain",
        stepIdentity: "Brand",
        stepQuestions: "Questions",
        stepModels: "Models",
        stepSchedule: "Schedule",
        domainUrl: "Domain or URL",
        domainHelp: "The site is used to identify the brand and generate questions. It is not counted as AI visibility evidence.",
        githubRepo: "GitHub repository",
        githubRepoHelp: "Optional. README and topics can inform the question set.",
        competitorsInput: "Competitor domains",
        competitorsHelp: "Optional. One per line. Auto-discovery can propose more for review.",
        keywords: "Keywords",
        keywordsHelp: "Optional. Your keywords are prioritized when generating monitoring questions.",
        promptCount: "Question count",
        promptCountHelp: "The generated questions remain editable before running.",
        keywordMode: "Keyword mode",
        sitePlusUser: "Site + user keywords",
        userOnlyKeywords: "User keywords only",
        siteOnlyKeywords: "Site keywords only",
        keywordLimit: "Keyword limit",
        promptsPerKeyword: "Questions per keyword",
        discovery: "Discovery",
        autoDiscover: "Discover brand, entities and questions",
        domainOnly: "Use submitted inputs only",
        provider: "Provider",
        models: "Models",
        maxTokens: "Max answer tokens",
        repeatCount: "Runs per question",
        repeatCountHelp: "Each repeat is stored as an independent observation to reduce reliance on a single random answer.",
        webSearch: "Web search",
        webSearchOff: "Off",
        webSearchOn: "On",
        searchMode: "Search mode",
        searchModeAuto: "Automatic native capability",
        searchModeNative: "Provider native only",
        requestEstimate: "Estimated requests",
        perRun: "per run",
        perMonth: "about {count} per month",
        auditLanguage: "UI and answer language",
        confirmQuestions: "Confirm questions",
        auditTarget: "Audit target",
        brand: "Brand",
        officialSite: "Official site",
        identifiedCompetitors: "Identified competitors",
        addCompetitor: "Add competitor",
        competitorDomain: "Competitor domain",
        brandAwarenessQuestions: "Brand awareness questions",
        brandAwarenessHelp: "Tests whether AI recognizes the named brand.",
        organicDiscoveryQuestions: "Unbranded discovery questions",
        organicDiscoveryHelp: "Tests whether AI finds the brand without being given its name.",
        comparisonQuestions: "Comparison questions",
        comparisonHelp: "Tests explicit comparisons and alternatives.",
        otherQuestions: "Other questions",
        enabled: "Enabled",
        delete: "Delete",
        addPrompt: "Add question",
        newPromptPlaceholder: "Type a monitoring question",
        plannedRunSummary: "Run summary",
        enabledPrompts: "Enabled questions",
        disabledPrompts: "Disabled questions",
        providerRuns: "Provider requests",
        promptSet: "Prompt set",
        analysisRules: "Analysis rules",
        confirmAndRun: "Confirm and run real audit",
        noCompetitors: "No competitors configured.",
        yes: "Yes",
        no: "No",
        brandAwareness: "Brand awareness",
        organicDiscovery: "Organic discovery",
        comparison: "Comparison",
        other: "Other",
        identifyingQuestions: "Identifying the brand and generating questions...",
        planReady: "Questions ready for review",
        analyzeQuestionChanges: "Analyze question changes",
        analyzingQuestionChanges: "Analyzing edited questions with the selected provider...",
        questionChangesReady: "Edited questions were classified by the provider. Review them before running.",
        pendingQuestionAnalysis: "Edited question text must be analyzed by the selected provider before it can run.",
        runningProviderCalls: "Running real provider requests",
        runFinished: "Run completed and added to the project.",
        auditFailed: "Audit failed",
        loading: "Loading",
        noAnswer: "No usable answer returned.",
        actualAnswer: "Actual AI answer",
        citedLinks: "Cited links",
        noCitations: "No citations returned.",
        searchNotUsed: "Not connected",
        searchNative: "Provider native",
        sourceLabel: "Source",
        model: "Model",
        runConditions: "Run conditions"
        ,attentionEmpty: "No comparable change is available yet. Complete another full run under the same baseline.",
        runIncomplete: "The latest run did not complete.",
        runIncompleteDetail: "{completed} / {planned} observations succeeded · {failed} failed · excluded from metrics and trends",
        currentDataFrom: "Current metrics use the latest complete run from {date}",
        noCompleteRun: "No complete run is available yet.",
        currentValidData: "Current valid data",
        viewFailures: "View failures",
        rerunBaseline: "Run full baseline again",
        compareUnavailable: "The current run cannot be compared with the previous run.",
        firstObservation: "The first baseline observation is complete. A later monitoring cycle is required before a trend exists.",
        sameDayOnly: "Multiple runs exist on the same day. Use the 24-hour view for intraday results; they are not a long-term trend.",
        partialRunTrend: "An incomplete run was excluded from the trend.",
        metricTrend: "Metric trend",
        brandComparison: "Brand comparison",
        comparisonMetricHelp: "Choose one metric to compare the target with AI-confirmed competitors.",
        latestCompleteRunOnly: "Latest complete run under the selected baseline",
        setMonitoring: "Set monitoring",
        monitoringTasks: "Monitoring tasks",
        noMonitoringTasks: "No scheduled monitoring yet",
        noMonitoringTasksBody: "Create a task to check questions, competitors, and citations on a repeatable baseline.",
        createMonitoring: "Create monitoring",
        taskName: "Task name",
        monitoringContent: "Monitoring content",
        selectQuestions: "Questions included in this task",
        selectModels: "Models included in this task",
        taskSearchHelp: "Search settings are part of the baseline and changing them starts a new comparable series.",
        monthly: "Monthly",
        customSchedule: "Custom",
        dayOfWeek: "Day of week",
        dayOfMonth: "Day of month",
        pause: "Pause",
        resume: "Resume",
        duplicate: "Duplicate",
        edit: "Edit",
        requestsPerRun: "requests per run",
        estimatedMonthly: "estimated monthly",
        nextOccurrences: "Next three runs",
        notificationConditions: "Notify when",
        notificationChannels: "Notification channels",
        brandMissingCondition: "Brand disappears from an answer",
        competitorCondition: "A new competitor appears",
        citationCondition: "The official site receives a new citation",
        recommendationCondition: "Recommendation changes",
        completeCondition: "Every run completes",
        failureCondition: "A run fails",
        noDeliveryConfigured: "No delivery channel configured. Events will remain visible in the workspace.",
        recentAlerts: "Recent monitoring events",
        noRecentAlerts: "No monitoring event has been recorded in this time range.",
        notificationTarget: "Destination",
        baselineEditRule: "Changing questions, models, search, language, or competitor scope requires a new baseline. This task only edits schedule and notifications.",
        viewResults: "View results",
        monitoringPeriods: "monitoring periods",
        active: "Active",
        saveTask: "Save task",
        deleteTask: "Delete task",
        confirmDeleteTask: "Delete this monitoring task? Historical runs will remain.",
        confirmedCompetitors: "Confirmed competitors",
        suspectedBrands: "Suspected brands",
        alternativeMethods: "Alternative methods",
        promotionChannels: "Promotion channels",
        unresolvedEntities: "Unresolved entities",
        comparisonScope: "Scope",
        scopedRuns: "runs",
        scopedAnswers: "valid answers",
        targetAbsentAnswers: "target absent",
        replacementFocus: "Who is replacing you",
        evidenceCount: "Evidence",
        currentResult: "Current result",
        baselineChanged: "The monitoring baseline changed. Results on either side are not connected.",
        metricNoSample: "No eligible observations",
        analysisIncomplete: "Provider execution finished, but current analysis is incomplete",
        analysisIncompleteDetail: "{completed} / {answered} answered observations passed the current analysis contract.",
        analysisHistorical: "This run uses an older analysis schema and is excluded from current metrics and trends.",
        reanalyzeAnswers: "Reanalyze saved answers",
        analysisRunning: "Reanalyzing saved answers...",
        classifyBaselineIntents: "Fix question intent and create a new baseline",
        classifyingBaselineIntents: "Classifying question intent...",
        pendingEntitySummary: "No confirmed competitor · {count} related entities await confirmation",
        officialDomainCoverage: "answers cited this official domain",
        sourcePageBreakdown: "Top cited pages; one answer may cite more than one page.",
        showMetric: "Show metric",
        dataSourceShort: "Provider API",
        trendTitle: "Changes in AI answers about your brand",
        trendPurpose: "Each point is one complete run. Lines connect results under the same baseline to show whether AI answers more often discover, consider, recommend, and cite your brand under identical questions, models, and search settings. Select a point to inspect the source answers.",
        sameBaseline: "Same baseline",
        nativeSearchConfigured: "Native search configured",
        mixedSearchConfigured: "Mixed search configuration",
        searchDisabled: "Search disabled",
        metricMeaning: "What this line proves",
        discoveryProof: "Whether AI thinks of your brand when the user does not name it.",
        discoveryFormula: "Unbranded answers that mention the brand / all unbranded discovery answers",
        discoveryDirection: "Up means more answers discovered the brand; down means it disappeared from more answers.",
        discoveryLegend: "AI thought of your brand",
        discoverySubject: "Answers where AI thought of {brand}",
        candidateProof: "Whether AI includes your brand among options the user could consider.",
        candidateFormula: "Answers listing the brand as an option / candidate-decision answers",
        candidateDirection: "Up means more answers included the brand as an option; down means fewer did.",
        candidateLegend: "Listed as an option",
        candidateSubject: "Answers listing {brand} as an option",
        recommendationProof: "Whether AI explicitly suggests considering or choosing your brand.",
        recommendationFormula: "Answers explicitly recommending the brand / recommendation-decision answers",
        recommendationDirection: "Up means more explicit recommendations; down means fewer.",
        recommendationLegend: "Explicitly recommended",
        recommendationSubject: "Answers explicitly recommending {brand}",
        citationProof: "Whether an answer requested with web search uses your official site as a source.",
        citationFormula: "Answers citing the official domain / successful answers with native search requested",
        citationDirection: "Up means more answers cited the official domain; down means fewer.",
        citationLegend: "Official site became a source",
        citationSubject: "Answers citing {domain}",
        changesProve: "What these runs prove",
        cannotProve: "What this chart cannot prove",
        cannotProveLongTerm: "A long-term trend from a small number of monitoring periods",
        cannotProveShare: "A change in market share",
        cannotProveConsumer: "The same result in consumer AI web products",
        cannotProveCause: "That an optimization caused the observed change",
        proofIncreased: "{subject} increased from {from} to {to} answers.",
        proofDecreased: "{subject} decreased from {from} to {to} answers.",
        proofUnchanged: "{subject} remained at {to} answers.",
        trendPointReason: "Why did this result change from {from} to {to}?",
        newlyMatched: "New in this run",
        persistentlyMatched: "Present in both runs",
        removedMatched: "No longer present in this run",
        previousAnswer: "Previous answer",
        currentAnswer: "Current answer",
        netChangePositive: "Net change: {added} added - {removed} removed = {net} more",
        netChangeNegative: "Net change: {added} added - {removed} removed = {net} fewer",
        netChangeZero: "Net change: {added} added - {removed} removed = no net change",
        noEvidenceRows: "No answers in this group.",
        firstPointEvidence: "This is the first comparable point. Open the matching answers that make up the result.",
        matchingAnswers: "Answers matching this metric",
        preparingAudit: "Preparing questions",
        callingProviders: "Calling AI providers",
        buildingResult: "Building evidence",
        savingResult: "Saving results",
        creatingRun: "Creating run...",
        runStarted: "Run completed",
        retryAction: "Failed · Retry",
        observationsCompleted: "observations finished",
        failedCount: "{count} failed",
        saving: "Saving...",
        saved: "Saved",
        deleting: "Deleting...",
        deleted: "Deleted"
      }
    };

    function t(key, values) {
      let value = translations.en[key] || key;
      if (!values) return value;
      Object.keys(values).forEach((name) => { value = value.replaceAll("{" + name + "}", String(values[name])); });
      return value;
    }
    function html(value) {
      return String(value == null ? "" : value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }
    function splitInput(value) {
      let normalized = String(value || "");
      [",", "，", ";", "；", "|"].forEach((separator) => { normalized = normalized.replaceAll(separator, "\n"); });
      return normalized.split("\n").map((item) => item.trim()).filter(Boolean);
    }
    function safeSlug(value) {
      let output = "";
      for (const char of String(value || "").toLowerCase()) {
        const code = char.charCodeAt(0);
        const allowed = (code >= 97 && code <= 122) || (code >= 48 && code <= 57);
        if (allowed) output += char;
        else if (output && !output.endsWith("-")) output += "-";
      }
      while (output.endsWith("-")) output = output.slice(0, -1);
      return output || "entity";
    }
    function formatDate(value) {
      if (!value) return "—";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
    }
    function formatFraction(metric) {
      if (!metric) return { numerator: 0, denominator: 0 };
      return { numerator: Number(metric.numerator || 0), denominator: Number(metric.denominator || 0) };
    }
    function domainFromInput(value) {
      const raw = String(value || "").trim();
      if (!raw) return "";
      try {
        const parsed = new URL(raw.includes("://") ? raw : "https://" + raw);
        const host = parsed.hostname.toLowerCase();
        return host.startsWith("www.") ? host.slice(4) : host;
      } catch {
        const slash = raw.indexOf("/");
        const host = (slash >= 0 ? raw.slice(0, slash) : raw).toLowerCase();
        return host.startsWith("www.") ? host.slice(4) : host;
      }
    }
    function nameFromDomain(domain) {
      const name = String(domain || "").split(".")[0] || "";
      return name ? name.charAt(0).toUpperCase() + name.slice(1) : domain;
    }
    function modelLabel(value) {
      const parts = String(value || "").split("/");
      return parts[parts.length - 1] || value;
    }
    function statusLabel(value) {
      if (value === "completed") return t("completed");
      if (value === "partial") return t("partial");
      if (value === "running") return t("running");
      return t("failed");
    }
    function statusClass(value) {
      if (value === "completed") return "ok";
      if (value === "partial") return "warn";
      if (value === "running") return "info";
      return "error";
    }
    async function requestJson(url, options) {
      const response = await fetch(url, options);
      if (response.status === 204) return {};
      const text = await response.text();
      let body = {};
      if (text) body = JSON.parse(text);
      if (!response.ok) throw new Error(body.error || "Request failed: " + response.status);
      return body;
    }

    ${renderMotionRuntime()}

    function applyLocale() {
      document.documentElement.lang = "en";
      document.querySelectorAll("[data-i18n]").forEach((node) => {
        const key = node.getAttribute("data-i18n");
        if (key) node.textContent = t(key);
      });
      document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
        const key = node.getAttribute("data-i18n-placeholder");
        if (key) node.setAttribute("placeholder", t(key));
      });
      renderProviders();
      renderProjectSelector();
      renderCurrentView();
      updateWizard();
      if (state.auditPlan) renderPlan(state.auditPlan, false);
    }

    function showView(view) {
      if (state.view === view) return;
      motion.rememberScroll(state.view);
      state.view = view;
      document.querySelectorAll(".view").forEach((node) => node.classList.toggle("active", node.getAttribute("data-view-panel") === view));
      document.querySelectorAll(".nav-button").forEach((node) => node.classList.toggle("active", node.getAttribute("data-view") === view));
      renderCurrentView();
      const activeView = document.querySelector('.view.active');
      motion.enterView(activeView);
      motion.restoreScroll(view);
    }
    function renderCurrentView() {
      renderPageHeading();
      if (state.view === "overview") renderOverview();
      if (state.view === "prompts") renderPrompts();
      if (state.view === "visibility") renderVisibility();
      if (state.view === "competitors") renderCompetitorsView();
      if (state.view === "citations") renderCitations();
      if (state.view === "monitoring") renderMonitoring();
      if (state.view === "runs") renderRuns();
      if (state.view === "providers") renderProviders();
      if (state.view === "settings") renderSettings();
      motion.finishDataRefresh();
    }
    function renderPageHeading() {
      const titles = {
        overview: t("overview"), prompts: t("prompts"), visibility: t("visibility"), competitors: t("competitorsNav"),
        citations: t("citations"), monitoring: t("monitoring"), runs: t("runRecords"), providers: t("providersNav"), settings: t("settings")
      };
      $("page-title").textContent = titles[state.view] || t("overview");
      $("breadcrumb-project").textContent = state.project ? state.project.name : t("project");
    }

    function renderProjectSelector() {
      const selector = $("project-select");
      if (!state.projects.length) {
        selector.innerHTML = '<option value="">' + html(t("noProjects")) + '</option>';
        selector.disabled = true;
        return;
      }
      selector.disabled = false;
      selector.innerHTML = state.projects.map((row) => '<option value="' + html(row.project.id) + '">' + html(row.project.name) + ' · ' + html(row.project.domain) + '</option>').join("");
      selector.value = state.currentProjectId;
    }
    async function loadProjects(preferredProjectId) {
      state.projects = await requestJson("/projects");
      const available = new Set(state.projects.map((row) => row.project.id));
      const selected = preferredProjectId && available.has(preferredProjectId)
        ? preferredProjectId
        : available.has(state.currentProjectId) ? state.currentProjectId : state.projects[0] && state.projects[0].project.id;
      renderProjectSelector();
      if (selected) await selectProject(selected);
      else clearProject();
    }
    function clearProject() {
      state.currentProjectId = "";
      state.project = null;
      state.dashboard = null;
      state.baselines = [];
      state.tasks = [];
      state.runs = [];
      state.observations = [];
      state.workbench = null;
      renderProjectSelector();
      renderCurrentView();
    }
    async function selectProject(projectId) {
      if (!projectId) return clearProject();
      motion.beginChartUpdate();
      state.currentProjectId = projectId;
      const prefix = "/projects/" + encodeURIComponent(projectId);
      const range = state.period === "1d" ? "24h" : state.period;
      const query = new URLSearchParams({ range, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" });
      if (state.model !== "all") query.set("model", state.model);
      if (state.searchUsed !== "all") query.set("searchUsed", state.searchUsed);
      const values = await Promise.all([
        requestJson(prefix + "/workbench?" + query.toString()), requestJson(prefix + "/baselines"), requestJson(prefix + "/observations")
      ]);
      state.workbench = values[0];
      state.project = values[0].project;
      state.dashboard = values[0];
      state.baselines = values[1];
      state.tasks = values[0].tasks.map((item) => item.task);
      state.runs = values[0].runs;
      state.observations = values[2];
      const availableModels = [...new Set(state.observations.map((item) => item.model))].sort();
      const modelSelect = $("model-filter");
      modelSelect.innerHTML = '<option value="all">' + html(t("allModels")) + '</option>' + availableModels.map((model) => '<option value="' + html(model) + '">' + html(modelLabel(model)) + '</option>').join("");
      if (!availableModels.includes(state.model)) state.model = "all";
      modelSelect.value = state.model;
      renderProjectSelector();
      renderCurrentView();
    }

    function latestObservations() {
      const runId = state.workbench && state.workbench.currentDataRun && state.workbench.currentDataRun.id;
      return runId ? state.observations.filter((item) => item.runId === runId && (state.model === "all" || item.model === state.model)) : [];
    }
    function metric(metricId) {
      const rows = state.workbench && state.workbench.latestMetrics;
      return (rows || []).find((item) => item.metricId === metricId) || { numerator: 0, denominator: 0, value: null, observationIds: [], denominatorObservationIds: [] };
    }
    function metricChange(metricId) {
      return (state.workbench && state.workbench.metricChanges || []).find((item) => item.metricId === metricId) || { comparable: false, delta: null, summary: t("compareUnavailable"), evidence: { currentObservationIds: [], previousObservationIds: [] } };
    }
    function metricLabel(metricId) {
      if (metricId === "brand_discovery") return t("brandDiscovery");
      if (metricId === "candidate_inclusion") return t("candidateEntry");
      if (metricId === "explicit_recommendation") return t("explicitRecommendation");
      return t("officialCitation");
    }
    function metricBasis(metricId) {
      if (metricId === "brand_discovery") return t("brandDiscoveryBasis");
      if (metricId === "candidate_inclusion") return t("candidateEntryBasis");
      if (metricId === "explicit_recommendation") return t("explicitRecommendationBasis");
      return t("officialCitationBasis");
    }
    function metricSemantics(metricId) {
      const brand = state.project && state.project.name || t("brand");
      const domain = state.project && state.project.domain || t("officialSite");
      if (metricId === "brand_discovery") return {
        className: "discovery",
        proof: t("discoveryProof"),
        formula: t("discoveryFormula"),
        direction: t("discoveryDirection"),
        legend: t("discoveryLegend"),
        subject: t("discoverySubject", { brand })
      };
      if (metricId === "candidate_inclusion") return {
        className: "candidate",
        proof: t("candidateProof"),
        formula: t("candidateFormula"),
        direction: t("candidateDirection"),
        legend: t("candidateLegend"),
        subject: t("candidateSubject", { brand })
      };
      if (metricId === "explicit_recommendation") return {
        className: "recommendation",
        proof: t("recommendationProof"),
        formula: t("recommendationFormula"),
        direction: t("recommendationDirection"),
        legend: t("recommendationLegend"),
        subject: t("recommendationSubject", { brand })
      };
      return {
        className: "citation",
        proof: t("citationProof"),
        formula: t("citationFormula"),
        direction: t("citationDirection"),
        legend: t("citationLegend"),
        subject: t("citationSubject", { domain })
      };
    }
    function trendContextMarkup() {
      const baseline = state.workbench && state.workbench.selectedBaseline;
      if (!baseline) return "";
      const prompts = (baseline.prompts || []).filter((prompt) => prompt.enabled).length;
      const models = new Set((baseline.providerTargets || []).map((target) => target.model)).size;
      const targets = baseline.providerTargets || [];
      const searchLabel = targets.length && targets.every((target) => target.webSearchEnabled)
        ? t("nativeSearchConfigured")
        : targets.some((target) => target.webSearchEnabled)
          ? t("mixedSearchConfigured")
          : t("searchDisabled");
      return '<div class="trend-context"><span>' + html(t("sameBaseline")) + '</span><span>' + prompts + ' ' + html(t("prompts")) + '</span><span>' + models + ' ' + html(t("models")) + '</span><span>' + html(t("dataSourceShort")) + '</span><span>' + html(searchLabel) + '</span></div>';
    }
    function latestPair(series) {
      const points = series && series.points || [];
      return points.length >= 2 ? [points[points.length - 2], points[points.length - 1]] : [];
    }
    function trendDefinitionsMarkup(seriesRows) {
      return '<div class="trend-definitions">' + seriesRows.map((series) => {
        const semantics = metricSemantics(series.metricId);
        const pair = latestPair(series);
        const values = pair.length
          ? pair[0].result.numerator + '/' + pair[0].result.denominator + ' → ' + pair[1].result.numerator + '/' + pair[1].result.denominator
          : series.points.length
            ? series.points[0].result.numerator + '/' + series.points[0].result.denominator
            : '—';
        return '<label class="trend-definition ' + semantics.className + '"><input type="checkbox" data-trend-metric="' + html(series.metricId) + '"' + (state.visibleMetrics.has(series.metricId) ? " checked" : "") + '><span class="trend-definition-body"><strong>' + html(metricLabel(series.metricId)) + '</strong><small>' + html(t("metricMeaning")) + ': ' + html(semantics.proof) + '</small><code>' + html(semantics.formula) + '</code><small>' + html(semantics.direction) + '</small><b>' + html(semantics.legend) + ' · ' + html(values) + '</b></span></label>';
      }).join("") + '</div>';
    }
    function trendProofStatement(series) {
      const pair = latestPair(series);
      if (!pair.length || !pair[1].change || !pair[1].change.comparable) return "";
      const previous = pair[0].result.numerator;
      const current = pair[1].result.numerator;
      const semantics = metricSemantics(series.metricId);
      const key = current > previous ? "proofIncreased" : current < previous ? "proofDecreased" : "proofUnchanged";
      const className = current > previous ? "positive" : current < previous ? "negative" : "neutral";
      return '<li class="' + className + '"><span></span><p>' + html(t(key, { subject: semantics.subject, from: previous, to: current })) + '</p></li>';
    }
    function trendProofMarkup(seriesRows) {
      const statements = seriesRows.map(trendProofStatement).filter(Boolean);
      if (!statements.length) return "";
      return '<div class="trend-proof"><h4>' + html(t("changesProve")) + '</h4><ul>' + statements.join("") + '</ul></div>';
    }
    function trendLimitationsMarkup() {
      return '<details class="trend-limitations"><summary>' + html(t("cannotProve")) + '</summary><ul><li>' + html(t("cannotProveLongTerm")) + '</li><li>' + html(t("cannotProveShare")) + '</li><li>' + html(t("cannotProveConsumer")) + '</li><li>' + html(t("cannotProveCause")) + '</li></ul></details>';
    }
    function periodLabel() {
      if (state.period === "1d") return t("last24Hours");
      if (state.period === "7d") return t("last7Days");
      if (state.period === "30d") return t("last30Days");
      if (state.period === "90d") return "90 days";
      return t("allTime");
    }
    function scopeLabel() {
      const scope = state.workbench && state.workbench.scope;
      if (!scope) return periodLabel();
      return periodLabel() + " · " + scope.runCount + " " + t("scopedRuns") + " · " + scope.completedAnswerCount + " " + t("scopedAnswers");
    }
    function seriesFor(metricId) {
      return (state.workbench && state.workbench.series || []).find((item) => item.metricId === metricId);
    }
    function seriesDrawable(series) {
      if (!series || series.state !== "ready") return false;
      const points = series.points.filter((point) => point.result.value != null);
      if (points.length < 2) return false;
      return points.slice(1).every((point) => point.change && point.change.comparable && point.evidenceChange && point.evidenceChange.comparable);
    }
    function sparkline(series) {
      if (!seriesDrawable(series)) return '<span class="sparkline-placeholder"></span>';
      const width = 180;
      const height = 30;
      const values = series.points.map((point) => point.result.value).filter((value) => value != null);
      if (values.length < 2) return '<span class="sparkline-placeholder"></span>';
      const denominator = Math.max(values.length - 1, 1);
      const coordinates = values.map((value, index) => {
        const x = (index / denominator) * width;
        const y = height - Math.max(0, Math.min(1, value)) * height;
        return [Number(x.toFixed(1)), Number(y.toFixed(1))];
      });
      const points = coordinates.map((point) => point[0].toFixed(1) + "," + point[1].toFixed(1)).join(" ");
      const semantics = metricSemantics(series.metricId);
      return '<svg class="sparkline" viewBox="0 0 180 30" preserveAspectRatio="none" aria-hidden="true"><polyline class="chart-line ' + semantics.className + '" data-series-key="sparkline:' + html(series.metricId) + ':0" data-chart-points="' + html(JSON.stringify(coordinates)) + '" points="' + points + '"></polyline></svg>';
    }
    function metricCard(metricId, filterName) {
      const current = metric(metricId);
      const change = metricChange(metricId);
      const changeMarkup = '<span class="metric-change ' + (change.delta > 0 ? "up" : change.delta < 0 ? "down" : "muted") + '">' + html(change.summary) + '</span>';
      const value = current.denominator > 0
        ? current.numerator + ' <span class="metric-denominator">/ ' + current.denominator + '</span>'
        : '<span class="metric-denominator">' + html(t("metricNoSample")) + '</span>';
      return '<button class="metric-card" type="button" data-evidence-ids="' + html(current.denominatorObservationIds.join(",")) + '" data-metric-filter="' + html(filterName) + '">' +
        '<span class="metric-label">' + html(metricLabel(metricId)) + '</span>' + changeMarkup +
        '<strong class="metric-value">' + value + '</strong>' + sparkline(seriesFor(metricId)) +
        '<small class="metric-basis">' + html(metricBasis(metricId)) + '</small></button>';
    }
    function noProjectMarkup() {
      return '<div class="empty-state"><strong>' + html(t("noProjects")) + '</strong><p>' + html(t("workspaceSubtitle")) + '</p><button class="button primary" type="button" data-open-wizard="true">' + html(t("newProject")) + '</button></div>';
    }
    function attentionClass(kind) {
      if (kind === "brand_disappeared" || kind === "candidate_left" || kind === "recommendation_lost" || kind === "official_citation_removed") return "negative";
      if (kind === "official_citation_added") return "citation";
      if (kind === "brand_appeared" || kind === "candidate_entered" || kind === "recommendation_gained") return "positive";
      return "";
    }
    function changedQuestionsMarkup() {
      const changed = state.workbench && state.workbench.attention || [];
      if (!changed.length) return '<div class="inline-empty">' + html(t("noComparableChanges")) + '</div>';
      return '<div class="event-list">' + changed.slice(0, 5).map((item) => {
        const evidenceIds = item.evidence.currentObservationIds.concat(item.evidence.previousObservationIds);
        return '<button class="event-item event-button" type="button" data-evidence-ids="' + html(evidenceIds.join(",")) + '"><span class="event-marker ' + attentionClass(item.kind) + '"></span><span><strong>' + html(item.summary) + '</strong><small>' + html(item.models.map(modelLabel).join(", ") || t("openEvidence")) + '</small></span></button>';
      }).join("") + '</div>';
    }
    function replacementMarkup() {
      const entities = state.workbench.entities.confirmedCompetitors || [];
      if (!entities.length) {
        const registry = state.workbench.entities || {};
        const pending = []
          .concat(registry.suspectedBrands || [])
          .concat(registry.unresolved || []);
        const detail = pending.length ? '<small>' + html(t("pendingEntitySummary", { count: pending.length })) + '</small>' : '';
        return '<div class="inline-empty">' + html(t("noConfirmedCompetitors")) + detail + '</div>';
      }
      const item = entities[0];
      return '<button class="event-item event-button" type="button" data-evidence-ids="' + html(item.evidence.map((row) => row.observationId).join(",")) + '"><span class="event-marker negative"></span><span><strong>' + html(item.canonicalName || item.name) + '</strong><small>' + html(t("targetAbsentAnswers") + ' ' + item.targetAbsentObservationCount + ' · ' + item.observationCount + ' / ' + state.workbench.scope.completedAnswerCount + ' ' + t("scopedAnswers")) + '</small></span></button>';
    }
    function monitoringEventLabel(condition) {
      const keys = {
        brand_disappeared: "brandMissingCondition",
        competitor_appeared: "competitorCondition",
        official_citation_added: "citationCondition",
        recommendation_changed: "recommendationCondition",
        run_completed: "completeCondition",
        run_failed: "failureCondition"
      };
      return t(keys[condition] || "recentAlerts");
    }
    function monitoringEventsMarkup(limit) {
      const events = (state.workbench && state.workbench.events || []).slice(0, limit);
      if (!events.length) return '<div class="inline-empty">' + html(t("noRecentAlerts")) + '</div>';
      return '<div class="event-list">' + events.map((item) => {
        const evidenceIds = item.observationIds.concat(item.previousObservationIds);
        const delivery = item.deliveries.length
          ? item.deliveries.filter((row) => row.status === "delivered").length + ' / ' + item.deliveries.length
          : "Recorded";
        const content = '<span class="event-marker ' + (item.condition === "run_failed" || item.condition === "brand_disappeared" ? "negative" : item.condition === "official_citation_added" ? "citation" : "positive") + '"></span><span><strong>' + html(monitoringEventLabel(item.condition)) + '</strong><small>' + html(formatDate(item.createdAt) + ' · ' + item.occurrenceCount + ' · ' + delivery) + '</small></span>';
        return evidenceIds.length
          ? '<button class="event-item event-button" type="button" data-evidence-ids="' + html(evidenceIds.join(",")) + '">' + content + '</button>'
          : '<div class="event-item">' + content + '</div>';
      }).join("") + '</div>';
    }
    function monitoringSummaryMarkup() {
      const summaries = state.workbench.tasks || [];
      if (!summaries.length) return '<div class="empty-inline"><span>' + html(t("noMonitoringTasks")) + '</span><button class="button primary" type="button" data-create-monitoring="true">' + html(t("setMonitoring")) + '</button></div>';
      const summary = summaries[0];
      return '<div class="monitor-compact"><div><strong>' + html(summary.task.name) + '</strong><p>' + html(scheduleLabel(summary.task.schedule) + ' · ' + summary.questionCount + ' ' + t("prompts") + ' · ' + summary.modelCount + ' ' + t("models")) + '</p></div><div><span class="status ' + (summary.task.enabled ? "ok" : "warn") + '">' + html(summary.task.enabled ? t("running") : t("pause")) + '</span><p>' + html(t("nextRun") + ': ' + formatDate(summary.task.nextRunAt)) + '</p></div></div>';
    }
    function latestRunAlertMarkup() {
      const latest = state.workbench && state.workbench.latestRun;
      if (!latest || state.workbench.latestRunComplete) return "";
      const current = state.workbench.currentDataRun;
      const basis = current
        ? t("currentDataFrom", { date: formatDate(current.finishedAt || current.startedAt) })
        : t("noCompleteRun");
      return '<section class="overview-alert"><div><strong>' + html(t("runIncomplete")) + '</strong><p>' + html(t("runIncompleteDetail", { completed: latest.completedObservationCount, planned: latest.plannedObservationCount, failed: latest.failedObservationCount })) + '</p><small>' + html(basis) + '</small></div><div class="inline-actions"><button class="button" type="button" data-view-jump="runs">' + html(t("viewFailures")) + '</button><button class="button primary" type="button" data-run-baseline="' + html(state.workbench.selectedBaseline && state.workbench.selectedBaseline.id || "") + '">' + html(t("rerunBaseline")) + '</button></div></section>';
    }
    function analysisCoverageAlertMarkup() {
      const run = state.workbench && state.workbench.latestProviderCompleteRun;
      const coverage = state.workbench && state.workbench.analysisCoverage;
      const current = state.workbench && state.workbench.currentDataRun;
      if (!run || !coverage || current && current.id === run.id) return "";
      const baseline = state.workbench.selectedBaseline;
      const missingPromptIntent = baseline && baseline.prompts.some((prompt) => !prompt.intentProfile);
      const action = missingPromptIntent
        ? '<button class="button primary" type="button" data-classify-baseline="' + html(baseline.id) + '">' + html(t("classifyBaselineIntents")) + '</button>'
        : '<button class="button primary" type="button" data-reanalyze-run="' + html(run.id) + '">' + html(t("reanalyzeAnswers")) + '</button>';
      return '<section class="overview-alert"><div><strong>' + html(t("analysisIncomplete")) + '</strong><p>' + html(t("analysisIncompleteDetail", { completed: coverage.completedAnalysisCount, answered: coverage.answeredObservationCount })) + '</p><small>' + html(t("analysisHistorical")) + '</small></div><div class="inline-actions">' + action + '</div></section>';
    }
    function citationSummaryMarkup() {
      const domains = state.workbench && state.workbench.citations && state.workbench.citations.targetDomains || [];
      if (!domains.length) return '<div class="inline-empty">' + html(t("noCitations")) + '</div>';
      const domain = domains[0];
      const pages = domain.pages.slice(0, 3).map((source) => '<li><span>' + html(source.title || source.url) + '</span><strong>' + source.observationCount + '</strong></li>').join("");
      return '<button class="event-item event-button" type="button" data-evidence-ids="' + html(domain.observationIds.join(",")) + '"><span class="event-marker citation"></span><span><strong>' + html(domain.domain) + '</strong><small>' + domain.observationCount + ' / ' + latestObservations().length + ' ' + html(t("officialDomainCoverage")) + '</small><small>' + html(t("sourcePageBreakdown")) + '</small><ul class="source-breakdown">' + pages + '</ul></span></button>';
    }
    function renderOverview() {
      const root = $("overview-body");
      if (!state.project || !state.workbench) { root.innerHTML = noProjectMarkup(); return; }
      root.innerHTML =
        latestRunAlertMarkup() +
        analysisCoverageAlertMarkup() +
        '<section class="section"><div class="section-head"><div><h2>' + html(t("currentValidData")) + '</h2><p>' + html(state.workbench.currentDataRun ? formatDate(state.workbench.currentDataRun.finishedAt || state.workbench.currentDataRun.startedAt) + ' · ' + state.workbench.currentDataRun.completedObservationCount + ' / ' + state.workbench.currentDataRun.plannedObservationCount : t("noCompleteRun")) + '</p></div><button class="button" type="button" data-run-baseline="' + html(state.workbench.selectedBaseline && state.workbench.selectedBaseline.id || "") + '">' + html(t("runNow")) + '</button></div>' +
        '<div class="metric-grid">' +
          metricCard("brand_discovery", "mentioned") +
          metricCard("candidate_inclusion", "candidate") +
          metricCard("explicit_recommendation", "recommended") +
          metricCard("official_citation", "cited") +
        '</div></section>' +
        '<section class="section"><div class="section-head"><div><h2>' + html(t("whatChanged")) + '</h2><p>' + html(state.workbench.changes.comparable ? t("latestCompleteRunOnly") : t("attentionEmpty")) + '</p></div></div>' + changedQuestionsMarkup() + '</section>' +
        '<section class="section">' + renderTrendPanel(true) + '</section>' +
        '<div class="overview-grid"><section class="section"><div class="section-head"><div><h2>' + html(t("replacementFocus")) + '</h2></div><button class="button text" type="button" data-view-jump="competitors">' + html(t("competitorsNav")) + '</button></div>' + replacementMarkup() + '</section>' +
        '<section class="section"><div class="section-head"><div><h2>' + html(t("citations")) + '</h2></div><button class="button text" type="button" data-view-jump="citations">' + html(t("citations")) + '</button></div>' + citationSummaryMarkup() + '</section></div>' +
        '<section class="section"><div class="section-head"><div><h2>' + html(t("monitoringTasks")) + '</h2></div><button class="button text" type="button" data-view-jump="monitoring">' + html(t("monitoring")) + '</button></div>' + monitoringSummaryMarkup() + '</section>' +
        '<section class="section"><div class="section-head"><div><h2>' + html(t("recentAlerts")) + '</h2></div></div>' + monitoringEventsMarkup(5) + '</section>';
      animateChartLines(root);
    }
    function animateChartLines(root) {
      motion.animateCharts(root);
    }
    function chartPolyline(series, className, seriesKey) {
      if (!seriesDrawable(series)) return "";
      const points = series.points;
      if (points.filter((point) => point.result.value != null).length < 2) return "";
      const width = 800;
      const height = 240;
      const xOffset = 34;
      const yOffset = 16;
      const plotWidth = width - xOffset - 10;
      const plotHeight = height - yOffset - 28;
      const denominator = Math.max(points.length - 1, 1);
      const segments = [];
      let segment = [];
      points.forEach((point, index) => {
        if (point.result.value == null) {
          if (segment.length >= 2) segments.push(segment);
          segment = [];
          return;
        }
        const x = xOffset + (index / denominator) * plotWidth;
        const y = yOffset + (1 - point.result.value) * plotHeight;
        segment.push([Number(x.toFixed(1)), Number(y.toFixed(1))]);
      });
      if (segment.length >= 2) segments.push(segment);
      const semanticClass = className || metricSemantics(series.metricId).className;
      const baseSeriesKey = seriesKey || "metric:" + String(series.metricId || "series");
      const lines = segments.map((coords, segmentIndex) => {
        const key = baseSeriesKey + ":" + segmentIndex;
        const pointsText = coords.map((point) => point[0].toFixed(1) + "," + point[1].toFixed(1)).join(" ");
        return '<polyline class="chart-line ' + semanticClass + '" data-series-key="' + html(key) + '" data-chart-points="' + html(JSON.stringify(coords)) + '" points="' + pointsText + '"></polyline>';
      }).join("");
      const dots = points.map((point, index) => {
        if (point.result.value == null) return "";
        const x = xOffset + (index / denominator) * plotWidth;
        const y = yOffset + (1 - point.result.value) * plotHeight;
        const evidence = point.evidenceChange;
        const evidenceIds = evidence && evidence.comparable
          ? [...new Set(evidence.addedCurrentObservationIds.concat(
              evidence.persistedObservationPairs.map((pair) => pair.currentObservationId),
              evidence.persistedObservationPairs.map((pair) => pair.previousObservationId),
              evidence.removedPreviousObservationIds,
            ))]
          : point.result.observationIds;
        const change = point.change && point.change.comparable ? point.change.delta : null;
        const changeText = change == null ? "" : " · " + (change > 0 ? "+" : "") + change;
        const pointAttributes = series.metricId
          ? ' data-trend-metric-id="' + html(series.metricId) + '" data-trend-run-id="' + html(point.runId) + '"'
          : ' data-evidence-ids="' + html(evidenceIds.join(",")) + '"';
        const title = html(formatDate(point.observedAt) + ' · ' + point.result.numerator + ' / ' + point.result.denominator + changeText);
        return '<g class="chart-point-group ' + semanticClass + '"><line class="chart-reference" x1="' + x.toFixed(1) + '" y1="16" x2="' + x.toFixed(1) + '" y2="212"></line><circle class="chart-point-pulse" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="5"></circle><circle class="chart-point ' + semanticClass + '" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4"></circle><circle class="chart-point-hit" data-series-key="' + html(baseSeriesKey + ':0') + '" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="12" tabindex="0" role="button" aria-label="' + title + '"' + pointAttributes + '><title>' + title + '</title></circle></g>';
      }).join("");
      return lines + dots;
    }
    function trendEmptyState(series) {
      const states = (series || []).map((item) => item.state);
      if (states.includes("same_day_only")) return t("sameDayOnly");
      if (states.includes("partial_run")) return t("partialRunTrend");
      if (states.includes("baseline_changed")) return t("baselineChanged");
      return t("firstObservation");
    }
    function renderTrendPanel(compact) {
      const allSeries = state.workbench && state.workbench.series || [];
      const visible = allSeries.filter((item) => state.visibleMetrics.has(item.metricId));
      const ready = visible.filter(seriesDrawable);
      const chartHeader = '<div class="chart-header trend-chart-header"><div><h3>' + html(t("trendTitle")) + '</h3><p>' + html(t("trendPurpose")) + '</p></div>' + (ready.length ? '<span class="status ok">' + ready[0].points.length + ' ' + html(t("monitoringPeriods")) + '</span>' : '') + '</div>' + trendContextMarkup();
      const definitions = trendDefinitionsMarkup(allSeries);
      if (!ready.length) return '<div class="chart-panel' + (compact ? ' compact' : '') + '">' + chartHeader + '<div class="' + (compact ? "inline-empty" : "chart-empty") + '"><strong>' + html(t("noTrend")) + '</strong><p>' + html(trendEmptyState(visible)) + '</p><div class="inline-actions"><button class="button" type="button" data-view-jump="monitoring">' + html(t("setMonitoring")) + '</button><button class="button primary" type="button" data-run-baseline="' + html(state.workbench && state.workbench.selectedBaseline && state.workbench.selectedBaseline.id || "") + '">' + html(t("runNow")) + '</button></div></div>' + definitions + trendLimitationsMarkup() + '</div>';
      const points = ready[0].points;
      const grid = [0, .25, .5, .75, 1].map((value) => {
        const y = 16 + (1 - value) * 196;
        return '<line class="chart-grid" x1="34" y1="' + y + '" x2="790" y2="' + y + '"></line><text class="chart-axis-label" x="0" y="' + (y + 4) + '" fill="#666" font-size="10">' + Math.round(value * 100) + '%</text>';
      }).join("");
      const labels = points.map((point, index) => {
        if (points.length > 8 && index % Math.ceil(points.length / 6) !== 0 && index !== points.length - 1) return "";
        const x = 34 + (index / Math.max(points.length - 1, 1)) * 756;
        const options = state.period === "1d" ? { hour: "2-digit", minute: "2-digit" } : { month: "short", day: "numeric" };
        return '<text class="chart-axis-label" x="' + x.toFixed(1) + '" y="235" text-anchor="middle" fill="#666" font-size="10">' + html(new Intl.DateTimeFormat("en", options).format(new Date(point.observedAt))) + '</text>';
      }).join("");
      return '<div class="chart-panel' + (compact ? ' compact' : '') + '">' + chartHeader +
        definitions +
        '<div class="chart-frame"><svg viewBox="0 0 800 240" preserveAspectRatio="none" role="img" aria-label="' + html(t("trendTitle")) + '">' + grid + labels + ready.map((item) => chartPolyline(item, undefined, "metric:" + item.metricId)).join("") + '</svg></div>' +
        trendProofMarkup(allSeries.filter((item) => item.state === "ready")) + trendLimitationsMarkup() + '</div>';
    }
    function renderVisibility() {
      const root = $("visibility-body");
      if (!state.project) { root.innerHTML = noProjectMarkup(); return; }
      const tabs = '<div class="view-tabs"><button class="segment' + (state.trendMode === "metrics" ? " active" : "") + '" type="button" data-trend-mode="metrics">' + html(t("metricTrend")) + '</button><button class="segment' + (state.trendMode === "brands" ? " active" : "") + '" type="button" data-trend-mode="brands">' + html(t("brandComparison")) + '</button></div>';
      root.innerHTML = tabs + (state.trendMode === "brands" ? renderBrandComparisonPanel() : renderTrendPanel(false));
      animateChartLines(root);
    }

    function renderBrandComparisonPanel() {
      const comparisons = state.workbench && state.workbench.brandComparisons || [];
      const comparison = comparisons.find((item) => item.metricId === state.comparisonMetric);
      const options = ["brand_discovery", "candidate_inclusion", "explicit_recommendation", "official_citation"].map((metricId) => '<option value="' + metricId + '"' + (metricId === state.comparisonMetric ? " selected" : "") + '>' + html(metricLabel(metricId)) + '</option>').join("");
      const selector = '<div class="chart-header"><div><h3>' + html(t("brandComparison")) + '</h3><p>' + html(t("comparisonMetricHelp")) + '</p></div><select id="comparison-metric">' + options + '</select></div>';
      if (!comparison || comparison.brands.length < 2) return '<div class="chart-panel">' + selector + '<div class="chart-empty"><strong>' + html(t("noConfirmedCompetitors")) + '</strong></div></div>';
      const lines = comparison.brands.filter((brand) => seriesDrawable({ state: comparison.state, points: brand.points }));
      if (comparison.state !== "ready" || lines.length < 2) return '<div class="chart-panel">' + selector + '<div class="chart-empty"><strong>' + html(t("noTrend")) + '</strong><p>' + html(trendEmptyState([{ state: comparison.state }])) + '</p></div></div>';
      const points = lines[0].points;
      const grid = [0, .25, .5, .75, 1].map((value) => {
        const y = 16 + (1 - value) * 196;
        return '<line class="chart-grid" x1="34" y1="' + y + '" x2="790" y2="' + y + '"></line><text class="chart-axis-label" x="0" y="' + (y + 4) + '" fill="#666" font-size="10">' + Math.round(value * 100) + '%</text>';
      }).join("");
      const labels = points.map((point, index) => {
        if (points.length > 8 && index % Math.ceil(points.length / 6) !== 0 && index !== points.length - 1) return "";
        const x = 34 + (index / Math.max(points.length - 1, 1)) * 756;
        const options = state.period === "1d" ? { hour: "2-digit", minute: "2-digit" } : { month: "short", day: "numeric" };
        return '<text class="chart-axis-label" x="' + x.toFixed(1) + '" y="235" text-anchor="middle" fill="#666" font-size="10">' + html(new Intl.DateTimeFormat("en", options).format(new Date(point.observedAt))) + '</text>';
      }).join("");
      const classes = ["", "secondary", "tertiary", "quaternary", "quinary"];
      const legend = lines.map((brand, index) => '<span class="brand-legend brand-legend-' + index + '">' + html(brand.name) + '</span>').join("");
      return '<div class="chart-panel">' + selector + '<div class="chart-frame"><svg viewBox="0 0 800 240" preserveAspectRatio="none" role="img" aria-label="' + html(t("brandComparison")) + '">' + grid + labels + lines.map((brand, index) => chartPolyline({ state: comparison.state, points: brand.points }, classes[index] || "quinary", "brand:" + comparison.metricId + ":" + brand.key)).join("") + '</svg></div><div class="legend">' + legend + '</div></div>';
    }

    function promptRows() {
      if (!state.workbench) return [];
      return state.workbench.questions.map((question) => {
        const result = question.recommended ? t("recommended") : question.candidate ? t("candidate") : question.mentioned ? t("mentioned") : t("absent");
        const className = question.recommended || question.candidate ? "ok" : question.mentioned ? "info" : "error";
        return {
          question,
          result,
          className,
          mentioned: question.mentioned > 0,
          candidate: question.candidate > 0,
          recommended: question.recommended > 0,
          cited: question.officiallyCited > 0
        };
      });
    }
    function renderPrompts() {
      const root = $("prompts-body");
      if (!state.project) { root.innerHTML = noProjectMarkup(); return; }
      const allRows = promptRows();
      const rows = state.promptFilter === "all" ? allRows : allRows.filter((row) => Boolean(row[state.promptFilter]));
      const filterLabel = state.promptFilter === "all" ? "" : '<span class="status info">' + html(t(state.promptFilter === "cited" ? "officialCitation" : state.promptFilter === "mentioned" ? "brandDiscovery" : state.promptFilter === "candidate" ? "candidateEntry" : "explicitRecommendation")) + '</span><button class="button text" type="button" data-clear-prompt-filter="true">×</button>';
      root.innerHTML = '<div class="section-head"><div><h2>' + html(t("promptAsset")) + '</h2><p>' + html(t("promptAssetHelp")) + '</p></div><div class="inline-actions">' + filterLabel + '</div></div>' +
        (rows.length ? '<div class="data-table-wrap"><table><thead><tr><th>' + html(t("question")) + '</th><th>' + html(t("result")) + '</th><th>' + html(t("modelCoverage")) + '</th><th>' + html(t("change")) + '</th><th>' + html(t("openEvidence")) + '</th></tr></thead><tbody>' + rows.map((row) => {
          const change = (state.workbench.attention || []).find((item) => item.promptIds.includes(row.question.promptId));
          return '<tr><td><strong>' + html(row.question.promptText) + '</strong><div class="filter-note">' + html(categoryLabel(row.question.auditCategory)) + '</div></td><td><span class="status ' + row.className + '">' + html(row.result) + '</span></td><td>' + row.question.completed + ' / ' + row.question.total + '</td><td>' + html(change ? change.summary : '—') + '</td><td><button class="button text" type="button" data-evidence-ids="' + html(row.question.modelResults.map((item) => item.observationId).join(",")) + '">' + html(t("openEvidence")) + '</button></td></tr>';
        }).join("") + '</tbody></table></div>' : '<div class="empty-state">' + html(t("noTrend")) + '</div>');
    }

    function entityGroupSection(title, items, confirmed) {
      if (!items.length) return '<section class="section"><div class="section-head"><div><h2>' + html(title) + '</h2></div></div><div class="chart-empty">—</div></section>';
      return '<section class="section"><div class="section-head"><div><h2>' + html(title) + '</h2></div><span class="status ' + (confirmed ? "ok" : "warn") + '">' + items.length + '</span></div><div class="data-table-wrap"><table><thead><tr><th>' + html(t("source")) + '</th><th>' + html(t("whyCompetitor")) + '</th><th>' + html(t("evidenceCount")) + '</th><th>' + html(t("openEvidence")) + '</th></tr></thead><tbody>' + items.map((item) => '<tr><td><strong>' + html(item.canonicalName || item.name) + '</strong><div class="filter-note">' + html(item.canonicalUrl || "—") + '</div></td><td>' + html(item.relationshipsToTarget.map(relationshipLabel).join(", ")) + '</td><td>' + item.observationCount + ' / ' + state.workbench.scope.completedAnswerCount + (confirmed ? '<div class="filter-note">' + html(t("targetAbsentAnswers") + ': ' + item.targetAbsentObservationCount) + '</div>' : '') + '</td><td><button class="button text" type="button" data-evidence-ids="' + html(item.evidence.map((row) => row.observationId).join(",")) + '">' + html(t("openEvidence")) + '</button></td></tr>').join("") + '</tbody></table></div></section>';
    }
    function relationshipLabel(value) {
      const labels = { competitor: "Competitor", direct_alternative: "Direct alternative", indirect_alternative: "Indirect alternative", compared_option: "Compared option", recommended_option: "Recommended option", channel: "Channel", source: "Source", integration: "Integration", example: "Example", customer: "Customer", partner: "Partner", unrelated: "Unrelated", unclear: "Needs confirmation", target: "Target brand", evaluated_candidate: "Evaluated candidate" };
      return labels[value] || value;
    }
    function renderCompetitorsView() {
      const root = $("competitors-body");
      if (!state.workbench) { root.innerHTML = noProjectMarkup(); return; }
      const registry = state.workbench.entities;
      root.innerHTML = '<div class="section-head"><div><h2>' + html(t("competitorsNav")) + '</h2><p>' + html(scopeLabel()) + '</p></div></div>' + entityGroupSection(t("confirmedCompetitors"), registry.confirmedCompetitors || [], true) +
        entityGroupSection(t("suspectedBrands"), registry.suspectedBrands || [], false) +
        '<div class="overview-grid">' + entityGroupSection(t("alternativeMethods"), registry.alternativeMethods || [], false) + entityGroupSection(t("promotionChannels"), registry.promotionChannels || [], false) + '</div>' +
        entityGroupSection(t("unresolvedEntities"), registry.unresolved || [], false);
    }

    function citationGroups() {
      if (!state.workbench) return [];
      const citations = state.workbench.citations;
      return [
        { label: t("targetSource"), type: "target", items: citations.targetSources || [] },
        { label: t("competitorSource"), type: "competitor", items: citations.competitorSources || [] },
        { label: t("thirdPartySource"), type: "third_party", items: citations.thirdPartySources || [] },
        { label: t("unknownSource"), type: "unknown", items: citations.unknownSources || [] }
      ];
    }
    function targetDomainBreakdown() {
      const domains = state.workbench && state.workbench.citations && state.workbench.citations.targetDomains || [];
      if (!domains.length) return '<div class="inline-empty">' + html(t("noCitations")) + '</div>';
      return '<div class="domain-source-list">' + domains.map((domain) => {
        const pages = domain.pages.map((page) => '<li><button class="button text" type="button" data-source-url="' + html(page.url) + '">' + html(page.title || page.url) + '</button><span>' + page.observationCount + ' / ' + state.workbench.scope.completedAnswerCount + '</span></li>').join("");
        return '<details class="domain-source"><summary><span><strong>' + html(domain.domain) + '</strong><small>' + html(domain.observationCount + ' / ' + state.workbench.scope.completedAnswerCount + ' ' + t("officialDomainCoverage")) + '</small></span><span class="domain-source-toggle">' + html(t("citedPageBreakdown")) + '</span></summary><div class="domain-source-pages"><div class="section-head"><div><strong>' + html(t("citedPageBreakdown")) + '</strong><p>' + html(t("sourcePageBreakdown")) + '</p></div><button class="button text" type="button" data-evidence-ids="' + html(domain.observationIds.join(",")) + '">' + html(t("openEvidence")) + '</button></div><ul>' + pages + '</ul></div></details>';
      }).join("") + '</div>';
    }
    function renderCitations() {
      const root = $("citations-body");
      if (!state.workbench) { root.innerHTML = noProjectMarkup(); return; }
      const groups = citationGroups().filter((group) => group.type !== "target");
      const total = groups.reduce((sum, group) => sum + group.items.reduce((value, item) => value + item.observationCount, 0), 0);
      const distribution = groups.map((group) => {
        const count = group.items.reduce((sum, item) => sum + item.observationCount, 0);
        return '<span style="width:' + (total ? count / total * 100 : 0).toFixed(2) + '%" title="' + html(group.label + ': ' + count) + '"></span>';
      }).join("");
      const items = groups.flatMap((group) => group.items.map((item) => ({ ...item, label: group.label, groupType: group.type }))).sort((a, b) => b.observationCount - a.observationCount);
      root.innerHTML = '<div class="section-head"><div><h2>' + html(t("sourceLandscape")) + '</h2><p>' + html(scopeLabel() + ' · ' + t("sourceLandscapeHelp")) + '</p></div></div>' +
        '<section class="section"><div class="section-head"><div><h2>' + html(t("officialDomainCoverageTitle")) + '</h2><p>' + html(t("sourcePageBreakdown")) + '</p></div></div>' + targetDomainBreakdown() + '</section>' +
        '<div class="source-distribution">' + distribution + '</div><div class="legend">' + groups.map((group) => '<span>' + html(group.label) + '</span>').join("") + '</div>' +
        '<section class="section">' + (items.length ? '<div class="data-table-wrap"><table><thead><tr><th>#</th><th>' + html(t("source")) + '</th><th>' + html(t("type")) + '</th><th>' + html(t("observations")) + '</th><th>' + html(t("questionCoverage")) + '</th><th>' + html(t("openEvidence")) + '</th></tr></thead><tbody>' + items.map((item, index) => '<tr><td>' + (index + 1) + '</td><td><strong>' + html(item.title || item.domain) + '</strong><div class="filter-note">' + html(item.domain) + '</div></td><td><span class="status citation">' + html(item.label) + '</span></td><td>' + item.observationCount + ' / ' + state.workbench.scope.completedAnswerCount + '</td><td>' + item.promptTexts.length + ' / ' + state.workbench.scope.promptCount + '</td><td><button class="button text" type="button" data-source-url="' + html(item.url) + '">' + html(t("openEvidence")) + '</button><a class="row-link" href="' + html(item.url) + '" target="_blank" rel="noreferrer">↗</a></td></tr>').join("") + '</tbody></table></div>' : '<div class="empty-state">' + html(t("noCitations")) + '</div>') + '</section>';
    }

    function scheduleLabel(schedule) {
      if (!schedule) return t("manual");
      const time = String(schedule.hour == null ? 0 : schedule.hour).padStart(2, "0") + ":" + String(schedule.minute == null ? 0 : schedule.minute).padStart(2, "0");
      if (schedule.kind === "manual") return t("manual");
      if (schedule.kind === "daily") return t("daily") + " · " + time;
      if (schedule.kind === "weekly") {
        const day = Number.isInteger(schedule.dayOfWeek) ? schedule.dayOfWeek : 1;
        const date = new Date(Date.UTC(2026, 0, 4 + day));
        const weekday = new Intl.DateTimeFormat("en", { weekday: "long", timeZone: "UTC" }).format(date);
        return t("weekly") + " · " + weekday + " " + time;
      }
      if (schedule.kind === "monthly") return t("monthly") + " · " + (schedule.dayOfMonth || 1) + " · " + time;
      return t("customSchedule") + " · " + (schedule.cron || "");
    }
    function renderTaskCard(summary) {
      const task = summary.task;
      const last = summary.lastRun;
      const month = summary.estimatedMonthlyRequests == null ? "—" : summary.estimatedMonthlyRequests;
      return '<article class="task-card"><div class="task-card-main"><div><div class="task-title"><strong>' + html(task.name) + '</strong><span class="status ' + (task.enabled ? "ok" : "warn") + '">' + html(task.enabled ? t("active") : t("pause")) + '</span></div><p>' + html(summary.questionCount + ' ' + t("prompts") + ' · ' + summary.modelCount + ' ' + t("models") + ' · ' + scheduleLabel(task.schedule)) + '</p><p>' + html(task.schedule.timezone + ' · ' + t("nextRun") + ': ' + formatDate(task.nextRunAt)) + '</p></div><div class="task-stats"><div><span>' + html(t("requestsPerRun")) + '</span><strong>' + summary.requestsPerRun + '</strong></div><div><span>' + html(t("estimatedMonthly")) + '</span><strong>' + month + '</strong></div><div><span>' + html(t("latestRun")) + '</span><strong>' + html(last ? last.completedObservationCount + ' / ' + last.plannedObservationCount : '—') + '</strong></div></div></div><div class="task-actions"><button class="button primary" type="button" data-run-task="' + html(task.id) + '">' + html(t("runNow")) + '</button><button class="button" type="button" data-view-jump="runs">' + html(t("viewResults")) + '</button><button class="button" type="button" data-edit-task="' + html(task.id) + '">' + html(t("edit")) + '</button><button class="task-switch" type="button" role="switch" aria-checked="' + (task.enabled ? "true" : "false") + '" data-checked="' + (task.enabled ? "true" : "false") + '" data-toggle-task="' + html(task.id) + '" data-task-enabled="' + (task.enabled ? "true" : "false") + '" data-on-label="' + html(t("active")) + '" data-off-label="' + html(t("pause")) + '"><span class="task-switch-track" aria-hidden="true"><span></span></span><span class="task-switch-label">' + html(task.enabled ? t("active") : t("pause")) + '</span></button><button class="button" type="button" data-duplicate-task="' + html(task.id) + '">' + html(t("duplicate")) + '</button><button class="button danger" type="button" data-delete-task="' + html(task.id) + '">' + html(t("deleteTask")) + '</button></div></article>';
    }
    function renderMonitoring() {
      const root = $("monitoring-body");
      if (!state.project || !state.workbench) { root.innerHTML = noProjectMarkup(); return; }
      const summaries = state.workbench.tasks || [];
      root.innerHTML = '<div class="section-head"><div><h2>' + html(t("monitoringTasks")) + '</h2><p>' + html(t("noMonitoringTasksBody")) + '</p></div><button class="button primary" type="button" data-create-monitoring="true">' + html(t("createMonitoring")) + '</button></div>' +
        (summaries.length ? '<div class="task-list">' + summaries.map(renderTaskCard).join("") + '</div>' : '<div class="empty-state"><strong>' + html(t("noMonitoringTasks")) + '</strong><p>' + html(t("noMonitoringTasksBody")) + '</p><button class="button primary" type="button" data-create-monitoring="true">' + html(t("createMonitoring")) + '</button></div>') +
        '<section class="section"><div class="section-head"><div><h2>' + html(t("recentAlerts")) + '</h2></div></div>' + monitoringEventsMarkup(20) + '</section>';
    }
    function taskBaselineMarkup(baseline) {
      if (!baseline) return '<div class="chart-empty">' + html(t("noTrend")) + '</div>';
      const prompts = baseline.prompts || [];
      const targets = baseline.providerTargets || [];
      const searchEnabled = targets.some((item) => item.webSearchEnabled);
      const promptRows = prompts.map((prompt) => '<label><input type="checkbox" data-task-prompt-id="' + html(prompt.id) + '"' + (prompt.enabled ? " checked" : "") + '> <span>' + html(prompt.text) + '</span></label>').join("");
      const modelRows = targets.map((target) => '<label><input type="checkbox" data-task-provider-id="' + html(target.providerId) + '" data-task-model="' + html(target.model) + '" checked> <span>' + html(target.providerId + ' · ' + modelLabel(target.model)) + '</span></label>').join("");
      return '<section class="drawer-section"><h3>' + html(t("monitoringContent")) + '</h3><div class="field full"><label>' + html(t("selectQuestions")) + '</label><div class="check-list">' + promptRows + '</div></div><div class="field full"><label>' + html(t("selectModels")) + '</label><div class="check-list">' + modelRows + '</div></div><div class="form-grid"><div class="field"><label>' + html(t("auditLanguage")) + '</label><input id="task-language" value="' + html(baseline.language) + '"></div><div class="field"><label>' + html(t("repeatCount")) + '</label><input id="task-run-count" type="number" min="1" max="10" value="' + html(baseline.runCountPerPrompt || 1) + '"></div><div class="field"><label>' + html(t("webSearch")) + '</label><select id="task-search-enabled"><option value="false"' + (!searchEnabled ? " selected" : "") + '>' + html(t("webSearchOff")) + '</option><option value="true"' + (searchEnabled ? " selected" : "") + '>' + html(t("webSearchOn")) + '</option></select></div></div><p class="field-help">' + html(t("taskSearchHelp")) + '</p></section>';
    }
    function taskEditorMarkup(summary) {
      const task = summary && summary.task;
      const schedule = task && task.schedule || { kind: "weekly", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", dayOfWeek: 1, hour: 9, minute: 0 };
      const activeBaselines = state.baselines.filter((item) => item.status === "active");
      const selectedBaseline = activeBaselines.find((item) => item.id === (task && task.baselineId)) || activeBaselines[0];
      const baselineOptions = activeBaselines.map((item) => '<option value="' + html(item.id) + '"' + (selectedBaseline && selectedBaseline.id === item.id ? " selected" : "") + '>' + html(t("baseline") + ' · ' + formatDate(item.createdAt)) + '</option>').join("");
      const condition = (name) => !task || (task.notifications && task.notifications.conditions || []).includes(name);
      const channel = (type) => task && task.notifications && (task.notifications.channels || []).find((item) => item.type === type);
      const channelRows = [["email", "Email"], ["webhook", "Webhook"], ["slack", "Slack"], ["discord", "Discord"], ["wecom", "WeCom"], ["lark", "Lark"]].map((item) => {
        const saved = channel(item[0]);
        return '<div class="notification-channel-row"><label><input type="checkbox" data-notification-channel-enabled="' + item[0] + '"' + (saved && saved.enabled ? " checked" : "") + '> ' + html(item[1]) + '</label><input data-notification-channel-target="' + item[0] + '" data-channel-id="' + html(saved && saved.id || "") + '" value="' + html(saved && saved.target || "") + '" placeholder="' + html(t("notificationTarget")) + '"></div>';
      }).join("");
      return '<form id="monitoring-task-form" data-task-id="' + html(task && task.id || "") + '"><div class="form-grid"><div class="field full"><label>' + html(t("taskName")) + '</label><input id="task-name" value="' + html(task && task.name || "") + '" required></div><div class="field full"><label>' + html(t("baseline")) + '</label><select id="task-baseline"' + (task ? " disabled" : "") + '>' + baselineOptions + '</select><p class="field-help">' + html(t("baselineEditRule")) + '</p></div></div><div id="task-baseline-configuration">' + taskBaselineMarkup(selectedBaseline) + '</div><div class="form-grid"><div class="field"><label>' + html(t("schedule")) + '</label><select id="task-schedule-kind"><option value="daily"' + (schedule.kind === "daily" ? " selected" : "") + '>' + html(t("daily")) + '</option><option value="weekly"' + (schedule.kind === "weekly" ? " selected" : "") + '>' + html(t("weekly")) + '</option><option value="monthly"' + (schedule.kind === "monthly" ? " selected" : "") + '>' + html(t("monthly")) + '</option><option value="cron"' + (schedule.kind === "cron" ? " selected" : "") + '>' + html(t("customSchedule")) + '</option></select></div><div class="field"><label>' + html(t("timezone")) + '</label><input id="task-timezone" value="' + html(schedule.timezone) + '"></div><div class="field task-simple-field"><label>' + html(t("time")) + '</label><input id="task-time" type="time" value="' + html(String(schedule.hour == null ? 9 : schedule.hour).padStart(2, "0") + ':' + String(schedule.minute == null ? 0 : schedule.minute).padStart(2, "0")) + '"></div><div class="field task-weekly-field"><label>' + html(t("dayOfWeek")) + '</label><select id="task-day-of-week">' + [0, 1, 2, 3, 4, 5, 6].map((day) => { const date = new Date(Date.UTC(2026, 0, 4 + day)); const label = new Intl.DateTimeFormat("en", { weekday: "long", timeZone: "UTC" }).format(date); return '<option value="' + day + '"' + ((schedule.dayOfWeek == null ? 1 : schedule.dayOfWeek) === day ? " selected" : "") + '>' + html(label) + '</option>'; }).join("") + '</select></div><div class="field task-monthly-field"><label>' + html(t("dayOfMonth")) + '</label><input id="task-day-of-month" type="number" min="1" max="31" value="' + html(schedule.dayOfMonth || 1) + '"></div><div class="field full task-cron-field"><label>Cron</label><input id="task-cron" value="' + html(schedule.cron || "0 9 * * 1") + '"></div></div><section class="drawer-section"><h3>' + html(t("notificationConditions")) + '</h3><div class="check-grid">' + [["brand_disappeared", "brandMissingCondition"], ["competitor_appeared", "competitorCondition"], ["official_citation_added", "citationCondition"], ["recommendation_changed", "recommendationCondition"], ["run_completed", "completeCondition"], ["run_failed", "failureCondition"]].map((item) => '<label><input type="checkbox" data-notification-condition="' + item[0] + '"' + (condition(item[0]) ? " checked" : "") + '> ' + html(t(item[1])) + '</label>').join("") + '</div></section><section class="drawer-section"><h3>' + html(t("notificationChannels")) + '</h3><div class="notification-channel-list">' + channelRows + '</div><p class="field-help">' + html(t("noDeliveryConfigured")) + '</p></section><section class="drawer-section"><h3>' + html(t("nextOccurrences")) + '</h3><div id="schedule-preview" class="schedule-preview">—</div></section><div class="drawer-actions"><button class="button" type="button" id="monitoring-cancel">' + html(t("close")) + '</button><button class="button primary" type="submit">' + html(t("saveTask")) + '</button></div></form>';
    }
    function openMonitoringEditor(taskId) {
      const summary = (state.workbench.tasks || []).find((item) => item.task.id === taskId);
      $("detail-title").textContent = summary ? t("edit") : t("createMonitoring");
      $("detail-body").innerHTML = taskEditorMarkup(summary);
      motion.openSheet($("detail-sheet"));
      updateTaskEditorFields();
      previewTaskSchedule().catch(() => {});
    }
    function updateTaskEditorFields() {
      const kind = $("task-schedule-kind") && $("task-schedule-kind").value;
      document.querySelectorAll(".task-simple-field").forEach((item) => item.classList.toggle("hidden", kind === "cron"));
      document.querySelectorAll(".task-weekly-field").forEach((item) => item.classList.toggle("hidden", kind !== "weekly"));
      document.querySelectorAll(".task-monthly-field").forEach((item) => item.classList.toggle("hidden", kind !== "monthly"));
      document.querySelectorAll(".task-cron-field").forEach((item) => item.classList.toggle("hidden", kind !== "cron"));
    }
    function taskSchedulePayload() {
      const kind = $("task-schedule-kind").value;
      const schedule = { kind, timezone: $("task-timezone").value.trim() || "UTC" };
      if (kind === "cron") schedule.cron = $("task-cron").value.trim();
      else {
        const parts = $("task-time").value.split(":");
        schedule.hour = Number(parts[0] || 0);
        schedule.minute = Number(parts[1] || 0);
        if (kind === "weekly") schedule.dayOfWeek = Number($("task-day-of-week").value);
        if (kind === "monthly") schedule.dayOfMonth = Number($("task-day-of-month").value);
      }
      return schedule;
    }
    async function previewTaskSchedule() {
      if (!$("monitoring-task-form")) return;
      const requestId = state.schedulePreviewRequest + 1;
      state.schedulePreviewRequest = requestId;
      const preview = $("schedule-preview");
      preview.setAttribute("aria-busy", "true");
      preview.innerHTML = '<div class="inline-loading"><span></span>' + html(t("loading")) + '</div>';
      try {
        const result = await requestJson("/projects/" + encodeURIComponent(state.currentProjectId) + "/tasks/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ schedule: taskSchedulePayload(), count: 3 }) });
        if (requestId !== state.schedulePreviewRequest || !$("schedule-preview")) return;
        preview.innerHTML = result.occurrences.length ? result.occurrences.map((item) => '<div>' + html(formatDate(item)) + '</div>').join("") : '—';
      } catch (error) {
        if (requestId === state.schedulePreviewRequest && $("schedule-preview")) preview.innerHTML = '<div class="action-error" role="alert">' + html(error.message || String(error)) + '</div>';
      } finally {
        if (requestId === state.schedulePreviewRequest && $("schedule-preview")) preview.removeAttribute("aria-busy");
      }
    }

    function searchLabel(run) {
      const rows = state.observations.filter((item) => item.runId === run.id);
      if (!rows.some((item) => item.webSearchEnabled)) return t("searchNotUsed");
      if (rows.some((item) => item.search && item.search.used)) return t("searchNative");
      return t("webSearchOn");
    }
    function renderRuns() {
      const root = $("runs-body");
      state.latestRuns = state.runs;
      if (!state.project) { root.innerHTML = noProjectMarkup(); return; }
      const rows = [...state.runs].sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
      const baselineName = (id) => { const baseline = state.baselines.find((item) => item.id === id); return baseline ? t("baseline") + ' · ' + formatDate(baseline.createdAt) : t("baseline"); };
      root.innerHTML = rows.length ? '<div class="data-table-wrap"><table><thead><tr><th>' + html(t("time")) + '</th><th>' + html(t("baseline")) + '</th><th>' + html(t("planned")) + '</th><th>' + html(t("successful")) + '</th><th>' + html(t("failed")) + '</th><th>' + html(t("search")) + '</th><th>' + html(t("status")) + '</th><th>' + html(t("openSnapshot")) + '</th></tr></thead><tbody>' + rows.map((run) => '<tr><td><strong>' + html(formatDate(run.finishedAt || run.startedAt)) + '</strong></td><td>' + html(baselineName(run.baselineId)) + '</td><td>' + run.plannedObservationCount + '</td><td>' + run.completedObservationCount + '</td><td>' + run.failedObservationCount + '</td><td>' + html(searchLabel(run)) + '</td><td><span class="status ' + statusClass(run.status) + '">' + html(statusLabel(run.status)) + '</span></td><td>' + (run.auditRunId ? '<a class="row-link" href="/reports/' + encodeURIComponent(run.auditRunId) + '" target="_blank">' + html(t("openSnapshot")) + '</a>' : '—') + '</td></tr>').join("") + '</tbody></table></div>' : '<div class="empty-state">' + html(t("runRecords")) + '</div>';
    }

    function providerOptionLabel(provider) { return provider.label + " (" + (provider.keyConfigured ? t("configured") : t("missing")) + ")"; }
    function selectedProvider() { return state.providers.find((provider) => provider.id === $("provider").value); }
    function modelCatalog(providerId) { return state.modelCatalogs.find((catalog) => catalog.providerId === providerId); }
    function modelCapability(providerId, model) {
      const catalog = modelCatalog(providerId);
      return catalog && catalog.models.find((item) => item.model === model);
    }
    function capabilityBadge(capability) {
      const supported = Boolean(capability && capability.nativeWebSearchSupported);
      return '<span class="status ' + (supported ? "ok" : "error") + '" data-native-web-search="' + supported + '">' + html(supported ? t("nativeSearch") : t("noNativeSearch")) + '</span>';
    }
    function renderSelectedModelCapabilities() {
      const root = $("selected-model-capabilities");
      const provider = selectedProvider();
      if (!root || !provider) return;
      const models = splitInput($("models").value);
      root.innerHTML = models.map((model) => {
        const capability = modelCapability(provider.id, model);
        const supported = Boolean(capability && capability.nativeWebSearchSupported);
        return '<span class="model-capability-chip" data-supported="' + supported + '"><strong>' + html(model) + '</strong><span>' + html(supported ? t("nativeSearch") : t("noNativeSearch")) + '</span></span>';
      }).join("");
    }
    function providerModelRows(provider) {
      const catalog = modelCatalog(provider.id);
      if (!catalog || catalog.catalogStatus !== "available") {
        return '<p class="action-error" role="alert">' + html(t("modelCatalogUnavailable")) + '</p>';
      }
      const input = $("provider-model-search");
      const query = input ? input.value.trim().toLowerCase() : "";
      const models = catalog.models.filter((item) => !query || item.model.toLowerCase().includes(query) || item.name.toLowerCase().includes(query));
      const supportedCount = catalog.models.filter((item) => item.nativeWebSearchSupported).length;
      const rows = models.map((item) => '<div class="provider-model-row" data-provider-model="' + html(item.model) + '"><div><strong>' + html(item.name) + '</strong><small>' + html(item.model) + '</small></div>' + capabilityBadge(item) + '</div>').join("");
      return '<details class="provider-models"><summary>' + html(t("showAllModels")) + ' · ' + html(t("modelCount", { count: catalog.models.length })) + ' · ' + html(t("nativeSearchModelCount", { count: supportedCount })) + '</summary><div class="provider-model-list">' + rows + '</div></details>';
    }
    function renderProviders() {
      const root = $("provider-list");
      if (!root) return;
      root.innerHTML = state.providers.map((provider) => '<article class="provider-row"><div class="provider-head"><div><strong>' + html(provider.label) + '</strong><p>' + html(provider.envKeys.join(", ")) + '</p></div><div><span class="status ' + (provider.keyConfigured ? "ok" : "error") + '">' + html(provider.keyConfigured ? t("configured") : t("missing")) + '</span></div></div>' + providerModelRows(provider) + '</article>').join("");
      const currentProvider = $("provider").value;
      $("provider").innerHTML = state.providers.map((provider) => '<option value="' + html(provider.id) + '">' + html(providerOptionLabel(provider)) + '</option>').join("");
      if (state.providers.some((provider) => provider.id === currentProvider)) $("provider").value = currentProvider;
      else if (state.providers.some((provider) => provider.id === "openrouter")) $("provider").value = "openrouter";
      renderSelectedModelCapabilities();
      syncRunButton();
    }
    async function loadProviders() {
      state.providers = await requestJson("/providers");
      try {
        state.modelCatalogs = await requestJson("/provider-models");
        state.modelCatalogError = "";
      } catch (error) {
        state.modelCatalogs = [];
        state.modelCatalogError = error instanceof Error ? error.message : String(error);
      }
      renderProviders();
      $("health").className = "status ok";
      $("health").textContent = t("serverOnline");
    }

    function renderSettings() {
      const root = $("settings-body");
      if (!state.project) { root.innerHTML = noProjectMarkup(); return; }
      root.innerHTML = '<section class="section"><div class="section-head"><div><h2>' + html(t("projectSettings")) + '</h2><p>' + html(t("projectSettingsHelp")) + '</p></div></div><div class="data-table-wrap"><table><tbody><tr><th>' + html(t("brand")) + '</th><td><strong>' + html(state.project.name) + '</strong></td></tr><tr><th>' + html(t("officialSite")) + '</th><td>' + html(state.project.domain) + '</td></tr><tr><th>' + html(t("aliases")) + '</th><td>' + html(state.project.aliases.join(", ") || "—") + '</td></tr><tr><th>' + html(t("competitorsNav")) + '</th><td>' + html(state.project.competitors.map((item) => item.name + " · " + item.domain).join(", ") || "—") + '</td></tr><tr><th>' + html(t("language")) + '</th><td>' + html(state.project.defaultLanguage) + '</td></tr><tr><th>' + html(t("projectStatus")) + '</th><td><span class="status ok">' + html(state.project.status === "active" ? t("active") : t("pause")) + '</span></td></tr></tbody></table></div></section>';
    }

    function trendEvidenceObservation(observationId, actionLabel) {
      const observation = state.observations.find((item) => item.id === observationId);
      if (!observation) return "";
      return '<li><span><strong>' + html(observation.promptText) + '</strong><small>' + html(modelLabel(observation.model) + ' · ' + observation.sourceLabel) + '</small></span><button class="button text" type="button" data-observation-id="' + html(observation.id) + '">' + html(actionLabel) + '</button></li>';
    }
    function trendEvidencePair(pair) {
      const current = state.observations.find((item) => item.id === pair.currentObservationId);
      const previous = state.observations.find((item) => item.id === pair.previousObservationId);
      if (!current || !previous) return "";
      return '<li><span><strong>' + html(current.promptText) + '</strong><small>' + html(modelLabel(current.model) + ' · ' + current.sourceLabel) + '</small></span><span class="trend-answer-actions"><button class="button text" type="button" data-observation-id="' + html(previous.id) + '">' + html(t("previousAnswer")) + '</button><button class="button text" type="button" data-observation-id="' + html(current.id) + '">' + html(t("currentAnswer")) + '</button></span></li>';
    }
    function trendEvidenceSection(title, rows) {
      const content = rows.filter(Boolean);
      return '<section class="trend-evidence-group"><h3>' + html(title) + ' <span>' + content.length + '</span></h3>' + (content.length ? '<ul>' + content.join("") + '</ul>' : '<p>' + html(t("noEvidenceRows")) + '</p>') + '</section>';
    }
    function openTrendPoint(metricId, runId) {
      const series = (state.workbench && state.workbench.series || []).find((item) => item.metricId === metricId);
      const point = series && series.points.find((item) => item.runId === runId);
      if (!series || !point) return;
      const previous = point.previousComparableRunId && series.points.find((item) => item.runId === point.previousComparableRunId);
      const evidence = point.evidenceChange;
      $("detail-title").textContent = metricLabel(metricId) + ' · ' + formatDate(point.observedAt);
      if (!previous || !evidence || !evidence.comparable) {
        const rows = point.result.observationIds.map((id) => trendEvidenceObservation(id, t("currentAnswer")));
        $("detail-body").innerHTML = '<div class="trend-point-summary"><strong>' + point.result.numerator + ' / ' + point.result.denominator + '</strong><p>' + html(t("firstPointEvidence")) + '</p></div>' + trendEvidenceSection(t("matchingAnswers"), rows);
        motion.openSheet($("detail-sheet"));
        return;
      }
      const added = evidence.addedCurrentObservationIds.length;
      const removed = evidence.removedPreviousObservationIds.length;
      const net = added - removed;
      const netKey = net > 0 ? "netChangePositive" : net < 0 ? "netChangeNegative" : "netChangeZero";
      const netValues = { added, removed, net: Math.abs(net) };
      $("detail-body").innerHTML = '<div class="trend-point-summary"><strong>' + point.result.numerator + ' / ' + point.result.denominator + '</strong><p>' + html(t("trendPointReason", { from: previous.result.numerator, to: point.result.numerator })) + '</p><b class="' + (net > 0 ? "positive" : net < 0 ? "negative" : "neutral") + '">' + html(t(netKey, netValues)) + '</b></div>' +
        trendEvidenceSection(t("newlyMatched"), evidence.addedCurrentObservationIds.map((id) => trendEvidenceObservation(id, t("currentAnswer")))) +
        trendEvidenceSection(t("persistentlyMatched"), evidence.persistedObservationPairs.map(trendEvidencePair)) +
        trendEvidenceSection(t("removedMatched"), evidence.removedPreviousObservationIds.map((id) => trendEvidenceObservation(id, t("previousAnswer"))));
      motion.openSheet($("detail-sheet"));
    }

    function openDetail(ids, title) {
      const observations = ids.map((id) => state.observations.find((item) => item.id === id)).filter(Boolean);
      if (!observations.length) return;
      state.detailObservationIds = ids;
      $("detail-title").textContent = title || t("openEvidence");
      $("detail-body").innerHTML = observations.map((item) => '<section class="section"><div class="section-head"><div><h2>' + html(item.promptText) + '</h2><p>' + html(item.sourceLabel + " · " + modelLabel(item.model)) + '</p></div><span class="status ' + statusClass(item.status) + '">' + html(statusLabel(item.status)) + '</span></div><div class="data-table-wrap"><table><tbody><tr><th>' + html(t("result")) + '</th><td>' + html(item.evidence.targetMentioned ? t("mentioned") : t("absent")) + '</td></tr><tr><th>' + html(t("search")) + '</th><td>' + html(item.search && item.search.used ? t("searchNative") : t("searchNotUsed")) + '</td></tr><tr><th>' + html(t("competitorsNav")) + '</th><td>' + html(item.evidence.mentionedCompetitors.join(", ") || "—") + '</td></tr></tbody></table></div><div class="section-head" style="margin-top:18px"><div><h2>' + html(t("actualAnswer")) + '</h2></div></div><div class="answer-text">' + html(item.answerText || item.error || t("noAnswer")) + '</div><div class="section-head" style="margin-top:18px"><div><h2>' + html(t("citedLinks")) + '</h2></div></div>' + ((item.citations || []).length ? '<div class="data-table-wrap"><table><tbody>' + item.citations.map((citation) => '<tr><td><a class="row-link" href="' + html(citation.url) + '" target="_blank" rel="noreferrer">' + html(citation.title || citation.domain || citation.url) + '</a></td></tr>').join("") + '</tbody></table></div>' : '<p class="filter-note">' + html(t("noCitations")) + '</p>') + '</section>').join("");
      motion.openSheet($("detail-sheet"));
    }
    function closeDetail() { motion.closeSheet($("detail-sheet")); }

    function openWizard() {
      state.wizardStep = 1;
      state.wizardReview = false;
      state.auditPlan = null;
      $("confirm-plan").classList.add("hidden");
      $("drawer-backdrop").classList.add("open");
      $("wizard").classList.add("open");
      $("domain").focus();
      updateWizard();
    }
    function closeWizard() {
      $("drawer-backdrop").classList.remove("open");
      $("wizard").classList.remove("open");
    }
    function updateWizard() {
      document.querySelectorAll(".wizard-panel").forEach((panel) => panel.classList.toggle("active", Number(panel.getAttribute("data-step-panel")) === state.wizardStep && !state.wizardReview));
      document.querySelectorAll(".wizard-step").forEach((step) => {
        const number = Number(step.getAttribute("data-step"));
        step.classList.toggle("active", number === state.wizardStep && !state.wizardReview);
        step.classList.toggle("done", number < state.wizardStep || state.wizardReview);
      });
      $("confirm-plan").classList.toggle("hidden", !state.wizardReview);
      $("wizard-back").disabled = state.wizardStep === 1 && !state.wizardReview;
      $("wizard-next").textContent = state.wizardStep === 5 ? t("identifyAndReview") : t("next");
      $("wizard-next").classList.toggle("hidden", state.wizardReview);
      updateProjectScheduleFields();
      updateEstimate();
    }
    function updateProjectScheduleFields() {
      const kind = $("scheduleKind") && $("scheduleKind").value;
      document.querySelectorAll(".project-schedule-field").forEach((item) => item.classList.toggle("hidden", kind === "manual"));
      document.querySelectorAll(".project-schedule-simple").forEach((item) => item.classList.toggle("hidden", kind === "manual" || kind === "cron"));
      document.querySelectorAll(".project-schedule-weekly").forEach((item) => item.classList.toggle("hidden", kind !== "weekly"));
      document.querySelectorAll(".project-schedule-monthly").forEach((item) => item.classList.toggle("hidden", kind !== "monthly"));
      document.querySelectorAll(".project-schedule-cron").forEach((item) => item.classList.toggle("hidden", kind !== "cron"));
      const weekday = $("projectScheduleDayOfWeek");
      if (weekday && !weekday.getAttribute("data-localized")) {
        [...weekday.options].forEach((option) => {
          const day = Number(option.value);
          const date = new Date(Date.UTC(2026, 0, 4 + day));
          option.textContent = new Intl.DateTimeFormat("en", { weekday: "long", timeZone: "UTC" }).format(date);
        });
        weekday.setAttribute("data-localized", "en");
      } else if (weekday && weekday.getAttribute("data-localized") !== "en") {
        weekday.removeAttribute("data-localized");
        updateProjectScheduleFields();
      }
    }
    function updateEstimate() {
      const promptCount = Math.max(1, Number($("promptCount").value || 1));
      const models = splitInput($("models").value);
      const repeats = Math.max(1, Number($("repeatCount").value || 1));
      const requests = promptCount * Math.max(models.length, 1) * repeats;
      const kind = $("scheduleKind").value;
      const multiplier = kind === "daily" ? 30 : kind === "weekly" ? 4 : kind === "monthly" ? 1 : 0;
      $("request-estimate").textContent = t("requestEstimate") + ": " + requests + " " + t("perRun") + " · " + t("perMonth", { count: requests * multiplier });
    }
    function projectSchedulePayload() {
      const kind = $("scheduleKind").value;
      const timezone = $("projectScheduleTimezone").value.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      if (kind === "manual") return { kind: "manual", timezone };
      if (kind === "cron") return { kind, timezone, cron: $("projectScheduleCron").value.trim() };
      const parts = $("projectScheduleTime").value.split(":");
      const schedule = { kind, timezone, hour: Number(parts[0] || 0), minute: Number(parts[1] || 0) };
      if (kind === "weekly") schedule.dayOfWeek = Number($("projectScheduleDayOfWeek").value);
      if (kind === "monthly") schedule.dayOfMonth = Number($("projectScheduleDayOfMonth").value);
      return schedule;
    }
    function formPayload() {
      return {
        domain: $("domain").value.trim(),
        keywords: $("keywords").value,
        competitors: $("competitors").value,
        githubRepo: $("githubRepo").value.trim(),
        provider: $("provider").value,
        models: splitInput($("models").value),
        promptCount: Number($("promptCount").value),
        keywordMode: $("keywordMode").value,
        keywordLimit: Number($("keywordLimit").value),
        promptsPerKeyword: Number($("promptsPerKeyword").value),
        webSearchEnabled: $("webSearchEnabled").value === "true",
        webSearchMode: "provider_native",
        maxTokens: Number($("maxTokens").value),
        language: "en",
        autoDiscover: $("autoDiscover").value === "true"
      };
    }
    function categoryLabel(category) {
      if (category === "brand_awareness") return t("brandAwareness");
      if (category === "organic_discovery") return t("organicDiscovery");
      if (category === "comparison") return t("comparison");
      return t("other");
    }
    function planCounts(plan) {
      const enabled = plan.prompts.filter((prompt) => prompt.enabled);
      const countFor = (category) => enabled.filter((prompt) => (prompt.auditCategory || "other") === category).length;
      return { enabled: enabled.length, disabled: plan.prompts.length - enabled.length, brand: countFor("brand_awareness"), organic: countFor("organic_discovery"), comparison: countFor("comparison"), other: countFor("other"), requests: enabled.length * plan.providerTargets.length * (plan.runCountPerPrompt || 1) };
    }
    function refreshPlanEstimate() {
      if (!state.auditPlan) return;
      const counts = planCounts(state.auditPlan);
      state.auditPlan.estimate = { enabledPromptCount: counts.enabled, disabledPromptCount: counts.disabled, providerTargetCount: state.auditPlan.providerTargets.length, providerRunCount: counts.requests };
    }
    function renderCategoryOptions(selected) {
      return ["brand_awareness", "organic_discovery", "comparison", "other"].map((category) => '<option value="' + category + '"' + (category === selected ? " selected" : "") + '>' + html(categoryLabel(category)) + '</option>').join("");
    }
    function renderPromptRows(plan, category) {
      const rows = plan.prompts.map((prompt, index) => ({ prompt, index })).filter((row) => (row.prompt.auditCategory || "other") === category);
      return rows.map((row) => '<div class="prompt-row"><input type="checkbox" data-prompt-enabled="' + row.index + '"' + (row.prompt.enabled ? " checked" : "") + ' aria-label="' + html(t("enabled")) + '"><textarea data-prompt-text="' + row.index + '">' + html(row.prompt.text) + '</textarea><select data-prompt-category="' + row.index + '">' + renderCategoryOptions(row.prompt.auditCategory || "other") + '</select><button class="button text danger" type="button" data-delete-prompt="' + row.index + '">' + html(t("delete")) + '</button></div>').join("");
    }
    function renderPromptGroup(plan, category, titleKey, helpKey) {
      return '<section class="prompt-group"><h3>' + html(t(titleKey)) + '</h3><p>' + html(t(helpKey)) + '</p>' + renderPromptRows(plan, category) + '</section>';
    }
    function renderPlanCompetitors(plan) {
      if (!plan.competitors.length) return '<p class="filter-note">' + html(t("noCompetitors")) + '</p>';
      return '<div class="chip-list">' + plan.competitors.map((competitor, index) => '<span class="chip">' + html(competitor.name || competitor.domain) + '<button type="button" data-remove-competitor="' + index + '">×</button></span>').join("") + '</div>';
    }
    function renderPlanSummary(plan) {
      const counts = planCounts(plan);
      return '<aside class="plan-summary"><h3>' + html(t("plannedRunSummary")) + '</h3><div class="summary-list"><div><span>' + html(t("enabledPrompts")) + '</span><strong>' + counts.enabled + '</strong></div><div><span>' + html(t("brandAwareness")) + '</span><strong>' + counts.brand + '</strong></div><div><span>' + html(t("organicDiscovery")) + '</span><strong>' + counts.organic + '</strong></div><div><span>' + html(t("comparison")) + '</span><strong>' + counts.comparison + '</strong></div><div><span>' + html(t("providerRuns")) + '</span><strong>' + counts.requests + '</strong></div><div><span>' + html(t("providerModels")) + '</span><strong>' + html(plan.providerTargets.map((item) => item.providerId + " · " + modelLabel(item.model)).join(", ")) + '</strong></div><div><span>' + html(t("search")) + '</span><strong>' + html(plan.providerTargets.some((item) => item.webSearchEnabled) ? t("webSearchOn") : t("webSearchOff")) + '</strong></div></div>' + (state.planSemanticsDirty ? '<p class="field-help">' + html(t("pendingQuestionAnalysis")) + '</p>' : '') + '<button id="confirm-run-button" class="button primary" type="button" style="width:100%;margin-top:14px">' + html(state.planSemanticsDirty ? t("analyzeQuestionChanges") : t("confirmAndRun")) + '</button></aside>';
    }
    function renderPlan(plan, scrollToPlan) {
      state.auditPlan = plan;
      refreshPlanEstimate();
      state.wizardReview = true;
      $("confirm-plan").classList.remove("hidden");
      $("plan-body").innerHTML = '<div class="plan-layout"><div><section class="plan-target"><h3>' + html(t("auditTarget")) + '</h3><div class="summary-list"><div><span>' + html(t("brand")) + '</span><strong>' + html(plan.target.name) + '</strong></div><div><span>' + html(t("aliases")) + '</span><strong>' + html((plan.target.aliases || []).join(", ") || "—") + '</strong></div><div><span>' + html(t("officialSite")) + '</span><strong>' + html(plan.target.domain) + '</strong></div></div><h3 style="margin-top:16px">' + html(t("identifiedCompetitors")) + '</h3>' + renderPlanCompetitors(plan) + '<div class="inline-add"><input id="new-competitor" placeholder="' + html(t("competitorDomain")) + '"><button type="button" class="button" id="add-competitor">' + html(t("addCompetitor")) + '</button></div></section><div class="prompt-groups">' + renderPromptGroup(plan, "brand_awareness", "brandAwarenessQuestions", "brandAwarenessHelp") + renderPromptGroup(plan, "organic_discovery", "organicDiscoveryQuestions", "organicDiscoveryHelp") + renderPromptGroup(plan, "comparison", "comparisonQuestions", "comparisonHelp") + renderPromptGroup(plan, "other", "otherQuestions", "comparisonHelp") + '</div><div class="prompt-add"><input id="new-prompt-text" placeholder="' + html(t("newPromptPlaceholder")) + '"><button type="button" class="button" id="add-prompt">' + html(t("addPrompt")) + '</button></div></div>' + renderPlanSummary(plan) + '</div>';
      updateWizard();
      syncRunButton();
      if (scrollToPlan) $("plan-body").scrollIntoView({ block: "start" });
    }
    function markPlanEdited() {
      if (!state.auditPlan) return;
      state.auditPlan.promptSetId = "client-edited";
      state.auditPlan.promptSetHash = "client-edited";
      refreshPlanEstimate();
    }
    function markQuestionTextEdited() {
      state.planSemanticsDirty = true;
      markPlanEdited();
    }
    function planPayloadForRun() { refreshPlanEstimate(); return state.auditPlan; }
    function syncRunButton() {
      const provider = selectedProvider();
      const searchEnabled = $("webSearchEnabled") && $("webSearchEnabled").value === "true";
      const unsupportedSearch = Boolean(provider && searchEnabled && splitInput($("models").value).some((model) => {
        const capability = modelCapability(provider.id, model);
        return !capability || !capability.nativeWebSearchSupported;
      }));
      const runButton = $("run-button");
      if (runButton) runButton.disabled = !provider || !provider.keyConfigured || unsupportedSearch;
      const confirmButton = $("confirm-run-button");
      if (confirmButton) confirmButton.disabled = !state.auditPlan || state.auditPlan.prompts.filter((prompt) => prompt.enabled).length === 0;
      if (unsupportedSearch && $("run-status")) {
        $("run-status").className = "status error";
        $("run-status").textContent = t("selectedModelSearchUnsupported");
      }
    }
    function renderResult(payload) {
      state.latestResult = payload;
      $("result-body").innerHTML = '<div class="event-list"><div class="event-item"><span class="event-marker positive"></span><strong>' + html(t("runFinished")) + '</strong></div><div class="event-item"><strong>' + html(payload.projectId || "") + '</strong></div></div>';
    }
    async function buildAuditPlan() {
      const provider = selectedProvider();
      if (!provider || !provider.keyConfigured) throw new Error(t("missing"));
      $("run-status").className = "status info";
      $("run-status").textContent = t("identifyingQuestions");
      const body = await requestJson("/audit-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formPayload()) });
      body.plan.runCountPerPrompt = Math.max(1, Number($("repeatCount").value || 1));
      state.planSemanticsDirty = false;
      renderPlan(body.plan, true);
      $("run-status").className = "status ok";
      $("run-status").textContent = t("planReady");
    }
    async function reclassifyEditedQuestions() {
      $("run-status").className = "status info";
      $("run-status").textContent = t("analyzingQuestionChanges");
      const body = await requestJson("/audit-plan/reclassify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmedPlan: planPayloadForRun() }) });
      state.planSemanticsDirty = false;
      renderPlan(body.plan, true);
      $("run-status").className = "status ok";
      $("run-status").textContent = t("questionChangesReady");
    }
    async function runConfirmedPlan() {
      if (state.planSemanticsDirty) {
        const reclassifyButton = $("confirm-run-button");
        await motion.run(
          reclassifyButton,
          { loading: t("analyzingQuestionChanges"), stage: t("analyzingQuestionChanges"), success: t("questionChangesReady"), error: t("retryAction") },
          reclassifyEditedQuestions,
        );
        return;
      }
      const button = $("confirm-run-button");
      $("run-status").className = "status info";
      $("run-status").textContent = t("runningProviderCalls");
      const result = await motion.runAuditJob(
        button,
        () => requestJson("/audit-jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmedPlan: planPayloadForRun(), maxTokens: Number($("maxTokens").value), temperature: 0 }) }),
        async (body) => {
          renderResult(body);
          const scheduleKind = $("scheduleKind").value;
          if (scheduleKind !== "manual") {
            const schedule = projectSchedulePayload();
            const taskName = (state.auditPlan && state.auditPlan.target && state.auditPlan.target.name || t("monitoring")) + " · " + scheduleLabel(schedule);
            await requestJson("/projects/" + encodeURIComponent(body.projectId) + "/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: taskName, baselineId: body.baselineId, schedule, enabled: true }) });
          }
          await loadProjects(body.projectId);
        },
      );
      if (result.ok) {
        $("run-status").className = "status ok";
        $("run-status").textContent = t("runFinished");
        closeWizard();
        if (state.view !== "overview") showView("overview");
      } else {
        $("run-status").className = "status error";
        $("run-status").textContent = t("failed");
        syncRunButton();
      }
    }

    async function runSavedAuditJob(button, path) {
      return motion.runAuditJob(
        button,
        () => requestJson(path, { method: "POST" }),
        async () => selectProject(state.currentProjectId),
      );
    }

    document.addEventListener("click", async (event) => {
      const target = event.target.closest ? event.target.closest("[data-trend-run-id], [data-evidence-ids], button, a, #drawer-backdrop, #detail-backdrop") : null;
      if (!target) return;
      const view = target.getAttribute("data-view") || target.getAttribute("data-view-jump");
      if (view) { event.preventDefault(); showView(view); return; }
      if (target.hasAttribute("data-open-wizard")) { openWizard(); return; }
      if (target.id === "wizard-close" || target.id === "drawer-backdrop") { closeWizard(); return; }
      if (target.id === "detail-close" || target.id === "detail-backdrop") { closeDetail(); return; }
      if (target.hasAttribute("data-close-progress")) { $("audit-progress").classList.add("hidden"); return; }
      if (target.getAttribute("data-step")) {
        state.wizardStep = Number(target.getAttribute("data-step"));
        state.wizardReview = false;
        updateWizard();
        return;
      }
      const trendMode = target.getAttribute("data-trend-mode");
      if (trendMode) { motion.beginChartUpdate(); state.trendMode = trendMode; renderVisibility(); return; }
      if (target.hasAttribute("data-metric-filter")) { state.promptFilter = target.getAttribute("data-metric-filter") || "all"; showView("prompts"); return; }
      if (target.hasAttribute("data-clear-prompt-filter")) { state.promptFilter = "all"; renderPrompts(); return; }
      const trendRunId = target.getAttribute("data-trend-run-id");
      const trendMetricId = target.getAttribute("data-trend-metric-id");
      if (trendRunId && trendMetricId) { motion.pulsePoint(target); openTrendPoint(trendMetricId, trendRunId); return; }
      const evidenceIds = target.getAttribute("data-evidence-ids");
      if (evidenceIds) { openDetail(evidenceIds.split(",").filter(Boolean), t("openEvidence")); return; }
      const observationId = target.getAttribute("data-observation-id");
      if (observationId) { openDetail([observationId], t("openEvidence")); return; }
      const sourceUrl = target.getAttribute("data-source-url");
      if (sourceUrl) {
        const visible = new Set(state.workbench && state.workbench.observationIds || []);
        const ids = state.observations.filter((item) => visible.has(item.id) && (item.citations || []).some((citation) => citation.url === sourceUrl)).map((item) => item.id);
        openDetail(ids, sourceUrl);
        return;
      }
      const entityName = target.getAttribute("data-entity-name");
      if (entityName) {
        const visible = new Set(state.workbench && state.workbench.observationIds || []);
        const ids = state.observations.filter((item) => visible.has(item.id) && (item.evidence.mentionedCompetitors.includes(entityName) || (item.intentAnalysis && item.intentAnalysis.entities || []).some((entity) => entity.name === entityName))).map((item) => item.id);
        openDetail(ids, entityName);
        return;
      }
      const baselineId = target.getAttribute("data-run-baseline");
      if (baselineId) {
        await runSavedAuditJob(target, "/projects/" + encodeURIComponent(state.currentProjectId) + "/baselines/" + encodeURIComponent(baselineId) + "/run-job");
        return;
      }
      const reanalyzeRunId = target.getAttribute("data-reanalyze-run");
      if (reanalyzeRunId) {
        await motion.run(
          target,
          { loading: t("analysisRunning"), stage: t("analysisRunning"), success: t("completed"), error: t("retryAction") },
          async () => {
            await requestJson("/projects/" + encodeURIComponent(state.currentProjectId) + "/runs/" + encodeURIComponent(reanalyzeRunId) + "/reanalyze", { method: "POST" });
            await selectProject(state.currentProjectId);
          },
        );
        return;
      }
      const classifyBaselineId = target.getAttribute("data-classify-baseline");
      if (classifyBaselineId) {
        await motion.run(
          target,
          { loading: t("classifyingBaselineIntents"), stage: t("classifyingBaselineIntents"), success: t("completed"), error: t("retryAction") },
          async () => {
            await requestJson("/projects/" + encodeURIComponent(state.currentProjectId) + "/baselines/" + encodeURIComponent(classifyBaselineId) + "/classify-intents", { method: "POST" });
            await selectProject(state.currentProjectId);
          },
        );
        return;
      }
      const taskId = target.getAttribute("data-run-task");
      if (taskId) {
        await runSavedAuditJob(target, "/projects/" + encodeURIComponent(state.currentProjectId) + "/tasks/" + encodeURIComponent(taskId) + "/run-job");
        return;
      }
      if (target.hasAttribute("data-create-monitoring")) { openMonitoringEditor(); return; }
      const editTaskId = target.getAttribute("data-edit-task");
      if (editTaskId) { openMonitoringEditor(editTaskId); return; }
      const toggleTaskId = target.getAttribute("data-toggle-task");
      if (toggleTaskId) {
        const enabled = target.getAttribute("data-task-enabled") !== "true";
        await motion.runToggle(
          target,
          enabled,
          async () => {
            await requestJson("/projects/" + encodeURIComponent(state.currentProjectId) + "/tasks/" + encodeURIComponent(toggleTaskId), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) });
            await selectProject(state.currentProjectId);
          },
        );
        return;
      }
      const duplicateTaskId = target.getAttribute("data-duplicate-task");
      if (duplicateTaskId) {
        await motion.run(
          target,
          { loading: t("loading"), stage: t("saving"), success: t("saved"), error: t("retryAction") },
          async () => {
            await requestJson("/projects/" + encodeURIComponent(state.currentProjectId) + "/tasks/" + encodeURIComponent(duplicateTaskId) + "/duplicate", { method: "POST" });
            await selectProject(state.currentProjectId);
          },
        );
        return;
      }
      const deleteTaskId = target.getAttribute("data-delete-task");
      if (deleteTaskId) {
        if (!window.confirm(t("confirmDeleteTask"))) return;
        await motion.run(
          target,
          { loading: t("deleting"), stage: t("deleting"), success: t("deleted"), error: t("retryAction") },
          async () => {
            await requestJson("/projects/" + encodeURIComponent(state.currentProjectId) + "/tasks/" + encodeURIComponent(deleteTaskId), { method: "DELETE" });
            await selectProject(state.currentProjectId);
          },
        );
        return;
      }
      if (target.id === "monitoring-cancel") { closeDetail(); return; }
      if (target.id === "import-runs") {
        await motion.run(
          target,
          { loading: t("loading"), stage: t("saving"), success: t("saved"), error: t("retryAction") },
          async () => { await requestJson("/projects/import-runs", { method: "POST" }); await loadProjects(); },
        );
        return;
      }
      if (target.id === "reload-runs") {
        await motion.run(
          target,
          { loading: t("loading"), stage: t("loading"), success: t("completed"), error: t("retryAction") },
          () => selectProject(state.currentProjectId),
        );
        return;
      }
      if (target.id === "wizard-back") {
        if (state.wizardReview) { state.wizardReview = false; state.wizardStep = 5; }
        else state.wizardStep = Math.max(1, state.wizardStep - 1);
        updateWizard();
        return;
      }
      if (target.id === "wizard-next") {
        if (state.wizardStep < 5) { state.wizardStep += 1; updateWizard(); return; }
        const result = await motion.run(
          target,
          { loading: t("identifyingQuestions"), stage: t("identifyingQuestions"), success: t("planReady"), error: t("retryAction") },
          buildAuditPlan,
        );
        if (!result.ok) { $("run-status").className = "status error"; $("run-status").textContent = result.error && result.error.message || t("failed"); }
        return;
      }
      if (!state.auditPlan) return;
      if (target.getAttribute("data-delete-prompt") != null) {
        state.auditPlan.prompts.splice(Number(target.getAttribute("data-delete-prompt")), 1); markPlanEdited(); renderPlan(state.auditPlan, false); return;
      }
      if (target.getAttribute("data-remove-competitor") != null) {
        state.auditPlan.competitors.splice(Number(target.getAttribute("data-remove-competitor")), 1); markPlanEdited(); renderPlan(state.auditPlan, false); return;
      }
      if (target.id === "add-competitor") {
        const input = $("new-competitor");
        const domain = domainFromInput(input.value);
        if (!domain) return;
        state.auditPlan.competitors.push({ id: "competitor-" + safeSlug(domain), type: "competitor", name: nameFromDomain(domain), domain, aliases: [] });
        input.value = ""; markPlanEdited(); renderPlan(state.auditPlan, false); return;
      }
      if (target.id === "add-prompt") {
        const text = $("new-prompt-text").value.trim();
        if (!text) return;
        state.auditPlan.prompts.push({ id: "manual-" + Date.now(), type: "category", topic: "pending-provider-analysis", language: state.auditPlan.language || "en", text, enabled: true, auditCategory: "other", targetIncluded: false });
        markQuestionTextEdited(); renderPlan(state.auditPlan, false); return;
      }
      if (target.id === "confirm-run-button") { await runConfirmedPlan(); }
    });

    document.addEventListener("input", (event) => {
      const target = event.target;
      if (target.id === "provider-model-search") { renderProviders(); return; }
      if (["promptCount", "models", "repeatCount", "scheduleKind"].includes(target.id)) {
        if (target.id === "scheduleKind") updateProjectScheduleFields();
        if (target.id === "models") { renderSelectedModelCapabilities(); syncRunButton(); }
        updateEstimate();
      }
      if (["task-time", "task-timezone", "task-day-of-week", "task-day-of-month", "task-cron"].includes(target.id)) previewTaskSchedule().catch(() => {});
      if (!state.auditPlan || !target.getAttribute) return;
      if (target.getAttribute("data-prompt-text") != null) {
        const prompt = state.auditPlan.prompts[Number(target.getAttribute("data-prompt-text"))];
        if (!prompt) return;
        prompt.text = target.value;
        markQuestionTextEdited();
      }
    });

    document.addEventListener("keydown", (event) => {
      const target = event.target;
      if (event.key === "Escape") {
        if ($("detail-sheet").classList.contains("open")) closeDetail();
        else if ($("wizard").classList.contains("open")) closeWizard();
        return;
      }
      if (!target || !target.hasAttribute || !target.hasAttribute("data-trend-run-id")) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      target.click();
    });
    async function refreshProjectControl(control) {
      if (!control) return;
      control.disabled = true;
      control.setAttribute("aria-busy", "true");
      try {
        await selectProject(state.currentProjectId);
        $("global-error").classList.add("hidden");
      } catch (error) {
        showFatal(error);
      } finally {
        control.disabled = false;
        control.removeAttribute("aria-busy");
      }
    }

    document.addEventListener("change", async (event) => {
      const target = event.target;
      if (target.id === "project-select") { state.currentProjectId = target.value; await refreshProjectControl(target); return; }
      if (target.id === "model-filter") { state.model = target.value; await refreshProjectControl(target); return; }
      if (target.id === "search-filter") { state.searchUsed = target.value; await refreshProjectControl(target); return; }
      if (target.id === "task-schedule-kind") { updateTaskEditorFields(); previewTaskSchedule().catch(() => {}); return; }
      if (target.id === "task-baseline") {
        const baseline = state.baselines.find((item) => item.id === target.value);
        if ($("task-baseline-configuration")) $("task-baseline-configuration").innerHTML = taskBaselineMarkup(baseline);
        return;
      }
      if (target.id === "comparison-metric") { motion.beginChartUpdate(); state.comparisonMetric = target.value; renderVisibility(); return; }
      if (target.getAttribute("data-trend-metric")) {
        motion.beginChartUpdate();
        const metricId = target.getAttribute("data-trend-metric");
        if (target.checked) state.visibleMetrics.add(metricId); else state.visibleMetrics.delete(metricId);
        renderVisibility(); return;
      }
      if (target.id === "provider") {
        const provider = selectedProvider();
        if (provider && provider.id === "openrouter") $("models").value = "openai/gpt-4o-mini,perplexity/sonar";
        else if (provider) $("models").value = provider.defaultModels.slice(0, 2).join(",");
        renderSelectedModelCapabilities(); updateEstimate(); syncRunButton(); return;
      }
      if (target.id === "webSearchEnabled") { renderSelectedModelCapabilities(); syncRunButton(); return; }
      if (!state.auditPlan || !target.getAttribute) return;
      if (target.getAttribute("data-prompt-enabled") != null) {
        const prompt = state.auditPlan.prompts[Number(target.getAttribute("data-prompt-enabled"))];
        if (prompt) { prompt.enabled = Boolean(target.checked); markPlanEdited(); renderPlan(state.auditPlan, false); }
      }
      if (target.getAttribute("data-prompt-category") != null) {
        const prompt = state.auditPlan.prompts[Number(target.getAttribute("data-prompt-category"))];
        if (prompt) { prompt.auditCategory = target.value; markPlanEdited(); renderPlan(state.auditPlan, false); }
      }
    });
    document.querySelectorAll("[data-period]").forEach((button) => button.addEventListener("click", async () => {
      state.period = button.getAttribute("data-period");
      document.querySelectorAll("[data-period]").forEach((item) => item.classList.toggle("active", item === button));
      if (state.currentProjectId) await refreshProjectControl(button); else renderCurrentView();
    }));
    $("audit-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const result = await motion.run(
        $("run-button"),
        { loading: t("identifyingQuestions"), stage: t("identifyingQuestions"), success: t("planReady"), error: t("retryAction") },
        buildAuditPlan,
      );
      if (!result.ok) { $("run-status").className = "status error"; $("run-status").textContent = result.error && result.error.message || t("failed"); }
    });
    document.addEventListener("submit", async (event) => {
      if (event.target.id !== "monitoring-task-form") return;
      event.preventDefault();
      const form = event.target;
      const taskId = form.getAttribute("data-task-id");
      const conditions = [...form.querySelectorAll("[data-notification-condition]:checked")].map((item) => item.getAttribute("data-notification-condition"));
      const channels = [...form.querySelectorAll("[data-notification-channel-target]")].map((input) => {
        const type = input.getAttribute("data-notification-channel-target");
        const enabled = Boolean(form.querySelector('[data-notification-channel-enabled="' + type + '"]:checked'));
        const target = input.value.trim();
        return { id: input.getAttribute("data-channel-id") || "channel-" + type, type, target, enabled };
      }).filter((channel) => channel.enabled && channel.target);
      const webSearchEnabled = $("task-search-enabled").value === "true";
      const webSearchMode = "provider_native";
      const selectedPromptIds = [...form.querySelectorAll("[data-task-prompt-id]:checked")].map((item) => item.getAttribute("data-task-prompt-id")).filter(Boolean);
      const providerTargets = [...form.querySelectorAll("[data-task-provider-id]:checked")].map((item) => ({
        providerId: item.getAttribute("data-task-provider-id"),
        model: item.getAttribute("data-task-model"),
        webSearchEnabled,
        webSearchMode
      }));
      const configuration = {
        selectedPromptIds,
        providerTargets,
        language: $("task-language").value.trim(),
        runCountPerPrompt: Math.max(1, Number($("task-run-count").value || 1))
      };
      const payload = { name: $("task-name").value.trim(), schedule: taskSchedulePayload(), notifications: { conditions, channels }, configuration, enabled: true };
      const submitButton = form.querySelector('button[type="submit"]');
      await motion.run(submitButton, { loading: t("saving"), stage: t("saving"), success: t("saved"), error: t("retryAction") }, async () => {
        const path = "/projects/" + encodeURIComponent(state.currentProjectId) + "/tasks" + (taskId ? "/" + encodeURIComponent(taskId) : "");
        if (!taskId) payload.baselineId = $("task-baseline").value;
        await requestJson(path, { method: taskId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        await selectProject(state.currentProjectId);
        closeDetail();
      });
    });
    function showFatal(error) {
      $("global-error").classList.remove("hidden");
      $("global-error").textContent = error.message || String(error);
    }

    motion.bind();
    applyLocale();
    Promise.all([loadProviders(), loadProjects()]).catch(showFatal);
  </script>`;
}
