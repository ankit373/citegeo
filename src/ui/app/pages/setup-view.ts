import { html } from "../dom.js";
import { button } from "../components/button.js";

// Setup answers one question: what can this machine actually do right now.
// Providers it can ask, where it puts what it learns, and what it is allowed
// to reach. Every row reports its own state rather than a combined verdict.

export type SetupLoadState = "idle" | "loading" | "ready" | "error";

export interface ProviderRow {
  providerId: string;
  label: string;
  endpoint: string | null;
  detail: string;
  modelCount: number;
  freeModels: number;
  nativeWebSearchModels: number;
  citationCapable: boolean;
  configured: boolean;
  reachable: boolean;
  runnableNow: boolean;
  balance: { paidModelsRunnable: boolean } | null;
  envKeys: string[];
  settingsEnvKeys?: string[];
}

export interface StorageField {
  key: string;
  label: string;
  envKey: string;
  secret: boolean;
  required: boolean;
  placeholder?: string;
}

export interface StorageSettings {
  backends: Array<{ id: string; label: string; note: string; fields: StorageField[] }>;
  current: { backend: string; secretsSet: string[]; values: Record<string, string> };
}

/** Null until a probe has been asked for, because "not tried" and "failed"
 * are different answers. */
export interface StorageCheck {
  pending?: boolean;
  ok?: boolean;
  /** Absent while the probe is still running, which the view draws instead. */
  detail?: string;
  describes?: string;
}

export interface CredentialSetting {
  key: string;
  label: string;
  envKey: string;
  value?: string | null;
}

export interface CredentialRow {
  providerId: string;
  label: string;
  kind: "model_provider" | "integration";
  purpose: string;
  help: string;
  settings: CredentialSetting[];
  envKeys: string[];
  source: "environment" | "stored" | "none";
  last4: string | null;
  editable: boolean;
}

/** What a credential could be held for, with no credential state in it, so a
 * server that refuses to read keys can still say what it would ask for. */
export interface IntegrationRow {
  providerId: string;
  label: string;
  kind: "model_provider" | "integration";
  purpose: string;
  help: string;
  envKeys: string[];
  settings: CredentialSetting[];
}

export interface SetupData {
  providers: ProviderRow[];
  providersState: SetupLoadState;
  storage: StorageSettings | null;
  storageState: SetupLoadState;
  storageBackend: string;
  storageCheck: StorageCheck | null;
  credentials: { closed?: boolean; storageEnabled?: boolean; credentials?: CredentialRow[] } | null;
  credentialsState: SetupLoadState;
  credentialNotice: { text: string; kind: string };
  integrations: IntegrationRow[];
  integrationsState: SetupLoadState;
}

function storageSection(data: SetupData) {
  if (data.storageState !== "ready" || !data.storage) {
    return '<p class="subtle">' + (data.storageState === "error" ? "Could not read the storage settings." : "Reading storage settings.") + '</p>';
  }
  const backends = data.storage.backends;
  const current = data.storage.current;
  const chosen = backends.find((row) => row.id === data.storageBackend) || backends[0];
  // An empty backend list is a configuration answer, not a crash.
  if (!chosen) return '<p class="subtle">No storage backend is offered by this build.</p>';
  const options = backends.map((row) => '<option value="' + html(row.id) + '"' + (row.id === chosen.id ? " selected" : "") + '>' + html(row.label) + '</option>').join("");
  const fields = chosen.fields.map((field) => {
    const stored = current.backend === chosen.id;
    const isSet = stored && current.secretsSet.indexOf(field.key) >= 0;
    const value = stored && !field.secret ? (current.values[field.key] || "") : "";
    return '<label class="storage-field"><span>' + html(field.label) + (field.required ? '' : ' <em>optional</em>') + '</span>'
      + '<input data-storage-field="' + html(field.key) + '" type="' + (field.secret ? "password" : "text") + '"'
      + ' value="' + html(value) + '"'
      + ' placeholder="' + html(isSet ? "stored, leave blank to keep" : (field.placeholder || "")) + '">'
      + '<small class="mono">' + html(field.envKey) + '</small></label>';
  }).join("");
  const result = data.storageCheck
    ? (data.storageCheck.pending
        ? '<p class="subtle">Writing a probe object.</p>'
        : '<div class="' + (data.storageCheck.ok ? "success-box" : "warning-box") + '">' + html(data.storageCheck.detail) + (data.storageCheck.describes ? ' (' + html(data.storageCheck.describes) + ')' : '') + '</div>')
    : '';
  return '<p class="subtle">' + html(chosen.note) + '</p>'
    + '<div class="storage-grid"><label class="storage-field"><span>Where to store</span><select data-storage-backend>' + options + '</select><small class="mono">STORAGE_BACKEND</small></label>' + fields + '</div>'
    + result
    + '<div class="inline-actions" style="margin-top:14px">' + button({ label: "Test connection", on: { "data-storage-check": true } }) + button({ label: "Save", kind: "primary", on: { "data-storage-save": true } }) + '</div>'
    + '<p class="subtle">A secret is encrypted with <span class="mono">CREDENTIAL_KEY</span> and never sent back to this page. Anything set in the environment wins over what is saved here.</p>';
}

