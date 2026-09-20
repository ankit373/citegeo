import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { credentialKey, decryptSecret, encryptSecret, type StoredCredential } from "../auth/credential-store.js";
import { storageBackend, type StorageBackendId, type StorageSettings } from "./storage-config.js";

// Where the settings themselves live: always on disk, never in the bucket they
// configure, or the product could not read its own configuration to reach it.

interface StoredSettings {
  backend: StorageBackendId;
  plain: Record<string, string>;
  secrets: Record<string, StoredCredential>;
  updatedAt: string;
}

export class StorageSettingsError extends Error {}

export const DEFAULT_SETTINGS: StorageSettings = { backend: "local", values: {} };

function notFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

export class StorageSettingsStore {
  constructor(private readonly rootDir: string) {}

  private path(): string {
    return join(this.rootDir, "storage-settings.json");
  }

  async load(): Promise<StorageSettings> {
    let stored: StoredSettings;
    try {
      stored = JSON.parse(await readFile(this.path(), "utf8")) as StoredSettings;
    } catch (error) {
      if (notFound(error)) return DEFAULT_SETTINGS;
      throw error;
    }
    const key = credentialKey();
    const values: Record<string, string> = { ...stored.plain };
    for (const [name, record] of Object.entries(stored.secrets || {})) {
      // A secret that cannot be decrypted is absent, not blank: a blank would
      // be sent to the service and fail as a wrong key rather than a missing one.
      const value = key ? decryptSecret(key, record) : null;
      if (value !== null) values[name] = value;
    }
    return { backend: stored.backend, values };
  }

  async save(settings: StorageSettings): Promise<void> {
    const backend = storageBackend(settings.backend);
    if (!backend) throw new StorageSettingsError(`Unknown storage backend "${settings.backend}".`);
    const secretFields = new Set(backend.fields.filter((field) => field.secret).map((field) => field.key));
    const key = credentialKey();
    if (secretFields.size && !key) {
      throw new StorageSettingsError(
        "Set CREDENTIAL_KEY before storing storage credentials. Without it a key would sit on disk in plain text.",
      );
    }

    const plain: Record<string, string> = {};
    const secrets: Record<string, StoredCredential> = {};
    for (const [name, value] of Object.entries(settings.values || {})) {
      const trimmed = (value || "").trim();
      if (!trimmed) continue;
      if (secretFields.has(name) && key) secrets[name] = encryptSecret(key, trimmed);
      else plain[name] = trimmed;
    }

    const body: StoredSettings = { backend: settings.backend, plain, secrets, updatedAt: new Date().toISOString() };
    await mkdir(this.rootDir, { recursive: true });
    const path = this.path();
    const temporary = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(body, null, 2)}\n`, "utf8");
    await rename(temporary, path);
  }

  /** The settings with every secret masked, which is all the interface ever sees. */
  async describe(): Promise<{ backend: StorageBackendId; values: Record<string, string>; secretsSet: string[] }> {
    const settings = await this.load();
    const backend = storageBackend(settings.backend);
    const secretFields = new Set((backend?.fields || []).filter((field) => field.secret).map((field) => field.key));
    const values: Record<string, string> = {};
    const secretsSet: string[] = [];
    for (const [name, value] of Object.entries(settings.values)) {
      if (secretFields.has(name)) { secretsSet.push(name); continue; }
      values[name] = value;
    }
    return { backend: settings.backend, values, secretsSet };
  }
}
