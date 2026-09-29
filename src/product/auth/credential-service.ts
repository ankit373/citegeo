import { credentialEnvKeys, integration } from "./integrations.js";
import { CredentialFileStore, IntegrationSettingsFileStore, credentialKey, decryptSecret, encryptSecret } from "./credential-store.js";

// The rules live here rather than in the HTTP layer, so a future caller cannot
// route round them by reaching for the store directly.

export type CredentialSource = "environment" | "stored" | "none";

export interface CredentialStatus {
  providerId: string;
  label: string;
  kind: string;
  purpose: string;
  help: string;
  settings: Array<{
    key: string;
    label: string;
    envKey: string;
    value: string | null;
    source: CredentialSource;
    /** Environment-owned settings are displayed but cannot be overwritten. */
    editable: boolean;
  }>;
  source: CredentialSource;
  /** Enough to recognise the key, never enough to use it. */
  last4: string | null;
  updatedAt: string | null;
  /** False when the environment owns this key, or another card holds it. */
  editable: boolean;
  envKeys: string[];
  /** The card this key actually lives under, when two integrations share one. */
  sharedWith?: string;
}

export type CredentialWriteOutcome =
  | "saved"
  | "cleared"
  | "storage_disabled"
  | "owned_by_environment"
  | "rejected";

export interface CredentialWriteResult {
  outcome: CredentialWriteOutcome;
  detail: string;
}

export interface IntegrationSettingsWriteResult {
  outcome: "saved" | "owned_by_environment" | "rejected";
  detail: string;
}

function isPrintableSetting(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 32 || code === 127) return false;
  }
  return true;
}

function envValue(providerId: string): string | null {
  for (const key of credentialEnvKeys(providerId)) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
}

export class CredentialService {
  constructor(
    private readonly store: CredentialFileStore,
    private readonly settingsStore = new IntegrationSettingsFileStore(store.dataDir),
  ) {}

  storageEnabled(): boolean {
    return credentialKey() !== null;
  }

  async status(providerIds: string[]): Promise<CredentialStatus[]> {
    const file = await this.store.read();
    const settingsFile = await this.settingsStore.read();
    return providerIds.map((providerId) => {
      const definition = integration(providerId);
      // Two integrations can share one credential. Reading the card's own id
      // when the key lives elsewhere reports a working connection as absent.
      const slot = definition?.credentialSlot || providerId;
      const fromEnv = envValue(slot);
      const stored = file[slot];
      // Settings are not secrets, so their values are shown: a wrong endpoint
      // is a thing you have to see to fix.
      const settings = (definition?.settings || []).map((setting) => {
        const environment = process.env[setting.envKey]?.trim() || null;
        const storedSetting = settingsFile[providerId]?.[setting.key]?.trim() || null;
        return {
          ...setting,
          value: environment || storedSetting,
          source: environment ? ("environment" as const) : storedSetting ? ("stored" as const) : ("none" as const),
          editable: !environment,
        };
      });
      const shared = {
        providerId,
        label: definition?.label || providerId,
        kind: definition?.kind || "integration",
        purpose: definition?.purpose || "",
        help: definition?.help || "",
        settings,
        envKeys: credentialEnvKeys(slot),
        /** Set when the key is held by another card, so this one cannot edit it. */
        ...(slot === providerId ? {} : { sharedWith: slot }),
      };
      if (fromEnv) {
        return { ...shared, source: "environment" as const, last4: fromEnv.slice(-4), updatedAt: null, editable: false };
      }
      return {
        ...shared,
        source: stored ? ("stored" as const) : ("none" as const),
        last4: stored?.last4 ?? null,
        updatedAt: stored?.updatedAt ?? null,
        // A shared key is edited where it lives, not in two places at once.
        editable: slot === providerId,
      };
    });
  }

  /** Resolves a usable key, preferring the environment. Never logged. */
  async resolve(providerId: string): Promise<string | null> {
    const fromEnv = envValue(providerId);
    if (fromEnv) return fromEnv;
    const key = credentialKey();
    if (!key) return null;
    const record = (await this.store.read())[providerId];
    return record ? decryptSecret(key, record, providerId) : null;
  }

  async save(providerId: string, secret: unknown): Promise<CredentialWriteResult> {
    const key = credentialKey();
    if (!key) {
      return {
        outcome: "storage_disabled",
        detail: "Set CREDENTIAL_KEY to 32 bytes to store keys here. Without it a stored key could not survive a restart.",
      };
    }
    if (envValue(providerId)) {
      return {
        outcome: "owned_by_environment",
        detail: `This key comes from ${credentialEnvKeys(providerId).join(" or ")}. Remove it from the environment before setting one here, or the stored value would be ignored.`,
      };
    }
    if (typeof secret !== "string" || secret.trim().length < 8) {
      // Nothing shorter than this is a real provider key, and refusing it early
      // avoids storing a typo that fails much later inside a run.
      return { outcome: "rejected", detail: "That does not look like a provider key." };
    }
    const file = await this.store.read();
    file[providerId] = encryptSecret(key, secret.trim(), providerId);
    await this.store.write(file);
    return { outcome: "saved", detail: "Stored. Restart is not required." };
  }

  async clear(providerId: string): Promise<CredentialWriteResult> {
    const file = await this.store.read();
    if (!file[providerId]) return { outcome: "cleared", detail: "Nothing was stored for this provider." };
    delete file[providerId];
    await this.store.write(file);
    return { outcome: "cleared", detail: "Removed." };
  }

  /** Stores only declared, short, printable settings. Secrets continue to use
   * the encrypted credential path; this is deliberately for property IDs,
   * country/database scope, and similar UI-onboarded configuration. */
  async saveSettings(providerId: string, values: unknown): Promise<IntegrationSettingsWriteResult> {
    const definition = integration(providerId);
    if (!definition) return { outcome: "rejected", detail: `Unknown provider "${providerId}".` };
    if (!values || typeof values !== "object" || Array.isArray(values)) return { outcome: "rejected", detail: "Settings must be a key-value object." };
    const supplied = values as Record<string, unknown>;
    const allowed = new Map((definition.settings || []).map((setting) => [setting.key, setting]));
    const output: Record<string, string> = {};
    for (const [key, setting] of allowed) {
      if (process.env[setting.envKey]?.trim()) {
        if (key in supplied) return { outcome: "owned_by_environment", detail: `${setting.label} comes from ${setting.envKey}; remove it from the environment before changing it here.` };
        continue;
      }
      const value = supplied[key];
      if (value === undefined || value === null) continue;
      if (typeof value !== "string") return { outcome: "rejected", detail: `${setting.label} must be text.` };
      const trimmed = value.trim();
      if (!trimmed) continue;
      if (trimmed.length > 500 || !isPrintableSetting(trimmed)) return { outcome: "rejected", detail: `${setting.label} is not a valid setting.` };
      output[key] = trimmed;
    }
    for (const key of Object.keys(supplied)) {
      if (!allowed.has(key)) return { outcome: "rejected", detail: `Unknown setting "${key}" for ${definition.label}.` };
    }
    const all = await this.settingsStore.read();
    if (Object.keys(output).length) all[providerId] = output;
    else delete all[providerId];
    await this.settingsStore.write(all);
    return { outcome: "saved", detail: Object.keys(output).length ? "Connection settings saved." : "Connection settings cleared." };
  }
}
