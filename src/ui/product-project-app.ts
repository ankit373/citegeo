import { PRODUCT_NAME, PRODUCT_TITLE, renderCiteGeoLockup } from "./brand.js";

/**
 * Phase 1 workspace: a product project exists before any audit configuration
 * or provider work. Later phases can replace the placeholder content panels.
 */
export function renderProductProjectAppHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <link rel="icon" type="image/svg+xml" href="/assets/brand/citegeo-emblem.svg"><link rel="apple-touch-icon" href="/assets/brand/citegeo-emblem.svg">
  <title>${PRODUCT_TITLE}</title>
  <link rel="preconnect" href="https://api.fontshare.com">
  <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f%5B%5D=cabinet-grotesk@800,700&f%5B%5D=general-sans@400,500,600&display=swap">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap">
  <style>
    :root { --bg:#14120F; --sidebar:#0E0C0A; --panel:#1C1914; --panel-hover:#24201A; --line:#332C22; --line-strong:#4A4030; --text:#F2EEE4; --muted:#A89C87; --weak:#6E6455; --confirmed:#7FA06E; --confirmed-text:#9DBC8E; --unknown:#C9973E; --unknown-text:#DBB05F; --failed:#B2503B; --failed-text:#CC7157; }
    * { box-sizing:border-box; }
    body { margin:0; min-height:100vh; background:var(--bg); color:var(--text); font-family:"General Sans", ui-sans-serif, system-ui, -apple-system, sans-serif; }
    h1, h2, h3 { font-family:"Cabinet Grotesk", ui-sans-serif, system-ui, sans-serif; letter-spacing:-0.01em; }
    .domain, .mono { font-family:"JetBrains Mono", ui-monospace, monospace; font-variant-numeric:tabular-nums; }
    button, input, select { font:inherit; }
    button { color:inherit; cursor:pointer; }
    button:disabled { cursor:not-allowed; opacity:.56; }
    button:focus-visible, input:focus-visible, select:focus-visible { outline:2px solid var(--text); outline-offset:2px; }
    .shell { min-height:100vh; display:grid; grid-template-columns:248px minmax(0,1fr); }
    .sidebar { background:var(--sidebar); border-right:1px solid var(--line); display:flex; flex-direction:column; padding:22px 16px; }
    .brand { display:flex; align-items:center; min-height:48px; margin:0 8px 28px; }
    .brand-lockup-image { display:block; width:min(100%,190px); height:auto; }
    .brand img { display:block; width:min(100%,190px); height:auto; }
    .project-label { color:var(--weak); font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; margin:0 8px 7px; }
    .project-select { width:100%; border:1px solid var(--line); border-radius:8px; background:var(--panel); color:var(--text); min-height:40px; padding:0 10px; }
    .nav { margin-top:24px; display:grid; gap:4px; }
    .nav-item { width:100%; min-height:42px; border:1px solid transparent; border-radius:8px; background:transparent; text-align:left; padding:0 12px; color:var(--muted); transition:transform 80ms ease, background-color 140ms ease, border-color 140ms ease, color 140ms ease; }
    .nav-item:hover, .nav-item:focus-visible { background:var(--panel); border-color:var(--line); color:var(--text); }
    .nav-item:active { transform:translateY(1px) scale(.98); }
    .nav-item.active { background:var(--panel); color:var(--text); border-color:var(--line); }
    .sidebar-bottom { margin-top:auto; padding:16px 8px 0; color:var(--weak); font-size:12px; }
    .workspace { min-width:0; padding:32px clamp(20px,4vw,64px); }
    .topbar { display:flex; justify-content:space-between; align-items:center; gap:16px; border-bottom:1px solid var(--line); padding-bottom:20px; }
    .crumb { color:var(--muted); font-size:14px; }
    .crumb strong { color:var(--text); }
    .button { min-height:38px; border-radius:8px; border:1px solid var(--line-strong); background:var(--panel); padding:0 13px; font-weight:700; transition:transform 80ms ease, background-color 140ms ease, border-color 140ms ease, color 140ms ease; }
    .button:hover, .button:focus-visible { background:var(--panel-hover); border-color:var(--line-strong); }
    .button:active { transform:translateY(1px) scale(.98); }
    .button.primary { background:var(--text); border-color:var(--text); color:var(--bg); }
    .button.primary:hover, .button.primary:focus-visible { background:var(--muted); border-color:var(--muted); }
    .button.danger { color:var(--failed-text); border-color:#4A2620; }
    .button.success { color:var(--confirmed-text); border-color:#2E3A26; }
    .content { max-width:1400px; margin:0 auto; padding-top:34px; }
    .heading { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; }
    h1 { margin:0; font-size:30px; letter-spacing:0; }
    h2 { margin:0; font-size:18px; }
    h3 { margin:0; font-size:15px; }
    p { line-height:1.55; }
    .subtle { color:var(--muted); margin:8px 0 0; }
    .toolbar { display:flex; gap:9px; margin:26px 0 20px; flex-wrap:wrap; }
    .filter { border:1px solid var(--line); background:transparent; color:var(--muted); padding:8px 10px; border-radius:7px; }
    .filter.active { background:var(--panel); color:var(--text); border-color:var(--line-strong); }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:12px; }
    .card { border:1px solid var(--line); border-radius:8px; background:var(--panel); padding:17px; color:var(--text); transition:transform 160ms ease, border-color 160ms ease, background-color 160ms ease; }
    .card:hover, .card:focus-within { transform:translateY(-2px); border-color:var(--line-strong); background:var(--panel-hover); }
    .card.selected { border-color:var(--text); }
    .card-select { display:block; width:100%; color:inherit; background:transparent; border:0; padding:0; text-align:left; }
    .card-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:15px; }
    .card-action { min-height:32px; border:1px solid var(--line-strong); border-radius:6px; background:var(--sidebar); color:var(--muted); padding:0 9px; font-size:12px; font-weight:700; }
    .card-action:hover, .card-action:focus-visible { background:var(--panel-hover); border-color:var(--line-strong); color:var(--text); }
    .card-action.danger { color:var(--failed-text); border-color:#4A2620; }
    .card-header { display:flex; justify-content:space-between; gap:10px; align-items:center; }
    .domain { font-feature-settings:"tnum" 1; color:var(--muted); margin-top:8px; overflow-wrap:anywhere; }
    .meta { display:flex; gap:8px; flex-wrap:wrap; margin-top:15px; color:var(--weak); font-size:12px; }
    .tag { border:1px solid var(--line); border-radius:999px; padding:3px 8px; }
    .tag.draft { color:var(--unknown-text); border-color:#4A3A1E; }
    .tag.archived { color:var(--muted); }
    .tag.deleted { color:var(--failed-text); border-color:#4A2620; }
    .empty { border:1px dashed var(--line-strong); min-height:250px; display:grid; place-items:center; text-align:center; padding:30px; border-radius:8px; }
    .empty-copy { max-width:470px; }
    .empty h2 { font-size:21px; }
    .empty .button { margin-top:15px; }
    .detail { margin-top:24px; border:1px solid var(--line); border-radius:8px; background:var(--panel); padding:22px; }
    .detail-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:14px; margin:19px 0 22px; }
    .detail-cell { display:grid; gap:5px; }
    .detail-cell span { color:var(--weak); font-size:12px; }
    .detail-cell strong { overflow-wrap:anywhere; }
    .placeholder { border-top:1px solid var(--line); margin-top:24px; padding-top:20px; color:var(--muted); }
    .drawer-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.62); opacity:0; pointer-events:none; transition:opacity 180ms ease; }
    .drawer { position:fixed; z-index:2; top:0; right:0; bottom:0; width:min(530px,100vw); background:var(--sidebar); border-left:1px solid var(--line-strong); transform:translateX(100%); transition:transform 210ms ease; padding:26px; overflow:auto; }
    body.drawer-open .drawer-backdrop { opacity:1; pointer-events:auto; }
    body.drawer-open .drawer { transform:translateX(0); }
    .drawer-head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:28px; }
    .close { width:34px; min-width:34px; height:34px; border:1px solid var(--line); border-radius:7px; background:var(--panel); }
    .form { display:grid; gap:16px; }
    .field { display:grid; gap:8px; }
    label { font-size:13px; font-weight:700; }
    .field-help { color:var(--weak); font-size:12px; margin:0; }
    input, select { width:100%; min-height:40px; border-radius:7px; border:1px solid var(--line-strong); background:var(--sidebar); color:var(--text); padding:0 10px; }
    .drawer-footer { display:flex; justify-content:space-between; gap:12px; border-top:1px solid var(--line); margin-top:28px; padding-top:18px; }
    .form-status { min-height:20px; color:var(--muted); font-size:13px; }
    .form-status.error { color:var(--failed-text); }
    .form-status.success { color:var(--confirmed-text); }
    .actions { display:flex; gap:8px; flex-wrap:wrap; }
    .hidden { display:none !important; }
    @media (max-width:760px) { .shell { grid-template-columns:1fr; } .sidebar { display:none; } .workspace { padding:22px 16px; } .heading, .topbar { align-items:flex-start; flex-direction:column; } }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration:.01ms !important; transition-duration:.01ms !important; } }
  </style>
