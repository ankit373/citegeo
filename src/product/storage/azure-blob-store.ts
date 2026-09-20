import { createHmac } from "node:crypto";
import { load } from "cheerio";
import { assertSafeKey, ObjectStoreError, type ObjectStore } from "./object-store.js";

// Azure signs with its own SharedKey scheme, not SigV4, so it needs its own
// adapter rather than a different endpoint on the S3 one.

export interface AzureBlobConfig {
  account: string;
  container: string;
  /** The storage account key, base64 as the portal shows it. */
  accountKey: string;
  prefix?: string | undefined;
  /** Overridden only by Azurite and sovereign clouds. */
  endpoint?: string | undefined;
}

const API_VERSION = "2021-12-02";

function trimSlashes(value: string): string {
  let out = value.trim();
  while (out.startsWith("/")) out = out.slice(1);
  while (out.endsWith("/")) out = out.slice(0, -1);
  return out;
}

export class AzureBlobObjectStore implements ObjectStore {
  private readonly prefix: string;

  constructor(private readonly config: AzureBlobConfig) {
    if (!config.account.trim() || !config.container.trim()) throw new ObjectStoreError("An account and container are required.");
    if (!config.accountKey.trim()) throw new ObjectStoreError("An account key is required.");
    this.prefix = trimSlashes(config.prefix || "");
  }

  private fullKey(key: string): string {
    const safe = assertSafeKey(key);
    return this.prefix ? `${this.prefix}/${safe}` : safe;
  }

  private base(): string {
    return trimSlashes(this.config.endpoint?.trim() || `https://${this.config.account}.blob.core.windows.net`);
  }

  private urlFor(blob: string, query: Record<string, string> = {}): URL {
    const path = blob ? `/${this.config.container}/${blob.split("/").map(encodeURIComponent).join("/")}` : `/${this.config.container}`;
    const url = new URL(`${this.base()}${path}`);
    for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
    return url;
  }

  /** The canonical form Azure signs: headers in a fixed order, then the
   * resource, then every query parameter sorted. */
  private authorization(method: string, url: URL, headers: Record<string, string>): string {
    const value = (name: string) => headers[name] || "";
    const canonicalHeaders = Object.keys(headers)
      .filter((name) => name.startsWith("x-ms-"))
      .sort()
      .map((name) => `${name}:${headers[name]}`)
      .join("\n");
    const canonicalResource = [`/${this.config.account}${decodeURIComponent(url.pathname)}`]
      .concat([...url.searchParams.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([n, v]) => `${n}:${v}`))
      .join("\n");
    const toSign = [
      method,
      value("content-encoding"), value("content-language"), value("content-length") === "0" ? "" : value("content-length"),
      value("content-md5"), value("content-type"), "", "", "", "", "", "",
      canonicalHeaders,
      canonicalResource,
    ].join("\n");
    const signature = createHmac("sha256", Buffer.from(this.config.accountKey, "base64")).update(toSign, "utf8").digest("base64");
    return `SharedKey ${this.config.account}:${signature}`;
  }

  private async send(method: string, url: URL, body?: string, extra: Record<string, string> = {}): Promise<Response> {
    const headers: Record<string, string> = {
      "x-ms-date": new Date().toUTCString(),
      "x-ms-version": API_VERSION,
      ...extra,
    };
    if (body !== undefined) {
      headers["content-length"] = String(Buffer.byteLength(body, "utf8"));
      headers["content-type"] = "application/json";
    }
    headers.authorization = this.authorization(method, url, headers);
    const init: RequestInit = { method, headers };
    if (body !== undefined) init.body = body;
    return fetch(url, init);
  }

  async get(key: string): Promise<string | null> {
    const response = await this.send("GET", this.urlFor(this.fullKey(key)));
    if (response.status === 404) return null;
    if (!response.ok) throw await this.failure("read", key, response);
    return response.text();
  }

  async put(key: string, body: string): Promise<void> {
    const response = await this.send("PUT", this.urlFor(this.fullKey(key)), body, { "x-ms-blob-type": "BlockBlob" });
    if (!response.ok) throw await this.failure("write", key, response);
  }

  async delete(key: string): Promise<void> {
    const response = await this.send("DELETE", this.urlFor(this.fullKey(key)));
    if (!response.ok && response.status !== 404) throw await this.failure("delete", key, response);
  }

  async list(prefix: string): Promise<string[]> {
    const scoped = this.fullKey(prefix.endsWith("/") ? prefix.slice(0, -1) : prefix);
    const found: string[] = [];
    let marker: string | undefined;
    do {
      const query: Record<string, string> = { restype: "container", comp: "list", prefix: `${scoped}/`, maxresults: "1000" };
      if (marker) query.marker = marker;
      const response = await this.send("GET", this.urlFor("", query));
      if (!response.ok) throw await this.failure("list", prefix, response);
      const document = load(await response.text(), { xmlMode: true });
      document("Blob > Name").each((_, node) => {
        const full = document(node).text();
        if (full) found.push(this.prefix ? full.slice(this.prefix.length + 1) : full);
      });
      marker = document("NextMarker").first().text() || undefined;
    } while (marker);
    return found.sort();
  }

  private async failure(action: string, key: string, response: Response): Promise<ObjectStoreError> {
    const body = await response.text().catch(() => "");
    const code = load(body, { xmlMode: true })("Code").first().text();
    return new ObjectStoreError(
      `Could not ${action} "${key}" in container ${this.config.container}: ${code ? `${code} (HTTP ${response.status})` : `HTTP ${response.status}`}`,
    );
  }

  describe(): string {
    return `container ${this.config.container} on ${this.config.account}${this.prefix ? ` under ${this.prefix}/` : ""}`;
  }
}
