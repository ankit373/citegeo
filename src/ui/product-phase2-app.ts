import { PRODUCT_NAME, PRODUCT_TITLE, renderCiteGeoLockup, renderCiteGeoMarkSvg } from "./brand.js";

export function renderProductPhase2AppHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <link rel="icon" type="image/svg+xml" href="/assets/brand/citegeo-emblem.svg"><link rel="apple-touch-icon" href="/assets/brand/citegeo-emblem.svg">
  <title>${PRODUCT_TITLE}</title>
  <style>
    :root { --bg:#14120F; --sidebar:#0E0C0A; --panel:#1C1914; --panel-hover:#24201A; --line:#332C22; --line-strong:#4A4030; --text:#F2EEE4; --muted:#A89C87; --weak:#6E6455; --confirmed:#7FA06E; --confirmed-text:#9DBC8E; --unknown:#C9973E; --unknown-text:#DBB05F; --failed:#B2503B; --failed-text:#CC7157; --motion-fast:120ms; --motion-normal:200ms; --ease-standard:cubic-bezier(.22,1,.36,1); --ease-press:cubic-bezier(.2,.8,.2,1); }
    * { box-sizing:border-box; }
    body { font-variant-numeric:tabular-nums; margin:0; min-height:100vh; background:var(--bg); color:var(--text); font-family:"General Sans",ui-sans-serif,system-ui,-apple-system,sans-serif; }
    h1,h2,h3 { font-family:"Cabinet Grotesk",ui-sans-serif,system-ui,sans-serif; letter-spacing:-0.01em; }
    .domain,.mono { font-family:"JetBrains Mono",ui-monospace,monospace; font-variant-numeric:tabular-nums; }
    button,input,select { font:inherit; }
    button { color:inherit; cursor:pointer; }
    button:disabled { cursor:not-allowed; opacity:.58; }
    button:focus-visible,input:focus-visible,select:focus-visible { outline:2px solid var(--text); outline-offset:2px; }
    .shell { min-height:100vh; display:grid; grid-template-columns:248px minmax(0,1fr); }
    .sidebar { background:var(--sidebar); border-right:1px solid var(--line); display:flex; flex-direction:column; padding:22px 16px; }
    .brand { display:flex; align-items:center; min-height:48px; margin:0 8px 28px; }
    .brand-lockup { display:block; width:min(100%,190px); }
    .brand-lockup img { display:block; width:100%; height:auto; }
    .brand-lockup-image { display:block; width:min(100%,190px); height:auto; }
    .brand-mark { width:30px; height:30px; display:grid; place-items:center; }
    .brand-mark svg { width:30px; height:30px; }
    .brand-title { display:grid; gap:2px; font-size:14px; }
    .brand-title strong { font-size:16px; letter-spacing:0; }
    .brand-title span,.subtle,.field-help,.model-meta { color:var(--muted); }
    .brand-title span { font-size:12px; }
    .project-label { color:var(--weak); font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; margin:0 8px 7px; }
    .project-select,input,select { width:100%; min-height:40px; border:1px solid var(--line-strong); border-radius:8px; background:var(--sidebar); color:var(--text); padding:0 10px; }
    .nav { margin-top:24px; display:grid; gap:4px; }
    .nav-item { min-height:42px; border:1px solid transparent; border-radius:8px; background:transparent; color:var(--muted); text-align:left; padding:0 12px; transition:transform var(--motion-fast) var(--ease-press),background-color var(--motion-fast) var(--ease-standard),border-color var(--motion-fast) var(--ease-standard),color var(--motion-fast) var(--ease-standard); }
    .nav-item:hover,.nav-item:focus-visible,.nav-item.active { background:var(--panel); border-color:var(--line); color:var(--text); }
    .nav-item:active,.button:active,.card-action:active { transform:translateY(1px) scale(.98); }
    .sidebar-bottom { margin-top:auto; padding:16px 8px 0; color:var(--weak); font-size:12px; }
    .workspace { min-width:0; padding:32px clamp(20px,4vw,64px); }
    .topbar { display:flex; justify-content:space-between; align-items:center; gap:16px; border-bottom:1px solid var(--line); padding-bottom:20px; }
    .crumb { color:var(--muted); font-size:14px; }
    .crumb strong { color:var(--text); }
    .button { position:relative; min-height:38px; border-radius:8px; border:1px solid var(--line-strong); background:var(--panel); padding:0 13px; font-weight:700; transition:transform var(--motion-fast) var(--ease-press),background-color var(--motion-fast) var(--ease-standard),border-color var(--motion-fast) var(--ease-standard),color var(--motion-fast) var(--ease-standard),opacity var(--motion-fast) var(--ease-standard); }
    .button:hover,.button:focus-visible { background:var(--panel-hover); border-color:#555; }
    .button.primary { background:var(--text); border-color:var(--text); color:var(--bg); }
    .button.primary:hover,.button.primary:focus-visible { background:var(--muted); border-color:var(--muted); }
    /* The failed colour reports an evidence state; chrome must not borrow it. */
    .button.danger { color:var(--text); border-color:var(--line-strong); }
    .button.danger:hover { border-color:var(--text); }
    .button[data-action-state="loading"] { color:var(--muted); }
    .button[data-action-state="loading"]::before { content:""; display:inline-block; width:12px; height:12px; margin-right:7px; vertical-align:-1px; border:2px solid currentColor; border-right-color:transparent; border-radius:50%; animation:spin 700ms linear infinite; }
    .button[data-action-state="success"] { color:var(--confirmed-text); border-color:#2E3A26; }
    .button[data-action-state="error"] { color:var(--failed-text); border-color:#4A2620; }
    .content { max-width:1440px; margin:0 auto; padding-top:28px; }
    /* No entrance animation: a view is static content, not a state change. */
    .view { }
    h1 { margin:0; font-size:32px; letter-spacing:-0.01em; }
    h2 { margin:0; font-size:22px; }
    h3 { margin:0; font-size:17px; }
    p { line-height:1.55; }
    .heading { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; }
    .toolbar,.actions,.card-actions,.inline-actions { display:flex; gap:9px; flex-wrap:wrap; }
    .heading .button,.heading .inline-actions .button { white-space:nowrap; }
    .toolbar { margin:24px 0 18px; }
    .filter { border:1px solid var(--line); background:transparent; color:var(--muted); padding:8px 10px; border-radius:7px; transition:background-color var(--motion-fast) var(--ease-standard),border-color var(--motion-fast) var(--ease-standard),transform var(--motion-fast) var(--ease-press); }
    .filter:hover,.filter:focus-visible,.filter.active { background:var(--panel); color:var(--text); border-color:var(--line-strong); }
    .filter:active { transform:translateY(1px) scale(.98); }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:12px; }
    .card,.detail,.section-card { border:1px solid var(--line); border-radius:8px; background:var(--panel); padding:18px; transition:border-color var(--motion-fast) var(--ease-standard),background-color var(--motion-fast) var(--ease-standard); }
    .card:hover,.card:focus-within { border-color:var(--line-strong); background:var(--panel-hover); }
    .mcols-project { grid-template-columns:minmax(0,1.1fr) minmax(0,1.2fr) 86px 148px auto; }
    .mcols-provider { grid-template-columns:minmax(0,1fr) 210px 124px minmax(0,1.5fr); align-items:start; }
    .mcols-vis { grid-template-columns:minmax(0,1fr) 120px 110px; }
    .mcols-voice { grid-template-columns:minmax(0,1fr) 110px 120px; }
    .mcols-cited { grid-template-columns:minmax(0,1fr) 100px minmax(0,1fr); }
    .mcols-crawler { grid-template-columns:minmax(0,1fr) 92px 84px 84px 108px; }
    .mcols-signal { grid-template-columns:130px minmax(0,1fr); align-items:start; }
    .mcols-credential { grid-template-columns:minmax(0,1fr) 120px minmax(0,1.3fr); }
    .credential-control { display:flex; gap:8px; align-items:center; }
    .credential-control input { flex:1; min-width:0; }
    .step.plan-step { grid-template-columns:66px minmax(0,1fr); align-items:start; }
    .plan-step .step-index { font-size:10px; letter-spacing:.07em; text-transform:uppercase; padding-top:2px; }
    .rowlink { background:none; border:0; padding:0; text-align:left; font-size:13px; font-weight:600; font-family:inherit; color:var(--text); }
    .rowlink:hover { text-decoration:underline; }
    .mrow.is-selected { box-shadow:inset 2px 0 0 var(--text); }
    .card.selected { border-color:var(--text); }
    .card-select { display:block; width:100%; color:inherit; background:transparent; border:0; padding:0; text-align:left; }
    .card-header { display:flex; justify-content:space-between; gap:10px; align-items:center; }
    .domain { font-feature-settings:"tnum" 1; color:var(--muted); margin-top:8px; overflow-wrap:anywhere; }
    .meta { display:flex; gap:8px; flex-wrap:wrap; margin-top:15px; color:var(--weak); font-size:12px; }
    .tag { border:1px solid var(--line); border-radius:999px; padding:3px 8px; font-size:12px; }
    .tag.draft { color:var(--unknown-text); border-color:#4A3A1E; }
    .tag.archived { color:var(--muted); }
    .tag.deleted { color:var(--failed-text); border-color:#4A2620; }
    .tag.ready { color:var(--confirmed-text); border-color:#2E3A26; }
    .tag.warning { color:var(--unknown-text); border-color:#4A3A1E; }
    .card-action { min-height:32px; border:1px solid var(--line-strong); border-radius:6px; background:var(--sidebar); color:var(--muted); padding:0 9px; font-size:12px; font-weight:700; transition:transform var(--motion-fast) var(--ease-press),background-color var(--motion-fast) var(--ease-standard),border-color var(--motion-fast) var(--ease-standard); }
    .card-action:hover,.card-action:focus-visible { background:var(--panel-hover); border-color:#555; color:var(--text); }
    .card-action.danger { color:var(--text); border-color:var(--line-strong); }
    .empty { border:1px dashed var(--line-strong); min-height:230px; display:grid; place-items:center; text-align:center; padding:30px; border-radius:8px; }
    .empty-copy { max-width:500px; }
    .empty .button { margin-top:15px; }
    .detail { margin-top:24px; }
    .detail-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:14px; margin:19px 0 22px; }
    .detail-cell { display:grid; gap:5px; }
    .detail-cell span { color:var(--weak); font-size:12px; }
    .detail-cell strong { overflow-wrap:anywhere; }
    .form { display:grid; gap:16px; }
    .field { display:grid; gap:8px; }
    label { font-size:13px; font-weight:700; }
    .field-help { font-size:12px; margin:0; }
    .form-title { font-size:13px; margin:22px 0 0; padding-top:16px; border-top:1px solid var(--line); }
    .form-status { min-height:20px; color:var(--muted); font-size:13px; margin:12px 0; }
    .form-status.error { color:var(--failed-text); }
    .form-status.success { color:var(--confirmed-text); }
    .form-status.loading { color:var(--muted); }
    .drawer-backdrop { position:fixed; z-index:4; inset:0; background:rgba(0,0,0,.62); opacity:0; pointer-events:none; transition:opacity var(--motion-normal) var(--ease-standard); }
    .drawer { position:fixed; z-index:5; top:0; right:0; bottom:0; width:min(530px,100vw); background:var(--sidebar); border-left:1px solid var(--line-strong); transform:translateX(100%); transition:transform var(--motion-normal) var(--ease-standard); padding:26px; overflow:auto; }
    body.drawer-open .drawer-backdrop { opacity:1; pointer-events:auto; }
    body.drawer-open .drawer { transform:translateX(0); }
    .drawer-head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:28px; }
    .close { width:34px; min-width:34px; height:34px; border:1px solid var(--line); border-radius:7px; background:var(--panel); }
    .drawer-footer { display:flex; justify-content:space-between; gap:12px; border-top:1px solid var(--line); margin-top:28px; padding-top:18px; }
    .section-stack { display:grid; gap:14px; margin-top:22px; }
    .section-card { padding:20px; }
    .section-head { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; margin-bottom:14px; }
    .protocol-list { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:8px; padding:0; margin:15px 0 0; list-style:none; }
    .protocol-list li { border:1px solid var(--line); background:var(--sidebar); border-radius:7px; padding:10px; color:var(--muted); font-size:13px; }
    .model-search { margin:18px 0 12px; }
    .model-catalog-controls { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:10px; margin-bottom:12px; }
    .model-catalog-controls label { display:grid; gap:6px; color:var(--weak); font-size:12px; }
    .model-catalog-controls select { min-width:0; }
    .catalog-result-summary { color:var(--weak); font-size:12px; margin:0 0 12px; }
    .model-list { display:grid; gap:8px; max-height:620px; overflow:auto; padding-right:3px; }
    .mtable { margin-top:14px; border-top:1px solid var(--line); }
    .mhead,.mrow { display:grid; align-items:center; gap:14px; padding:8px; border-bottom:1px solid var(--line); }
    .mhead { font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--weak); }
    .mrow { transition:background-color var(--motion-fast) var(--ease-standard); }
    .mrow:hover,.mrow:focus-within { background:var(--panel-hover); }
    .mcols-selected { grid-template-columns:minmax(0,1fr) 104px 92px 178px; }
    .mcols-readonly { grid-template-columns:minmax(0,1fr) 104px 178px; }
    .mcols-catalog { grid-template-columns:20px minmax(0,1fr) 116px 96px 178px; }
    .mname { min-width:0; }
    .mname strong { display:block; font-size:13px; line-height:1.35; }
    .mname span { display:block; font-size:11px; color:var(--weak); overflow-wrap:anywhere; }
    .mcell { font-size:12px; color:var(--muted); min-width:0; overflow-wrap:anywhere; }
    .state-ok { color:var(--confirmed-text); }
    .state-flag { color:var(--unknown-text); }
    .state-bad { color:var(--failed-text); }
    .mrow select { width:100%; }
    .mrow input[type="checkbox"] { width:16px; min-height:16px; accent-color:var(--text); }
    .mlegend { font-size:12px; color:var(--weak); margin:10px 2px 0; }
    .countstrip { display:flex; flex-wrap:wrap; gap:8px 26px; margin-top:14px; }
    .countstrip .count { display:grid; gap:1px; font-size:12px; color:var(--muted); }
    .countstrip .count strong { font-size:19px; font-family:"JetBrains Mono",ui-monospace,monospace; color:var(--text); }
    .countstrip .is-zero,.countstrip .is-zero strong { color:var(--weak); }
    .bulk { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
    .model-name { min-width:0; display:grid; gap:4px; }
    .model-name strong,.model-name span { overflow-wrap:anywhere; }
    .model-name span { color:var(--weak); font-size:12px; }
    .model-meta { display:flex; gap:6px; flex-wrap:wrap; font-size:12px; }
    .model-mode { display:grid; gap:5px; }
    .model-mode label { color:var(--weak); font-size:11px; }
    .baseline-list { display:grid; gap:8px; margin-top:14px; }
    .baseline-row { display:grid; grid-template-columns:minmax(0,1fr) 150px; align-items:start; gap:14px; border:1px solid var(--line); border-radius:7px; padding:11px; background:var(--sidebar); }
    .baseline-row strong { display:block; font-size:13px; }
    .baseline-row span { display:block; color:var(--weak); font-size:12px; margin-top:3px; overflow-wrap:anywhere; }
    .status-line { display:flex; gap:9px; flex-wrap:wrap; align-items:center; color:var(--muted); font-size:13px; }
    .warning-box { border:1px solid #4A3A1E; background:#1F1810; padding:12px; border-radius:7px; color:var(--unknown-text); }
    .success-box { border:1px solid #2E3A26; background:#161B12; padding:12px; border-radius:7px; color:var(--confirmed-text); }
    .technical-details { border:1px solid var(--line); border-radius:8px; background:var(--sidebar); padding:14px 16px; color:var(--muted); }
    .technical-details summary { color:var(--text); cursor:pointer; font-weight:700; }
    .technical-details[open] summary { margin-bottom:14px; }
    .run-list { display:grid; gap:12px; }
    .run-row { border:1px solid var(--line); background:var(--sidebar); border-radius:8px; padding:14px; display:grid; gap:10px; }
    .run-row-head,.model-run-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
    .run-row h3,.model-run-card h3 { margin:0; }
    .model-run-list { display:grid; gap:10px; }
    .model-run-card { border:1px solid var(--line); border-radius:8px; padding:14px; background:var(--sidebar); display:grid; gap:12px; }
    .model-run-card.running { border-color:var(--line-strong); }
    .model-run-card.completed,.model-run-card.unknown { border-color:#2E3A26; }
    .model-run-card.failed,.model-run-card.unsupported { border-color:#4A2620; }
    /* The data is a matrix, so it reads as rows with rule lines. No card-in-card. */
    .nav-label { margin:16px 8px 6px; color:var(--weak); font-size:11px; letter-spacing:.08em; text-transform:uppercase; }
    .nav-step { display:inline-block; width:16px; color:var(--weak); font-variant-numeric:tabular-nums; }
    .nav-item.active .nav-step { color:var(--text); }
    .steps { list-style:none; margin:0; padding:0; border-top:1px solid var(--line); }
    .step { display:grid; grid-template-columns:28px minmax(0,1fr) auto auto auto; align-items:center; gap:14px; padding:12px 0; border-bottom:1px solid var(--line); }
    .step-index { color:var(--weak); font-variant-numeric:tabular-nums; }
    .step-label { font-weight:600; }
    .step-note { color:var(--muted); font-size:12px; }
    .step-mark { font-size:12px; color:var(--weak); white-space:nowrap; }
    .step[data-state="done"] .step-index,.step[data-state="done"] .step-mark { color:var(--confirmed-text); }
    .step[data-state="done"] .step-label { color:var(--muted); font-weight:400; }
    .step[data-state="next"] .step-mark { color:var(--text); }
    .step[data-state="todo"] .step-label { color:var(--weak); }
    .step[data-state="warn"] .step-mark,.step[data-state="warn"] .step-index { color:var(--unknown-text); }
    .step-action:empty { display:none; }
    @media(max-width:760px){ .step { grid-template-columns:24px minmax(0,1fr); } .step-note,.step-mark { grid-column:2; } }
    .recognition-summary { display:grid; grid-template-columns:minmax(140px,210px) minmax(0,1fr); border-top:1px solid var(--line); margin-top:14px; }
    .recognition-summary > div { display:contents; }
    .recognition-summary span { padding:10px 16px 10px 0; border-bottom:1px solid var(--line); color:var(--muted); font-size:12px; }
    .recognition-summary strong { padding:10px 0; border-bottom:1px solid var(--line); overflow-wrap:anywhere; font-weight:600; }
    .evidence-details { border:1px solid var(--line); border-radius:7px; padding:12px; background:var(--sidebar); }
    .evidence-details summary { cursor:pointer; font-weight:700; }
    .evidence-details[open] summary { margin-bottom:12px; }
    .evidence-group { display:grid; gap:7px; margin-top:14px; }
    .evidence-group h4 { margin:0; font-size:13px; }
    .evidence-group ul { margin:0; padding-left:18px; display:grid; gap:5px; color:var(--muted); }
    .raw-answer { max-height:360px; overflow:auto; white-space:pre-wrap; overflow-wrap:anywhere; margin:0; padding:12px; border:1px solid var(--line); border-radius:6px; background:var(--bg); color:var(--muted); font-size:12px; line-height:1.55; }
    .raw-answer mark { background:rgba(201,151,62,0.22); color:var(--unknown-text); border-bottom:1px solid var(--unknown); border-radius:2px; scroll-margin:28px; }
    .evidence-jump { margin-left:7px; padding:0; border:0; background:transparent; color:var(--text); text-decoration:underline; cursor:pointer; font:inherit; font-size:12px; }
    .evidence-jump:hover,.evidence-jump:focus-visible { color:var(--muted); text-decoration:underline; outline:none; }
    .attempt-row { border-top:1px solid var(--line); padding-top:10px; color:var(--muted); font-size:12px; display:grid; gap:5px; }
    @keyframes spin { to { transform:rotate(360deg); } }
    @media (max-width:840px) {
      .shell { grid-template-columns:1fr; }
      /* Hiding the sidebar here left no way to navigate at all on a phone. */
      .sidebar { border-right:0; border-bottom:1px solid var(--line); padding:14px 16px; }
      .brand { margin:0 0 14px; }
      .nav { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .nav-label,.sidebar-bottom { display:none; }
      .workspace { padding:22px 16px; }
      .topbar,.heading,.section-head { align-items:flex-start; flex-direction:column; }
      /* Fixed column widths do not fit, so every table stacks. */
      .mhead { display:none; }
      .mcols-selected,.mcols-readonly,.mcols-project,.mcols-provider { grid-template-columns:minmax(0,1fr); gap:6px; }
      .mcols-catalog { grid-template-columns:20px minmax(0,1fr); gap:6px 10px; }
      .mcols-catalog > *:nth-child(n+3) { grid-column:2; }
      .card-actions { margin-top:2px; }
    }
    @media (prefers-reduced-motion:reduce) { *,*::before,*::after { animation-duration:.01ms !important; transition-duration:.01ms !important; } }
  </style>
</head>
<body>
  <div id="app"></div>
  <div id="drawer-backdrop" class="drawer-backdrop"></div>
  <aside id="project-drawer" class="drawer" aria-label="New project" aria-hidden="true" data-testid="project-drawer">
    <div class="drawer-head"><div><h2>New project</h2><p class="subtle">Just enter a domain. The project is saved as a draft first, and models are configured in the next step.</p></div><button id="close-drawer" type="button" class="close" aria-label="Close">×</button></div>
    <form id="project-form" class="form" autocomplete="off">
      <div class="field"><label for="project-domain">Primary domain</label><input id="project-domain" name="domain" placeholder="example.com" required><p class="field-help">A normalized domain can be bound to only one project that has not been deleted.</p></div>
      <div class="field"><label for="project-name">Project name</label><input id="project-name" name="name" placeholder="Optional"></div>
      <div id="form-status" class="form-status" aria-live="polite"></div>
      <div class="drawer-footer"><button id="cancel-draft" type="button" class="button">Cancel</button><button id="save-draft" type="submit" class="button primary" data-testid="save-draft">Save draft</button></div>
    </form>
  </aside>
  <script>
    const state = { page:"overview", mode:"current", projects:[], currentProjects:[], selectedId:new URL(window.location.href).searchParams.get("projectId") || localStorage.getItem("citegeo.product.projectId") || "", providers:[], providersState:"idle", insights:null, insightsState:"idle", crawlers:null, crawlersState:"idle", plan:null, planState:"idle", signals:null, signalsState:"idle", credentials:null, credentialsState:"idle", credentialNotice:{text:"",kind:""}, catalog:[], catalogState:"idle", catalogError:"", query:"", catalogProvider:"", catalogNativeSearch:"all", catalogSort:"name", selections:[], draftSelections:new Map(), selectionsDirty:false, baselines:[], monitoringConfiguration:null, configurationState:"idle", drawerSession:0, modelNotice:{ text:"", kind:"" }, monitoringNotice:{ text:"", kind:"" }, modelActionState:"idle", monitoringSaveState:"idle", recognitionRuns:[], recognitionDetail:null, recognitionModelDetails:{}, recognitionSelectedRunId:"", recognitionNotice:{ text:"", kind:"" }, recognitionActionState:"idle", recognitionRefreshTimer:0 };
    const app = document.getElementById("app");
    const element = (id) => document.getElementById(id);
    const html = (value) => String(value).split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;").split('"').join("&quot;").split("'").join("&#39;");
    const project = () => state.currentProjects.find((item) => item.id === state.selectedId) || null;
    const formatTime = (value) => new Date(value).toLocaleString();
    const modeText = (mode) => mode === "provider_native" ? "Provider Native web search" : "Offline";
    const statusText = (status) => status === "draft" ? "Draft" : status === "active" ? "Running" : status === "archived" ? "Archived" : "Deleted";
    function setSelectedProject(projectId) { state.selectedId = projectId || ""; if (state.selectedId) localStorage.setItem("citegeo.product.projectId", state.selectedId); else localStorage.removeItem("citegeo.product.projectId"); const next = new URL(window.location.href); if (state.selectedId) next.searchParams.set("projectId", state.selectedId); else next.searchParams.delete("projectId"); window.history.replaceState({ projectId:state.selectedId }, "", next); }
    function setDrawer(open) { document.body.classList.toggle("drawer-open", open); element("project-drawer").setAttribute("aria-hidden", String(!open)); }
    function openDrawer() { state.drawerSession += 1; setFormStatus("", ""); setDrawer(true); window.setTimeout(() => element("project-domain").focus(), 0); }
    function closeDrawer() { state.drawerSession += 1; setDrawer(false); }
    function setFormStatus(message, kind) { const target = element("form-status"); target.textContent = message || ""; target.className = kind ? "form-status " + kind : "form-status"; }
    const expectedErrorText = { invalid_project_input:"Invalid project input. Check the domain and name.", project_not_found:"The project does not exist or has been deleted.", project_domain_conflict:"This domain is already used by another project.", project_state_conflict:"The project\\'s current status does not allow this action.", project_endpoint_not_found:"The requested project action does not exist.", configuration_invalid:"Invalid configuration. Check the models and their web search modes.", baseline_unchanged:"The current configuration is already saved.", baseline_not_found:"That configuration version does not exist.", model_catalog_unavailable:"The model catalog is temporarily unavailable. Try again shortly.", configuration_operation_failed:"Could not save the configuration. Try again.", recognition_invalid:"The recognition test cannot start. Check the configuration, or wait for the running test to finish.", recognition_run_not_found:"That recognition test record does not exist.", recognition_model_run_not_found:"That model execution record does not exist.", recognition_operation_failed:"The recognition test action failed. Try again.", project_operation_failed:"The project action failed. Try again.", request_failed:"The request did not complete. Check your network and try again." };
    function requestError(code) { const error = new Error(expectedErrorText[code] || expectedErrorText.request_failed); error.code = code || "request_failed"; return error; }
    function errorCode(error) { return error && typeof error === "object" && typeof error.code === "string" ? error.code : "request_failed"; }
    async function request(path, options) { try { const response = await fetch(path, options); const text = await response.text(); let body = {}; if (text) body = JSON.parse(text); if (!response.ok) throw requestError(typeof body.code === "string" ? body.code : "request_failed"); return body; } catch (error) { if (error && typeof error === "object" && typeof error.code === "string") throw error; throw requestError("request_failed"); } }
    function buttonState(button, value, label) { if (!button) return; if (!button.dataset.originalLabel) button.dataset.originalLabel = button.textContent; button.dataset.actionState = value; button.textContent = label; button.disabled = value === "loading"; }
    function restoreButton(button) { if (!button) return; button.disabled = false; button.dataset.actionState = "idle"; button.textContent = button.dataset.originalLabel || button.textContent; }
    async function runAction(button, labels, work) { if (!button || button.disabled) return; buttonState(button, "loading", labels.loading); try { const value = await work(); buttonState(button, "success", labels.success); window.setTimeout(() => restoreButton(button), 850); return value; } catch (error) { buttonState(button, "error", labels.error); window.setTimeout(() => restoreButton(button), 1200); throw error; } }
    function currentList() { if (state.mode === "archived") return state.projects.filter((item) => item.status === "archived"); if (state.mode === "deleted") return state.projects.filter((item) => item.status === "deleted"); return state.projects.filter((item) => item.status === "draft" || item.status === "active"); }
    function listUrl() { if (state.mode === "archived") return "/api/projects?includeArchived=true"; if (state.mode === "deleted") return "/api/projects?includeDeleted=true"; return "/api/projects"; }
    async function refreshProjects() { const responses = state.mode === "current" ? [await request("/api/projects")] : await Promise.all([request("/api/projects"), request(listUrl())]); state.currentProjects = responses[0].projects; state.projects = state.mode === "current" ? state.currentProjects : responses[1].projects; if (!state.currentProjects.some((item) => item.id === state.selectedId)) setSelectedProject(state.currentProjects[0] ? state.currentProjects[0].id : ""); else setSelectedProject(state.selectedId); }
    function resetDraftSelections() { state.draftSelections = new Map(state.selections.map((selection) => [selection.modelId, selection.webSearchMode])); state.selectionsDirty = false; }
    async function refreshConfiguration() { const selected = project(); if (!selected) { state.selections = []; state.baselines = []; state.monitoringConfiguration = null; resetDraftSelections(); return; } state.configurationState = "loading"; render(); try { const result = await Promise.all([request("/api/projects/" + encodeURIComponent(selected.id) + "/models"), request("/api/projects/" + encodeURIComponent(selected.id) + "/baselines"), request("/api/projects/" + encodeURIComponent(selected.id) + "/monitoring-configuration")]); state.selections = result[0].selections; state.baselines = result[1].baselines; state.monitoringConfiguration = result[2].configuration; if (!state.selectionsDirty) resetDraftSelections(); state.configurationState = "ready"; } catch (error) { state.configurationState = "error"; state.monitoringNotice = { text:error instanceof Error ? error.message : expectedErrorText.request_failed, kind:"error" }; } render(); }
    async function loadCatalog() { if (state.catalogState === "loading" || state.catalogState === "ready") return; state.catalogState = "loading"; state.catalogError = ""; render(); try { const result = await request("/api/provider-models"); state.catalog = result.models; state.catalogState = "ready"; } catch (error) { state.catalogState = "error"; state.catalogError = error instanceof Error ? error.message : String(error); } render(); }
    function cardActions(item) { if (state.mode === "archived") return '<div class="card-actions"><button type="button" class="card-action" data-project-action="restore" data-project-id="' + html(item.id) + '">Restore project</button></div>'; if (state.mode === "deleted") return '<div class="card-actions"><button type="button" class="card-action" data-project-action="restore" data-project-id="' + html(item.id) + '">Restore project</button><button type="button" class="card-action danger" data-project-action="purge" data-project-id="' + html(item.id) + '">Purge permanently</button></div>'; return '<div class="card-actions"><button type="button" class="card-action" data-project-action="archive" data-project-id="' + html(item.id) + '">Archive</button><button type="button" class="card-action danger" data-project-action="delete" data-project-id="' + html(item.id) + '">Delete</button></div>'; }
    function renderProjectCards() { const rows = currentList(); if (rows.length === 0) { const title = state.mode === "current" ? "No projects yet" : state.mode === "archived" ? "No archived projects" : "No recently deleted projects"; const copy = state.mode === "current" ? "Once you enter a domain, the project is saved as a draft immediately." : "Project lifecycle records are kept here."; return '<div class="empty"><div class="empty-copy" data-testid="empty-state"><h2>' + title + '</h2><p class="subtle">' + copy + '</p>' + (state.mode === "current" ? '<button id="empty-new-project" type="button" class="button primary">New project</button>' : '') + '</div></div>'; }
      return '<div class="mtable" data-testid="project-list"><div class="mhead mcols-project"><span>Project</span><span>Domain</span><span>Status</span><span>Updated</span><span></span></div>' + rows.map((item) => '<div class="mrow mcols-project ' + (item.id === state.selectedId ? "is-selected" : "") + '" data-testid="project-card" data-project-id="' + html(item.id) + '"><button type="button" class="rowlink" data-project-action="select" data-project-id="' + html(item.id) + '" data-testid="project-title">' + html(item.name) + '</button><span class="mcell mono" data-testid="project-domain">' + html(item.normalizedDomain) + '</span><span class="tag ' + html(item.status) + '">' + statusText(item.status) + '</span><span class="mcell mono">' + html(formatTime(item.updatedAt)) + '</span>' + cardActions(item) + '</div>').join("") + '</div>'; }
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
      const rows = activity.crawlers.map((row) => '<div class="mrow mcols-crawler"><div class="mname"><strong>' + html(row.name) + '</strong><span>' + html(row.engine) + ' · ' + html(row.purpose === "live_fetch" ? "fetches when asked" : row.purpose === "training" ? "training crawl" : "search index") + '</span></div><span class="mcell">' + row.fetches + '</span><span class="mcell">' + row.pages + '</span><span class="mcell ' + (row.errorRate ? "state-flag" : "") + '">' + (row.errorRate === null ? "n/a" : Math.round(row.errorRate * 100) + "%") + '</span><span class="mcell mono">' + html(row.lastSeen ? row.lastSeen.slice(0, 10) : "unknown") + '</span></div>').join("");
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
    async function captureSignals(button) {
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
    function signalFacts(signals) {
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
      const rows = snapshots.map((snapshot) => {
        const when = snapshot.capturedAt ? snapshot.capturedAt.slice(0, 16).split("T").join(" ") : "unknown";
        const changes = (snapshot.changes || []).length
          ? '<ul class="protocol-list">' + snapshot.changes.map((change) => '<li><span class="' + (change.direction === "regressed" ? "state-bad" : change.direction === "improved" ? "state-ok" : "state-flag") + '">' + html(change.direction) + '</span> ' + html(change.detail) + '</li>').join("") + '</ul>'
          : '<span class="step-note">No change from the probe before it.</span>';
        return '<div class="mrow mcols-signal"><span class="mcell mono">' + html(when) + '</span><div class="mname"><span class="step-note">' + html(signalFacts(snapshot.signals)) + '</span>' + changes + '</div></div>';
      }).join("");
      return head + '<div class="mtable"><div class="mhead mcols-signal"><span>Probed</span><span>What it saw, and what moved</span></div>' + rows + '</div></section>';
    }
    function renderActionPlan() {
      if (state.planState === "idle") { loadPlan(); }
      const head = '<section class="section-card"><div class="section-head"><div><h2>What to do next</h2><p class="subtle">Ordered by what decides whether a model can cite you at all. Every line names the observation behind it.</p></div><div class="inline-actions"><button type="button" class="button" data-probe-signals>Probe the site</button></div></div>';
      if (state.planState !== "ready" || !state.plan) {
        return head + '<p class="subtle">' + (state.planState === "error" ? "Could not build a plan." : "Building the plan…") + '</p></section>';
      }
      const plan = state.plan;
      if (!plan.probed) {
        return head + '<div class="warning-box">' + html(plan.detail || "No site probe yet.") + '</div></section>';
      }
      const changes = (plan.changes || []).length
        ? '<div class="warning-box"><strong>Changed since the previous probe</strong><ul class="protocol-list">' + plan.changes.map((change) => '<li><span class="' + (change.direction === "regressed" ? "state-bad" : change.direction === "improved" ? "state-ok" : "state-flag") + '">' + html(change.direction) + '</span> ' + html(change.detail) + '</li>').join("") + '</ul></div>'
        : '';
      const open = plan.actions.filter((action) => action.severity !== "done");
      const done = plan.actions.filter((action) => action.severity === "done");
      const row = (action) => '<li class="step plan-step" data-state="' + (action.severity === "critical" ? "warn" : action.severity === "done" ? "done" : "next") + '">'
        + '<span class="step-index ' + (action.severity === "critical" ? "state-bad" : action.severity === "high" ? "state-flag" : "") + '">' + html(action.severity === "done" ? "ok" : action.severity) + '</span>'
        + '<span class="step-label"><strong>' + html(action.title) + '</strong><br><span class="step-note">' + html(action.evidence) + '</span>'
        + (action.severity === "done" ? '' : '<br><span class="step-note state-ok">Fix: ' + html(action.fix) + '</span>')
        + '</span></li>';
      return head + changes
        + (open.length ? '<ol class="steps">' + open.map(row).join("") + '</ol>' : '<p class="subtle">Nothing outstanding.</p>')
        + (done.length ? '<details class="technical-details"><summary>' + done.length + ' already in place</summary><ol class="steps">' + done.map(row).join("") + '</ol></details>' : '')
        + '<p class="mlegend">Probed ' + html(plan.capturedAt ? plan.capturedAt.slice(0, 16).split("T").join(" ") : "never") + '.</p></section>';
    }
    function percent(value) { return value === null || value === undefined ? '<span class="state-flag">not comparable</span>' : '<strong>' + Math.round(value * 100) + '%</strong>'; }
    function insightTable(columns, head, rows, empty) {
      if (!rows.length) return '<p class="subtle">' + html(empty) + '</p>';
      return '<div class="mtable"><div class="mhead ' + columns + '">' + head.map((label) => '<span>' + html(label) + '</span>').join("") + '</div>' + rows.join("") + '</div>';
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
      const modelRows = v.byModel.map((row) => '<div class="mrow mcols-vis"><div class="mname"><strong>' + html(row.displayName) + '</strong><span class="mono">' + html(row.modelId) + '</span></div><span class="mcell">' + row.recognized + ' / ' + row.answered + '</span><span class="mcell">' + percent(row.score) + '</span></div>').join("");
      const voiceRow = (row, isTarget) => '<div class="mrow mcols-voice"><div class="mname"><strong>' + html(row.name) + (isTarget ? ' <span class="state-ok">you</span>' : '') + '</strong>' + (row.domain ? '<span class="mono">' + html(row.domain) + '</span>' : '') + '</div><span class="mcell">' + row.mentions + '</span><span class="mcell">' + percent(row.share) + '</span></div>';
      const voiceRows = [voiceRow(sov.target, true)].concat(sov.competitors.map((row) => voiceRow(row, false))).join("");
      const citedRows = core.citations.domains.map((row) => '<div class="mrow mcols-cited"><div class="mname"><strong class="mono">' + html(row.domain) + '</strong>' + (row.isTarget ? '<span class="state-ok">your domain</span>' : '') + '</div><span class="mcell">' + row.answers + '</span><span class="mcell">' + html(row.models.join(", ")) + '</span></div>').join("");
      const gapRows = data.citationGap.map((row) => '<div class="mrow mcols-cited"><div class="mname"><strong class="mono">' + html(row.domain) + '</strong><span>cited alongside ' + html(row.competitors.join(", ")) + '</span></div><span class="mcell">' + row.answers + '</span><span class="mcell">' + html(row.models.join(", ")) + '</span></div>').join("");
      const audit = data.claimAudit;
      const auditRows = [].concat(
        audit.disagreements.map((row) => '<li><strong>Models disagree on ' + html(row.field) + '</strong><br><span class="subtle">' + row.variants.map((variant) => html(variant.value) + ' (' + variant.models.length + ')').join(" vs ") + '</span></li>'),
        audit.unsourced.map((row) => '<li><strong class="state-flag">' + html(row.field) + ' asserted with no source</strong><br><span class="subtle">' + row.count + ' answer(s) from ' + html(row.models.join(", ")) + '</span></li>'),
        audit.mismatches.map((row) => '<li><strong class="state-bad">' + html(row.field) + ' shares nothing with what you declare</strong><br><span class="subtle">they say "' + html(row.asserted) + '", you say "' + html(row.declared) + '"</span></li>'),
      ).join("");
      const categoryRows = core.categories.map((row) => '<li>' + html(row.value) + ' <span class="subtle">' + row.count + '</span></li>').join("");
      return '<section class="view"><div class="heading"><div><h1>Visibility</h1><p class="subtle">Pooled from ' + data.runsConsidered + ' run(s) and ' + core.answered + ' parsed answer(s) for ' + html(data.domain) + '.</p></div><div class="inline-actions"><button type="button" class="button" data-reload-insights>Recompute</button></div></div>'
        + renderActionPlan()
        + '<div class="countstrip"><span class="count"><strong>' + (v.score === null ? "n/a" : Math.round(v.score * 100) + "%") + '</strong>Visibility</span><span class="count"><strong>' + v.recognized + '</strong>Recognised</span><span class="count"><strong>' + v.answered + '</strong>Answers</span><span class="count"><strong>' + core.citations.targetCitedIn + '</strong>Answers citing you</span><span class="count"><strong>' + data.citationGap.length + '</strong>Citation gaps</span></div>'
        + '<section class="section-card"><div class="section-head"><div><h2>Visibility by model</h2><p class="subtle">Answers where the model said it recognised the domain.</p></div></div>' + insightTable("mcols-vis", ["Model", "Recognised", "Visibility"], v.byModel.length ? [modelRows] : [], "No parsed answers yet.") + '</section>'
        + '<section class="section-card"><div class="section-head"><div><h2>Share of voice</h2><p class="subtle">Counted once per answer. A share needs a competitor to be a share of.</p></div></div>' + insightTable("mcols-voice", ["Brand", "Mentions", "Share"], [voiceRows], "Nothing named yet.") + '</section>'
        + '<section class="section-card"><div class="section-head"><div><h2>Citation gap</h2><p class="subtle">Cited when a competitor is named, never when you are. This is the shortest list of places to get into.</p></div></div>' + insightTable("mcols-cited", ["Domain", "Answers", "Models"], gapRows ? [gapRows] : [], "No gap yet. It fills in once answers name competitors, which needs web search enabled.") + '</section>'
        + '<section class="section-card"><div class="section-head"><div><h2>Cited sources</h2><p class="subtle">Every domain the answers cited.</p></div></div>' + insightTable("mcols-cited", ["Domain", "Answers", "Models"], citedRows ? [citedRows] : [], "No citations captured yet.") + '</section>'
        + '<section class="section-card"><div class="section-head"><div><h2>Claim audit</h2><p class="subtle">Disagreement, assertions with no source, and claims unlike your own description.</p></div></div>' + (auditRows ? '<ul class="protocol-list">' + auditRows + '</ul>' : '<p class="subtle">Nothing flagged across ' + audit.answers + ' answer(s).</p>') + '</section>'
        + renderCrawlerSection() + renderSignalHistory() + '<section class="section-card"><div class="section-head"><div><h2>How the models categorise you</h2><p class="subtle">Their words, counted.</p></div></div>' + (categoryRows ? '<ul class="protocol-list">' + categoryRows + '</ul>' : '<p class="subtle">No category returned yet.</p>') + '</section></section>';
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
    async function saveCredential(providerId, button) {
      const field = document.querySelector('[data-credential-input="' + providerId + '"]');
      const secret = field ? field.value : "";
      try {
        const result = await runAction(button, { loading:"Saving…", success:"Saved", error:"Refused" }, () => request("/api/credentials/" + encodeURIComponent(providerId), { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ secret:secret }) }));
        state.credentialNotice = { text:result.detail || "Stored.", kind:"success" };
      } catch (error) {
        state.credentialNotice = { text:error instanceof Error ? error.message : String(error), kind:"error" };
      }
      if (field) field.value = "";
      state.credentialsState = "idle";
      state.providersState = "idle";
      loadCredentials();
      loadProviders();
    }
    async function clearCredential(providerId, button) {
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
    function renderCredentials() {
      if (state.credentialsState === "idle") { loadCredentials(); }
      const head = '<section class="section-card"><div class="section-head"><div><h2>Provider keys</h2><p class="subtle">A key set here is encrypted at rest and never returned by the API. Only the last four characters are ever shown.</p></div></div>';
      if (state.credentialsState !== "ready" || !state.credentials) {
        return head + '<p class="subtle">Reading key status…</p></section>';
      }
      const data = state.credentials;
      if (data.closed) {
        return head + '<div class="warning-box">Key entry is closed because this server has no password. Set <span class="mono">AUTH_PASSWORD</span> and restart, or keep using <span class="mono">.env</span>.</div></section>';
      }
      const notice = state.credentialNotice.text
        ? '<div class="' + (state.credentialNotice.kind === "error" ? "warning-box" : "success-box") + '">' + html(state.credentialNotice.text) + '</div>'
        : '';
      const disabled = data.storageEnabled
        ? ''
        : '<div class="warning-box">Storing keys here needs <span class="mono">CREDENTIAL_KEY</span>, 32 bytes. Without it a stored key could not survive a restart, so the form stays read-only.</div>';
      const rows = (data.credentials || []).map((row) => {
        const known = row.last4 ? '<span class="mono">••••' + html(row.last4) + '</span>' : '<span class="state-flag">not set</span>';
        const where = row.source === "environment"
          ? '<span class="mcell">from <span class="mono">' + html(row.envKeys.join(" or ")) + '</span></span>'
          : '<span class="mcell">' + (row.source === "stored" ? "stored here" : "none") + '</span>';
        const control = !row.editable
          ? '<span class="step-note">Set in the environment, so it cannot be changed here.</span>'
          : !data.storageEnabled
            ? '<span class="step-note">Needs CREDENTIAL_KEY.</span>'
            : '<span class="credential-control"><input type="password" autocomplete="off" placeholder="Paste a key" data-credential-input="' + html(row.providerId) + '"><button type="button" class="button" data-credential-save="' + html(row.providerId) + '">Save</button>' + (row.source === "stored" ? '<button type="button" class="button danger" data-credential-clear="' + html(row.providerId) + '">Remove</button>' : '') + '</span>';
        return '<div class="mrow mcols-credential"><div class="mname"><strong>' + html(row.providerId) + '</strong>' + where + '</div><span class="mcell">' + known + '</span>' + control + '</div>';
      }).join("");
      return head + notice + disabled + '<div class="mtable"><div class="mhead mcols-credential"><span>Provider</span><span>Key</span><span>Change</span></div>' + rows + '</div></section>';
    }
    function renderSetup() {
      if (state.providersState === "idle") { loadProviders(); }
      if (state.providersState !== "ready") {
        return '<section class="view"><div class="heading"><div><h1>Setup</h1><p class="subtle">Which providers this machine can actually run.</p></div></div><div class="empty"><div class="empty-copy"><h2>' + (state.providersState === "error" ? "Could not read provider status" : "Checking providers") + '</h2></div></div></section>';
      }
      const rows = state.providers.map((provider) => {
        const paidBlocked = Boolean(provider.balance && !provider.balance.paidModelsRunnable);
        const mark = !provider.configured ? "Not configured"
          : !provider.reachable ? "Unreachable"
          : paidBlocked && provider.freeModels ? "Free models only"
          : !provider.runnableNow ? "Out of credit"
          : "Ready";
        const mode = provider.runnableNow ? "done" : provider.configured ? "warn" : "todo";
        const counts = provider.modelCount + ' models'
          + (provider.freeModels ? ' \\u00b7 ' + provider.freeModels + ' free to run' : '')
          + (provider.nativeWebSearchModels ? ' \\u00b7 ' + provider.nativeWebSearchModels + ' with web search' : '');
        const stateClass = mode === "done" ? "state-ok" : mode === "warn" ? "state-flag" : "";
        return '<div class="mrow mcols-provider" data-state="' + mode + '">'
          + '<div class="mname"><strong>' + html(provider.label) + '</strong><span class="mono">' + html(provider.endpoint || "not set") + '</span></div>'
          + '<span class="mcell">' + counts + '</span>'
          + '<span class="mcell ' + stateClass + '">' + html(mark) + '</span>'
          + '<span class="mcell">' + html(provider.detail) + '</span></div>';
      }).join("");
      const runnable = state.providers.filter((provider) => provider.runnableNow);
      const banner = runnable.length
        ? ''
        : '<div class="warning-box">Nothing can run right now. Every configured provider is either out of credit, unreachable or has no models. A run started now would fail once per selected model.</div>';
      const envRows = state.providers.map((provider) => '<li>' + html(provider.label) + ': <span class="mono">' + html(provider.envKeys.join(", ")) + '</span></li>').join("");
      return '<section class="view"><div class="heading"><div><h1>Setup</h1><p class="subtle">Which providers this machine can actually run, and what each one costs you.</p></div><div class="inline-actions"><button type="button" class="button" data-reload-providers>Re-check</button></div></div>'
        + banner
        + '<section class="section-card"><div class="section-head"><div><h2>Providers</h2><p class="subtle">A provider appears in the model picker only when it is configured and answering.</p></div></div><div class="mtable"><div class="mhead mcols-provider"><span>Provider</span><span>Catalog</span><span>Status</span><span>What this means</span></div>' + rows + '</div></section>'
        + renderCredentials() + '<section class="section-card"><div class="section-head"><div><h2>Where these come from</h2><p class="subtle">Set in .env at the repository root, then restart the server.</p></div></div><ul class="protocol-list">' + envRows + '<li>Local gateway endpoint: <span class="mono">OPENAI_COMPATIBLE_BASE_URL</span></li></ul></section></section>';
    }

    function resultsSwitch(active) {
      const has = state.recognitionRuns.length > 0;
      const tab = (page, label, enabled) => '<button type="button" class="filter ' + (active === page ? "active" : "") + '" data-page="' + page + '"' + (enabled ? "" : " disabled") + '>' + label + '</button>';
      return '<div class="toolbar">' + tab("reports", "Report", has) + tab("recognition", "Run detail", true) + '</div>';
    }

    function renderNextSteps(configuration) {
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
        const button = index === next ? '<button type="button" class="button primary" data-page="' + step.page + '">' + html(step.action) + '</button>' : "";
        return '<li class="step" data-state="' + state_ + '"><span class="step-index">' + (index + 1) + '</span><span class="step-label">' + html(step.label) + '</span><span class="step-note">' + html(step.note) + '</span><span class="step-mark">' + mark + '</span><span class="step-action">' + button + '</span></li>';
      }).join("");
      return '<section class="section-card"><div class="section-head"><div><h2>Getting a result</h2><p class="subtle">Three steps, in order. Each one unlocks the next.</p></div></div><ol class="steps">' + rows + '</ol></section>';
    }
    function renderOverview() { const selected = project(); if (!selected) return '<section class="view"><div class="heading"><div><h1>Project</h1><p class="subtle">Create a project before configuring AI models and monitoring.</p></div></div>' + renderProjectCards() + '</section>'; const configuration = monitoringConfiguration(); return '<section class="view"><div class="heading"><div><h1>Project overview</h1><p class="subtle">A project is bound to one domain. Save models and web search modes as the fixed configuration for later monitoring.</p></div></div><div class="toolbar"><button type="button" class="filter ' + (state.mode === "current" ? "active" : "") + '" data-list-mode="current">Current</button><button type="button" class="filter ' + (state.mode === "archived" ? "active" : "") + '" data-list-mode="archived">Archived</button><button type="button" class="filter ' + (state.mode === "deleted" ? "active" : "") + '" data-list-mode="deleted">Recently deleted</button></div>' + renderNextSteps(configuration) + renderProjectCards() + '<section class="detail"><div class="card-header"><div><h2 data-testid="selected-project-title">' + html(selected.name) + '</h2><p class="subtle">The saved record for this project.</p></div></div><div class="detail-grid"><div class="detail-cell"><span>Primary domain</span><strong class="mono" data-testid="selected-project-domain">' + html(selected.normalizedDomain) + '</strong></div><div class="detail-cell"><span>Selected models</span><strong>' + state.selections.length + '</strong></div><div class="detail-cell"><span>Current version</span><strong>' + html(configuration.currentVersion ? "v" + configuration.currentVersion : "Not saved yet") + '</strong></div><div class="detail-cell"><span>Project ID</span><strong data-testid="selected-project-id">' + html(selected.id) + '</strong></div></div><form id="project-edit-form" class="form"><h3 class="form-title">Edit this project</h3><div class="field"><label for="edit-domain">Primary domain</label><input id="edit-domain" value="' + html(selected.primaryDomain) + '"></div><div class="field"><label for="edit-name">Project name</label><input id="edit-name" value="' + html(selected.name) + '"></div><div class="actions"><button type="submit" class="button primary" data-testid="save-project">Save project</button><button id="archive-project" type="button" class="button" data-testid="archive-project">Archive</button><button id="delete-project" type="button" class="button danger" data-testid="delete-project">Delete project</button></div></form></section></section>'; }
    function selectedRows() { const byId = new Map(state.catalog.map((item) => [item.modelId, item])); return Array.from(state.draftSelections.entries()).map(([modelId, webSearchMode]) => ({ model:byId.get(modelId) || state.selections.find((item) => item.modelId === modelId), modelId, webSearchMode })).filter((item) => item.model); }
    function providerShortLabel(providerId) { return providerId === "openrouter" ? "OpenRouter" : providerId === "azure-openai" ? "Azure" : "Local"; }
    function openRouterOutOfCredit() { return state.providers.some((provider) => provider.providerId === "openrouter" && provider.balance && !provider.balance.paidModelsRunnable); }
    function modelIsBlocked(model, modelId) { return Boolean(model) && model.providerId === "openrouter" && !modelId.endsWith(":free") && openRouterOutOfCredit(); }
    function runsNowCell(model, modelId) { if (model && model.available === false) return '<span class="mcell state-bad" title="' + html(model.unavailableReason || "") + '">Never</span>'; return modelIsBlocked(model, modelId) ? '<span class="mcell state-flag">No credit</span>' : '<span class="mcell state-ok">Yes</span>'; }
    function webSearchSelect(modelId, mode, nativeSupported, attribute) { return '<select data-' + attribute + '="' + html(modelId) + '" ' + (nativeSupported ? "" : "disabled") + '><option value="off" ' + (mode === "off" ? "selected" : "") + '>Offline</option><option value="provider_native" ' + (mode === "provider_native" ? "selected" : "") + '>Native web search</option></select>'; }
    function renderSelectedModels(readOnly) { const rows = selectedRows(); if (rows.length === 0) return '<p class="subtle">No models selected yet.</p>'; const columns = readOnly ? "mcols-readonly" : "mcols-selected"; const head = '<div class="mhead ' + columns + '"><span>Model</span><span>Provider</span>' + (readOnly ? '' : '<span>Runs now</span>') + '<span>Web search</span></div>'; const body = rows.map((row) => { const nativeSupported = row.model.nativeWebSearchSupported === true; const mode = readOnly ? '<span class="mcell">' + html(modeText(row.webSearchMode)) + '</span>' : webSearchSelect(row.modelId, row.webSearchMode, nativeSupported, "selected-model-mode"); return '<div class="mrow selection-row ' + columns + '"><div class="mname"><strong>' + html(row.model.displayName) + '</strong><span class="mono">' + html(row.modelId) + '</span></div><span class="mcell">' + html(providerShortLabel(row.model.providerId)) + '</span>' + (readOnly ? '' : runsNowCell(row.model, row.modelId)) + mode + '</div>'; }).join(""); return '<div class="mtable">' + head + body + '</div>' + (readOnly ? '' : '<p class="mlegend">Web search stays Offline for models with no provider-native search.</p>'); }
    function catalogVendor(item) { const supplied = typeof item.vendor === "string" ? item.vendor.trim() : ""; if (supplied) return supplied; const name = String(item.displayName || ""); const separator = name.indexOf(":"); if (separator > 0) return name.slice(0, separator).trim(); const modelId = String(item.modelId || ""); const namespaceEnd = modelId.indexOf("/"); return namespaceEnd > 0 ? modelId.slice(0, namespaceEnd) : modelId; }
    function catalogReleasedAt(item) { if (typeof item.releasedAt !== "string" || !item.releasedAt) return null; const timestamp = new Date(item.releasedAt).getTime(); return Number.isFinite(timestamp) ? timestamp : null; }
    function catalogVendors() { return Array.from(new Set(state.catalog.map((item) => catalogVendor(item)).filter((vendor) => vendor.length > 0))).sort((left, right) => left.localeCompare(right)); }
    function filteredCatalogModels() { const query = state.query.toLocaleLowerCase(); const results = state.catalog.filter((item) => { const vendor = catalogVendor(item); const matchesQuery = item.displayName.toLocaleLowerCase().includes(query) || item.modelId.toLocaleLowerCase().includes(query) || vendor.toLocaleLowerCase().includes(query); const matchesVendor = !state.catalogProvider || vendor === state.catalogProvider; const matchesSearch = state.catalogNativeSearch === "all" || (state.catalogNativeSearch === "supported" ? item.nativeWebSearchSupported : !item.nativeWebSearchSupported); return matchesQuery && matchesVendor && matchesSearch; }); results.sort((left, right) => { const leftVendor = catalogVendor(left); const rightVendor = catalogVendor(right); if (state.catalogSort === "vendor") { const vendorOrder = leftVendor.localeCompare(rightVendor); return vendorOrder || left.displayName.localeCompare(right.displayName); } if (state.catalogSort === "newest" || state.catalogSort === "oldest") { const leftReleasedAt = catalogReleasedAt(left); const rightReleasedAt = catalogReleasedAt(right); if (leftReleasedAt === null && rightReleasedAt === null) return left.displayName.localeCompare(right.displayName); if (leftReleasedAt === null) return 1; if (rightReleasedAt === null) return -1; return state.catalogSort === "newest" ? rightReleasedAt - leftReleasedAt : leftReleasedAt - rightReleasedAt; } return left.displayName.localeCompare(right.displayName); }); return results.slice(0, 80); }
    function catalogResultSummary(count) { return 'Show ' + count + '  models. When sorting by release date, models with no date in the catalog are listed last.'; }
    function catalogHead() { return '<div class="mhead mcols-catalog"><span></span><span>Model</span><span>Vendor</span><span>Runs now</span><span>Web search</span></div>'; }
    function renderCatalogModelRows(results) { return results.map((item) => { const chosen = state.draftSelections.get(item.modelId); const isChosen = chosen !== undefined; const vendor = catalogVendor(item); const releasedAt = catalogReleasedAt(item); const released = releasedAt === null ? ' \\u00b7 no release date' : ' \\u00b7 ' + new Date(releasedAt).toLocaleDateString(); const releasedTitle = releasedAt === null ? ' title="Catalog does not provide a release date"' : ''; return '<div class="mrow mcols-catalog" data-testid="catalog-model" data-model-id="' + html(item.modelId) + '" data-model-vendor="' + html(vendor) + '" data-model-released-at="' + html(releasedAt === null ? "" : String(releasedAt)) + '" data-native-search="' + String(item.nativeWebSearchSupported) + '"><input type="checkbox" data-model-checkbox="' + html(item.modelId) + '" ' + (isChosen ? "checked" : "") + (item.available ? "" : " disabled") + ' aria-label="Select ' + html(item.displayName) + '"><div class="mname"><strong>' + html(item.displayName) + '</strong><span class="mono"' + releasedTitle + '>' + html(item.modelId) + html(released) + '</span>' + (item.available ? '' : '<span class="state-bad">' + html(item.unavailableReason || "Unavailable") + '</span>') + '</div><span class="mcell">' + html(vendor) + '</span>' + runsNowCell(item, item.modelId) + webSearchSelect(item.modelId, chosen || "off", isChosen && item.nativeWebSearchSupported, "model-mode") + '</div>'; }).join(""); }
    function refreshCatalogSearchResults() { const list = document.querySelector(".model-list"); const summary = document.querySelector(".catalog-result-summary"); if (!list || !summary || state.catalogState !== "ready") { render(); return; } const results = filteredCatalogModels(); summary.textContent = catalogResultSummary(results.length); list.innerHTML = results.length === 0 ? '<p class="subtle">No matching models.</p>' : renderCatalogModelRows(results); }
    function blockedSelectionBanner() {
      if (state.providersState !== "ready") return '';
      const stalled = state.providers.some((provider) => provider.providerId === "openrouter" && provider.balance && !provider.balance.paidModelsRunnable);
      if (!stalled) return '';
      const rows = selectedRows();
      const blocked = rows.filter((row) => row.model && row.model.providerId === "openrouter" && !row.modelId.endsWith(":free"));
      if (!blocked.length) return '';
      return '<div class="warning-box">' + blocked.length + ' of these ' + rows.length + ' models cannot run right now. This OpenRouter account has no credit, so each one answers HTTP 402 and returns no answer. Models ending in :free still run, and local gateway models cost nothing. Setup shows the full picture.</div>';
    }
    function renderModels() { if (state.providersState === "idle") { loadProviders(); } const selected = project(); if (!selected) return '<section class="view"><div class="empty"><div class="empty-copy"><h2>Select a project first</h2><p class="subtle">A model configuration belongs to a single project.</p></div></div></section>'; const vendors = catalogVendors(); const results = filteredCatalogModels(); const list = state.catalogState === "idle" || state.catalogState === "loading" ? '<p class="subtle">Loading the OpenRouter model catalog…</p>' : state.catalogState === "error" ? '<div class="warning-box"><strong>Model catalog unavailable</strong><p>' + html(state.catalogError) + '</p><button id="retry-catalog" type="button" class="button" data-testid="retry-catalog">Retry</button></div>' : results.length === 0 ? '<p class="subtle">No matching models.</p>' : '<p class="catalog-result-summary">' + catalogResultSummary(results.length) + '</p><div class="mtable">' + catalogHead() + renderCatalogModelRows(results) + '</div>'; const notice = state.modelNotice.text || (state.selectionsDirty ? "Configuration not saved yet" : ""); const noticeClass = state.modelNotice.kind || (state.selectionsDirty ? "warning" : ""); const saveLabel = state.modelActionState === "error" ? "Retry saving model configuration" : "Save model configuration"; const vendorOptions = vendors.map((vendor) => '<option value="' + html(vendor) + '" ' + (state.catalogProvider === vendor ? "selected" : "") + '>' + html(vendor) + '</option>').join(""); const cfg = monitoringConfiguration(); return '<section class="view"><div class="heading"><div><h1>Choose models</h1><p class="subtle">Pick the models to ask, set each one\\'s web search mode, then save them as this project\\'s configuration. Currently ' + (cfg.currentVersion ? "saved as v" + cfg.currentVersion : "not saved") + '.</p></div><div class="inline-actions"><button id="save-models" type="button" class="button" data-testid="save-models" data-action-state="' + state.modelActionState + '">' + saveLabel + '</button>' + saveConfigurationButton(cfg, state.selections.length > 0) + '</div></div><div id="models-status" class="form-status ' + noticeClass + '" aria-live="polite">' + html(notice) + '</div><div class="section-stack"><section class="section-card"><div class="section-head"><div><h2>Selected models</h2><p class="subtle">Select one or more models.</p></div><span class="tag">' + selectedRows().length + '  selected</span></div>' + blockedSelectionBanner() + renderSelectedModels() + '</section><section class="section-card"><div class="section-head"><div><h2>Model catalog</h2><p class="subtle">Searchable and multi-select. A provider that is unreachable contributes nothing; no fabricated models are shown.</p></div><span class="tag ' + (state.catalogState === "ready" ? "ready" : state.catalogState === "error" ? "warning" : "") + '">' + (state.catalogState === "ready" ? "Catalog available" : state.catalogState === "error" ? "Catalog error" : "Loading") + '</span></div><input id="model-search" class="model-search" data-testid="model-search" type="search" value="' + html(state.query) + '" placeholder="Search by model name, model ID or vendor"><div class="model-catalog-controls"><label for="model-provider-filter">Model vendor<select id="model-provider-filter" data-testid="model-provider-filter"><option value="">All vendors</option>' + vendorOptions + '</select></label><label for="model-native-search-filter">Web search capability<select id="model-native-search-filter" data-testid="model-native-search-filter"><option value="all" ' + (state.catalogNativeSearch === "all" ? "selected" : "") + '>All</option><option value="supported" ' + (state.catalogNativeSearch === "supported" ? "selected" : "") + '>Supports native web search</option><option value="unsupported" ' + (state.catalogNativeSearch === "unsupported" ? "selected" : "") + '>Does not support native web search</option></select></label><label for="model-catalog-sort">Sort<select id="model-catalog-sort" data-testid="model-catalog-sort"><option value="name" ' + (state.catalogSort === "name" ? "selected" : "") + '>Name A-Z</option><option value="vendor" ' + (state.catalogSort === "vendor" ? "selected" : "") + '>Vendor A-Z</option><option value="newest" ' + (state.catalogSort === "newest" ? "selected" : "") + '>Release date: newest first</option><option value="oldest" ' + (state.catalogSort === "oldest" ? "selected" : "") + '>Release date: oldest first</option></select></label></div>' + list + '</section></div></section>'; }
    function configurationVisualState(configuration) { return state.monitoringSaveState === "idle" ? configuration.status : state.monitoringSaveState; }
    function renderConfigurationDiff(configuration) { const diff = configuration.diff; const rows = []; for (const item of diff.addedModels) rows.push("Models added: " + item.displayName); for (const item of diff.removedModels) rows.push("Models removed: " + item.displayName); for (const item of diff.webSearchModeChanges) rows.push("Web search mode change: " + item.displayName + " from \\"" + modeText(item.previousMode) + "\\" to \\"" + modeText(item.currentMode) + "\\""); if (diff.protocolVersionChange) rows.push("Protocol version change: " + diff.protocolVersionChange.previous + " → " + diff.protocolVersionChange.current); if (diff.domainChange) rows.push("Domain change: " + diff.domainChange.previous + " → " + diff.domainChange.current); if (diff.languageChange) rows.push("Output language change: " + diff.languageChange.previous + " → " + diff.languageChange.current); if (rows.length === 0) return ""; return '<section class="section-card" data-testid="configuration-diff"><div class="section-head"><div><h2>Changes in this run</h2><p class="subtle">Saving creates a new configuration version.</p></div></div><ul class="protocol-list">' + rows.map((row) => '<li>' + html(row) + '</li>').join("") + '</ul></section>'; }
    function renderConfigurationRows(configuration) { if (state.baselines.length === 0) return '<p class="subtle">No past configurations yet.</p>'; const currentId = configuration.currentBaseline ? configuration.currentBaseline.id : ""; return '<div class="baseline-list">' + state.baselines.map((baseline) => '<article class="baseline-row" data-testid="configuration-version-row" data-configuration-id="' + html(baseline.id) + '"><div><strong>config v' + baseline.version + (currentId === baseline.id ? " · Current version" : "") + '</strong><span>' + html(baseline.normalizedDomain) + ' · ' + baseline.modelSnapshots.length + '  models</span><span>' + baseline.modelSnapshots.map((item) => html(item.displayName + "（" + modeText(item.webSearchMode) + "）")).join(", ") + '</span></div><span class="tag mono">' + html(formatTime(baseline.createdAt)) + '</span></article>').join("") + '</div>'; }
    function renderTechnicalDetails(configuration) { const protocol = configuration.currentProtocol; const capabilities = configuration.currentModelSnapshots.length ? configuration.currentModelSnapshots.map((item) => '<li>' + html(item.displayName + " · " + formatTime(item.capabilityCheckedAt)) + '</li>').join("") : '<li>The capability check time is recorded once models are saved.</li>'; return '<details class="technical-details"><summary>Technical details</summary><div class="detail-grid"><div class="detail-cell"><span>Protocol</span><strong>' + html(protocol.protocolId + "/" + protocol.protocolVersion) + '</strong></div><div class="detail-cell"><span>Protocol hash</span><strong>' + html(protocol.promptTemplateHash || "Recorded on first save") + '</strong></div><div class="detail-cell"><span>Input scope</span><strong>Domain only</strong></div><div class="detail-cell"><span>Output language</span><strong>' + html(configuration.currentLanguage) + '</strong></div></div><p class="field-help">Model capability check time</p><ul class="protocol-list">' + capabilities + '</ul></details>'; }
    function saveConfigurationButton(configuration, hasModels) { const visual = configurationVisualState(configuration); const disabled = !hasModels || visual === "unchanged" || visual === "saving" || visual === "saved"; const label = visual === "no_version" ? "Save config v1" : visual === "unchanged" ? "✓ Current configuration saved" : visual === "changed" ? "Save as config v" + configuration.nextVersion : visual === "saving" ? "Saving…" : visual === "saved" ? "✓ Saved as v" + configuration.currentVersion : "Save again"; return '<button id="save-monitoring-configuration" type="button" class="button primary" data-testid="save-monitoring-configuration" data-action-state="' + visual + '" ' + (disabled ? "disabled" : "") + '>' + label + '</button>'; }
    function renderConfiguration() { const selected = project(); if (!selected) return '<section class="view"><div class="empty"><div class="empty-copy"><h2>Select a project first</h2><p class="subtle">A configuration belongs to a single project.</p></div></div></section>'; if (state.configurationState === "loading") return '<section class="view"><div class="heading"><div><h1>Configuration</h1><p class="subtle">Loading the current configuration…</p></div></div><div class="section-card inline-empty" aria-live="polite">Loading the domain, models and web search modes.</div></section>'; const configuration = monitoringConfiguration(); const hasModels = selectedRows().length > 0; const notice = state.monitoringNotice.text; const noticeKind = state.monitoringNotice.kind; const stateMessage = !hasModels ? "Select at least one available model before saving the configuration." : configuration.status === "no_version" ? "No configuration saved yet. Saving fixes the current domain, language, models and web search modes." : configuration.status === "changed" ? "The models or web search modes have changed. Saving creates a new configuration version." : "The current models and web search modes are saved."; const stateClass = !hasModels || configuration.status === "changed" ? "warning-box" : configuration.status === "unchanged" ? "success-box" : "warning-box"; return '<section class="view"><div class="heading"><div><h1>Configuration</h1><p class="subtle">Save the domain, output language and each model\\'s web search mode as reusable monitoring conditions.</p></div>' + saveConfigurationButton(configuration, hasModels) + '</div><div id="monitoring-configuration-status" data-testid="monitoring-configuration-status" class="form-status ' + html(noticeKind) + '" aria-live="polite">' + html(notice) + '</div><div class="section-stack"><section class="section-card"><div class="section-head"><div><h2>Current version</h2><p class="subtle">Target domain: <span class="mono">' + html(selected.normalizedDomain) + '</span></p></div><span class="tag ' + (configuration.status === "unchanged" ? "ready" : "warning") + '">' + (configuration.currentVersion ? "v" + configuration.currentVersion : "Not saved yet") + '</span></div><div class="' + stateClass + '" data-testid="monitoring-configuration-summary">' + html(stateMessage) + '</div></section><section class="section-card"><div class="section-head"><div><h2>Current model configuration</h2><p class="subtle">Each model stores its own web search mode.</p></div><button type="button" class="button" data-page="models">Adjust models</button></div>' + renderSelectedModels(true) + '</section>' + renderConfigurationDiff(configuration) + '<section class="section-card"><div class="section-head"><div><h2>Past configurations</h2><p class="subtle">Read-only snapshot. Saving a new version does not overwrite past configurations.</p></div></div>' + renderConfigurationRows(configuration) + '</section>' + renderTechnicalDetails(configuration) + '</div></section>'; }
    const brandMark = ${JSON.stringify(renderCiteGeoMarkSvg("phase2-brand-mark").split("\n").join(""))};
    const brandLockup = ${JSON.stringify(renderCiteGeoLockup("brand-lockup-image"))};
    function render() { if (window.__citegeoPhase5Active) return; const selected = project(); const options = state.currentProjects.length ? state.currentProjects.map((item) => '<option value="' + html(item.id) + '">' + html(item.name) + ' · ' + html(item.normalizedDomain) + '</option>').join("") : '<option value="">No projects yet</option>'; let view = state.page === "models" ? renderModels() : state.page === "configuration" ? renderConfiguration() : state.page === "setup" ? renderSetup() : state.page === "visibility" ? renderVisibility() : renderOverview(); app.innerHTML = '<div class="shell"><aside class="sidebar"><div class="brand"><div class="brand-lockup">' + brandLockup + '</div></div><div class="project-label">Project</div><select id="project-select" class="project-select" aria-label="Switch project" data-testid="project-select">' + options + '</select><nav class="nav" aria-label="Project navigation"><button type="button" class="nav-item ' + (state.page === "overview" ? "active" : "") + '" data-page="overview"><span>Overview</span></button><div class="nav-label">Run a test</div><button type="button" class="nav-item ' + (state.page === "models" ? "active" : "") + '" data-page="models"><span class="nav-step">1</span><span>Choose models</span></button><button type="button" class="nav-item ' + (state.page === "recognition" || state.page === "reports" ? "active" : "") + '" data-page="recognition"><span class="nav-step">2</span><span>Results</span></button><button type="button" class="nav-item ' + (state.page === "visibility" ? "active" : "") + '" data-page="visibility"><span class="nav-step">3</span><span>Visibility</span></button><div class="nav-label">Over time</div><a class="nav-item" href="?view=measurements"><span>Continuous measurement</span></a><div class="nav-label">Machine</div><button type="button" class="nav-item ' + (state.page === "configuration" ? "active" : "") + '" data-page="configuration"><span>Configuration history</span></button><button type="button" class="nav-item ' + (state.page === "setup" ? "active" : "") + '" data-page="setup"><span>Setup</span></button></nav><div class="sidebar-bottom">Domain recognition</div></aside><main class="workspace"><header class="topbar"><div class="crumb"><strong>${PRODUCT_NAME}</strong> / ' + html(selected ? selected.name : "Project") + '</div><button id="new-project" type="button" class="button primary" data-testid="new-project">New project</button></header><section class="content">' + view + '</section></main></div>'; const select = element("project-select"); select.value = state.selectedId; document.title = selected ? selected.name + " | ${PRODUCT_TITLE}" : "${PRODUCT_TITLE}"; }
    async function setPage(page) { state.page = page; if (page === "configuration") { await refreshConfiguration(); return; } if (page === "reports" && window.__citegeoPhase4 && typeof window.__citegeoPhase4.open === "function") { await window.__citegeoPhase4.open(); return; } render(); if (page === "models") { await refreshConfiguration(); await loadCatalog(); } }
    async function createDraft(event) { event.preventDefault(); const button = element("save-draft"); const session = state.drawerSession; setFormStatus("Creating project draft", "loading"); try { const response = await runAction(button, { loading:"Saving…", success:"Saved", error:"Save failed" }, () => request("/api/projects", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ domain:element("project-domain").value, name:element("project-name").value }) })); state.mode = "current"; state.page = "overview"; setSelectedProject(response.project.id); await refreshProjects(); state.selections = []; state.baselines = []; resetDraftSelections(); setFormStatus("Draft saved", "success"); render(); window.setTimeout(() => { if (state.drawerSession === session) closeDrawer(); }, 850); } catch (error) { setFormStatus(error instanceof Error ? error.message : String(error), "error"); } }
    async function saveProject(event) { event.preventDefault(); const selected = project(); if (!selected) return; const button = event.currentTarget.querySelector('button[type="submit"]'); try { await runAction(button, { loading:"Saving…", success:"Saved", error:"Save failed" }, () => request("/api/projects/" + encodeURIComponent(selected.id), { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ domain:element("edit-domain").value, name:element("edit-name").value }) })); await refreshProjects(); render(); } catch (error) { window.alert(error instanceof Error ? error.message : String(error)); } }
    async function projectAction(action, projectId, button) { if (action === "select") { setSelectedProject(projectId); state.selectionsDirty = false; await refreshConfiguration(); render(); return; } if (action === "delete" && !window.confirm("The project will be removed from the current list.")) return; if (action === "purge" && !window.confirm("A permanent purge cannot be undone.")) return; const path = "/api/projects/" + encodeURIComponent(projectId) + (action === "archive" ? "/archive" : action === "restore" ? "/restore" : action === "purge" ? "/purge" : ""); const method = action === "delete" || action === "purge" ? "DELETE" : "POST"; const labels = action === "archive" ? { loading:"Archiving…", success:"Archived", error:"Archive failed" } : action === "restore" ? { loading:"Restoring…", success:"Restored", error:"Restore failed" } : action === "purge" ? { loading:"Purging…", success:"Purged", error:"Purge failed" } : { loading:"Deleting…", success:"Deleted", error:"Delete failed" }; try { await runAction(button, labels, () => request(path, { method })); if (state.selectedId === projectId && (action === "archive" || action === "delete" || action === "purge")) setSelectedProject(""); if (action === "restore") { state.mode = "current"; setSelectedProject(projectId); } await refreshProjects(); await refreshConfiguration(); render(); } catch (error) { window.alert(error instanceof Error ? error.message : String(error)); } }
    function changeModel(modelId, checked) { const catalogItem = state.catalog.find((item) => item.modelId === modelId); if (!catalogItem) return; if (!checked) state.draftSelections.delete(modelId); else state.draftSelections.set(modelId, "off"); state.modelNotice = { text:"", kind:"" }; state.modelActionState = "idle"; state.selectionsDirty = true; render(); }
    function changeModelMode(modelId, mode) { const catalogItem = state.catalog.find((item) => item.modelId === modelId); if (!catalogItem || !state.draftSelections.has(modelId)) return; if (mode === "provider_native" && !catalogItem.nativeWebSearchSupported) return; state.modelNotice = { text:"", kind:"" }; state.modelActionState = "idle"; state.draftSelections.set(modelId, mode); state.selectionsDirty = true; render(); }
    async function saveModels(button) { const selected = project(); if (!selected) return; const selections = Array.from(state.draftSelections.entries()).map(([modelId, webSearchMode]) => ({ modelId, webSearchMode })); state.modelNotice = { text:"Saving each model\\'s own web search mode…", kind:"loading" }; try { const response = await runAction(button, { loading:"Saving…", success:"Saved", error:"Save failed" }, () => request("/api/projects/" + encodeURIComponent(selected.id) + "/models", { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ selections }) })); state.selections = response.selections; resetDraftSelections(); state.modelNotice = { text:"Model configuration saved", kind:"success" }; state.modelActionState = "success"; render(); window.setTimeout(() => { state.modelActionState = "idle"; if (state.page === "models") render(); }, 850); } catch (error) { state.modelNotice = { text:error instanceof Error ? error.message : String(error), kind:"error" }; state.modelActionState = "error"; render(); } }
    async function saveMonitoringConfiguration() { const selected = project(); const configuration = monitoringConfiguration(); if (!selected || configuration.status === "unchanged" || state.monitoringSaveState === "saving") return; if (selectedRows().length === 0) { state.monitoringNotice = { text:"Select at least one available model before saving the configuration.", kind:"error" }; state.monitoringSaveState = "failed"; render(); return; } state.monitoringSaveState = "saving"; state.monitoringNotice = { text:"Saving the current domain, language, models and web search modes…", kind:"loading" }; render(); try { const response = await request("/api/projects/" + encodeURIComponent(selected.id) + "/baselines", { method:"POST", headers:{"Content-Type":"application/json"}, body:"{}" }); state.currentProjects = state.currentProjects.map((item) => item.id === response.project.id ? response.project : item); state.projects = state.projects.map((item) => item.id === response.project.id ? response.project : item); await refreshConfiguration(); const version = response.baseline.version; state.monitoringSaveState = "saved"; state.monitoringNotice = { text:"Saved as config v" + version, kind:"success" }; render(); window.setTimeout(() => { state.monitoringSaveState = "idle"; if (state.page === "configuration") render(); }, 850); } catch (error) { if (errorCode(error) === "baseline_unchanged") { await refreshConfiguration(); state.monitoringSaveState = "idle"; state.monitoringNotice = { text:"The current configuration is already saved", kind:"success" }; render(); return; } state.monitoringSaveState = "failed"; state.monitoringNotice = { text:error instanceof Error ? error.message : expectedErrorText.request_failed, kind:"error" }; render(); } }
    document.addEventListener("click", async (event) => { const target = event.target; if (target && target.closest && target.closest("[data-reload-providers]")) { state.providersState = "idle"; loadProviders(); return; }
      if (target && target.closest && target.closest("[data-reload-insights]")) { state.insightsState = "idle"; state.crawlersState = "idle"; state.planState = "idle"; state.signalsState = "idle"; loadInsights(); loadCrawlers(); loadPlan(); loadSignals(); return; }
      const saveCred = target && target.closest ? target.closest("[data-credential-save]") : null;
      if (saveCred) { await saveCredential(saveCred.getAttribute("data-credential-save"), saveCred); return; }
      const clearCred = target && target.closest ? target.closest("[data-credential-clear]") : null;
      if (clearCred) { await clearCredential(clearCred.getAttribute("data-credential-clear"), clearCred); return; }
      const probeButton = target && target.closest ? target.closest("[data-probe-signals]") : null;
      if (probeButton) { await captureSignals(probeButton); state.signalsState = "idle"; loadSignals(); return; } if (!(target instanceof Element)) return; const pageButton = target.closest("[data-page]"); if (pageButton) { await setPage(pageButton.getAttribute("data-page") || "overview"); return; } const listModeButton = target.closest("[data-list-mode]"); if (listModeButton) { state.mode = listModeButton.getAttribute("data-list-mode") || "current"; await refreshProjects(); render(); return; } if (target.id === "new-project" || target.id === "empty-new-project") { openDrawer(); return; } if (target.id === "close-drawer" || target.id === "cancel-draft" || target.id === "drawer-backdrop") { closeDrawer(); return; } if (target.id === "retry-catalog") { state.catalogState = "idle"; await loadCatalog(); return; } if (target.id === "save-models") { await saveModels(target); return; } if (target.id === "save-monitoring-configuration") { await saveMonitoringConfiguration(); return; } if (target.id === "archive-project") { const selected = project(); if (selected) await projectAction("archive", selected.id, target); return; } if (target.id === "delete-project") { const selected = project(); if (selected) await projectAction("delete", selected.id, target); return; } const action = target.closest("[data-project-action]"); if (action) { const projectId = action.getAttribute("data-project-id"); const name = action.getAttribute("data-project-action"); if (projectId && name) await projectAction(name, projectId, action); } });
    document.addEventListener("change", async (event) => { const target = event.target; if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return; if (target.id === "project-select") { setSelectedProject(target.value); state.selectionsDirty = false; await refreshConfiguration(); render(); return; } if (target instanceof HTMLInputElement && target.hasAttribute("data-model-checkbox")) { changeModel(target.getAttribute("data-model-checkbox") || "", target.checked); return; } if (target instanceof HTMLSelectElement && target.hasAttribute("data-model-mode")) { changeModelMode(target.getAttribute("data-model-mode") || "", target.value); return; } if (target instanceof HTMLSelectElement && target.hasAttribute("data-selected-model-mode")) { changeModelMode(target.getAttribute("data-selected-model-mode") || "", target.value); return; } });
    document.addEventListener("change", (event) => { const target = event.target; if (!(target instanceof HTMLSelectElement)) return; if (target.id === "model-provider-filter") { state.catalogProvider = target.value; render(); return; } if (target.id === "model-native-search-filter") { state.catalogNativeSearch = target.value; render(); return; } if (target.id === "model-catalog-sort") { state.catalogSort = target.value; render(); } });
    document.addEventListener("input", (event) => { const target = event.target; if (target instanceof HTMLInputElement && target.id === "model-search") { state.query = target.value; refreshCatalogSearchResults(); } });
    document.addEventListener("submit", (event) => { const target = event.target; if (!(target instanceof HTMLFormElement)) return; if (target.id === "project-form") createDraft(event); if (target.id === "project-edit-form") saveProject(event); });
    refreshProjects().then(async () => { await refreshConfiguration(); render(); }).catch((error) => { app.innerHTML = '<main class="workspace"><div class="warning-box">' + html(error instanceof Error ? error.message : String(error)) + '</div></main>'; });
    function recognitionRunStatusText(status) { return status === "queued" ? "Waiting to start" : status === "running" ? "Running" : status === "completed" ? "Completed" : status === "partial" ? "Partly complete" : "Execution failed"; }
    function recognitionModelStatusText(status) { return status === "queued" ? "Waiting to start" : status === "running" ? "Calling" : status === "response_saved" ? "Answer received" : status === "analysis_failed" ? "Local parse failed" : status === "completed" ? "Completed" : status === "unknown" ? "Model could not confirm" : status === "unsupported" ? "Model does not support it" : "Provider Call failed"; }
    function activeRecognitionRun() { return state.recognitionDetail && (state.recognitionDetail.run.status === "queued" || state.recognitionDetail.run.status === "running") ? state.recognitionDetail.run : null; }
    function recognitionDetailFor(modelRunId) { return state.recognitionModelDetails[modelRunId] || null; }
    function recognitionLink(url, label) { return '<a href="' + html(url) + '" target="_blank" rel="noreferrer">' + html(label) + '</a>'; }
    function recognitionUrlLabel(url) { try { const parsed = new URL(url); return parsed.hostname + parsed.pathname + parsed.search; } catch { return url; } }
    function recognitionEvidenceRows(archive) { const rows = []; const add = (id, evidence) => { if (evidence && typeof evidence.start === "number" && typeof evidence.end === "number") rows.push({ id, start:evidence.start, end:evidence.end }); }; add(archive.result.id + "-brand", archive.result.recognizedBrand.evidence); add(archive.result.id + "-business", archive.result.businessDescription.evidence); add(archive.result.id + "-detail", archive.result.detailedDescription?.evidence); add(archive.result.id + "-category", archive.result.productCategory.evidence); for (const competitor of archive.competitors) { add(competitor.id, competitor.evidence); add(competitor.id + "-business", competitor.businessDescription.evidence); add(competitor.id + "-category", competitor.productCategory.evidence); } for (const keyword of archive.brandKeywords) add(keyword.id, keyword.evidence); for (const keyword of archive.competitorKeywords) add(keyword.id, keyword.evidence); return rows; }
    function evidenceJump(id) { return '<button type="button" class="evidence-jump" data-evidence-target="' + html(id) + '">View evidence</button>'; }
    function evidenceValue(value, id) { return value ? html(value) + evidenceJump(id) : '<span class="state-flag">Unconfirmed</span>'; }
    function recognitionIssue(archive, field) { return (archive.result.fieldIssues || []).find((item) => item.field === field) || null; }
    function recognitionMissingText(archive, field, emptyText, missingText) { const issue = recognitionIssue(archive, field); return issue && issue.kind === "missing_field" ? '<span class="state-flag">' + html(missingText) + '</span>' : html(emptyText); }
    function highlightedRawAnswer(answer, rows) { const sorted = rows.slice().sort((left, right) => left.start - right.start || left.end - right.end); const parts = []; let cursor = 0; for (const row of sorted) { if (row.start < cursor || row.end <= row.start || row.end > answer.length) continue; parts.push(html(answer.slice(cursor, row.start))); parts.push('<mark id="' + html(row.id) + '">' + html(answer.slice(row.start, row.end)) + '</mark>'); cursor = row.end; } parts.push(html(answer.slice(cursor))); return parts.join(""); }
    function renderRecognitionEvidence(detail, modelRun) { const archive = detail.archive; const attempts = detail.attempts || []; const latest = attempts.length ? attempts[attempts.length - 1] : null; const providerCitations = archive && archive.providerCitations.length ? '<ul>' + archive.providerCitations.map((item) => '<li>' + recognitionLink(item.url, item.title || recognitionUrlLabel(item.url)) + '</li>').join("") + '</ul>' : '<p class="subtle">' + (modelRun.recognitionMode === "unaided_domain_recognition" ? "Provider-native web search was not used in this run." : "This model returned no provider citations in this run.") + '</p>'; const answerUrls = archive && archive.answerMentionedUrls.length ? '<ul>' + archive.answerMentionedUrls.map((item) => '<li>' + recognitionLink(item.url, recognitionUrlLabel(item.url)) + '</li>').join("") + '</ul>' : '<p class="subtle">The answer body has no URLs outside the confirmed citations.</p>'; const history = attempts.length ? attempts.map((item) => '<div class="attempt-row"><strong>Attempt ' + item.attemptNumber + ' · ' + html(recognitionModelStatusText(item.status)) + '</strong>' + (item.errorMessage ? '<span>' + html(item.errorMessage) + '</span>' : '') + '</div>').join("") : '<p class="subtle">No attempt records created yet.</p>'; const revisions = detail.analysisRevisions && detail.analysisRevisions.length ? '<ul>' + detail.analysisRevisions.map((revision, index) => '<li>Local parse version ' + (index + 1) + ' · ' + (revision.status === "complete" ? "Parsed" : revision.status === "partial" ? "Partly available" : "Parsing failed") + ' · No model was called</li>').join("") + '</ul>' : '<p class="subtle">No new local parse has been created yet.</p>'; const raw = latest && latest.rawAnswer ? '<pre class="raw-answer">' + highlightedRawAnswer(latest.rawAnswer, archive ? recognitionEvidenceRows(archive) : []) + '</pre>' : '<p class="subtle">This model has not returned a raw answer to show yet.</p>'; return '<details class="evidence-details"><summary>View raw answer and evidence</summary><div class="evidence-group"><h4>Provider Citation</h4>' + providerCitations + '</div><div class="evidence-group"><h4>Plain URLs in the answer</h4>' + answerUrls + '</div><div class="evidence-group"><h4>Raw answer</h4>' + raw + '</div><div class="evidence-group"><h4>Attempt records</h4>' + history + '</div><div class="evidence-group"><h4>Local parse version</h4>' + revisions + '</div></details>'; }
    function renderRecognitionSummary(detail) { const archive = detail.archive; if (!archive) return ''; const competitors = archive.competitors.length ? archive.competitors.map((item) => evidenceValue(item.name, item.id)).join(", ") : recognitionMissingText(archive, "competitors", "This answer listed no competitors", "This answer did not provide this field"); const keywords = archive.brandKeywords.length ? archive.brandKeywords.map((item) => evidenceValue(item.keyword, item.id)).join(", ") : recognitionMissingText(archive, "brandKeywords", "This answer listed no associated keywords", "This answer did not provide this field"); const competitorKeywords = archive.competitors.length ? archive.competitors.map((item) => { const values = archive.competitorKeywords.filter((keyword) => keyword.competitorRecognitionId === item.id).map((keyword) => evidenceValue(keyword.keyword, keyword.id)); return html(item.name) + ": " + (values.length ? values.join(", ") : "This answer did not provide this field"); }).join("; ") : recognitionMissingText(archive, "competitors", "This answer listed no competitors", "This answer did not provide this field"); const domainRecognition = archive.result.domainRecognition === null ? recognitionMissingText(archive, "domainRecognition", "This field does not match the required format", "This answer did not clearly return a recognition status") : archive.result.domainRecognition === "recognized" ? '<span class="state-ok">Model explicitly recognized it</span>' : archive.result.domainRecognition === "not_recognized" ? '<span class="state-bad">Model explicitly did not recognize it</span>' : '<span class="state-flag">Model said it could not confirm</span>'; const detailDescription = archive.result.detailedDescription?.value; const detailText = detailDescription ? evidenceValue(detailDescription, archive.result.id + "-detail") : '<span class="state-flag">This answer gave no detailed description</span>'; const issues = archive.result.fieldIssues && archive.result.fieldIssues.length ? '<details class="technical-details"><summary>Field parsing notes</summary><ul class="protocol-list">' + archive.result.fieldIssues.map((item) => '<li>' + html(item.field + " · " + item.kind + " · " + item.detail) + '</li>').join("") + '</ul></details>' : ""; return '<div class="recognition-summary"><div><span>Brand the model recognized in this run</span><strong>' + evidenceValue(archive.result.recognizedBrand.value, archive.result.id + "-brand") + '</strong></div><div><span>Recognition status</span><strong>' + domainRecognition + '</strong></div><div><span>Business description</span><strong>' + evidenceValue(archive.result.businessDescription.value, archive.result.id + "-business") + '</strong></div><div><span>Detailed description</span><strong>' + detailText + '</strong></div><div><span>Product category</span><strong>' + evidenceValue(archive.result.productCategory.value, archive.result.id + "-category") + '</strong></div><div><span>Recognized competitors</span><strong>' + competitors + '</strong></div><div><span>Associated keywords</span><strong>' + keywords + '</strong></div><div><span>Keywords per competitor</span><strong>' + competitorKeywords + '</strong></div></div>' + issues; }
    function recognitionRunCounts(detail) { const summary = { received:0, complete:0, partial:0, analysisFailed:0, requestLimited:0, running:0 }; for (const modelRun of detail.modelRuns) { const presentation = recognitionDetailFor(modelRun.id)?.presentation; if (!presentation) { if (modelRun.status === "queued" || modelRun.status === "running") summary.running += 1; continue; } if (presentation.requestExecution === "response_received") summary.received += 1; if (presentation.localAnalysis === "complete") summary.complete += 1; else if (presentation.localAnalysis === "partial") summary.partial += 1; else if (presentation.localAnalysis === "failed") summary.analysisFailed += 1; if (presentation.requestExecution === "request_rejected" || presentation.requestExecution === "transport_failed") summary.requestLimited += 1; if (presentation.requestExecution === "running" || presentation.requestExecution === "not_started") summary.running += 1; } return summary; }
    function recognitionCountLabels(summary) { return [["Answer received", summary.received], ["Fully parsed", summary.complete], ["Partly available", summary.partial], ["Parsing failed", summary.analysisFailed], ["Request throttled or failed", summary.requestLimited], ["Still running", summary.running]]; }
    function recognitionRunSummary(detail) { return recognitionCountLabels(recognitionRunCounts(detail)).map((entry) => entry[0] + " " + entry[1]).join(" · "); }
    function recognitionCountStrip(detail) { return '<div class="countstrip">' + recognitionCountLabels(recognitionRunCounts(detail)).map((entry) => '<span class="count' + (entry[1] ? "" : " is-zero") + '"><strong>' + entry[1] + '</strong>' + html(entry[0]) + '</span>').join("") + '</div>'; }
    function renderRecognitionModel(modelRun) { const detail = recognitionDetailFor(modelRun.id); const latest = detail && detail.attempts.length ? detail.attempts[detail.attempts.length - 1] : null; const presentation = detail ? detail.presentation : null; const mode = modelRun.recognitionMode === "native_web_domain_discovery" ? "Provider Native web findings" : "Offline domain recognition"; // Delivery, not recognition outcome. The report shows the other axis.
      const visibleStatus = "Answer: " + (presentation ? presentation.statusLabel : recognitionModelStatusText(modelRun.status)); const tagClass = presentation && presentation.localAnalysis === "complete" ? "ready" : presentation && (presentation.requestExecution === "response_received" || presentation.requestExecution === "running") ? "warning" : modelRun.status === "completed" || modelRun.status === "unknown" ? "ready" : "deleted"; const reanalyzeAction = presentation && presentation.primaryAction === "reanalyze_saved_answer" && latest ? '<button type="button" class="card-action" data-recognition-reanalyze="' + html(modelRun.id) + '" data-recognition-attempt="' + html(latest.id) + '">Re-analyze existing answer</button>' : ''; const retryAction = presentation && presentation.primaryAction === "retry_request" ? '<button type="button" class="card-action" data-recognition-retry="' + html(modelRun.id) + '">Retry this model</button>' : ''; const configurationAction = presentation && presentation.primaryAction === "check_model_configuration" ? '<button type="button" class="card-action" data-page="models">Check model configuration</button>' : ''; const settingsAction = presentation && presentation.primaryAction === "open_provider_settings" ? '<a class="card-action" href="https://openrouter.ai/settings/preferences" target="_blank" rel="noreferrer">Open OpenRouter settings</a>' : ''; const detailText = presentation && presentation.detail ? '<p class="subtle model-run-detail">' + html(presentation.detail) + '</p>' : ''; const technicalError = modelRun.errorMessage ? '<details class="technical-details"><summary>Technical details</summary><p>' + html(modelRun.errorMessage) + '</p></details>' : ''; return '<article class="model-run-card ' + html(modelRun.status) + '" data-testid="recognition-model-run"><div class="model-run-head"><div><h3>' + html(modelRun.modelSnapshot.displayName) + '</h3><p class="subtle">' + html(modelRun.modelSnapshot.modelId) + ' · ' + html(mode) + '</p></div><div class="inline-actions"><span class="tag ' + tagClass + '">' + html(visibleStatus) + '</span>' + reanalyzeAction + retryAction + configurationAction + settingsAction + '</div></div>' + detailText + (detail ? renderRecognitionSummary(detail) + renderRecognitionEvidence(detail, modelRun) : '<p class="subtle">Loading this model\\'s archived result.</p>') + technicalError + '</article>'; }
    function renderRecognitionRun(run) { const selected = state.recognitionDetail && state.recognitionDetail.run.id === run.id; const summary = selected ? recognitionRunSummary(state.recognitionDetail) : "Plan " + run.plannedModelRunCount + "  models · open this run to see execution status"; return '<article class="run-row"><div class="run-row-head"><div><h3>Recognition test · ' + html(formatTime(run.createdAt)) + '</h3><p class="subtle">config v' + html(run.baselineVersion) + ' · ' + html(summary) + '</p></div><span class="tag ' + (run.status === "completed" ? "ready" : run.status === "partial" ? "warning" : run.status === "failed" ? "deleted" : "warning") + '">' + html(recognitionRunStatusText(run.status)) + '</span></div><div class="inline-actions">' + (selected ? '<span class="subtle">Viewing</span>' : '<button type="button" class="card-action" data-recognition-run="' + html(run.id) + '">View this run</button>') + '</div></article>'; }
    function renderRecognitionPage() { const selected = project(); if (!selected) return '<section class="view"><div class="empty"><div class="empty-copy"><h2>Select a project first</h2><p class="subtle">A domain recognition test belongs to a single project.</p></div></div></section>'; const active = activeRecognitionRun(); const canStart = Boolean(selected.activeBaselineId) && state.recognitionActionState !== "loading" && !active; const startLabel = state.recognitionActionState === "loading" ? "Creating test…" : active ? "Running" : "Start recognition test"; const current = state.recognitionDetail; const currentRows = current ? '<section class="section-card"><div class="section-head"><div><h2>This run</h2><p class="subtle">Each model is called and archived independently. A model\\'s description reflects only its own answer in this run.</p>' + recognitionCountStrip(current) + '</div><span class="tag">' + html(recognitionRunStatusText(current.run.status)) + '</span></div><div class="model-run-list">' + current.modelRuns.map(renderRecognitionModel).join("") + '</div></section>' : '<section class="section-card"><p class="subtle">No recognition test records yet. Save a configuration to start one.</p></section>'; const history = state.recognitionRuns.length ? '<section class="section-card"><div class="section-head"><div><h2>Run records</h2><p class="subtle">Every record keeps its own model execution and evidence.</p></div></div><div class="run-list">' + state.recognitionRuns.map(renderRecognitionRun).join("") + '</div></section>' : ''; const unavailable = !selected.activeBaselineId ? '<div class="warning-box">Save your models as a configuration first, on Choose models.</div>' : ''; return '<section class="view"><div class="heading"><div><h1>Results</h1><p class="subtle">Each model receives only the domain, language, monitoring protocol and its own web search mode. Offline and native-web results are recorded separately.</p></div><button id="start-recognition" type="button" class="button primary" data-testid="start-recognition" data-action-state="' + html(state.recognitionActionState) + '" ' + (canStart ? "" : "disabled") + '>' + html(startLabel) + '</button></div>' + resultsSwitch("recognition") + '<div id="recognition-status" class="form-status ' + html(state.recognitionNotice.kind) + '" aria-live="polite">' + html(state.recognitionNotice.text) + '</div><div class="section-stack">' + unavailable + currentRows + history + '</div></section>'; }
    async function refreshRecognition() { const selected = project(); if (!selected) { state.recognitionRuns = []; state.recognitionDetail = null; state.recognitionModelDetails = {}; return; } const projectId = selected.id; const listed = await request("/api/projects/" + encodeURIComponent(projectId) + "/recognition-runs"); if (projectId !== state.selectedId) return; state.recognitionRuns = listed.runs || []; const runId = state.recognitionSelectedRunId || (state.recognitionRuns[0] ? state.recognitionRuns[0].id : ""); if (!runId) { state.recognitionDetail = null; state.recognitionModelDetails = {}; if (state.page === "recognition") render(); return; } const detail = await request("/api/projects/" + encodeURIComponent(projectId) + "/recognition-runs/" + encodeURIComponent(runId)); if (projectId !== state.selectedId) return; state.recognitionSelectedRunId = detail.run.id; state.recognitionDetail = detail; const pairs = await Promise.all(detail.modelRuns.map(async (modelRun) => { try { return [modelRun.id, await request("/api/projects/" + encodeURIComponent(projectId) + "/recognition-runs/" + encodeURIComponent(detail.run.id) + "/model-runs/" + encodeURIComponent(modelRun.id))]; } catch { return [modelRun.id, null]; } })); state.recognitionModelDetails = {}; for (const pair of pairs) { if (pair[1]) state.recognitionModelDetails[pair[0]] = pair[1]; } if (state.page === "recognition") render(); if (detail.run.status === "queued" || detail.run.status === "running") { window.clearTimeout(state.recognitionRefreshTimer); state.recognitionRefreshTimer = window.setTimeout(() => { if (state.page === "recognition") refreshRecognition().catch(() => {}); }, 1000); } }
    async function startRecognition() { const selected = project(); if (!selected || activeRecognitionRun() || state.recognitionActionState === "loading") return; const idempotencyKey = crypto.randomUUID(); state.recognitionActionState = "loading"; state.recognitionNotice = { text:"Creating a separate execution record for each model…", kind:"loading" }; render(); try { const response = await request("/api/projects/" + encodeURIComponent(selected.id) + "/recognition-runs", { method:"POST", headers:{ "Idempotency-Key":idempotencyKey } }); state.recognitionSelectedRunId = response.run.id; state.recognitionActionState = "success"; state.recognitionNotice = { text:"Recognition test started. Waiting for models to respond.", kind:"success" }; await refreshRecognition(); window.setTimeout(() => { state.recognitionActionState = "idle"; if (state.page === "recognition") render(); }, 850); } catch (error) { state.recognitionActionState = "error"; state.recognitionNotice = { text:error instanceof Error ? error.message : expectedErrorText.request_failed, kind:"error" }; render(); } }
    async function retryRecognition(modelRunId, button) { const selected = project(); const detail = state.recognitionDetail; if (!selected || !detail) return; try { await runAction(button, { loading:"Retrying…", success:"Started", error:"Retry failed" }, () => request("/api/projects/" + encodeURIComponent(selected.id) + "/recognition-runs/" + encodeURIComponent(detail.run.id) + "/model-runs/" + encodeURIComponent(modelRunId) + "/retry", { method:"POST" })); state.recognitionNotice = { text:"A new execution attempt was created for this model.", kind:"success" }; await refreshRecognition(); } catch (error) { state.recognitionNotice = { text:error instanceof Error ? error.message : expectedErrorText.request_failed, kind:"error" }; render(); } }
    async function reanalyzeRecognition(modelRunId, attemptId, button) { const selected = project(); const detail = state.recognitionDetail; if (!selected || !detail || !attemptId) return; try { await runAction(button, { loading:"Parsing the saved answer…", success:"Local parse complete", error:"Parsing failed" }, () => request("/api/projects/" + encodeURIComponent(selected.id) + "/recognition-runs/" + encodeURIComponent(detail.run.id) + "/model-runs/" + encodeURIComponent(modelRunId) + "/attempts/" + encodeURIComponent(attemptId) + "/reanalyze", { method:"POST" })); state.recognitionNotice = { text:"A new local parse was generated from the saved raw answer. No model was called.", kind:"success" }; await refreshRecognition(); } catch (error) { state.recognitionNotice = { text:error instanceof Error ? error.message : expectedErrorText.request_failed, kind:"error" }; render(); } }
    const phase2Render = render;
    render = function renderWithRecognition() { if (window.__citegeoPhase5Active) return; if (state.page === "reports" && window.__citegeoPhase4 && typeof window.__citegeoPhase4.render === "function") return window.__citegeoPhase4.render(); if (state.page !== "recognition") return phase2Render(); const selected = project(); const options = state.currentProjects.length ? state.currentProjects.map((item) => '<option value="' + html(item.id) + '">' + html(item.name) + ' · ' + html(item.normalizedDomain) + '</option>').join("") : '<option value="">No projects yet</option>'; app.innerHTML = '<div class="shell"><aside class="sidebar"><div class="brand"><div class="brand-lockup">' + brandLockup + '</div></div><div class="project-label">Project</div><select id="project-select" class="project-select" aria-label="Switch project" data-testid="project-select">' + options + '</select><nav class="nav" aria-label="Project navigation"><button type="button" class="nav-item" data-page="overview"><span>Overview</span></button><div class="nav-label">Run a test</div><button type="button" class="nav-item" data-page="models"><span class="nav-step">1</span><span>Choose models</span></button><button type="button" class="nav-item" data-page="recognition"><span class="nav-step">2</span><span>Results</span></button><button type="button" class="nav-item" data-page="visibility"><span class="nav-step">3</span><span>Visibility</span></button><div class="nav-label">Over time</div><a class="nav-item" href="?view=measurements"><span>Continuous measurement</span></a><div class="nav-label">Machine</div><button type="button" class="nav-item" data-page="configuration"><span>Configuration history</span></button><button type="button" class="nav-item" data-page="setup"><span>Setup</span></button></nav><div class="sidebar-bottom">Domain recognition</div></aside><main class="workspace"><header class="topbar"><div class="crumb"><strong>${PRODUCT_NAME}</strong> / ' + html(selected ? selected.name : "Project") + '</div><button id="new-project" type="button" class="button primary" data-testid="new-project">New project</button></header><section class="content">' + renderRecognitionPage() + '</section></main></div>'; const select = element("project-select"); if (select) select.value = state.selectedId; document.title = selected ? selected.name + " | ${PRODUCT_TITLE}" : "${PRODUCT_TITLE}"; };
    document.addEventListener("click", async (event) => { const target = event.target; if (!(target instanceof Element)) return; if (target.id === "start-recognition") { await startRecognition(); return; } const evidenceButton = target.closest("[data-evidence-target]"); if (evidenceButton) { const card = evidenceButton.closest("[data-testid=recognition-model-run]"); const details = card ? card.querySelector("details.evidence-details") : null; if (details) details.open = true; const evidenceTarget = evidenceButton.getAttribute("data-evidence-target"); window.setTimeout(() => { const marked = evidenceTarget ? element(evidenceTarget) : null; if (marked) marked.scrollIntoView({ block:"center", behavior:"smooth" }); }, 0); return; } const runButton = target.closest("[data-recognition-run]"); if (runButton) { state.recognitionSelectedRunId = runButton.getAttribute("data-recognition-run") || ""; await refreshRecognition(); return; } const reanalyzeButton = target.closest("[data-recognition-reanalyze]"); if (reanalyzeButton) { await reanalyzeRecognition(reanalyzeButton.getAttribute("data-recognition-reanalyze") || "", reanalyzeButton.getAttribute("data-recognition-attempt") || "", reanalyzeButton); return; } const retryButton = target.closest("[data-recognition-retry]"); if (retryButton) { await retryRecognition(retryButton.getAttribute("data-recognition-retry") || "", retryButton); return; } const pageButton = target.closest("[data-page]"); if (pageButton && pageButton.getAttribute("data-page") === "recognition") { window.setTimeout(() => refreshRecognition().catch((error) => { state.recognitionNotice = { text:error instanceof Error ? error.message : expectedErrorText.request_failed, kind:"error" }; render(); }), 0); } if (pageButton && pageButton.getAttribute("data-page") !== "recognition") window.clearTimeout(state.recognitionRefreshTimer); });
    document.addEventListener("change", (event) => { const target = event.target; if (target instanceof HTMLSelectElement && target.id === "project-select") { state.recognitionSelectedRunId = ""; window.setTimeout(() => { if (state.page === "recognition") refreshRecognition().catch(() => {}); }, 0); } });
    window.__citegeoPhase2 = { state, app, html, element, project, formatTime, brandMark, brandLockup, request, refreshRecognition, phase2Render, render: () => render() };
  </script>
</body>
</html>`;
}
