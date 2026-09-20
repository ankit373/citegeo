import { load } from "cheerio";
import { assertSafeKey, ObjectStoreError, type ObjectStore } from "./object-store.js";
import { encodeKeyPath, signRequest, type SigningKeys } from "./sigv4.js";

// One adapter for every S3-compatible service: AWS, Cloudflare R2, MinIO,
// DigitalOcean Spaces, Backblaze B2, and Google Cloud Storage through its own
// S3-compatible XML API.

export interface S3StoreConfig {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string | undefined;
  /** Omit for AWS. Set for R2, MinIO, Spaces, B2 or GCS. */
  endpoint?: string | undefined;
  /** Required by MinIO and anything not serving bucket-as-subdomain. */
  forcePathStyle?: boolean | undefined;
  /** Everything this product writes lives under here. */
  prefix?: string | undefined;
}

function trimSlashes(value: string): string {
  let out = value.trim();
  while (out.startsWith("/")) out = out.slice(1);
  while (out.endsWith("/")) out = out.slice(0, -1);
  return out;
}

export class S3ObjectStore implements ObjectStore {
  private readonly prefix: string;

  constructor(private readonly config: S3StoreConfig) {
    if (!config.bucket.trim()) throw new ObjectStoreError("A bucket name is required.");
    if (!config.accessKeyId.trim() || !config.secretAccessKey.trim()) throw new ObjectStoreError("An access key and secret are required.");
    this.prefix = trimSlashes(config.prefix || "");
  }

  private keys(): SigningKeys {
    return {
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      sessionToken: this.config.sessionToken,
      region: this.config.region || "us-east-1",
      service: "s3",
    };
  }

  private fullKey(key: string): string {
    const safe = assertSafeKey(key);
    return this.prefix ? `${this.prefix}/${safe}` : safe;
  }

  /** Path-style puts the bucket in the path; virtual-hosted puts it in the host. */
  private urlFor(objectKey: string, query: Record<string, string> = {}): URL {
    const base = this.config.endpoint?.trim()
      || `https://s3.${this.config.region || "us-east-1"}.amazonaws.com`;
    const root = new URL(base.includes("://") ? base : `https://${base}`);
    const pathStyle = this.config.forcePathStyle ?? Boolean(this.config.endpoint);
    const url = pathStyle
      ? new URL(`${root.origin}/${encodeURIComponent(this.config.bucket)}${objectKey ? `/${encodeKeyPath(objectKey)}` : "/"}`)
      : new URL(`${root.protocol}//${this.config.bucket}.${root.host}${objectKey ? `/${encodeKeyPath(objectKey)}` : "/"}`);
    for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
    return url;
  }

  private async send(method: string, url: URL, body = ""): Promise<Response> {
    const headers = signRequest({ method, url, body }, this.keys());
    const init: RequestInit = { method, headers };
    if (method !== "GET" && method !== "DELETE") init.body = body;
    return fetch(url, init);
  }

  async get(key: string): Promise<string | null> {
    const response = await this.send("GET", this.urlFor(this.fullKey(key)));
    if (response.status === 404) return null;
    if (!response.ok) throw await this.failure("read", key, response);
    return response.text();
  }

  // A PUT of a whole object is atomic at the service, so no temp key is needed.
  async put(key: string, body: string): Promise<void> {
    const response = await this.send("PUT", this.urlFor(this.fullKey(key)), body);
    if (!response.ok) throw await this.failure("write", key, response);
  }

  async delete(key: string): Promise<void> {
    const response = await this.send("DELETE", this.urlFor(this.fullKey(key)));
    if (!response.ok && response.status !== 404) throw await this.failure("delete", key, response);
  }

  async list(prefix: string): Promise<string[]> {
    const scoped = this.fullKey(prefix.endsWith("/") ? prefix.slice(0, -1) : prefix);
    const found: string[] = [];
    let token: string | undefined;
    // A bucket returns at most a thousand keys per call and says when there
    // are more, so a project with more than that is not silently truncated.
    do {
      const query: Record<string, string> = { "list-type": "2", prefix: `${scoped}/`, "max-keys": "1000" };
      if (token) query["continuation-token"] = token;
      const response = await this.send("GET", this.urlFor("", query));
      if (!response.ok) throw await this.failure("list", prefix, response);
      const document = load(await response.text(), { xmlMode: true });
      document("Contents > Key").each((_, node) => {
        const full = document(node).text();
        if (full) found.push(this.prefix ? full.slice(this.prefix.length + 1) : full);
      });
      token = document("IsTruncated").first().text() === "true"
        ? document("NextContinuationToken").first().text() || undefined
        : undefined;
    } while (token);
    return found.sort();
  }

  private async failure(action: string, key: string, response: Response): Promise<ObjectStoreError> {
    const body = await response.text().catch(() => "");
    const code = load(body, { xmlMode: true })("Code").first().text();
    const detail = code ? `${code} (HTTP ${response.status})` : `HTTP ${response.status}`;
    return new ObjectStoreError(`Could not ${action} "${key}" in bucket ${this.config.bucket}: ${detail}`);
  }

  describe(): string {
    const where = this.config.endpoint?.trim() || `s3.${this.config.region || "us-east-1"}.amazonaws.com`;
    return `bucket ${this.config.bucket} at ${where}${this.prefix ? ` under ${this.prefix}/` : ""}`;
  }
}
