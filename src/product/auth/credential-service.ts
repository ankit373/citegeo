import { credentialEnvKeys, integration } from "./integrations.js";
import { CredentialFileStore, credentialKey, decryptSecret, encryptSecret } from "./credential-store.js";

// The rules live here rather than in the HTTP layer, so a future caller cannot
// route round them by reaching for the store directly.

export type CredentialSource = "environment" | "stored" | "none";

export interface CredentialStatus {
  providerId: string;
  label: string;
  kind: string;
  purpose: string;
  help: string;
  settings: Array<{ key: string; label: string; envKey: string; value: string | null }>;
  source: CredentialSource;
  /** Enough to recognise the key, never enough to use it. */
  last4: string | null;
  updatedAt: string | null;
  /** False when the environment owns this provider's key. */
  editable: boolean;
  envKeys: string[];
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

function envValue(providerId: string): string | null {
  for (const key of credentialEnvKeys(providerId)) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
}

export class CredentialService {
  constructor(private readonly store: CredentialFileStore) {}

  storageEnabled(): boolean {
    return credentialKey() !== null;
  }

  async status(providerIds: string[]): Promise<CredentialStatus[]> {
    const file = await this.store.read();
    return providerIds.map((providerId) => {
      const fromEnv = envValue(providerId);
      const stored = file[providerId];
      const definition = integration(providerId);
      // Settings are not secrets, so their values are shown: a wrong endpoint
      // is a thing you have to see to fix.
      const settings = (definition?.settings || []).map((setting) => ({
        ...setting,
        value: process.env[setting.envKey]?.trim() || null,
      }));
      const shared = {
        providerId,
        label: definition?.label || providerId,
        kind: definition?.kind || "integration",
        purpose: definition?.purpose || "",
        help: definition?.help || "",
        settings,
        envKeys: credentialEnvKeys(providerId),
      };
      if (fromEnv) {
        return { ...shared, source: "environment" as const, last4: fromEnv.slice(-4), updatedAt: null, editable: false };
      }
      return {
        ...shared,
        source: stored ? ("stored" as const) : ("none" as const),
        last4: stored?.last4 ?? null,
        updatedAt: stored?.updatedAt ?? null,
        editable: true,
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
}
