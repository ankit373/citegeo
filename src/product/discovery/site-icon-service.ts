import type { ProductProjectFileStore } from "../projects/project-store.js";
import { getJson, putJson } from "../storage/object-store.js";
import { readSiteIcon } from "./site-icon.js";

// Marks are read from each site once and kept, because a logo does not move
// often and nobody should wait on a crawl to draw a table.

export interface IconRecord {
  /** Null when the site declares no icon, which is an answer and is kept. */
  url: string | null;
  readAt: string;
}

const STALE_AFTER_DAYS = 30;

export class SiteIconStore {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private key(): string {
    return "brand-icons.json";
  }

  async load(): Promise<Record<string, IconRecord>> {
    return (await getJson<Record<string, IconRecord>>(this.projects.objects, this.key())) || {};
  }

  async save(all: Record<string, IconRecord>): Promise<void> {
    await putJson(this.projects.objects, this.key(), all);
  }
}

export class SiteIconService {
  private inFlight = new Map<string, Promise<IconRecord>>();

  constructor(private readonly store: SiteIconStore) {}

  /** What is already known, with nothing fetched. A table draws from this. */
  async known(domains: string[]): Promise<Record<string, string | null>> {
    const all = await this.store.load();
    const out: Record<string, string | null> = {};
    for (const domain of domains) {
      const held = all[domain];
      if (held) out[domain] = held.url;
    }
    return out;
  }

  /** Reads any domain not seen recently, one at a time, and keeps the answer. */
  async refresh(domains: string[]): Promise<Record<string, string | null>> {
    const all = await this.store.load();
    const cutoff = Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
    const wanted = domains.filter((domain) => {
      const held = all[domain];
      return !held || Date.parse(held.readAt) < cutoff;
    });
    for (const domain of wanted.slice(0, 12)) {
      // One in flight per domain, so ten tables asking at once read once.
      let job = this.inFlight.get(domain);
      if (!job) {
        job = readSiteIcon(domain).then((url) => ({ url, readAt: new Date().toISOString() }));
        this.inFlight.set(domain, job);
        job.finally(() => this.inFlight.delete(domain));
      }
      all[domain] = await job;
    }
    if (wanted.length) await this.store.save(all);
    const out: Record<string, string | null> = {};
    for (const domain of domains) {
      const held = all[domain];
      if (held) out[domain] = held.url;
    }
    return out;
  }
}