</head>
<body>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">${renderCiteGeoLockup("brand-lockup-image")}</div>
      <div class="project-label">Project</div>
      <select id="project-select" class="project-select" aria-label="Switch project" data-testid="project-select"></select>
      <nav class="nav" aria-label="Project navigation">
        <button type="button" class="nav-item active">Overview</button>
        <button type="button" class="nav-item" disabled>Questions</button>
        <button type="button" class="nav-item" disabled>Models</button>
        <button type="button" class="nav-item" disabled>Monitoring</button>
      </nav>
      <div class="sidebar-bottom">Stage 1 · Project basics</div>
    </aside>
    <main class="workspace">
      <header class="topbar"><div class="crumb"><strong>${PRODUCT_NAME}</strong> / Project</div><button id="new-project" type="button" class="button primary" data-testid="new-project">New project</button></header>
      <section class="content">
        <div class="heading"><div><h1>Project</h1><p class="subtle">Each project is bound to exactly one primary domain. A project is saved as a draft as soon as it is created, and no AI provider is called yet.</p></div></div>
        <div class="toolbar"><button type="button" class="filter active" data-list-mode="current">Current</button><button type="button" class="filter" data-list-mode="archived">Archived</button><button type="button" class="filter" data-list-mode="deleted">Recently deleted</button></div>
        <div id="notice" class="form-status" aria-live="polite"></div>
        <div id="project-list" class="grid" aria-live="polite" data-testid="project-list"></div>
        <div id="project-detail" data-testid="project-detail"></div>
      </section>
    </main>
  </div>
  <div id="drawer-backdrop" class="drawer-backdrop"></div>
  <aside id="project-drawer" class="drawer" aria-label="New project" aria-hidden="true" data-testid="project-drawer">
    <div class="drawer-head"><div><h2>New project</h2><p class="subtle">Save the domain as a draft first. Questions, models and the monitoring plan are configured in later steps.</p></div><button id="close-drawer" type="button" class="close" aria-label="Close">×</button></div>
    <form id="project-form" class="form" autocomplete="off">
      <div class="field"><label for="project-domain">Primary domain</label><input id="project-domain" name="domain" placeholder="example.com" required><p class="field-help">A normalized domain can be bound to only one project that has not been deleted.</p></div>
      <div class="field"><label for="project-name">Project name</label><input id="project-name" name="name" placeholder="Optional"></div>
      <div class="field"><label for="brand-name">Brand name</label><input id="brand-name" name="brandName" placeholder="Optional"></div>
      <div class="field"><label for="project-language">Default language</label><select id="project-language" name="language"><option value="en">English</option></select></div>
      <div id="form-status" class="form-status" aria-live="polite"></div>
      <div class="drawer-footer"><button id="cancel-draft" type="button" class="button">Cancel</button><button id="save-draft" type="submit" class="button primary" data-testid="save-draft">Save draft</button></div>
    </form>
  </aside>
  <script>
    const locationProjectId = new URL(window.location.href).searchParams.get("projectId") || "";
    const state = { mode: "current", projects: [], currentProjects: [], selectedId: locationProjectId || localStorage.getItem("citegeo.product.projectId") || "", drawerSession: 0 };
    const element = (id) => document.getElementById(id);
    const html = (value) => String(value).split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;").split('"').join("&quot;").split("'").join("&#39;");
    const formatTime = (value) => new Date(value).toLocaleString();
    function setNotice(message, kind) { const notice = element("notice"); notice.textContent = message || ""; notice.className = kind ? "form-status " + kind : "form-status"; }
    function setFormStatus(message, kind) { const status = element("form-status"); status.textContent = message || ""; status.className = kind ? "form-status " + kind : "form-status"; }
    function setDrawer(open) { document.body.classList.toggle("drawer-open", open); element("project-drawer").setAttribute("aria-hidden", String(!open)); }
    function openDrawer() { state.drawerSession += 1; setDrawer(true); }
    function closeDrawer() { state.drawerSession += 1; setDrawer(false); }
    function setSelectedProject(projectId) { state.selectedId = projectId || ""; if (state.selectedId) localStorage.setItem("citegeo.product.projectId", state.selectedId); else localStorage.removeItem("citegeo.product.projectId"); const next = new URL(window.location.href); if (state.selectedId) next.searchParams.set("projectId", state.selectedId); else next.searchParams.delete("projectId"); window.history.replaceState({ projectId: state.selectedId }, "", next); }
    async function request(path, options) { const response = await fetch(path, options); const text = await response.text(); const body = text ? JSON.parse(text) : {}; if (!response.ok) throw new Error(body.error || "Request failed"); return body; }
    function listUrl() { if (state.mode === "archived") return "/api/projects?includeArchived=true"; if (state.mode === "deleted") return "/api/projects?includeDeleted=true"; return "/api/projects"; }
    function projectsForMode() { if (state.mode === "archived") return state.projects.filter((project) => project.status === "archived"); if (state.mode === "deleted") return state.projects.filter((project) => project.status === "deleted"); return state.projects.filter((project) => project.status === "draft" || project.status === "active"); }
    function statusText(status) { if (status === "draft") return "Draft"; if (status === "active") return "Active"; if (status === "archived") return "Archived"; return "Deleted"; }
    function renderSelect() { const select = element("project-select"); const current = state.currentProjects; if (current.length === 0) { select.innerHTML = '<option value="">No projects yet</option>'; select.value = ""; return; } select.innerHTML = current.map((project) => '<option value="' + html(project.id) + '">' + html(project.name) + ' · ' + html(project.normalizedDomain) + '</option>').join(""); select.value = state.selectedId; }
    function cardActions(project) { if (state.mode === "archived") return '<div class="card-actions"><button type="button" class="card-action" data-project-action="restore" data-project-id="' + html(project.id) + '">Restore project</button></div>'; if (state.mode === "deleted") return '<div class="card-actions"><button type="button" class="card-action" data-project-action="restore" data-project-id="' + html(project.id) + '">Restore project</button><button type="button" class="card-action danger" data-project-action="purge" data-project-id="' + html(project.id) + '">Purge permanently</button></div>'; return '<div class="card-actions"><button type="button" class="card-action" data-project-action="archive" data-project-id="' + html(project.id) + '">Archive</button><button type="button" class="card-action danger" data-project-action="delete" data-project-id="' + html(project.id) + '">Delete</button></div>'; }
    function renderList() { const list = element("project-list"); const projects = projectsForMode(); if (projects.length === 0) { const title = state.mode === "current" ? "No projects yet" : state.mode === "archived" ? "No archived projects" : "No recently deleted projects"; const description = state.mode === "current" ? "Enter a domain to save it as a project draft." : "Project lifecycle records are kept here."; list.className = "empty"; list.innerHTML = '<div class="empty-copy" data-testid="empty-state"><h2>' + title + '</h2><p class="subtle">' + description + '</p>' + (state.mode === "current" ? '<button id="empty-new-project" type="button" class="button primary">New project</button>' : '') + '</div>'; return; } list.className = "grid"; list.innerHTML = projects.map((project) => '<article class="card ' + (project.id === state.selectedId ? "selected" : "") + '" data-testid="project-card" data-project-id="' + html(project.id) + '"><button type="button" class="card-select" data-project-action="select" data-project-id="' + html(project.id) + '"><div class="card-header"><h3 data-testid="project-title">' + html(project.name) + '</h3><span class="tag ' + html(project.status) + '">' + statusText(project.status) + '</span></div><div class="domain" data-testid="project-domain">' + html(project.normalizedDomain) + '</div><div class="meta"><span>Brand: ' + html(project.brandName) + '</span><span>Updated: ' + html(formatTime(project.updatedAt)) + '</span></div></button>' + cardActions(project) + '</article>').join(""); }
    function selectedProject() { return state.currentProjects.find((project) => project.id === state.selectedId) || null; }
    function renderDetail() { const target = element("project-detail"); const project = selectedProject(); if (!project || state.mode !== "current") { target.innerHTML = ""; return; } target.innerHTML = '<section class="detail"><div class="card-header"><div><h2 data-testid="selected-project-title">' + html(project.name) + '</h2><p class="subtle">The project identity is saved. You can maintain its basic details here.</p></div><span class="tag ' + html(project.status) + '">' + statusText(project.status) + '</span></div><div class="detail-grid"><div class="detail-cell"><span>Primary domain</span><strong data-testid="selected-project-domain">' + html(project.normalizedDomain) + '</strong></div><div class="detail-cell"><span>Brand name</span><strong>' + html(project.brandName) + '</strong></div><div class="detail-cell"><span>Default language</span><strong>' + html(project.defaultLanguage) + '</strong></div><div class="detail-cell"><span>Project ID</span><strong data-testid="selected-project-id">' + html(project.id) + '</strong></div></div><form id="project-edit-form" class="form"><div class="field"><label for="edit-domain">Primary domain</label><input id="edit-domain" value="' + html(project.primaryDomain) + '"></div><div class="field"><label for="edit-name">Project name</label><input id="edit-name" value="' + html(project.name) + '"></div><div class="field"><label for="edit-brand">Brand name</label><input id="edit-brand" value="' + html(project.brandName) + '"></div><div class="field"><label for="edit-language">Default language</label><select id="edit-language"><option value="en">English</option></select></div><div class="actions"><button type="submit" class="button primary" data-testid="save-project">Save project</button><button id="archive-project" type="button" class="button" data-testid="archive-project">Archive</button><button id="delete-project" type="button" class="button danger" data-testid="delete-project">Delete project</button></div></form></section>'; element("edit-language").value = project.defaultLanguage; }
    function render() { renderSelect(); renderList(); renderDetail(); document.title = selectedProject() ? selectedProject().name + " | " + ${JSON.stringify(PRODUCT_TITLE)} : ${JSON.stringify(PRODUCT_TITLE)}; document.querySelectorAll("[data-list-mode]").forEach((button) => button.classList.toggle("active", button.dataset.listMode === state.mode)); }
    async function refresh(message) { const requests = state.mode === "current" ? [request("/api/projects")] : [request("/api/projects"), request(listUrl())]; const responses = await Promise.all(requests); state.currentProjects = responses[0].projects; state.projects = state.mode === "current" ? state.currentProjects : responses[1].projects; if (!state.currentProjects.some((project) => project.id === state.selectedId)) setSelectedProject(state.currentProjects[0] ? state.currentProjects[0].id : ""); else setSelectedProject(state.selectedId); render(); if (message) setNotice(message, "success"); }
    function setButtonLoading(button, label) { button.disabled = true; button.dataset.originalLabel = button.textContent; button.textContent = label; }
    function restoreButton(button) { button.disabled = false; button.textContent = button.dataset.originalLabel || button.textContent; }
    async function createDraft(event) { event.preventDefault(); const button = element("save-draft"); const drawerSession = state.drawerSession; setButtonLoading(button, "Saving…"); setFormStatus("Creating project draft", ""); try { const project = await request("/api/projects", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ domain:element("project-domain").value, name:element("project-name").value, brandName:element("brand-name").value, defaultLanguage:element("project-language").value }) }); state.mode = "current"; setSelectedProject(project.project.id); setFormStatus("Draft saved", "success"); await refresh("Project draft saved"); window.setTimeout(() => { restoreButton(button); if (state.drawerSession === drawerSession) closeDrawer(); }, 800); } catch (error) { setFormStatus(error instanceof Error ? error.message : String(error), "error"); restoreButton(button); } }
    async function saveEdit(event) { event.preventDefault(); const project = selectedProject(); if (!project) return; const button = event.currentTarget.querySelector('button[type="submit"]'); setButtonLoading(button, "Saving…"); try { await request("/api/projects/" + encodeURIComponent(project.id), { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ domain:element("edit-domain").value, name:element("edit-name").value, brandName:element("edit-brand").value, defaultLanguage:element("edit-language").value }) }); await refresh("Project saved"); window.setTimeout(() => restoreButton(button), 800); } catch (error) { setNotice(error instanceof Error ? error.message : String(error), "error"); restoreButton(button); } }
    async function archiveProject(projectId, button) { const project = state.currentProjects.find((item) => item.id === projectId); if (!project) return; if (button) setButtonLoading(button, "Archiving…"); try { await request("/api/projects/" + encodeURIComponent(project.id) + "/archive", { method:"POST" }); if (state.selectedId === project.id) setSelectedProject(""); await refresh("Project archived"); } catch (error) { setNotice(error instanceof Error ? error.message : String(error), "error"); if (button) restoreButton(button); } }
    async function deleteProject(projectId, button) { const project = state.currentProjects.find((item) => item.id === projectId); if (!project || !window.confirm("The project will be removed from the current list. You can still restore it from Recently deleted, or purge it permanently.")) return; if (button) setButtonLoading(button, "Deleting…"); try { await request("/api/projects/" + encodeURIComponent(project.id), { method:"DELETE" }); if (state.selectedId === project.id) setSelectedProject(""); await refresh("Project deleted"); } catch (error) { setNotice(error instanceof Error ? error.message : String(error), "error"); if (button) restoreButton(button); } }
    async function restoreDeleted(projectId) { await request("/api/projects/" + encodeURIComponent(projectId) + "/restore", { method:"POST" }); state.mode = "current"; setSelectedProject(projectId); await refresh("Project restored"); }
    async function purgeDeleted(projectId) { if (!window.confirm("A permanent delete cannot be undone.")) return; await request("/api/projects/" + encodeURIComponent(projectId) + "/purge", { method:"DELETE" }); await refresh("Project permanently deleted"); }
    element("new-project").addEventListener("click", () => { setFormStatus("", ""); openDrawer(); element("project-domain").focus(); });
    element("close-drawer").addEventListener("click", closeDrawer);
    element("cancel-draft").addEventListener("click", closeDrawer);
    element("drawer-backdrop").addEventListener("click", closeDrawer);
    element("project-form").addEventListener("submit", createDraft);
    element("project-select").addEventListener("change", (event) => { setSelectedProject(event.target.value); render(); });
    document.querySelectorAll("[data-list-mode]").forEach((button) => button.addEventListener("click", async () => { state.mode = button.dataset.listMode; await refresh(); }));
    element("project-list").addEventListener("click", async (event) => { if (event.target.id === "empty-new-project") { openDrawer(); return; } const action = event.target.closest("[data-project-action]"); if (!action) return; const id = action.dataset.projectId; if (!id) return; if (action.dataset.projectAction === "select") { setSelectedProject(id); render(); return; } if (action.dataset.projectAction === "archive") { await archiveProject(id, action); return; } if (action.dataset.projectAction === "delete") { await deleteProject(id, action); return; } if (action.dataset.projectAction === "restore") { await restoreDeleted(id); return; } if (action.dataset.projectAction === "purge") { await purgeDeleted(id); } });
    element("project-detail").addEventListener("submit", saveEdit);
    element("project-detail").addEventListener("click", (event) => { if (event.target.id === "archive-project") archiveProject(selectedProject()?.id, event.target); if (event.target.id === "delete-project") deleteProject(selectedProject()?.id, event.target); });
    refresh().catch((error) => setNotice(error instanceof Error ? error.message : String(error), "error"));
  </script>
</body>
</html>`;
}