function credentialsSection(data: SetupData) {
  const head = '<section class="section-card"><div class="section-head"><div><h2>Provider keys</h2><p class="subtle">A key set here is encrypted at rest and never returned by the API. Only the last four characters are ever shown.</p></div></div>';
  if (data.credentialsState !== "ready" || !data.credentials) {
    return head + '<p class="subtle">Reading key status…</p></section>';
  }
  const held = data.credentials;
  if (held.closed) {
    return head + '<div class="warning-box">Key entry is closed because this server has no password. Set <span class="mono">AUTH_PASSWORD</span> and restart, or keep using <span class="mono">.env</span>.</div></section>';
  }
  const notice = data.credentialNotice.text
    ? '<div class="' + (data.credentialNotice.kind === "error" ? "warning-box" : "success-box") + '">' + html(data.credentialNotice.text) + '</div>'
    : '';
  const disabled = held.storageEnabled
    ? ''
    : '<div class="warning-box">Storing keys here needs <span class="mono">CREDENTIAL_KEY</span>, 32 bytes. Without it a stored key could not survive a restart, so the form stays read-only.</div>';
  const rows = (held.credentials || []).map((row) => {
    const known = row.last4 ? '<span class="mono">••••' + html(row.last4) + '</span>' : '<span class="state-flag">not set</span>';
    const where = row.source === "environment"
      ? '<span class="mcell">from <span class="mono">' + html(row.envKeys.join(" or ")) + '</span></span>'
      : '<span class="mcell">' + (row.source === "stored" ? "stored here" : "none") + '</span>';
    const control = !row.editable
      ? '<span class="step-note">Set in the environment, so it cannot be changed here.</span>'
      : !held.storageEnabled
        ? '<span class="step-note">Needs CREDENTIAL_KEY.</span>'
        : '<span class="credential-control"><input type="password" autocomplete="off" placeholder="Paste a key" data-credential-input="' + html(row.providerId) + '">' + button({ label: "Save", on: { "data-credential-save": row.providerId } }) + '' + (row.source === "stored" ? button({ label: "Remove", tone: "danger", on: { "data-credential-clear": row.providerId } }) : '') + '</span>';
    return '<div class="mrow mcols-credential"><div class="mname"><strong>' + html(row.providerId) + '</strong>' + where + '</div><span class="mcell">' + known + '</span>' + control + '</div>';
  }).join("");
  return head + notice + disabled + '<div class="mtable"><div class="mhead mcols-credential"><span>Provider</span><span>Key</span><span>Change</span></div>' + rows + '</div></section>';
}
// A score nobody can take apart is a score nobody can act on, so the
// components are always next to the number and the weights are printed.

/** The outward connections, which are not model providers and do not
 * belong in the same table: one answers questions, the other reaches out. */
function connectionsSection(data: SetupData) {
  const head = '<section class="section-card"><div class="section-head"><div><h2>Connections</h2>'
    + '<p class="subtle">None of these are required. Measurement runs from a domain alone; these add what your own site already knows, and let the fixes be raised as a pull request.</p></div></div>';
  if (data.integrationsState !== "ready") {
    return head + '<p class="subtle">' + (data.integrationsState === "error" ? "Could not read what this product can connect to." : "Reading connections\u2026") + '</p></section>';
  }
  // Absent when the server refuses to read keys, which is a state this has
  // to draw rather than a reason to draw nothing.
  const held = data.credentials?.credentials || [];
  const open = Boolean(data.credentials) && !data.credentials?.closed;
  const storageEnabled = Boolean(data.credentials?.storageEnabled);
  const rows = data.integrations.filter((row) => row.kind === "integration").map((row) => {
    const live = held.find((item) => item.providerId === row.providerId);
    const mark = !live ? '<span class="mcell state-flag" title="This server has no AUTH_PASSWORD, so it will not report whether a credential is held.">cannot be read here</span>'
      : live.source === "environment" ? '<span class="mcell state-ok">set in the environment</span>'
      : live.source === "stored" ? '<span class="mcell state-ok">stored here</span>'
      : '<span class="mcell state-flag">not connected</span>';
    // The two ways in, named. A self-hosted copy registers no OAuth app of
    // its own, so the second way is a client the reader owns.
    const ways = row.providerId === "google" || row.providerId === "google-analytics"
      ? '<ul class="protocol-list"><li><strong>A service account key.</strong> Paste the JSON, then add the service account as a user on the property.</li>'
        + '<li><strong>An OAuth client you own.</strong> Paste <span class="mono">{"client_id", "client_secret", "refresh_token"}</span> consented to the scopes below.</li></ul>'
      : '';
    const settings = (row.settings || []).map((setting) => {
      const value = live && (live.settings || []).find((item) => item.key === setting.key);
      const shown = value && value.value ? '<span class="mono">' + html(String(value.value)) + '</span>' : '<span class="state-flag">not set</span>';
      return '<li>' + html(setting.label) + ': ' + shown + ' \u00b7 <span class="mono">' + html(setting.envKey) + '</span></li>';
    }).join("");
    const control = !open
      ? '<span class="step-note">Key entry is closed on this server, so set ' + (row.envKeys || []).map((key) => '<span class="mono">' + html(String(key)) + '</span>').join(" or ") + ' in .env.</span>'
      : live && !live.editable
        ? '<span class="step-note">Set in the environment, so it cannot be changed here.</span>'
        : !storageEnabled
          ? '<span class="step-note">Needs CREDENTIAL_KEY.</span>'
          : '<span class="credential-control"><input type="password" autocomplete="off" placeholder="' + (ways ? "Paste the JSON" : "Paste the token") + '" data-credential-input="' + html(row.providerId) + '">'
            + button({ label: "Save", on: { "data-credential-save": row.providerId } })
            + (live && live.source === "stored" ? button({ label: "Remove", tone: "danger", on: { "data-credential-clear": row.providerId } }) : '') + '</span>';
    return '<div class="section-card connection-card" data-connection="' + html(String(row.providerId)) + '"><div class="section-head"><div><h3>' + html(row.label) + '</h3>'
      + '<p class="subtle">' + html(row.purpose) + '</p></div>' + mark + '</div>'
      + ways
      + (settings ? '<ul class="protocol-list">' + settings + '</ul>' : '')
      + '<p class="field-help">' + html(row.help) + '</p>'
      + '<div class="inline-actions">' + control + '</div></div>';
  }).join("");
  return head + (rows || '<p class="subtle">No outward connections are defined.</p>') + '</section>';
}

