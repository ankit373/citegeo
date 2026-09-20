import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, rmdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

// Everything this product stores is a small JSON document under a key. That is
// the whole surface, which is why it can sit on a disk or on a bucket.

export interface ObjectStore {
  get(key: string): Promise<string | null>;
  put(key: string, body: string): Promise<void>;
  delete(key: string): Promise<void>;
  /** Keys under a prefix, full keys rather than the remainder. */
  list(prefix: string): Promise<string[]>;
  /** Where this is writing, for the interface to show. */
  describe(): string;
}

export class ObjectStoreError extends Error {}

/** A key is a path with forward slashes and no way out of the root. */
export function assertSafeKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) throw new ObjectStoreError("An empty key cannot be stored.");
  if (trimmed.startsWith("/")) throw new ObjectStoreError(`Key "${key}" must be relative.`);
  for (const segment of trimmed.split("/")) {
    if (segment === "" || segment === "." || segment === "..") {
      throw new ObjectStoreError(`Key "${key}" must not contain an empty or relative segment.`);
    }
  }
  return trimmed;
}

/** The disk, which is the default and needs nothing configured. */
export class LocalObjectStore implements ObjectStore {
  constructor(private readonly rootDir: string) {}

  private pathFor(key: string): string {
    const root = resolve(this.rootDir);
    const path = resolve(root, assertSafeKey(key));
    // resolve() would happily escape the root given a crafted key.
    if (path !== root && !path.startsWith(root + sep)) throw new ObjectStoreError(`Key "${key}" resolves outside the store.`);
    return path;
  }

  async get(key: string): Promise<string | null> {
    try {
      return await readFile(this.pathFor(key), "utf8");
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  // Temp file then rename, because a reader shares this volume with the worker.
  async put(key: string, body: string): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporary, body, "utf8");
    await rename(temporary, path);
  }

  async delete(key: string): Promise<void> {
    const path = this.pathFor(key);
    await rm(path, { force: true });
    // Object storage has no empty directories, so neither does this. Without
    // pruning, a purged project left its folder behind.
    await this.pruneEmpty(dirname(path));
  }

  private async pruneEmpty(directory: string): Promise<void> {
    const root = resolve(this.rootDir);
    let current = directory;
    while (current.startsWith(root + sep)) {
      try {
        if ((await readdir(current)).length) return;
        // rmdir, not rm: it is the operation that means "only if empty", and
        // rm without recursive throws on a directory and was being swallowed.
        await rmdir(current);
      } catch {
        return;
      }
      current = dirname(current);
    }
  }

  async list(prefix: string): Promise<string[]> {
    const clean = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
    const root = this.pathFor(clean || ".");
    const found: string[] = [];
    const walk = async (directory: string, keyPrefix: string): Promise<void> => {
      let entries;
      try {
        entries = await readdir(directory, { withFileTypes: true });
      } catch (error) {
        if (isNotFound(error)) return;
        throw error;
      }
      for (const entry of entries) {
        const key = keyPrefix ? `${keyPrefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) await walk(join(directory, entry.name), key);
        // A rename that has not landed yet is not an object.
        else if (!entry.name.endsWith(".tmp")) found.push(key);
      }
    };
    await walk(root, clean);
    return found.sort();
  }

  describe(): string {
    return `local disk at ${resolve(this.rootDir)}`;
  }
}

export function isNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

/** Reads a JSON document, returning null when it is absent rather than throwing. */
export async function getJson<T>(store: ObjectStore, key: string): Promise<T | null> {
  const raw = await store.get(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // A half-written object is not a corrupt store; the next write fixes it.
    return null;
  }
}

export async function putJson(store: ObjectStore, key: string, value: unknown): Promise<void> {
  await store.put(key, `${JSON.stringify(value, null, 2)}\n`);
}

/** Every JSON document under a prefix. A document mid-write is skipped rather
 * than failing the read of every other one. */
export async function listJson<T>(store: ObjectStore, prefix: string): Promise<T[]> {
  const rows: T[] = [];
  for (const key of await store.list(prefix)) {
    if (!key.endsWith(".json")) continue;
    const row = await getJson<T>(store, key);
    if (row) rows.push(row);
  }
  return rows;
}

/** Resolves its backend on first use. Construction of the service graph stays
 * synchronous while the settings behind it are decrypted asynchronously. */
export class DeferredObjectStore implements ObjectStore {
  private resolved: Promise<ObjectStore> | null = null;
  private described = "not resolved yet";

  constructor(private readonly resolve: () => Promise<ObjectStore>) {}

  private store(): Promise<ObjectStore> {
    if (!this.resolved) {
      this.resolved = this.resolve().then((store) => {
        this.described = store.describe();
        return store;
      });
    }
    return this.resolved;
  }

  async get(key: string): Promise<string | null> { return (await this.store()).get(key); }
  async put(key: string, body: string): Promise<void> { return (await this.store()).put(key, body); }
  async delete(key: string): Promise<void> { return (await this.store()).delete(key); }
  async list(prefix: string): Promise<string[]> { return (await this.store()).list(prefix); }
  describe(): string { return this.described; }
}
