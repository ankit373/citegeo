import { PRODUCT_NAME, PRODUCT_TITLE, renderCiteGeoLockupInline, renderCiteGeoMarkSvg } from "./brand.js";
import { THEME_BASE, THEME_FONT_LINKS, THEME_TOKENS } from "./theme.js";

export function renderProductPhase2AppHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/svg+xml" href="/assets/brand/citegeo-emblem.svg"><link rel="apple-touch-icon" href="/assets/brand/citegeo-emblem.svg">
  <title>${PRODUCT_TITLE}</title>
  ${THEME_FONT_LINKS}
  <script>
    // Applied before the stylesheet paints, otherwise the page shows the system
    // theme for a frame and then swaps, which reads as a bug.
    try {
      var saved = localStorage.getItem("citegeo.theme");
      if (saved === "light" || saved === "dark") document.documentElement.setAttribute("data-theme", saved);
    } catch (error) { /* private browsing denies storage; the system theme is a fine default */ }
  </script>
  <link rel="stylesheet" href="/app/app.css">
  <style>
    /* The sidebar is sticky and one viewport tall, so below the fold its grid
       column fell back to the page background and the rail appeared to stop. */
    .brand { display:flex; align-items:center; min-height:40px; margin:0 8px 22px; width:calc(100% - 16px); background:none; border:0; padding:0; cursor:pointer; color:inherit; text-align:left; }
    .brand:hover,.brand:focus-visible { opacity:.78; }
    .crumb-home:hover,.crumb-home:focus-visible { color:var(--accent); }
    .brand-lockup-inline { display:inline-flex; align-items:center; gap:8px; color:var(--text); }
    .brand-mark-svg { width:24px; height:24px; display:block; color:var(--accent); }
    .brand-word { font-family:var(--font-display); font-size:20px; font-weight:600; letter-spacing:-0.02em; }
    .brand-mark { width:30px; height:30px; display:grid; place-items:center; }
    .brand-mark svg { width:30px; height:30px; }
    .brand-title { display:grid; gap:2px; font-size:14px; }
    .brand-title strong { font-size:16px; letter-spacing:0; }
    .brand-title span,.subtle,.field-help,.model-meta { color:var(--muted); }
    .brand-title span { font-size:12px; }
    .project-select,input,select { width:100%; min-height:34px; border:1px solid var(--line); border-radius:var(--radius-sm); background:var(--surface); color:var(--text); padding:0 10px; font-size:13px; transition:border-color var(--motion-fast) var(--ease-standard); }
    .project-select:hover,input:hover,select:hover { border-color:var(--line-strong); }
    .nav-item { display:flex; align-items:center; gap:9px; min-height:34px; border:0; border-radius:var(--radius-sm); background:transparent; color:var(--muted); text-align:left; padding:0 10px; font-size:13px; text-decoration:none; transition:background-color var(--motion-fast) var(--ease-standard),color var(--motion-fast) var(--ease-standard); }
    .nav-item:hover,.nav-item:focus-visible { background:var(--raised); color:var(--text); }
    .nav-item.active:hover { color:var(--accent); }
    .nav-item.active { background:var(--accent-wash); color:var(--accent); font-weight:550; }
    .theme-toggle:hover { color:var(--text); border-color:var(--line-strong); }
    .crumb strong { color:var(--text); }
    /* The failed colour reports an evidence state; chrome must not borrow it. */
    .content { max-width:1280px; margin:0 auto; padding-top:clamp(24px,3vw,40px); }
    /* No entrance animation: a view is static content, not a state change. */
    h1 { margin:0; font-size:clamp(26px,2.6vw,34px); letter-spacing:-0.03em; font-weight:650; }
    h2 { margin:0; font-size:16px; font-weight:600; letter-spacing:-0.015em; }
    h3 { margin:0; font-size:14px; font-weight:600; }
    p { line-height:1.6; }
    .heading .subtle { margin-top:6px; }
    .toolbar,.actions,.card-actions,.inline-actions { display:flex; gap:9px; flex-wrap:wrap; }
    .heading .button,.heading .inline-actions .button { white-space:nowrap; }
    .toolbar { margin:24px 0 18px; }
    .filter:hover,.filter:focus-visible,.filter.active { background:var(--surface); color:var(--text); border-color:var(--line-strong); }
    .filter:active { transform:translateY(1px) scale(.98); }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:12px; }
    .card,.detail,.section-card { border:1px solid var(--line); border-radius:var(--radius); background:var(--surface); padding:clamp(16px,1.8vw,24px); box-shadow:var(--shadow-sm); transition:border-color var(--motion-fast) var(--ease-standard),box-shadow var(--motion-fast) var(--ease-standard); }
    .card:hover,.card:focus-within { border-color:var(--line-strong); box-shadow:var(--shadow); }
    .rowtags { display:flex; gap:5px; flex-wrap:wrap; margin-top:5px; }
    .rowtags .tag { font-size:11px; padding:1px 7px; }
    .promptbar input,.promptbar select { flex:0 1 auto; width:auto; min-width:150px; min-height:34px; }
    .promptbar #prompt-search { flex:1 1 260px; }
    .promptbar .prompt-result-summary { color:var(--weak); margin-left:auto; }
    .bulkbar { display:flex; gap:10px; align-items:center; flex-wrap:wrap; padding:10px 14px; margin-bottom:12px; border:1px solid var(--accent); border-radius:var(--radius-sm); background:var(--accent-wash); }
    .bulkbar .spacer { flex:1 1 auto; }
    .coverage { display:flex; gap:7px; flex-wrap:wrap; margin-top:14px; }
    .coverage .tag { cursor:pointer; background:transparent; color:var(--muted); font:inherit; font-size:12px; }
    .coverage .tag:hover,.coverage .tag.active { border-color:var(--accent); color:var(--accent); }
    .headmain { flex:1 1 300px; min-width:0; }
    .dtiles { display:grid; grid-template-columns:repeat(auto-fit,minmax(186px,1fr)); gap:1px; margin:18px 0; background:var(--line); border:1px solid var(--line); border-radius:var(--radius); overflow:hidden; }
    .dtile { background:var(--surface); padding:15px 17px; display:grid; gap:4px; align-content:start; }
    .dtile > span { font-size:var(--type-micro); letter-spacing:.09em; text-transform:uppercase; color:var(--weak); font-weight:600; }
    .dtile strong { font-family:var(--font-display); font-size:26px; font-weight:500; letter-spacing:-0.02em; line-height:1.1; }
    .dtile small { font-size:var(--type-xs); color:var(--weak); line-height:1.45; }
    /* start, not stretch: one card with sixteen rows in it was pulling every
       card beside it to its own height, and one of them holds a single line. */
    /* dense: a full width card would otherwise leave the narrow card before
       it sitting alone with a hole beside it. Cards in a row share a height,
       which only works because a long list inside one scrolls rather than
       setting the height of everything beside it. */
    .dgrid { display:grid; grid-auto-flow:dense; grid-template-columns:repeat(auto-fit,minmax(322px,1fr)); gap:12px; margin-bottom:12px; }
    .dgrid > .section-card { display:flex; flex-direction:column; }
    /* A full width card shares its row with nobody, so it has no height to
       match and shows every row. */
    .dgrid > .section-card:not(.is-wide) > .mtable { max-height:340px; overflow-y:auto; }
    /* The cut lands mid row, so it fades to say there is more below. */
    .dgrid > .section-card:not(.is-wide) > .mtable { mask-image:linear-gradient(to bottom,#000 calc(100% - 26px),transparent); -webkit-mask-image:linear-gradient(to bottom,#000 calc(100% - 26px),transparent); }
    .dgrid > .section-card { margin:0; }
    /* A table with five columns cannot fit a 322px card. */
    .dgrid > .section-card.is-wide { grid-column:1 / -1; }
    .dbars { display:grid; gap:9px; margin-top:14px; }
    .dbar { display:grid; gap:3px; font-size:var(--type-sm); }
    .dbar-name { color:var(--text); font-weight:550; overflow-wrap:anywhere; }
    .dbar-track { display:block; height:7px; border-radius:4px; background:var(--sunken); overflow:hidden; }
    .dbar-track i { display:block; height:100%; background:var(--line-strong); }
    .dbar.is-you .dbar-track i { background:var(--accent); }
    .dbar-value { font-size:var(--type-xs); color:var(--weak); }
    .dmoves { margin:14px 0 0; padding-left:18px; display:grid; gap:10px; font-size:var(--type-sm); }
    .dmoves strong { display:block; color:var(--text); }
    .dmoves .subtle { display:block; font-size:var(--type-xs); color:var(--weak); margin-top:2px; }
    /* A loader is the shadow of what is arriving, so the layout does not jump. */
    .sk { display:grid; gap:9px; margin-top:14px; }
    .sk-row { display:grid; gap:12px; align-items:center; }
    .sk-line { display:block; height:11px; border-radius:5px; background:var(--skeleton); position:relative; overflow:hidden; }
    .sk-line::after { content:""; position:absolute; inset:0; transform:translateX(-100%); background:linear-gradient(90deg,transparent,var(--skeleton-sheen),transparent); animation:sheen var(--motion-shimmer) infinite; }
    .sk-tilerow { display:grid; grid-template-columns:repeat(auto-fit,minmax(186px,1fr)); gap:12px; margin:18px 0; }
    .sk-tile { display:grid; gap:8px; padding:15px 17px; border:1px solid var(--line); border-radius:var(--radius); }
    .sk-head { display:grid; gap:8px; margin-bottom:6px; }
    .sk-wrap { display:block; }
    .visually-hidden { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
    @keyframes sheen { to { transform:translateX(100%); } }
    @media (prefers-reduced-motion:reduce) { .sk-line::after { animation:none; } }
    .headaside { display:flex; align-items:center; gap:14px; flex-wrap:wrap; justify-content:flex-end; margin-left:auto; }
    .scoremid { font-family:var(--font-display); font-size:26px; line-height:1; }
    textarea { width:100%; border:1px solid var(--line); border-radius:var(--radius-sm); background:var(--surface); color:var(--text); padding:9px 10px; font:inherit; font-size:13px; line-height:1.5; resize:vertical; }
    .inline-form textarea { flex:1 1 100%; background:var(--sunken); border-radius:6px; }
    /* The score is the page's subject, so it is set as a header rather than as
       one card among equals. */
    .hero { display:grid; grid-template-columns:minmax(0,auto) minmax(0,1fr); gap:clamp(20px,3vw,44px); align-items:center; padding:clamp(18px,2.2vw,28px) 0 clamp(20px,2.4vw,30px); border-bottom:1px solid var(--line); }
    .hero-figure { display:grid; gap:2px; }
    .hero-figure .scorebig { line-height:.86; }
    .hero-sub { display:flex; align-items:baseline; gap:10px; font-size:13px; color:var(--muted); }
    .hero-delta { font-weight:600; font-variant-numeric:tabular-nums; }
    .hero-spark { min-width:0; }
    .hero-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(118px,1fr)); gap:clamp(14px,2vw,30px); }
    .hero-stat { display:grid; gap:3px; min-width:0; }
    .hero-stat span { font-size:10px; letter-spacing:.09em; text-transform:uppercase; color:var(--weak); font-weight:600; }
    .hero-stat strong { font-family:var(--font-display); font-size:21px; font-weight:500; letter-spacing:-0.015em; }
    .hero-stat small { font-size:11px; color:var(--weak); }
    @media (max-width:860px) { .hero { grid-template-columns:1fr; } }

    /* Filters read as one control strip, not as a row of loose buttons. */
    .segment { display:flex; flex-wrap:wrap; gap:8px; align-items:center; padding:12px 0; border-bottom:1px solid var(--line); margin-bottom:6px; }
    .segment select { width:auto; min-width:120px; max-width:200px; }
    .segment .spacer { flex:1 1 auto; }
    .segment .applied { font-size:12px; color:var(--accent); }

    /* A share is a length before it is a number. */
    .sharebar { position:relative; display:block; width:100%; height:22px; border-radius:4px; background:var(--sunken); overflow:hidden; }
    .sharebar > i { position:absolute; inset:0 auto 0 0; background:var(--line-strong); border-radius:4px; transition:width var(--motion-normal) var(--ease-standard); }
    .sharebar.is-target > i { background:var(--accent); }
    .sharebar > b { position:absolute; inset:0; display:flex; align-items:center; padding:0 8px; font-size:11px; font-weight:600; font-variant-numeric:tabular-nums; white-space:nowrap; }

    .mrow.is-clickable { cursor:pointer; }
    .mrow.is-clickable:hover { background:var(--raised); }
    .chev { color:var(--weak); font-size:11px; }

    /* Evidence opens beside the number rather than replacing the page. */
    .panel-scrim { position:fixed; inset:0; z-index:8; background:var(--scrim); opacity:0; pointer-events:none; transition:opacity var(--motion-normal) var(--ease-standard); }
    .panel { position:fixed; z-index:9; inset:0 0 0 auto; width:min(720px,100vw); background:var(--paper); border-left:1px solid var(--line); box-shadow:-12px 0 40px rgba(20,18,14,.16); transform:translateX(100%); transition:transform var(--motion-normal) var(--ease-standard); display:flex; flex-direction:column; }
    body.panel-open .panel-scrim { opacity:1; pointer-events:auto; }
    body.panel-open .panel { transform:translateX(0); }
    .panel-head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; padding:20px clamp(18px,2.4vw,28px); border-bottom:1px solid var(--line); }
    /* Rows must size to their content: auto tracks let a card with overflow:hidden
       shrink below its own text, which silently clipped every answer. */
    .panel-body { flex:1 1 auto; overflow:auto; padding:clamp(16px,2.2vw,26px); display:grid; gap:14px; grid-auto-rows:max-content; align-content:start; }
    .evidence { border:1px solid var(--line); border-radius:var(--radius); background:var(--surface); overflow:hidden; }
    .evidence-head { display:flex; flex-wrap:wrap; gap:8px 14px; align-items:center; padding:11px 15px; border-bottom:1px solid var(--line); background:var(--raised); font-size:12px; color:var(--muted); }
    .evidence-text { padding:15px; font-size:13px; line-height:1.62; white-space:pre-wrap; max-height:300px; overflow:auto; }
    .evidence-text mark { background:var(--accent-wash); color:var(--accent); padding:0 2px; border-radius:3px; font-weight:600; }
    .evidence-foot { padding:11px 15px; border-top:1px solid var(--line); font-size:12px; color:var(--weak); display:grid; gap:5px; }
    .evidence-foot a { overflow-wrap:anywhere; }
    .evidence.is-live { border-color:var(--accent); background:var(--accent-wash); }
    .brief { border:1px solid var(--line); border-radius:var(--radius); background:var(--surface); padding:16px 18px; display:grid; gap:10px; }
    .brief h3 { margin:6px 0 0; font-size:13px; }
    .brief .why { margin:0; font-size:14px; font-weight:550; color:var(--text); }
    .brief .evidence-note { margin:0; font-size:12px; color:var(--weak); line-height:1.55; }
    .brief .evidence-foot { border:0; padding:0; }
    .voice { border-left:2px solid var(--line-strong); padding:2px 0 2px 12px; display:grid; gap:5px; }
    .voice.is-you { border-left-color:var(--accent); }
    .voice-top { display:flex; gap:9px; align-items:baseline; flex-wrap:wrap; }
    .voice-top strong { font-size:13px; font-weight:600; }
    .quotes { margin:0; padding-left:16px; display:grid; gap:4px; font-size:12px; color:var(--muted); line-height:1.55; }
    .panel-section { margin:8px 0 -4px; font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--weak); }
    .panel-actions { display:flex; align-items:flex-start; gap:10px; }
    .runpane-progress { display:grid; gap:6px; margin-top:8px; font-size:12px; color:var(--muted); }
    .runpane-progress .bar { margin:0; }
    .runfield > span:first-child { font-size:10px; letter-spacing:.09em; text-transform:uppercase; color:var(--weak); font-weight:600; padding-top:2px; }
    .runtext { margin:0; font-size:13px; line-height:1.6; white-space:pre-wrap; max-height:220px; overflow:auto; }
    .runtext mark { background:var(--accent-wash); color:var(--accent); padding:0 2px; border-radius:3px; font-weight:600; }
    .namechips { display:flex; flex-wrap:wrap; gap:6px; }
    .namechip { display:inline-flex; align-items:baseline; gap:5px; border:1px solid var(--line); border-radius:999px; padding:2px 9px; font-size:12px; color:var(--muted); }
    .namechip b { font-family:var(--font-mono); font-size:10px; color:var(--weak); font-weight:500; }
    .namechip i { font-style:normal; font-size:11px; color:var(--weak); }
    .namechip.is-you { border-color:var(--accent); color:var(--accent); background:var(--accent-wash); }
    .liverun.is-clickable { cursor:pointer; }
    .liverun.is-clickable:hover { border-color:var(--accent-hover); }
    .plan { display:grid; gap:10px; margin-top:16px; }
    .move { border:1px solid var(--line); border-left:3px solid var(--line-strong); border-radius:var(--radius-sm); background:var(--sunken); padding:13px 15px; display:grid; gap:5px; }
    .move.raises_visibility { border-left-color:var(--accent); }
    .move.unblocks_measurement { border-left-color:var(--unknown); }
    .move.widens_measurement { border-left-color:var(--line-strong); }
    .move-top { display:flex; gap:10px; align-items:baseline; flex-wrap:wrap; }
    .move-top strong { font-size:14px; font-weight:600; color:var(--text); }
    .move p { margin:0; font-size:13px; color:var(--muted); }
    .move .why { color:var(--text); }
    .move .evidence-note { font-size:12px; color:var(--weak); }
    .move-actions { display:flex; gap:7px; flex-wrap:wrap; margin-top:4px; }
    .pill.good { color:var(--confirmed-text); border-color:var(--confirmed); background:var(--confirmed-wash); }
    .pill.bad { color:var(--failed-text); border-color:var(--failed); background:var(--failed-wash); }
    .pill.flat { color:var(--muted); }

    .scorehead { display:flex; flex-direction:column; align-items:flex-end; gap:4px; }
    .scorebig { font-family:var(--font-display); font-size:clamp(44px,5.4vw,66px); font-weight:500; line-height:.92; letter-spacing:-0.035em; font-variant-numeric:tabular-nums; color:var(--text); }
    .stat span { font-size:11px; letter-spacing:.07em; text-transform:uppercase; color:var(--weak); font-weight:600; }
    .stat strong { font-family:var(--font-display); font-size:25px; font-weight:500; letter-spacing:-0.018em; line-height:1.15; }
    .stat small { font-size:12px; color:var(--weak); }
    .bar > i { display:block; height:100%; background:var(--accent); border-radius:2px; transition:width var(--motion-normal) var(--ease-standard); }
    .inline-form { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; }
    .inline-form input,.inline-form select { flex:1 1 180px; min-width:0; padding:8px 10px; border-radius:6px; border:1px solid var(--line); background:var(--sunken); color:var(--text); font:inherit; font-size:13px; }
    .inline-form input { flex:3 1 320px; }
    .checkline { display:inline-flex; align-items:center; gap:7px; font-size:13px; color:var(--muted); }
    .checkline input { width:15px; min-height:15px; flex:0 0 auto; accent-color:var(--accent); }
    .checkgrid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:8px; margin-top:12px; }
    .trend-head { margin-bottom:10px; font-size:13px; }
    .alertlist { display:grid; gap:2px; margin-top:12px; }
    .alertrow { display:grid; grid-template-columns:78px minmax(0,1fr); gap:12px; align-items:start; padding:11px 0; border-bottom:1px solid var(--line); }
    .alertrow:last-child { border-bottom:0; }
    .alertrow strong { font-size:13px; font-weight:550; }
    .alertrow p { margin-top:2px; }
    .storage-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:12px; margin-top:14px; }
    .storage-field { display:grid; gap:4px; min-width:0; }
    .storage-field > span { font-size:12px; font-weight:550; }
    .storage-field > span em { color:var(--weak); font-style:normal; font-weight:400; }
    .storage-field small { color:var(--weak); font-size:11px; overflow-wrap:anywhere; }
    .liverun { border:1px solid var(--accent); background:var(--accent-wash); border-radius:var(--radius); padding:13px 15px; margin:14px 0; display:grid; gap:9px; }
    .liverun-top { display:flex; align-items:center; gap:12px; flex-wrap:wrap; font-size:13px; }
    .liverun .bar { margin:0; background:var(--surface); }
    .liverun p { margin:0; }
    .dash-split { display:grid; grid-template-columns:minmax(0,1.35fr) minmax(0,1fr); gap:22px; margin-top:16px; align-items:start; }
    .trend { width:100%; height:auto; display:block; }
    .chart-line { fill:none; stroke:var(--text); stroke-width:2; stroke-linejoin:round; stroke-linecap:round; }
    .trend circle { fill:var(--text); }
    .chart-grid { stroke:var(--line); stroke-width:1; }
    .chart-axis { fill:var(--weak); font-size:10px; font-family:"JetBrains Mono",ui-monospace,monospace; }
    .credential-control { display:flex; gap:8px; align-items:center; }
    .credential-control input { flex:1; min-width:0; }
    .step.plan-step { grid-template-columns:66px minmax(0,1fr); align-items:start; }
    .plan-step .step-index { font-size:10px; letter-spacing:.07em; text-transform:uppercase; padding-top:2px; }
    .rowlink:hover { text-decoration:underline; }
    .mrow.is-selected { box-shadow:inset 2px 0 0 var(--text); }
    .card.selected { border-color:var(--text); }
    .card-select { display:block; width:100%; color:inherit; background:transparent; border:0; padding:0; text-align:left; }
    .card-header { display:flex; justify-content:space-between; gap:10px; align-items:center; }
    .domain { font-feature-settings:"tnum" 1; color:var(--muted); margin-top:8px; overflow-wrap:anywhere; }
    .meta { display:flex; gap:8px; flex-wrap:wrap; margin-top:15px; color:var(--weak); font-size:12px; }
    .tag.draft { color:var(--unknown-text); border-color:var(--unknown); background:var(--unknown-wash); }
    .tag.archived { color:var(--muted); }
    .tag.deleted { color:var(--failed-text); border-color:var(--failed); background:var(--failed-wash); }
    .tag.ready { color:var(--confirmed-text); border-color:var(--confirmed); background:var(--confirmed-wash); }
    .tag.warning { color:var(--unknown-text); border-color:var(--unknown); background:var(--unknown-wash); }
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
    .drawer { position:fixed; z-index:5; top:0; right:0; bottom:0; width:min(530px,100vw); background:var(--sunken); border-left:1px solid var(--line-strong); transform:translateX(100%); transition:transform var(--motion-normal) var(--ease-standard); padding:26px; overflow:auto; }
    body.drawer-open .drawer-backdrop { opacity:1; pointer-events:auto; }
    body.drawer-open .drawer { transform:translateX(0); }
    .drawer-head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:28px; }
    .close { width:34px; min-width:34px; height:34px; border:1px solid var(--line); border-radius:7px; background:var(--surface); }
    .drawer-footer { display:flex; justify-content:space-between; gap:12px; border-top:1px solid var(--line); margin-top:28px; padding-top:18px; }
    .section-stack { display:grid; gap:12px; margin-top:20px; }
    .protocol-list { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:8px; padding:0; margin:15px 0 0; list-style:none; }
    .protocol-list li { border:1px solid var(--line); background:var(--sunken); border-radius:7px; padding:10px; color:var(--muted); font-size:13px; min-width:0; overflow-wrap:anywhere; }
    .protocol-list li.is-clickable { cursor:pointer; }
    .protocol-list li.is-clickable:hover { border-color:var(--accent); }
    .model-search { margin:18px 0 12px; }
    .model-catalog-controls { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:10px; margin-bottom:12px; }
    .model-catalog-controls label { display:grid; gap:6px; color:var(--weak); font-size:12px; }
    .model-catalog-controls select { min-width:0; }
    .catalog-result-summary { color:var(--weak); font-size:12px; margin:0 0 12px; }
    .model-list { display:grid; gap:8px; max-height:620px; overflow:auto; padding-right:3px; }
    .mhead,.mrow { display:grid; align-items:center; gap:16px; padding:10px 8px; border-bottom:1px solid var(--line); }
    .mrow:last-child { border-bottom:0; }
    .mrow:hover,.mrow:focus-within { background:var(--raised); border-radius:var(--radius-sm); }
    .mname strong { display:block; font-size:13px; line-height:1.4; font-weight:550; color:var(--text); }
    .mname span { display:block; font-size:12px; color:var(--weak); overflow-wrap:anywhere; margin-top:2px; }
    /* A badge is part of the name line, so it must not take the block
       display the rule above gives every other span in the cell. */
    .mname .pill,.mname .tag { display:inline-flex; width:auto; margin-top:0; }
    .mname .subtle { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; font-size:12px; color:var(--weak); margin-top:3px; }
    .state-ok { color:var(--confirmed-text); font-weight:500; }
    .state-flag { color:var(--unknown-text); font-weight:500; }
    .state-bad { color:var(--failed-text); font-weight:500; }
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
    .baseline-row { display:grid; grid-template-columns:minmax(0,1fr) 150px; align-items:start; gap:14px; border:1px solid var(--line); border-radius:7px; padding:11px; background:var(--sunken); }
    .baseline-row strong { display:block; font-size:13px; }
    .baseline-row span { display:block; color:var(--weak); font-size:12px; margin-top:3px; overflow-wrap:anywhere; }
    .status-line { display:flex; gap:9px; flex-wrap:wrap; align-items:center; color:var(--muted); font-size:13px; }
    .technical-details { border:1px solid var(--line); border-radius:8px; background:var(--sunken); padding:14px 16px; color:var(--muted); }
    .exportmenu { position:relative; }
    .exportmenu > summary { list-style:none; cursor:pointer; display:inline-flex; }
    .exportmenu > summary::-webkit-details-marker { display:none; }
    .exportlist { position:absolute; right:0; z-index:6; margin-top:6px; min-width:256px; display:grid; gap:2px; padding:10px; border:1px solid var(--line-strong); border-radius:var(--radius-sm); background:var(--surface); box-shadow:var(--shadow); }
    .exportlist strong { font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--weak); margin-top:6px; }
    .exportlist strong:first-child { margin-top:0; }
    .exportlist a { display:block; padding:5px 7px; border-radius:6px; font-size:13px; color:var(--text); text-decoration:none; }
    .exportlist a:hover,.exportlist a:focus-visible { background:var(--raised); }
    .exportlist .subtle { margin-top:8px; padding-top:8px; border-top:1px solid var(--line); font-size:11px; line-height:1.5; }
    .technical-details summary { color:var(--text); cursor:pointer; font-weight:700; }
    .technical-details[open] summary { margin-bottom:14px; }
    .run-list { display:grid; gap:12px; }
    .run-row { border:1px solid var(--line); background:var(--sunken); border-radius:8px; padding:14px; display:grid; gap:10px; }
    .run-row-head,.model-run-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
    .run-row h3,.model-run-card h3 { margin:0; }
    .model-run-list { display:grid; gap:10px; }
    .model-run-card { border:1px solid var(--line); border-radius:8px; padding:14px; background:var(--sunken); display:grid; gap:12px; }
    .model-run-card.running { border-color:var(--line-strong); }
    .model-run-card.completed,.model-run-card.unknown { border-color:var(--confirmed); }
    .model-run-card.failed,.model-run-card.unsupported { border-color:var(--failed); }
    /* The data is a matrix, so it reads as rows with rule lines. No card-in-card. */
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
    .evidence-details { border:1px solid var(--line); border-radius:7px; padding:12px; background:var(--sunken); }
    .evidence-details summary { cursor:pointer; font-weight:700; }
    .evidence-details[open] summary { margin-bottom:12px; }
    .evidence-group { display:grid; gap:7px; margin-top:14px; }
    .evidence-group h4 { margin:0; font-size:13px; }
    .evidence-group ul { margin:0; padding-left:18px; display:grid; gap:5px; color:var(--muted); }
    .raw-answer { max-height:360px; overflow:auto; white-space:pre-wrap; overflow-wrap:anywhere; margin:0; padding:12px; border:1px solid var(--line); border-radius:6px; background:var(--paper); color:var(--muted); font-size:12px; line-height:1.55; }
    .raw-answer mark { background:rgba(201,151,62,0.22); color:var(--unknown-text); border-bottom:1px solid var(--unknown); border-radius:2px; scroll-margin:28px; }
    .evidence-jump { margin-left:7px; padding:0; border:0; background:transparent; color:var(--text); text-decoration:underline; cursor:pointer; font:inherit; font-size:12px; }
    .evidence-jump:hover,.evidence-jump:focus-visible { color:var(--muted); text-decoration:underline; outline:none; }
    .attempt-row { border-top:1px solid var(--line); padding-top:10px; color:var(--muted); font-size:12px; display:grid; gap:5px; }
    @keyframes spin { to { transform:rotate(360deg); } }
    @media (max-width:840px) {
      /* Hiding the sidebar here left no way to navigate at all on a phone. */
      .brand { margin:0 0 14px; }
      /* anywhere, not break-word: only this variant lowers min-content, and a
         domain in a heading was setting the width of the whole page. */
      .workspace { overflow-wrap:anywhere; }
      /* stretch, not flex-start: a flex-start child is sized to max-content,
         so every heading refused to wrap and pushed the page sideways. */
      .heading { flex-direction:column; align-items:stretch; }
      /* A card header stays a row so Expand sits beside the title rather than
         on a line of its own. It wraps when there is genuinely no room. */
      .section-head { flex-wrap:wrap; align-items:flex-start; column-gap:10px; }
      /* The 300px basis is a width in a row and a height in a column, so
         turning the head sideways gave every card a 300px tall header with
         one line in it, and pushed the content to the bottom. */
      .headmain { flex-basis:auto; }
      .topbar { flex-wrap:wrap; }
      /* Fixed column widths do not fit, so every table stacks. */
      /* Two columns, not five: the three unused tracks were still reserving
         their desktop widths, leaving the question less than half the row. */
      .mcols-catalog,.mcols-promptrow,.mcols-engine { grid-template-columns:20px minmax(0,1fr); row-gap:6px; align-items:start; }
      .mcols-catalog > *:nth-child(n+3),.mcols-promptrow > *:nth-child(n+3),.mcols-engine > *:nth-child(n+3) { grid-column:2; }
      /* A cell with nothing in it still took a row and a gap. */
      .mcols-catalog > .mcell:empty,.mcols-promptrow > .mcell:empty,.mcols-engine > .mcell:empty { display:none; }
      /* A provider row is four columns of prose and URLs. In 112px the
         endpoint broke mid-word, so it stacks and each part gets the width. */
      .mcols-provider { grid-template-columns:minmax(0,1fr); row-gap:4px; }
      .mcols-provider > * { grid-column:1; }
      /* Those stack their cells into one column, so the header stacks too and
         becomes a list of column names labelling nothing. */
      .mhead.mcols-catalog,.mhead.mcols-promptrow,.mhead.mcols-engine,.mhead.mcols-provider { display:none; }
      .promptbar .prompt-result-summary { margin-left:0; }
      .card-actions { margin-top:2px; }
      /* Anchored to the right of a control that can sit anywhere in a wrapped
         row, this opened off the left edge. Inline, it cannot. */
      .exportlist { position:static; min-width:0; margin-top:8px; box-shadow:none; }
      /* A fixed track width cannot fit a phone, so the table scrolls inside
         its card. contain, not overflow: a scroll container only zeroes the
         minimum size of a flex or grid item, and this is a plain block, so
         overflow alone still let the rows widen the whole page. */
      .mtable { contain:inline-size; overflow-x:auto; overscroll-behavior-x:contain; }
    }
    /* A thumb needs more room than a pointer. These sit here rather than in
       the theme because the rules they widen are still defined in this file. */
    @media (pointer:coarse) {
      input[type="checkbox"],input[type="radio"] { width:19px; height:19px; }
      .checkline { min-height:34px; align-items:center; }
      .exportlist a { padding:9px 7px; }
      .tag { min-height:32px; }
      /* Widens the target without moving the sentence it sits in. */
      .linklike { position:relative; }
      .linklike::after { content:""; position:absolute; inset:-9px -5px; }
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
  <script id="citegeo-config" type="application/json">${JSON.stringify({
    productName: PRODUCT_NAME,
    productTitle: PRODUCT_TITLE,
    brandMark: renderCiteGeoMarkSvg("phase2-brand-mark").split("\n").join(""),
    brandLockup: renderCiteGeoLockupInline(),
  })}</script>
  <script>window.__citegeo = JSON.parse(document.getElementById("citegeo-config").textContent);</script>
  <script type="module" src="/app/main.js"></script>
</body>
</html>`;
}
