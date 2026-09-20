import { checkObjectStore, createObjectStore, STORAGE_BACKENDS, type StorageBackendId } from "./storage-config.js";
import { StorageSettingsStore } from "./storage-settings.js";

export type StorageJsonSender = (status: number, body: unknown, contentType?: string) => void;

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function handleStorageApi(input: {
  method: string;
  route: string[];
  send: StorageJsonSender;
  settings: StorageSettingsStore;
  dataDir: string;
  readJson: () => Promise<Record<string, unknown>>;
}): Promise<boolean> {
  const { method, route, send, settings, dataDir, readJson } = input;
  if (route[0] !== "api" || route[1] !== "storage") return false;

  if (method === "GET" && route.length === 2) {
    try {
      send(200, { backends: STORAGE_BACKENDS, current: await settings.describe() });
    } catch (error) {
      send(500, { error: message(error) });
    }
    return true;
  }

  if (method === "PUT" && route.length === 2) {
    const body = await readJson();
    const backend = typeof body.backend === "string" ? (body.backend as StorageBackendId) : "local";
    const values = body.values && typeof body.values === "object" ? (body.values as Record<string, string>) : {};
    try {
      // Built before it is saved, so an unusable configuration is refused here
      // rather than taking the next restart down with it.
      createObjectStore({ backend, values: await merged(settings, backend, values) }, dataDir);
      await settings.save({ backend, values });
      send(200, await settings.describe());
    } catch (error) {
      send(400, { error: message(error) });
    }
    return true;
  }

  if (method === "POST" && route.length === 3 && route[2] === "check") {
    const body = await readJson();
    const backend = typeof body.backend === "string" ? (body.backend as StorageBackendId) : undefined;
    const values = body.values && typeof body.values === "object" ? (body.values as Record<string, string>) : {};
    try {
      const saved = await settings.load();
      const target = backend || saved.backend;
      const store = createObjectStore({ backend: target, values: await merged(settings, target, values) }, dataDir);
      const result = await checkObjectStore(store);
      send(result.ok ? 200 : 400, { ...result, backend: target });
    } catch (error) {
      send(400, { ok: false, detail: message(error) });
    }
    return true;
  }

  return false;
}

/** A secret already stored is reused when the form sends it back blank, so
 * editing a prefix does not silently wipe the key. */
async function merged(
  settings: StorageSettingsStore,
  backend: StorageBackendId,
  values: Record<string, string>,
): Promise<Record<string, string>> {
  const saved = await settings.load();
  if (saved.backend !== backend) return values;
  const out: Record<string, string> = { ...saved.values };
  for (const [name, value] of Object.entries(values)) {
    if ((value || "").trim()) out[name] = value;
  }
  return out;
}
