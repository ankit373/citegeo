import { PRODUCT_NAME, PRODUCT_TITLE, renderCiteGeoLockup } from "./brand.js";
import { WORKBENCH_CSS } from "./workbench-style.js";
import { renderWorkbenchScript } from "./workbench-script.js";

function navButton(index: string, view: string, key: string, active = false): string {
  return `<button class="nav-button${active ? " active" : ""}" type="button" data-view="${view}"><span class="nav-index">${index}</span><span data-i18n="${key}">${key}</span></button>`;
}

function wizardStep(step: number, key: string): string {
  return `<button class="wizard-step${step === 1 ? " active" : ""}" type="button" data-step="${step}"><span>0${step}</span><br><span data-i18n="${key}">${key}</span></button>`;
}

export function renderAppHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>${PRODUCT_TITLE}</title>
  <link rel="preconnect" href="https://api.fontshare.com">
  <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f%5B%5D=cabinet-grotesk@800,700&f%5B%5D=general-sans@400,500,600&display=swap">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap">
  <style>${WORKBENCH_CSS}</style>
</head>
<body>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        ${renderCiteGeoLockup("brand-lockup-image")}
      </div>

      <div class="project-switcher">
        <label for="project-select" data-i18n="project">Project</label>
        <select id="project-select" aria-label="Project"></select>
      </div>

      <nav class="nav-group" aria-label="Workspace">
        ${navButton("01", "overview", "overview", true)}
        ${navButton("02", "prompts", "prompts")}
        ${navButton("03", "visibility", "visibility")}
        ${navButton("04", "competitors", "competitorsNav")}
        ${navButton("05", "citations", "citations")}
        ${navButton("06", "monitoring", "monitoring")}
        ${navButton("07", "runs", "runRecords")}
      </nav>
      <div class="nav-separator"></div>
      <nav class="nav-group" aria-label="Configuration">
        ${navButton("08", "providers", "providersNav")}
        ${navButton("09", "settings", "settings")}
      </nav>

      <div class="sidebar-footer"><div class="health-line"><span>CiteGEO OSS</span><span id="health" class="status info">...</span></div></div>
    </aside>

    <div class="workspace">
      <header class="topbar">
        <div class="breadcrumb"><strong>${PRODUCT_NAME}</strong> &nbsp;/&nbsp; <span id="breadcrumb-project">Project</span></div>
        <div class="top-actions">
          <select id="model-filter" aria-label="Model filter"><option value="all">All models</option></select>
          <button class="button primary" type="button" data-open-wizard="true" data-i18n="newProject">New project</button>
        </div>
      </header>

      <main class="content">
        <div id="global-error" class="error-box hidden"></div>
        <aside id="audit-progress" class="audit-progress hidden" aria-live="polite" aria-label="Audit progress"></aside>
        <header class="page-head">
          <div class="page-title"><p class="eyebrow" data-i18n="workspaceSubtitle">Evidence from real provider observations</p><h1 id="page-title">Overview</h1></div>
          <div class="inline-actions"><button class="button" type="button" data-create-monitoring="true" data-i18n="setMonitoring">Set up scheduled monitoring</button><button id="import-runs" class="button" type="button" data-i18n="importRuns">Import saved runs</button></div>
        </header>

        <div class="toolbar">
          <div class="segmented" role="group" aria-label="Time range">
            <button class="segment" type="button" data-period="1d" data-i18n="last24Hours">24 Hour</button>
            <button class="segment" type="button" data-period="7d" data-i18n="last7Days">7 days</button>
            <button class="segment" type="button" data-period="30d" data-i18n="last30Days">30 days</button>
            <button class="segment" type="button" data-period="90d">90 days</button>
            <button class="segment active" type="button" data-period="all" data-i18n="allTime">All time</button>
          </div>
          <div class="inline-actions"><select id="search-filter" aria-label="Search filter"><option value="all" data-i18n="allSearch">All web search modes</option><option value="true" data-i18n="webSearchOn">On</option><option value="false" data-i18n="webSearchOff">Close</option></select><span class="status info" data-i18n="dataSourceShort" title="Provider API">Provider API</span></div>
        </div>

        <section class="view active" data-view-panel="overview"><div id="overview-body"></div><div id="result" class="section hidden"><div id="result-body"></div></div></section>
        <section class="view" data-view-panel="prompts"><div id="prompts-body"></div></section>
        <section class="view" data-view-panel="visibility"><div id="visibility-body"></div></section>
        <section class="view" data-view-panel="competitors"><div id="competitors-body"></div></section>
        <section class="view" data-view-panel="citations"><div id="citations-body"></div></section>
        <section class="view" data-view-panel="monitoring"><div id="monitoring-body"></div></section>
        <section class="view" data-view-panel="runs"><div class="section-head"><div><h2 data-i18n="runRecords">Run records</h2></div><button id="reload-runs" class="button" type="button" data-i18n="runRecords">Run records</button></div><div id="runs-body"></div></section>
        <section class="view" data-view-panel="providers">
          <div class="section-head"><div><h2 data-i18n="providerCatalog">Provider Catalog</h2><p data-i18n="providerCatalogHelp">Each key is used on its own. OpenRouter can route a single key to the many models it supports.</p></div></div>
          <div class="provider-model-toolbar"><label for="provider-model-search" data-i18n="searchModels">Search models</label><input id="provider-model-search" type="search" data-i18n-placeholder="searchModelsPlaceholder" placeholder="Enter a model name or ID"></div>
          <div id="providers"><div id="provider-list" class="provider-grid"></div></div>
        </section>
        <section class="view" data-view-panel="settings"><div id="settings-body"></div></section>
      </main>
    </div>
  </div>

  <div id="drawer-backdrop" class="drawer-backdrop"></div>
  <aside id="wizard" class="wizard" aria-label="Create monitoring project">
    <div class="wizard-head">
      <div><h2 data-i18n="wizardTitle">New monitoring project</h2><p data-i18n="wizardSubtitle">Every question can be reviewed and edited before any real provider request runs.</p></div>
      <button id="wizard-close" class="close-button" type="button" aria-label="Close">×</button>
    </div>
    <div class="wizard-steps">
      ${wizardStep(1, "stepDomain")}${wizardStep(2, "stepIdentity")}${wizardStep(3, "stepQuestions")}${wizardStep(4, "stepModels")}${wizardStep(5, "stepSchedule")}
    </div>

    <form id="audit-form" autocomplete="off">
      <div class="wizard-body" id="new-audit">
        <section class="wizard-panel active" data-step-panel="1">
          <h3 data-i18n="stepDomain">Domain</h3><p data-i18n="domainHelp">The site is used only to identify the brand and build questions. It never counts as AI visibility evidence.</p>
          <div class="form-grid">
            <div class="field full"><label for="domain" data-i18n="domainUrl">Domain or URL</label><input id="domain" name="domain" placeholder="example.com" required></div>
            <div class="field full"><label for="githubRepo" data-i18n="githubRepo">GitHub Repository</label><input id="githubRepo" name="githubRepo" placeholder="org/repo"><p class="field-help" data-i18n="githubRepoHelp">Optional. The README and topics help shape the monitoring questions.</p></div>
          </div>
        </section>

        <section class="wizard-panel" data-step-panel="2">
          <h3 data-i18n="stepIdentity">Brand</h3><p data-i18n="competitorsHelp">Optional, one per line. Detected results still need your confirmation.</p>
          <div class="form-grid">
            <div class="field full"><label for="competitors" data-i18n="competitorsInput">Competitor domains</label><textarea id="competitors" name="competitors" placeholder="competitor-a.com&#10;competitor-b.com"></textarea></div>
            <div class="field full"><label for="autoDiscover" data-i18n="discovery">Detection method</label><select id="autoDiscover" name="autoDiscover"><option value="true" data-i18n="autoDiscover">Identify brand, entities and questions</option><option value="false" data-i18n="domainOnly">Use my input only</option></select></div>
          </div>
        </section>

        <section class="wizard-panel" data-step-panel="3">
          <h3 data-i18n="stepQuestions">Questions</h3><p data-i18n="promptCountHelp">Generated questions can still be edited before the run.</p>
          <div class="form-grid">
            <div class="field full"><label for="keywords" data-i18n="keywords">Keywords</label><textarea id="keywords" name="keywords" placeholder="AI visibility&#10;brand monitoring"></textarea><p class="field-help" data-i18n="keywordsHelp">Keywords you enter take priority when building monitoring questions.</p></div>
            <div class="field"><label for="promptCount" data-i18n="promptCount">Question count</label><input id="promptCount" name="promptCount" type="number" min="1" max="30" value="8"></div>
            <div class="field"><label for="keywordMode" data-i18n="keywordMode">Keyword mode</label><select id="keywordMode" name="keywordMode"><option value="site_plus_user" data-i18n="sitePlusUser">Site + My keywords</option><option value="user_only" data-i18n="userOnlyKeywords">My keywords only</option><option value="site_only" data-i18n="siteOnlyKeywords">Site keywords only</option></select></div>
            <div class="field"><label for="keywordLimit" data-i18n="keywordLimit">Keyword count</label><input id="keywordLimit" name="keywordLimit" type="number" min="1" max="30" value="6"></div>
            <div class="field"><label for="promptsPerKeyword" data-i18n="promptsPerKeyword">Questions per keyword</label><input id="promptsPerKeyword" name="promptsPerKeyword" type="number" min="1" max="6" value="2"></div>
          </div>
        </section>

        <section class="wizard-panel" data-step-panel="4">
          <h3 data-i18n="stepModels">Models</h3><p data-i18n="providerCatalogHelp">Each key is used on its own. OpenRouter can route a single key to the many models it supports.</p>
          <div class="form-grid">
            <div class="field"><label for="provider" data-i18n="provider">Provider</label><select id="provider" name="provider"></select></div>
            <div class="field"><label for="models" data-i18n="models">Models</label><input id="models" name="models" value="openai/gpt-4o-mini,perplexity/sonar" required></div>
            <div class="field full"><div id="selected-model-capabilities" class="selected-model-capabilities" aria-live="polite"></div></div>
            <div class="field"><label for="maxTokens" data-i18n="maxTokens">Max answer tokens</label><input id="maxTokens" name="maxTokens" type="number" min="200" max="4000" value="700"></div>
            <div class="field"><label for="repeatCount" data-i18n="repeatCount">Repeats per question</label><input id="repeatCount" name="repeatCount" type="number" min="1" max="10" value="1"><p class="field-help" data-i18n="repeatCountHelp">A repeated request forms its own observation, which reduces the effect of single-run randomness.</p></div>
            <div class="field"><label for="webSearchEnabled" data-i18n="webSearch">Web search</label><select id="webSearchEnabled" name="webSearchEnabled"><option value="false" data-i18n="webSearchOff">Close</option><option value="true" data-i18n="webSearchOn">On</option></select></div>
            <div class="field"><label id="language-label" data-i18n="auditLanguage">Page and answer language</label></div>
          </div>
        </section>

        <section class="wizard-panel" data-step-panel="5">
          <h3 data-i18n="stepSchedule">Frequency</h3><p data-i18n="whatChangedHelp">A change is shown only when two runs had identical conditions.</p>
          <div class="form-grid">
            <div class="field full"><label for="scheduleKind" data-i18n="schedule">Frequency</label><select id="scheduleKind" name="scheduleKind"><option value="manual" data-i18n="manual">Run once</option><option value="weekly" data-i18n="weekly">Weekly</option><option value="daily" data-i18n="daily">Daily</option><option value="monthly" data-i18n="monthly">Monthly</option><option value="cron" data-i18n="customSchedule">Custom</option></select></div>
            <div class="field project-schedule-field hidden"><label for="projectScheduleTimezone" data-i18n="timezone">Time zone</label><input id="projectScheduleTimezone" name="projectScheduleTimezone" value="Asia/Shanghai"></div>
            <div class="field project-schedule-field project-schedule-simple hidden"><label for="projectScheduleTime" data-i18n="time">Run time</label><input id="projectScheduleTime" name="projectScheduleTime" type="time" value="09:00"></div>
            <div class="field project-schedule-field project-schedule-weekly hidden"><label for="projectScheduleDayOfWeek" data-i18n="dayOfWeek">Run date</label><select id="projectScheduleDayOfWeek" name="projectScheduleDayOfWeek"><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="0">0</option></select></div>
            <div class="field project-schedule-field project-schedule-monthly hidden"><label for="projectScheduleDayOfMonth" data-i18n="dayOfMonth">Day of month</label><input id="projectScheduleDayOfMonth" name="projectScheduleDayOfMonth" type="number" min="1" max="31" value="1"></div>
            <div class="field full project-schedule-field project-schedule-cron hidden"><label for="projectScheduleCron">Cron</label><input id="projectScheduleCron" name="projectScheduleCron" value="0 9 * * 1"></div>
          </div>
        </section>

        <section id="confirm-plan" class="hidden">
          <div class="section-head"><div><h2 data-i18n="confirmQuestions">Confirm questions</h2><p data-i18n="wizardSubtitle">Every question can be reviewed and edited before any real provider request runs.</p></div></div>
          <div id="plan-error" class="error-box hidden"></div><div id="plan-body"></div>
        </section>
      </div>

      <div class="wizard-footer">
        <div><button id="wizard-back" class="button" type="button" data-i18n="back">Back</button></div>
        <div class="request-estimate" id="request-estimate"></div>
        <div class="actions"><span id="run-status" class="status">—</span><button id="run-button" class="button primary hidden" type="submit">Run</button><button id="wizard-next" class="button primary" type="button" data-i18n="next">Next</button></div>
      </div>
    </form>
  </aside>

  <div id="detail-backdrop" class="detail-backdrop"></div>
  <aside id="detail-sheet" class="detail-sheet" aria-label="Evidence" aria-hidden="true">
    <div class="detail-head"><strong id="detail-title">Evidence</strong><button id="detail-close" class="close-button" type="button" aria-label="Close">×</button></div>
    <div id="detail-body" class="detail-body"></div>
  </aside>

  ${renderWorkbenchScript()}
</body>
</html>`;
}