export function setupView(data: SetupData) {
  if (data.providersState !== "ready") {
    return '<section class="view"><div class="heading"><div><h1>Setup</h1><p class="subtle">Which providers this machine can actually run.</p></div></div><div class="empty"><div class="empty-copy"><h2>' + (data.providersState === "error" ? "Could not read provider status" : "Checking providers") + '</h2></div></div></section>';
  }
  const rows = data.providers.map((provider) => {
    const paidBlocked = Boolean(provider.balance && !provider.balance.paidModelsRunnable);
    const mark = !provider.configured ? "Not configured"
      : !provider.reachable ? "Unreachable"
      : paidBlocked && provider.freeModels ? "Free models only"
      : !provider.runnableNow ? "Out of credit"
      : "Ready";
    const mode = provider.runnableNow ? "done" : provider.configured ? "warn" : "todo";
    const counts = provider.modelCount + ' models'
      + (provider.freeModels ? ' \u00b7 ' + provider.freeModels + ' free to run' : '')
      + (provider.nativeWebSearchModels ? ' \u00b7 ' + provider.nativeWebSearchModels + ' with web search' : '')
      + (provider.configured && !provider.citationCapable ? ' \u00b7 no citations' : '');
    const stateClass = mode === "done" ? "state-ok" : mode === "warn" ? "state-flag" : "";
    return '<div class="mrow mcols-provider" data-state="' + mode + '">'
      + '<div class="mname"><strong>' + html(provider.label) + '</strong><span class="mono">' + html(provider.endpoint || "not set") + '</span></div>'
      + '<span class="mcell">' + counts + '</span>'
      + '<span class="mcell ' + stateClass + '">' + html(mark) + '</span>'
      + '<span class="mcell">' + html(provider.detail) + '</span></div>';
  }).join("");
  const runnable = data.providers.filter((provider) => provider.runnableNow);
  const banner = runnable.length
    ? ''
    : '<div class="warning-box">Nothing can run right now. Every configured provider is either out of credit, unreachable or has no models. A run started now would fail once per selected model.</div>';
  const envRows = data.providers.map((provider) => {
    const keys = provider.envKeys.concat(provider.settingsEnvKeys || []);
    return '<li>' + html(provider.label) + ': <span class="mono">' + html(keys.join(", ")) + '</span></li>';
  }).join("");
  return '<section class="view"><div class="heading"><div><h1>Setup</h1><p class="subtle">Which providers this machine can actually run, and what each one costs you.</p></div><div class="inline-actions">' + button({ label: "Re-check", on: { "data-reload-providers": true } }) + '</div></div>'
    + banner
    + '<section class="section-card"><div class="section-head"><div><h2>Providers</h2><p class="subtle">A provider appears in the model picker only when it is configured and answering.</p></div></div><div class="mtable"><div class="mhead mcols-provider"><span>Provider</span><span>Catalog</span><span>Status</span><span>What this means</span></div>' + rows + '</div></section>'
    + '<section class="section-card"><div class="section-head"><div><h2>Where this is stored</h2><p class="subtle">Everything is small JSON documents, so it sits on a disk or a bucket equally well.</p></div></div>' + storageSection(data) + '</section>'
    + credentialsSection(data) + connectionsSection(data) + '<section class="section-card"><div class="section-head"><div><h2>Where these come from</h2><p class="subtle">Set in .env at the repository root, then restart the server.</p></div></div><ul class="protocol-list">' + envRows + '</ul></section></section>';
}
