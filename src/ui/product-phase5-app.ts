import { renderProductPhase4AppHtml } from "./product-phase4-app.js";
import { renderCiteGeoLockup } from "./brand.js";

const phase5BrandLockup = renderCiteGeoLockup("p5-brandlockup");
const phase5Script = String.raw`<script>
(() => {
  const mount = document.getElementById("app");
  if (!mount) return;
  window.__citegeoPhase5Active = true;
  const state = { projects: [], projectId: "", project: null, configuration: null, selections: [], catalog: [], watchSets: [], watchSet: null, runs: [], tasks: [], snapshot: null, detail: [], modal: "", error: "", loading: false, activeNav: "overview", discoveryMetric: "brand_name_mention", associationMetric: "keyword_association_coverage", objectId: "", keywordId: "", showHistoricalModels: false, timeRange: "all", sourceFilter: "all", searchFilter: "all", schedulePreview: [], scheduleTaskId: "", taskPreview: {}, deleteTaskId: "" };
  const colors = ["#6B8CAE", "#8B7FBF", "#B98A5E", "#6FA88A", "#A6748F", "#7A94A0"];
  const esc = (value) => String(value == null ? "" : value).split("").map((item) => item === "&" ? "&amp;" : item === "<" ? "&lt;" : item === ">" ? "&gt;" : item === '"' ? "&quot;" : item === "'" ? "&#39;" : item).join("");
  const encoded = (value) => encodeURIComponent(value);
  const api = async (path, options) => {
    const response = await fetch(path, { headers: { "content-type": "application/json" }, ...(options || {}) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof body.code === "string" ? body.code : "request_failed");
    return body;
  };
  const currentProject = () => state.projects.find((item) => item.id === state.projectId) || null;
  const activeWatchSet = () => state.watchSets.find((item) => item.status === "active" && item.baselineId === state.project?.activeBaselineId) || null;
  const targetObject = () => state.watchSet ? state.watchSet.objects.find((item) => item.id === state.watchSet.targetObjectId) || null : null;
  const selectedObject = () => state.watchSet ? state.watchSet.objects.find((item) => item.id === state.objectId) || targetObject() : null;
  const comparisonObject = () => state.watchSet ? (selectedObject()?.role === "competitor" && selectedObject()?.identityState === "confirmed" ? selectedObject() : state.watchSet.objects.find((item) => item.role === "competitor" && item.identityState === "confirmed")) || null : null;
  const selectedKeyword = () => state.watchSet ? state.watchSet.keywords.find((item) => item.id === state.keywordId && item.neutralEligible) || state.watchSet.keywords.find((item) => item.neutralEligible) || null : null;
  const metricDefinitions = () => {
    const discovery = state.discoveryMetric === "domain_body_mention"
      ? ["domain_body_mention", "Domain mentions when the brand is not named", "Whether a neutral keyword answer actually writes out the object\'s domain", "Domain written in body / analyzable keyword answers", "discovery"]
      : ["brand_name_mention", "Name mentions when the brand is not named", "Whether a neutral keyword answer actually writes out the object\'s name", "Name written out / analyzable keyword answers", "discovery"];
    const association = state.associationMetric === "keyword_association_count"
      ? ["keyword_association_count", "Keyword association count", "Number of answers in which the model associated this keyword with the object, in that object\'s own domain answers", "Associated answer count", "association"]
      : state.associationMetric === "keyword_relative_weight"
        ? ["keyword_relative_weight", "Relative keyword weight", "This keyword\'s share of associated answers within the fixed monitored keyword set", "Associated-answer share / all monitored-keyword associated answers", "association"]
        : ["keyword_association_coverage", "Keyword association coverage", "Whether the model associated this keyword with the object in that object\'s own domain answers", "Associated answers / analyzable domain answers", "association"];
    return [
      ["domain_recognition", "Which models explicitly recognized this domain?", "The recognition result for this run after the model was given the object\'s domain. It is not an organic recommendation.", "Explicit recognition / analyzable domain answers", "domain"],
      discovery,
      association,
      ["positive_recommendation", "When asked this keyword, which models recommend this object?", "The model explicitly suggested considering this object in a keyword answer that never named the brand.", "Positive recommendation / analyzable keyword answers", "recommendation"],
      ["first_mention", "When asked this keyword, how often was this object mentioned first?", "Counted by verifiable position in the answer body. It does not represent the model\'s internal reasoning order.", "Sole first mention / analyzable keyword answers", "first_mention"],
      ["first_recommendation", "When asked this keyword, how often was this object recommended first?", "Counted by explicit recommendation evidence and order. It does not represent the model\'s internal reasoning order.", "Sole first recommendation / analyzable keyword answers", "first_recommendation"],
      ["recommendation_gap", "For the same keyword, how is the recommendation gap between us and a competitor changing?", "Within the same model, keyword and sample batch: the target\'s recommendation share minus the competitor\'s.", "Target recommendation share minus competitor share (percentage points)", "gap"],
      ["provider_citation", "When asked this keyword, which web-enabled models cited this official site?", "Counts only official-site citations actually returned by provider-native web search. URLs in the answer body are not included in this chart.", "Official-site citations / analyzable web-enabled answers", "citation"],
    ];
  };
  const requestButton = (label, action, primary) => '<button type="button" class="p5-button' + (primary ? " primary" : "") + '" data-action="' + esc(action) + '">' + esc(label) + "</button>";
  const navButton = (label, target) => '<button type="button" data-nav-target="' + esc(target) + '" class="' + (state.activeNav === target ? "active" : "") + '">' + esc(label) + "</button>";
  const modalShell = (content) => '<div class="p5-modalwrap" data-modal-backdrop>' + content + "</div>";
  const modalHeader = (title) => '<div class="p5-modal-head"><h2>' + esc(title) + '</h2>' + requestButton("Close", "close") + "</div>";
  const searchLabel = (mode) => mode === "provider_native" ? "Provider Native web search" : "Offline";
  const dateLabel = (value) => value ? new Date(value).toLocaleString("en-US", { hour12: false }) : "Not run yet";
  const selectProject = (projectId) => {
    state.projectId = projectId;
    state.snapshot = null;
    state.detail = [];
    const next = new URL(window.location.href);
    next.searchParams.set("projectId", projectId);
    next.searchParams.delete("project");
    window.history.replaceState({}, "", next);
  };
  const css = () => '<style>' +
    '#app{min-height:100vh;background:#14120F;color:#F2EEE4;font:14px "General Sans",ui-sans-serif,system-ui,sans-serif;font-variant-numeric:tabular-nums}.p5-shell{display:grid;grid-template-columns:248px minmax(0,1fr);min-height:100vh;background:linear-gradient(90deg,#0E0C0A 0 247px,#332C22 247px 248px,transparent 248px)}.p5-side{position:sticky;top:0;height:100vh;box-sizing:border-box;background:#0E0C0A;border-right:1px solid #332C22;padding:20px 16px}.p5-brand{display:flex;align-items:center;margin:4px 8px 24px}.p5-brandlockup{display:block;width:min(100%,190px);height:auto}.p5-brandlockup img{display:block;width:100%;height:auto}.p5-label{color:#6E6455;font-size:11px;letter-spacing:.08em;text-transform:uppercase;margin:18px 8px 8px}.p5-input,.p5-select{box-sizing:border-box;width:100%;border:1px solid #332C22;border-radius:8px;background:#1C1914;color:#F2EEE4;padding:10px}.p5-nav{display:grid;gap:3px;margin-top:12px}.p5-nav button{border:0;background:transparent;color:#A89C87;text-align:left;border-radius:8px;padding:10px 12px;cursor:pointer}.p5-nav button.active,.p5-nav button:hover,.p5-nav button:focus-visible{color:#F2EEE4;background:#24201A}.p5-main{min-width:0}.p5-header{position:sticky;top:0;z-index:4;height:70px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 30px;border-bottom:1px solid #332C22;background:#14120F}.p5-content{max-width:1700px;padding:30px}.p5-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:20px}.p5-heading h1{font-family:"Cabinet Grotesk",ui-sans-serif,system-ui,sans-serif;font-weight:800;letter-spacing:-0.01em;font-size:28px;margin:0 0 7px}.p5-muted{margin:0;color:#A89C87;line-height:1.5}.p5-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.p5-button{min-height:38px;border:1px solid #332C22;border-radius:8px;background:#1C1914;color:#F2EEE4;padding:9px 12px;cursor:pointer;transition:transform 80ms ease,background-color 140ms ease,border-color 140ms ease}.p5-button:hover,.p5-button:focus-visible{background:#24201A;border-color:#4A4030}.p5-button:active{transform:translateY(1px) scale(.98)}.p5-button.primary{background:#F2EEE4;border-color:#F2EEE4;color:#14120F}.p5-button[disabled]{cursor:not-allowed;opacity:.55}.p5-button[data-state="loading"]:before{content:"◌ ";animation:p5spin 1s linear infinite}.p5-button[data-state="success"]{border-color:#7FA06E;color:#9DBC8E}.p5-button[data-state="error"]{border-color:#B2503B;color:#CC7157}.p5-alert,.p5-card,.p5-chart,.p5-modal,.p5-drawer,.p5-empty{border:1px solid #332C22;border-radius:8px;background:#1C1914}.p5-alert{padding:15px 18px;border-left:3px solid #C9973E;margin:18px 0}.p5-alert strong{display:block;margin-bottom:4px}.p5-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:18px}.p5-card{padding:16px;min-height:102px}.p5-cardwide{grid-column:1/-1}.p5-card:hover{border-color:#4A4030}.p5-card span{color:#A89C87}.p5-card strong{display:block;margin-top:10px;font-size:22px}.p5-section{margin-top:28px;scroll-margin-top:88px}.p5-section h2{font-family:"Cabinet Grotesk",ui-sans-serif,system-ui,sans-serif;font-weight:700;letter-spacing:-0.01em;font-size:18px;margin:0 0 6px}.p5-chart{padding:18px;margin-top:14px}.p5-charthead{display:flex;justify-content:space-between;gap:16px}.p5-chart h3{font-family:"Cabinet Grotesk",ui-sans-serif,system-ui,sans-serif;font-weight:700;margin:0 0 6px;font-size:16px}.p5-formula{color:#A89C87;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:12px}.p5-chart svg{width:100%;height:230px;display:block;margin:10px 0 0}.p5-axis{stroke:#332C22;stroke-width:1}.p5-axis-label{fill:#A89C87;font-size:11px}.p5-line{fill:none;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.p5-line.draw{stroke-dasharray:var(--path-length);stroke-dashoffset:var(--path-length);animation:p5draw 650ms cubic-bezier(.22,1,.36,1) forwards}.p5-point{stroke-width:3;cursor:pointer;transition:transform 140ms ease}.p5-point.partial{stroke-dasharray:3 2}.p5-pointbutton:focus-visible .p5-point,.p5-pointbutton:hover .p5-point{transform:scale(1.65)}.p5-pointbutton .p5-latest{stroke:currentColor;stroke-width:5;stroke-opacity:.35}.p5-legend{display:flex;flex-wrap:wrap;gap:12px;color:#A89C87;margin-top:8px}.p5-legend i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px}.p5-table{width:100%;border-collapse:collapse;margin-top:12px}.p5-table th,.p5-table td{text-align:left;vertical-align:top;padding:9px 8px;border-bottom:1px solid #332C22}.p5-table td{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:12px}.p5-table th{color:#A89C87;font-weight:600}.p5-table-detail{margin-top:12px;color:#A89C87}.p5-table-detail summary{cursor:pointer}.p5-empty{margin-top:18px;padding:18px;color:#A89C87}.p5-emptyall strong{display:block;color:#F2EEE4;margin-bottom:6px}.p5-metriclist{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:2px 18px;margin:12px 0 0;padding-left:18px;font-size:13px}.p5-modalwrap{position:fixed;inset:0;z-index:10;padding:18px;display:grid;place-items:center;background:#000a}.p5-modal{width:min(580px,100%);max-height:calc(100vh - 36px);overflow:auto;padding:20px}.p5-modal-head{position:sticky;top:-20px;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:12px;margin:-20px -20px 16px;padding:16px 20px 12px;background:#1C1914;border-bottom:1px solid #332C22}.p5-modal-head h2{font-family:"Cabinet Grotesk",ui-sans-serif,system-ui,sans-serif;font-weight:700;margin:0}.p5-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}.p5-check{display:flex;align-items:center;gap:8px;padding:8px 0}.p5-drawer{position:fixed;right:18px;top:88px;z-index:9;width:min(550px,calc(100vw - 36px));max-height:calc(100vh - 106px);overflow:auto;padding:18px;box-shadow:0 18px 50px #0008;animation:p5slide 200ms ease-out}.p5-drawer pre{white-space:pre-wrap;word-break:break-word;background:#0E0C0A;border:1px solid #332C22;border-radius:6px;padding:12px}.p5-status{font-size:12px;color:#A89C87}.p5-saved{margin:18px 0 0;color:#9DBC8E;font-size:13px}.p5-ok{color:#9DBC8E}.p5-warn{color:#DBB05F}.p5-bad{color:#CC7157}.p5-tag{display:inline-block;border:1px solid #4A4030;border-radius:999px;padding:3px 7px;margin:2px;color:#A89C87;font-size:12px}@keyframes p5draw{to{stroke-dashoffset:0}}@keyframes p5spin{to{transform:rotate(360deg)}}@keyframes p5slide{from{transform:translateX(16px);opacity:0}to{transform:translateX(0);opacity:1}}@media(max-width:900px){.p5-shell{grid-template-columns:1fr}.p5-side{position:relative;height:auto;border-right:0;border-bottom:1px solid #332C22}.p5-nav{grid-template-columns:repeat(3,minmax(0,1fr))}.p5-header{padding:0 18px}.p5-content{padding:18px}.p5-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}</style>';
  async function load() {
    state.loading = true;
    render();
    try {
      const listed = await api("/api/projects");
      state.projects = listed.projects || [];
      const params = new URL(window.location.href).searchParams;
      const requested = params.get("projectId") || params.get("project");
      const saved = window.localStorage.getItem("citegeo-current-project");
      if (requested && state.projects.some((item) => item.id === requested)) state.projectId = requested;
      else if (!state.projectId || !state.projects.some((item) => item.id === state.projectId)) state.projectId = state.projects.some((item) => item.id === saved) ? saved : state.projects[0] ? state.projects[0].id : "";
      state.project = currentProject();
      if (state.project) {
        const base = "/api/projects/" + encoded(state.project.id);
        const values = await Promise.all([api(base + "/monitoring-configuration"), api(base + "/models"), api(base + "/watch-sets"), api(base + "/measurement-runs"), api(base + "/monitoring-tasks"), api("/api/provider-models")]);
        state.configuration = values[0].configuration;
        state.selections = values[1].selections || [];
        state.watchSets = values[2].watchSets || [];
        state.watchSet = activeWatchSet();
        state.runs = values[3].runs || [];
        state.tasks = values[4].tasks || [];
        state.catalog = values[5].models || [];
        if (state.watchSet) {
          try { state.snapshot = (await api(base + "/measurement-stats", { method: "POST", body: "{}" })).snapshot; } catch (_) { state.snapshot = null; }
        } else state.snapshot = null;
        window.localStorage.setItem("citegeo-current-project", state.projectId);
      }
      state.error = "";
    } catch (_) { state.error = "Could not read project data. Check the local service and the project configuration."; }
    state.loading = false;
    render();
  }
  const pointList = (metric) => {
    const object = selectedObject();
    const keyword = selectedKeyword();
    const target = targetObject();
    const isDomain = metric === "domain_recognition";
    const competitor = comparisonObject();
    const rangeDays = state.timeRange === "7" ? 7 : state.timeRange === "30" ? 30 : state.timeRange === "90" ? 90 : null;
    const earliest = rangeDays === null ? null : Date.now() - rangeDays * 24 * 60 * 60 * 1000;
    return (state.snapshot ? state.snapshot.points : []).filter((point) => {
      const run = state.runs.find((item) => item.id === point.runId);
      const inRange = earliest === null || Date.parse(point.observedAt) >= earliest;
      const sourceMatches = state.sourceFilter === "all" || run?.source === state.sourceFilter;
      const searchMatches = state.searchFilter === "all" || point.webSearchMode === state.searchFilter;
      const activeModel = state.showHistoricalModels || state.selections.some((selection) => selection.modelId === point.modelId && selection.webSearchMode === point.webSearchMode);
      const objectMatches = metric === "recommendation_gap" ? !target || point.objectId === target.id : !object || point.objectId === object.id;
      return point.metric === metric && inRange && sourceMatches && searchMatches && activeModel && objectMatches && (!competitor || metric !== "recommendation_gap" || point.comparisonObjectId === competitor.id) && (isDomain || !keyword || point.keywordId === keyword.id);
    });
  };
  const colorFor = (modelId) => { let value = 0; for (const item of String(modelId)) value = (value * 31 + item.charCodeAt(0)) % colors.length; return colors[value]; };
  const formattedValue = (point) => point.value === null ? "No data yet" : point.valueUnit === "count" ? String(point.value) + " " : point.valueUnit === "percentage_points" ? point.value.toFixed(1) + "  percentage points" : point.value.toFixed(1) + "%";
  const controlsFor = (definition) => definition[4] === "discovery"
    ? '<div class="p5-actions"><button class="p5-button" data-view-metric="brand_name_mention" ' + (state.discoveryMetric === "brand_name_mention" ? "disabled" : "") + '>Brand name</button><button class="p5-button" data-view-metric="domain_body_mention" ' + (state.discoveryMetric === "domain_body_mention" ? "disabled" : "") + '>Domain in answer body</button></div>'
    : definition[4] === "association"
      ? '<div class="p5-actions"><button class="p5-button" data-view-metric="keyword_association_count" ' + (state.associationMetric === "keyword_association_count" ? "disabled" : "") + '>Association count</button><button class="p5-button" data-view-metric="keyword_association_coverage" ' + (state.associationMetric === "keyword_association_coverage" ? "disabled" : "") + '>Association coverage</button><button class="p5-button" data-view-metric="keyword_relative_weight" ' + (state.associationMetric === "keyword_relative_weight" ? "disabled" : "") + '>Relative weight</button></div>'
      : "";
  const chart = (definition, index) => {
    const points = pointList(definition[0]);
    const valid = points.filter((item) => item.value !== null);
    const object = selectedObject();
    const keyword = selectedKeyword();
    const target = targetObject();
    const competitor = comparisonObject();
    const context = definition[4] === "domain"
      ? object ? object.name + " · " + (object.domain || "Missing domain") : "No object selected yet"
      : definition[4] === "association"
        ? object && keyword ? object.name + " · " + keyword.keyword : "No object or keyword selected yet"
        : definition[4] === "gap"
          ? target && competitor && keyword ? target.name + "  and  " + competitor.name + " · " + keyword.keyword : "No comparison object or keyword selected yet"
          : object && keyword ? object.name + " · " + keyword.keyword : "No object or keyword selected yet";
    if (!valid.length) return '<article class="p5-chart"><div class="p5-charthead"><div><h3>' + esc(definition[1]) + '</h3><p class="p5-formula">Object or keyword: ' + esc(context) + '</p><p class="p5-formula">Evidence: ' + esc(definition[2]) + '</p><p class="p5-formula">Formula: ' + esc(definition[3]) + '</p></div>' + controlsFor(definition) + '</div><div class="p5-empty">Not enough data to compute yet. Save a scope first and complete the matching probe runs.</div></article>';
    const times = [...new Set(points.map((item) => item.observedAt))].sort((left, right) => left.localeCompare(right));
    const byModel = new Map();
    for (const item of points) { const key = item.modelId + "|" + item.webSearchMode + "|" + item.fingerprint + "|" + (item.keywordId || ""); const rows = byModel.get(key) || []; rows.push(item); byModel.set(key, rows); }
    const width = 820; const height = 190; const left = 44; const right = 18; const top = 12; const bottom = 30;
    const x = (item) => times.length === 1 ? left + (width - left - right) / 2 : left + times.indexOf(item.observedAt) * (width - left - right) / (times.length - 1);
    const values = valid.map((item) => item.value);
    const min = definition[0] === "recommendation_gap" ? -100 : 0;
    const max = definition[0] === "keyword_association_count" ? Math.max(1, ...values) : 100;
    const y = (item) => top + (max - item.value) * (height - top - bottom) / (max - min || 1);
    const series = [...byModel.entries()].map(([seriesKey, rows]) => {
      const ordered = [...rows].sort((left, right) => left.observedAt.localeCompare(right.observedAt));
      const color = colorFor(ordered[0]?.modelId || seriesKey);
      let connected = false;
      const pathData = ordered.map((item) => { if (item.value === null || !item.complete) { connected = false; return ""; } const command = connected ? "L" : "M"; connected = true; return command + x(item).toFixed(1) + " " + y(item).toFixed(1); }).filter(Boolean).join(" ");
      const latest = ordered[ordered.length - 1];
      const latestComplete = [...ordered].reverse().find((item) => item.complete && item.value !== null) || null;
      return { color, pathData, latestPointId: latestComplete ? latestComplete.id : "", legend: '<span><i style="background:' + color + '"></i>' + esc(latest.modelDisplayName) + ' · ' + esc(searchLabel(latest.webSearchMode)) + ' · ' + latest.numerator + ' / ' + latest.denominator + ' (' + esc(formattedValue(latest)) + ')' + (latest.complete ? "" : " · Incomplete coverage") + '</span>' };
    });
    const labels = times.map((item) => '<text class="p5-axis-label" x="' + x({ observedAt: item }).toFixed(1) + '" y="' + (height - 8) + '" text-anchor="middle">' + esc(new Date(item).toLocaleString("en-US", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })) + '</text>').join("");
    const lines = series.map((item) => item.pathData ? '<path class="p5-line draw" stroke="' + item.color + '" d="' + item.pathData + '"></path>' : "").join("");
    const latestPointIds = new Set(series.map((item) => item.latestPointId).filter(Boolean));
    const pointGroups = new Map();
    for (const item of valid) { const key = x(item).toFixed(1) + "|" + y(item).toFixed(1); const rows = pointGroups.get(key) || []; rows.push(item); pointGroups.set(key, rows); }
    const dots = [...pointGroups.values()].map((rows) => { const visible = rows.at(-1); const ids = rows.map((item) => item.id).join(","); const names = rows.map((item) => item.modelDisplayName).join(", "); const color = colorFor(visible.modelId); const tooltip = rows.map((item) => item.modelDisplayName + " · " + searchLabel(item.webSearchMode) + " · " + new Date(item.observedAt).toLocaleString("en-US", { hour12: false }) + " · " + formattedValue(item) + " · Hits " + item.numerator + " / Analyzable " + item.denominator + " · Scheduled " + item.planned + " · Failed or excluded " + item.failed + " · " + (item.complete ? "Complete" : "Incomplete coverage")).join("\n"); return '<g class="p5-pointbutton" data-point="' + esc(visible.id) + '" data-points="' + esc(ids) + '" role="button" tabindex="0" aria-label="View' + esc(names + " · " + definition[1]) + 'Evidence"><title>' + esc(tooltip) + '</title><circle class="p5-point' + (visible.complete ? "" : " partial") + (rows.some((item) => latestPointIds.has(item.id)) ? " p5-latest" : "") + '" cx="' + x(visible).toFixed(1) + '" cy="' + y(visible).toFixed(1) + '" r="' + (rows.length > 1 ? "7" : "5") + '" fill="' + (visible.complete ? color : "#14120F") + '" stroke="' + color + '"></circle></g>'; }).join("");
    const rows = points.map((item) => '<tr><td>' + esc(new Date(item.observedAt).toLocaleString("en-US", { hour12: false })) + '</td><td>' + esc(item.modelDisplayName) + '</td><td>' + esc(searchLabel(item.webSearchMode)) + '</td><td>' + esc(formattedValue(item)) + '</td><td>' + item.numerator + ' / ' + item.denominator + '</td><td>' + item.planned + '</td><td>' + item.failed + '</td><td>' + (item.complete ? "Complete" : "Incomplete coverage") + '</td></tr>').join("");
    return '<article class="p5-chart"><div class="p5-charthead"><div><h3>' + esc(definition[1]) + '</h3><p class="p5-formula">Object or keyword: ' + esc(context) + '</p><p class="p5-formula">Evidence: ' + esc(definition[2]) + '</p><p class="p5-formula">Formula: ' + esc(definition[3]) + '</p><p class="p5-formula">Each line is one fixed model, actual web search mode and probe fingerprint. Each point is one real run. Hover or focus a point for the full statistics.</p></div>' + controlsFor(definition) + '</div><svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + esc(definition[1]) + 'Data point"><line class="p5-axis" x1="' + left + '" x2="' + (width - right) + '" y1="' + (height - bottom) + '" y2="' + (height - bottom) + '"></line><line class="p5-axis" x1="' + left + '" x2="' + (width - right) + '" y1="' + ((height - bottom + top) / 2) + '" y2="' + ((height - bottom + top) / 2) + '"></line><line class="p5-axis" x1="' + left + '" x2="' + (width - right) + '" y1="' + top + '" y2="' + top + '"></line>' + lines + dots + labels + '</svg><div class="p5-legend">' + series.map((item) => item.legend).join("") + '<span>Click a point to see its component data and the raw answer</span></div><details class="p5-table-detail"><summary>View chart data</summary><table class="p5-table"><thead><tr><th>Time</th><th>Model</th><th>Execution mode</th><th>Result</th><th>Hits / analyzable</th><th>Scheduled</th><th>Failed or excluded</th><th>Coverage</th></tr></thead><tbody>' + rows + '</tbody></table></details></article>';
  };
  const hasPoints = (definition) => pointList(definition[0]).some((item) => item.value !== null);
  const chartSection = () => {
    const definitions = metricDefinitions();
    const ready = definitions.filter(hasPoints);
    if (!ready.length) {
      return '<div class="p5-empty p5-emptyall"><strong>No measurements yet</strong>Save a scope, then run a recognition test. These ' + definitions.length + ' charts each fill in once matching probe runs exist.<ul class="p5-metriclist">' + definitions.map((definition) => '<li>' + esc(definition[1]) + '</li>').join("") + '</ul></div>';
    }
    const waiting = definitions.filter((definition) => !hasPoints(definition));
    return ready.map(chart).join("") + (waiting.length ? '<div class="p5-empty">Still waiting on data: ' + waiting.map((definition) => esc(definition[1])).join(' \u00b7 ') + '</div>' : "");
  };
  const metricCards = () => metricDefinitions().slice(0, 4).some(hasPoints) ? metricDefinitions().slice(0, 4).map((definition) => {
    const values = pointList(definition[0]).filter((item) => item.value !== null);
    const latest = values[values.length - 1];
    return '<article class="p5-card"><span>' + esc(definition[1]) + '</span><strong>' + (latest ? latest.numerator + ' / ' + latest.denominator : "No data yet") + '</strong><small class="p5-status">' + (latest ? esc(formattedValue(latest)) + " · " : "") + esc(definition[3]) + '</small></article>';
  }).join("") : '<article class="p5-card p5-cardwide"><span>Current data</span><strong>Nothing measured yet</strong><small class="p5-status">Headline numbers appear after the first completed run.</small></article>';
  const runSummary = () => {
    const run = state.runs[0];
    if (!run) return '<div class="p5-empty">No measurement run created yet. Save a scope to start multi-model recognition and neutral keyword tests.</div>';
    const models = (run.modelRuns || []).map((item) => '<tr><td>' + esc(item.modelSnapshot.displayName) + '</td><td>' + esc(searchLabel(item.modelSnapshot.webSearchMode)) + '</td><td><span class="p5-status ' + (item.status === "completed" ? "p5-ok" : item.status === "running" ? "p5-warn" : "p5-bad") + '">' + esc(item.status) + '</span></td><td>' + (item.probeRunIds ? item.probeRunIds.length : 0) + '</td></tr>').join("");
    return '<table class="p5-table"><thead><tr><th>Model</th><th>Web search mode</th><th>Status</th><th>Probe</th></tr></thead><tbody>' + models + '</tbody></table>';
  };
  const watchSetSummary = () => {
    if (!state.watchSet) return '<div class="p5-empty">No scope saved yet. A scope only uses candidate objects and keywords from the saved recognition profile. Objects without a clear identity are not tested on their own domain.</div>';
    return '<div><p class="p5-muted">Current version v' + state.watchSet.version + ' · ' + state.watchSet.repetitions + '  repeats · once fixed, past runs are never rewritten.</p><div>' + state.watchSet.objects.map((item) => '<span class="p5-tag">' + esc(item.name) + (item.domain ? " · " + esc(item.domain) : " · Identity to confirm") + '</span>').join("") + '</div><div>' + state.watchSet.keywords.map((item) => '<span class="p5-tag">' + esc(item.keyword) + (item.neutralEligible ? "" : " · Not used in neutral tests") + '</span>').join("") + '</div></div>';
  };
  const scopeControls = () => state.watchSet ? '<section class="p5-section"><div class="p5-charthead"><div><h2>View scope</h2><p class="p5-muted">Filtering only reads saved evidence and sends no model requests. Managing models changes later runs; this only controls the legend.</p></div><label class="p5-check"><input type="checkbox" data-role="historical-models" ' + (state.showHistoricalModels ? "checked" : "") + '>Show retired models</label></div><div class="p5-row"><label>Object<select class="p5-select" data-role="measurement-object">' + state.watchSet.objects.map((item) => '<option value="' + esc(item.id) + '" ' + (item.id === (selectedObject()?.id || "") ? "selected" : "") + '>' + esc(item.name) + (item.domain ? " · " + esc(item.domain) : " · Missing domain") + '</option>').join("") + '</select></label><label>Neutral keyword<select class="p5-select" data-role="measurement-keyword">' + state.watchSet.keywords.filter((item) => item.neutralEligible).map((item) => '<option value="' + esc(item.id) + '" ' + (item.id === (selectedKeyword()?.id || "") ? "selected" : "") + '>' + esc(item.keyword) + '</option>').join("") + '</select></label><label>Time range<select class="p5-select" data-role="measurement-range"><option value="all" ' + (state.timeRange === "all" ? "selected" : "") + '>All time</option><option value="7" ' + (state.timeRange === "7" ? "selected" : "") + '>Last 7 days</option><option value="30" ' + (state.timeRange === "30" ? "selected" : "") + '>Last 30 days</option><option value="90" ' + (state.timeRange === "90" ? "selected" : "") + '>Last 90 days</option></select></label><label>Execution mode<select class="p5-select" data-role="measurement-search"><option value="all" ' + (state.searchFilter === "all" ? "selected" : "") + '>All web search modes</option><option value="off" ' + (state.searchFilter === "off" ? "selected" : "") + '>Offline</option><option value="provider_native" ' + (state.searchFilter === "provider_native" ? "selected" : "") + '>Provider Native web search</option></select></label><label>Data source<select class="p5-select" data-role="measurement-source"><option value="all" ' + (state.sourceFilter === "all" ? "selected" : "") + '>Manual and scheduled</option><option value="manual" ' + (state.sourceFilter === "manual" ? "selected" : "") + '>Run manually</option><option value="scheduled" ' + (state.sourceFilter === "scheduled" ? "selected" : "") + '>Scheduled run</option></select></label></div></section>' : "";
  const taskSummary = () => state.tasks.length ? state.tasks.filter((task) => task.status !== "deleted").map((task) => '<article class="p5-card"><span>' + esc(task.name) + ' · ' + esc(task.status === "active" ? "Running" : task.status === "paused" ? "Paused" : "Incompatible configuration") + '</span><strong>' + esc(task.rule.frequency === "daily" ? "Daily" : task.rule.frequency === "weekly" ? "Weekly" : task.rule.frequency === "monthly" ? "Monthly" : "Custom") + '</strong><small class="p5-status">' + task.modelScope.length + '  models · ' + task.plannedRequestCount + '  requests · next: ' + esc(dateLabel(task.nextRunAt)) + '</small><div class="p5-actions">' + requestButton("Preview", "task-preview:" + task.id) + (task.status === "active" ? requestButton("Pause", "task-pause:" + task.id) : task.status === "paused" ? requestButton("Resume", "task-resume:" + task.id) : "") + requestButton("Edit", "task-edit:" + task.id) + (state.deleteTaskId === task.id ? requestButton("Confirm delete", "task-confirm-delete:" + task.id) : requestButton("Delete", "task-delete:" + task.id)) + '</div>' + ((state.taskPreview[task.id] || []).length ? '<div class="p5-status">Next three: ' + state.taskPreview[task.id].map((value) => esc(dateLabel(value))).join(" · ") + '</div>' : "") + '</article>').join("") : '<div class="p5-empty">No schedule set yet. A task only runs against a fixed configuration and scope, and never mixes past configurations.</div>';
  const configurationSummary = () => {
    if (!state.configuration) return "";
    const status = state.configuration.status;
    if (status === "unchanged") return '<p class="p5-saved">Configuration saved. The current models, web search modes, domain and language all match the saved version.</p>';
    const label = status === "unchanged" ? "Current configuration saved" : status === "changed" ? "Models or web search modes have changed" : "No configuration saved yet";
    const action = status === "unchanged" ? '<button class="p5-button" disabled>✓ Current configuration saved</button>' : requestButton(status === "changed" ? "Save as a new configuration" : "Save configuration", "save-configuration");
    return '<div class="p5-alert"><strong>' + esc(label) + '</strong><p class="p5-muted">' + (status === "unchanged" ? "The current models, web search modes, domain and language match the saved version." : "Saving creates a new version. Existing runs and past evidence are never rewritten.") + '</p><div class="p5-actions">' + action + '</div></div>';
  };
  const overview = () => '<div class="p5-heading" id="p5-overview"><div><h1>Continuous measurement</h1><p class="p5-muted">A line only joins real samples from the same project, configuration, model, web search mode and protocol. Refreshing the page does not call any model.</p></div><div class="p5-actions">' + requestButton("Manage models", "models") + requestButton("Save scope", "watchset") + requestButton("Start recognition test", "run", true) + '</div></div>' + configurationSummary() + (state.error ? '<div class="p5-alert"><strong>Action did not complete</strong><p class="p5-muted">' + esc(state.error) + '</p></div>' : "") + scopeControls() + '<section class="p5-section"><h2>Current data</h2><div class="p5-grid">' + metricCards() + '</div></section><section class="p5-section" id="p5-competition"><h2>How AI answers about your brand change</h2><p class="p5-muted">Each point is one complete run. Each line is a single model. Different protocols, web search modes or configuration fingerprints are never joined into one line.</p>' + chartSection() + '</section><section class="p5-section" id="p5-keywords"><h2>Scope</h2>' + watchSetSummary() + '</section><section class="p5-section" id="p5-recognition"><div class="p5-charthead"><div><h2>This run</h2><p class="p5-muted">One model failing never overwrites another model\'s evidence. You can inspect and retry each probe on its own.</p></div>' + requestButton("Test newly added models only", "new-models") + '</div>' + runSummary() + '</section><section class="p5-section" id="p5-monitoring"><div class="p5-charthead"><div><h2>Scheduled monitoring</h2><p class="p5-muted">A scheduled task reuses the same measurement execution path and records every run it produces.</p></div>' + requestButton("Set up scheduled monitoring", "schedule") + '</div><div class="p5-grid">' + taskSummary() + '</div></section>';
  const createModal = () => modalShell('<form class="p5-modal" data-form="project" role="dialog" aria-modal="true">' + modalHeader("New project") + '<p class="p5-muted">Each project is bound to its own domain, models, scope, runs and tasks.</p><label>Domain<input class="p5-input" name="domain" required placeholder="example.com"></label><label>Project name<input class="p5-input" name="name" placeholder="Optional"></label><div class="p5-actions" style="margin-top:16px">' + requestButton("Cancel", "close") + '<button class="p5-button primary" type="submit">Create draft project</button></div></form>');
  const watchsetModal = () => state.watchSet ? modalShell('<div class="p5-modal" role="dialog" aria-modal="true">' + modalHeader("Current scope") + '<p class="p5-muted">The current scope is saved. Historical evidence for models, keywords and objects stays in its original version. A configuration change requires a new scope version.</p><div class="p5-actions">' + requestButton("Close", "close") + "</div></div>") : modalShell('<div class="p5-modal" role="dialog" aria-modal="true">' + modalHeader("Save scope") + '<p class="p5-muted">Candidates for objects and keywords are drawn from this project\'s saved recognition profile. Competitor domains are never guessed.</p><div class="p5-actions">' + requestButton("Cancel", "close") + requestButton("Save and confirm scope", "create-watchset", true) + "</div></div>");
  const modelModal = () => modalShell('<div class="p5-modal" role="dialog" aria-modal="true">' + modalHeader("Model") + '<p class="p5-muted">Select one or more currently available models. A newly added model only creates its own probe at "Test newly added models only", and removing one never deletes past evidence.</p><div>' + state.catalog.map((model) => { const selected = state.selections.find((item) => item.modelId === model.modelId); return '<label class="p5-check"><input type="checkbox" data-model="' + esc(model.modelId) + '" ' + (selected ? "checked" : "") + '><span>' + esc(model.displayName || model.modelId) + '</span><select class="p5-select" data-mode="' + esc(model.modelId) + '"><option value="off" ' + (selected && selected.webSearchMode === "off" ? "selected" : "") + '>Offline</option><option value="provider_native" ' + (selected && selected.webSearchMode === "provider_native" ? "selected" : "") + (model.nativeWebSearchSupported ? "" : " disabled") + '>Provider Native web search</option></select></label>'; }).join("") + '</div><div class="p5-actions" style="margin-top:16px">' + requestButton("Save model selection", "save-models", true) + "</div></div>");
  const scheduleModal = () => {
    const task = state.tasks.find((item) => item.id === state.scheduleTaskId) || null;
    const rule = task ? task.rule : { frequency: "weekly", timezone: "Asia/Shanghai", hour: 9, minute: 0, weekday: 1, dayOfMonth: 1, cron: "0 9 * * 1" };
    const modelScope = new Set(task ? task.modelScope : state.selections.map((item) => item.modelId));
    const isWeekly = rule.frequency === "weekly";
    const isMonthly = rule.frequency === "monthly";
    const isCustom = rule.frequency === "custom";
    const preview = state.schedulePreview.length ? '<div class="p5-empty"><strong>Next three runs</strong><div>' + state.schedulePreview.map((value) => esc(dateLabel(value))).join("<br>") + '</div></div>' : "";
    return '<div class="p5-modalwrap"><form class="p5-modal" data-form="schedule" data-task-id="' + esc(task?.id || "") + '"><h2>' + (task ? "Edit schedule" : "Set up scheduled monitoring") + '</h2><p class="p5-muted">A task uses a frozen configuration and scope. Editing it changes future schedules and never rewrites saved runs or evidence.</p><label>Task name<input class="p5-input" name="name" value="' + esc(task?.name || "Recurring monitoring") + '"></label><div class="p5-row"><label>Frequency<select class="p5-select" name="frequency"><option value="daily" ' + (rule.frequency === "daily" ? "selected" : "") + '>Daily</option><option value="weekly" ' + (isWeekly ? "selected" : "") + '>Weekly</option><option value="monthly" ' + (isMonthly ? "selected" : "") + '>Monthly</option><option value="custom" ' + (isCustom ? "selected" : "") + '>Custom cron</option></select></label><label>Time zone<input class="p5-input" name="timezone" value="' + esc(rule.timezone) + '"></label></div><div class="p5-row" data-simple-schedule ' + (isCustom ? "hidden" : "") + '><label>Hour<input class="p5-input" name="hour" type="number" min="0" max="23" value="' + esc(rule.hour === undefined ? 9 : rule.hour) + '"></label><label>Minute<input class="p5-input" name="minute" type="number" min="0" max="59" value="' + esc(rule.minute === undefined ? 0 : rule.minute) + '"></label></div><div class="p5-row" data-weekly-schedule ' + (isWeekly ? "" : "hidden") + '><label>Day of week<select class="p5-select" name="weekday">' + [1, 2, 3, 4, 5, 6, 0].map((weekday) => '<option value="' + weekday + '" ' + (rule.weekday === weekday ? "selected" : "") + '>' + ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][weekday] + '</option>').join("") + '</select></label><div></div></div><div class="p5-row" data-monthly-schedule ' + (isMonthly ? "" : "hidden") + '><label>Day of month<input class="p5-input" name="dayOfMonth" type="number" min="1" max="31" value="' + esc(rule.dayOfMonth === undefined ? 1 : rule.dayOfMonth) + '"></label><div></div></div><label data-custom-schedule ' + (isCustom ? "" : "hidden") + '>Cron<input class="p5-input" name="cron" value="' + esc(rule.cron || "") + '"></label><h3>Models this task runs</h3><p class="p5-muted">The model set is fixed inside the task version. After a model change, an older task is checked for compatibility before its next run.</p><div>' + state.selections.map((selection) => '<label class="p5-check"><input type="checkbox" data-schedule-model="' + esc(selection.modelId) + '" ' + (modelScope.has(selection.modelId) ? "checked" : "") + '><span>' + esc(selection.displayName) + ' · ' + esc(searchLabel(selection.webSearchMode)) + '</span></label>').join("") + '</div>' + preview + '<div class="p5-actions" style="margin-top:16px">' + requestButton("Preview next three", "schedule-preview") + requestButton("Cancel", "close") + '<button class="p5-button primary" type="submit">' + (task ? "Save task" : "Create monitoring task") + '</button></div></form></div>';
  };
  const drawer = () => {
    if (!state.detail.length) return "";
    return '<aside class="p5-drawer" data-testid="measurement-evidence-drawer"><div class="p5-charthead"><strong>Data point evidence</strong>' + requestButton("Close", "close-drawer") + '</div>' + state.detail.map((detail) => { const samples = detail.samples || []; return '<section class="p5-section"><p class="p5-muted">Model: ' + esc(detail.point.modelDisplayName) + ' · ' + esc(searchLabel(detail.point.webSearchMode)) + '</p><p class="p5-muted">Numerator ' + detail.point.numerator + ' / Denominator ' + detail.point.denominator + ' · Scheduled ' + detail.point.planned + ' · Failed or excluded ' + detail.point.failed + '</p>' + samples.map((sample) => { const attempt = sample.detail && sample.detail.attempts ? sample.detail.attempts.find((item) => item.id === sample.sample.attemptId) || null : null; return '<article class="p5-card" style="margin-top:10px"><span>' + esc(sample.sample.included ? sample.sample.numerator ? "Counted in numerator" : "Counted in denominator" : "Excluded") + '</span><p class="p5-muted">' + esc(sample.sample.exclusionReason || "Analyzable") + '</p><p class="p5-status">Probe: ' + esc(sample.sample.probeRunId) + ' · Attempt: ' + esc(sample.sample.attemptId || "Not created") + '</p>' + (attempt && attempt.rawAnswer ? '<pre>' + esc(attempt.rawAnswer) + '</pre>' : '<p class="p5-muted">This sample has no raw answer to show.</p>') + '</article>'; }).join("") + '</section>'; }).join("") + '</aside>';
  };
  const render = () => {
    const project = currentProject();
    const headerAction = state.loading ? '<button type="button" class="p5-button primary" disabled>Loading…</button>' : requestButton("New project", "create", true);
    const body = state.loading ? '<div class="p5-empty" data-testid="phase5-loading">Loading project data. No model is called again.</div>' : '<div data-testid="phase5-ready">' + (project ? overview() : '<div class="p5-empty"><h2>No projects yet</h2><p>Once you create a domain project, its models, scope, runs, charts and tasks all belong strictly to that project.</p>' + requestButton("New project", "create", true) + '</div>') + '</div>';
    mount.innerHTML = css() + '<div class="p5-shell" data-testid="phase5-workbench"><aside class="p5-side"><div class="p5-brand">${phase5BrandLockup}</div><div class="p5-label">Project</div><select class="p5-select" data-role="projects">' + (state.projects.length ? state.projects.map((item) => '<option value="' + esc(item.id) + '" ' + (item.id === state.projectId ? "selected" : "") + '>' + esc(item.name) + ' · ' + esc(item.normalizedDomain) + '</option>').join("") : '<option>No projects yet</option>') + '</select><nav class="p5-nav">' + navButton("Overview", "p5-overview") + navButton("Domain recognition", "p5-recognition") + navButton("Competitor comparison", "p5-competition") + navButton("Keyword", "p5-keywords") + navButton("Source", "p5-competition") + navButton("Monitoring", "p5-monitoring") + '</nav><div class="p5-label">Data source</div><p class="p5-muted" style="padding:0 8px">Provider API Observation<br>Filters and charts never call a model.</p></aside><main class="p5-main"><header class="p5-header"><strong>citegeo / ' + esc(project ? project.name : "Project") + '</strong>' + headerAction + '</header><div class="p5-content">' + body + '</div></main></div>' + (state.modal === "create" ? createModal() : state.modal === "watchset" ? watchsetModal() : state.modal === "models" ? modelModal() : state.modal === "schedule" ? scheduleModal() : "") + drawer();
    requestAnimationFrame(() => document.querySelectorAll(".p5-line.draw").forEach((line) => { try { const length = line.getTotalLength(); line.style.setProperty("--path-length", String(length)); } catch (_) { line.classList.remove("draw"); } }));
  };
  const perform = async (button, label, job) => {
    if (button.dataset.state === "loading") return;
    button.dataset.state = "loading"; button.textContent = "◌ " + label + "…"; button.disabled = true;
    try { await job(); button.dataset.state = "success"; button.textContent = "✓ Completed"; window.setTimeout(load, 800); }
    catch (_) { state.error = "The action did not complete. Check this project\'s configuration, scope, models, budget or task status."; button.dataset.state = "error"; button.textContent = "Action failed · retry"; button.disabled = false; render(); }
  };
  const ruleFromScheduleForm = (form) => {
    const data = new FormData(form);
    const frequency = String(data.get("frequency") || "daily");
    return { frequency, timezone: String(data.get("timezone") || "Asia/Shanghai"), hour: Number(data.get("hour")), minute: Number(data.get("minute")), ...(frequency === "weekly" ? { weekday: Number(data.get("weekday")) } : {}), ...(frequency === "monthly" ? { dayOfMonth: Number(data.get("dayOfMonth")) } : {}), ...(frequency === "custom" ? { cron: String(data.get("cron") || "") } : {}) };
  };
  const syncScheduleFields = (form) => {
    const frequency = form.querySelector("select[name='frequency']")?.value;
    const simple = form.querySelector("[data-simple-schedule]");
    const weekly = form.querySelector("[data-weekly-schedule]");
    const monthly = form.querySelector("[data-monthly-schedule]");
    const custom = form.querySelector("[data-custom-schedule]");
    if (simple) simple.hidden = frequency === "custom";
    if (weekly) weekly.hidden = frequency !== "weekly";
    if (monthly) monthly.hidden = frequency !== "monthly";
    if (custom) custom.hidden = frequency !== "custom";
  };
  document.addEventListener("change", async (event) => { const target = event.target; if (target instanceof HTMLSelectElement && target.dataset.role === "projects") { selectProject(target.value); await load(); return; } if (target instanceof HTMLSelectElement && target.dataset.role === "measurement-object") { state.objectId = target.value; render(); return; } if (target instanceof HTMLSelectElement && target.dataset.role === "measurement-keyword") { state.keywordId = target.value; render(); return; } if (target instanceof HTMLSelectElement && target.dataset.role === "measurement-range") { state.timeRange = target.value; render(); return; } if (target instanceof HTMLSelectElement && target.dataset.role === "measurement-search") { state.searchFilter = target.value; render(); return; } if (target instanceof HTMLInputElement && target.dataset.role === "historical-models") { state.showHistoricalModels = target.checked; render(); return; } if (target instanceof HTMLSelectElement && target.name === "frequency") { const form = target.closest("form[data-form='schedule']"); if (form) syncScheduleFields(form); } });
  document.addEventListener("click", async (event) => {
    const clicked = event.target;
    if (clicked instanceof Element && clicked.hasAttribute("data-modal-backdrop")) { state.modal = ""; render(); return; }
    const origin = event.target instanceof Element ? event.target.closest("button,[data-point]") : null;
    if (!origin) return;
    const navTarget = origin.getAttribute("data-nav-target");
    if (navTarget) { state.activeNav = navTarget; render(); window.requestAnimationFrame(() => document.getElementById(navTarget)?.scrollIntoView({ behavior: "smooth", block: "start" })); return; }
    const pointId = origin.getAttribute("data-point");
    const pointIds = origin.getAttribute("data-points") || pointId || "";
    if (pointId && state.project) { try { state.detail = await Promise.all(pointIds.split(",").filter(Boolean).map((id) => api("/api/projects/" + encoded(state.project.id) + "/measurement-stats/" + encoded(state.snapshot.id) + "/points/" + encoded(id) + "/samples"))); render(); } catch (_) { state.error = "Could not read the evidence for this data point."; render(); } return; }
    const action = origin.getAttribute("data-action");
    const viewMetric = origin.getAttribute("data-view-metric");
    if (viewMetric === "brand_name_mention" || viewMetric === "domain_body_mention") { state.discoveryMetric = viewMetric; render(); return; }
    if (viewMetric === "keyword_association_count" || viewMetric === "keyword_association_coverage" || viewMetric === "keyword_relative_weight") { state.associationMetric = viewMetric; render(); return; }
    if (!action) return;
    if (action === "create" || action === "watchset" || action === "models" || action === "schedule") { state.modal = action === "create" ? "create" : action; render(); return; }
    if (action === "close") { state.modal = ""; render(); return; }
    if (action === "close-drawer") { state.detail = []; render(); return; }
    if (!state.project) return;
    const base = "/api/projects/" + encoded(state.project.id);
    if (action === "schedule-preview") {
      const form = document.querySelector("form[data-form='schedule']");
      if (!(form instanceof HTMLFormElement)) return;
      return perform(origin, "Preview", async () => { state.schedulePreview = (await api(base + "/monitoring-tasks/preview", { method: "POST", body: JSON.stringify({ rule: ruleFromScheduleForm(form) }) })).occurrences || []; });
    }
    const divider = action.indexOf(":");
    const taskAction = divider < 0 ? "" : action.slice(0, divider);
    const taskId = divider < 0 ? "" : action.slice(divider + 1);
    if (taskAction === "task-preview") return perform(origin, "Load preview", async () => { state.taskPreview[taskId] = (await api(base + "/monitoring-tasks/" + encoded(taskId) + "/preview")).occurrences || []; });
    if (taskAction === "task-pause") return perform(origin, "Pause", async () => { await api(base + "/monitoring-tasks/" + encoded(taskId) + "/pause", { method: "POST", body: "{}" }); });
    if (taskAction === "task-resume") return perform(origin, "Resume", async () => { await api(base + "/monitoring-tasks/" + encoded(taskId) + "/resume", { method: "POST", body: "{}" }); });
    if (taskAction === "task-edit") { state.scheduleTaskId = taskId; state.schedulePreview = []; state.modal = "schedule"; render(); return; }
    if (taskAction === "task-delete") { state.deleteTaskId = taskId; render(); return; }
    if (taskAction === "task-confirm-delete") return perform(origin, "Delete", async () => { await api(base + "/monitoring-tasks/" + encoded(taskId), { method: "DELETE" }); state.deleteTaskId = ""; });
    if (action === "create-watchset") return perform(origin, "Save", async () => { const row = await api(base + "/watch-sets", { method: "POST", body: "{}" }); await api(base + "/watch-sets/" + encoded(row.watchSet.id) + "/confirm", { method: "POST", body: "{}" }); state.modal = ""; });
    if (action === "save-configuration") return perform(origin, "Save", async () => { await api(base + "/baselines", { method: "POST", body: "{}" }); });
    if (action === "save-models") return perform(origin, "Save", async () => { const selections = []; document.querySelectorAll("input[data-model]").forEach((box) => { if (box.checked) { const modelId = box.getAttribute("data-model"); const select = document.querySelector("select[data-mode='" + modelId + "']"); selections.push({ modelId, webSearchMode: select ? select.value : "off" }); } }); await api(base + "/models", { method: "PUT", body: JSON.stringify({ selections }) }); state.modal = ""; });
    if (action === "run") return perform(origin, "Create run", async () => { await api(base + "/measurement-runs", { method: "POST", body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }) }); });
    if (action === "new-models") return perform(origin, "Create a run for newly added models", async () => { await api(base + "/measurement-runs/new-models", { method: "POST", body: "{}" }); });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.modal) { state.modal = ""; render(); return; }
    const target = event.target;
    if (!(target instanceof Element) || !target.hasAttribute("data-point")) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.dataset.form === "project") { event.preventDefault(); const button = form.querySelector("button[type='submit']"); return perform(button, "Create project", async () => { const data = new FormData(form); const created = await api("/api/projects", { method: "POST", body: JSON.stringify({ domain: String(data.get("domain") || ""), name: String(data.get("name") || "") }) }); selectProject(created.project.id); state.modal = ""; }); }
    if (form.dataset.form === "schedule" && state.project) { event.preventDefault(); const button = form.querySelector("button[type='submit']"); return perform(button, form.dataset.taskId ? "Save task" : "Create task", async () => { const data = new FormData(form); const modelScope = []; form.querySelectorAll("input[data-schedule-model]").forEach((box) => { if (box.checked) { const modelId = box.getAttribute("data-schedule-model"); if (modelId) modelScope.push(modelId); } }); const body = JSON.stringify({ name: String(data.get("name") || ""), rule: ruleFromScheduleForm(form), modelScope }); const taskId = form.dataset.taskId || ""; await api("/api/projects/" + encoded(state.project.id) + "/monitoring-tasks" + (taskId ? "/" + encoded(taskId) : ""), { method: taskId ? "PATCH" : "POST", body }); state.modal = ""; state.scheduleTaskId = ""; state.schedulePreview = []; }); }
  });
  document.addEventListener("visibilitychange", () => {
    document.documentElement.classList.toggle("p5-page-hidden", document.hidden);
  });
  const begin = () => {
    if (!window.__citegeoPhase2) { window.setTimeout(begin, 20); return; }
    load();
  };
  begin();
})();
</script>`;

export function renderProductPhase5AppHtml(): string {
  return renderProductPhase4AppHtml().replace("</body>", `${phase5Script}</body>`);
}
