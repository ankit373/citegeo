import { sha256 } from "../../utils/hash.js";
import type { ProductProjectFileStore } from "../projects/project-store.js";
import { getJson, putJson } from "../storage/object-store.js";
import { domainLabel, tokenize } from "./prompt-identity.js";

// Who you actually compete with, as opposed to whoever happened to be named.
// A rival you track and never see is a finding; one you never declared is
// invisible, and those are different things.

export type CompetitorSource = "declared" | "from_site" | "discovered";

export interface Competitor {
  id: string;
  name: string;
  domain: string | null;
  source: CompetitorSource;
  /** False once retired, kept so past runs still resolve. */
  tracked: boolean;
  addedAt: string;
}

export interface CompetitorSet {
  projectId: string;
  competitors: Competitor[];
  updatedAt: string;
}

export function competitorId(projectId: string, name: string): string {
  return `rival-${sha256(JSON.stringify({ projectId, name: tokenize(name).join(" ") })).slice(0, 24)}`;
}

export function emptyCompetitorSet(projectId: string): CompetitorSet {
  return { projectId, competitors: [], updatedAt: new Date().toISOString() };
}

/** Whether a named organisation is this tracked rival. */
export function matchesCompetitor(competitor: Competitor, name: string, domain: string | null): boolean {
  if (tokenize(competitor.name).join(" ") === tokenize(name).join(" ")) return true;
  if (!competitor.domain || !domain) return false;
  return domainLabel(competitor.domain) === domainLabel(domain);
}

export class CompetitorFileStore {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private key(projectId: string): string {
    return this.projects.keyFor(projectId, "competitors.json");
  }

  async load(projectId: string): Promise<CompetitorSet> {
    const parsed = await getJson<CompetitorSet>(this.projects.objects, this.key(projectId));
    if (!parsed) return emptyCompetitorSet(projectId);
    return { ...emptyCompetitorSet(projectId), ...parsed, projectId };
  }

  async save(set: CompetitorSet): Promise<void> {
    await putJson(this.projects.objects, this.key(set.projectId), { ...set, updatedAt: new Date().toISOString() });
  }
}

export class CompetitorSetError extends Error {}

export class CompetitorService {
  constructor(private readonly store: CompetitorFileStore) {}

  async get(projectId: string): Promise<CompetitorSet> {
    return this.store.load(projectId);
  }

  async add(projectId: string, input: { name: string; domain?: string | null; source?: CompetitorSource }): Promise<CompetitorSet> {
    const name = input.name.trim();
    if (!name) throw new CompetitorSetError("A competitor needs a name.");
    const set = await this.store.load(projectId);
    const id = competitorId(projectId, name);
    const existing = set.competitors.find((row) => row.id === id);
    if (existing) {
      // Re-adding a retired rival tracks it again rather than duplicating it.
      existing.tracked = true;
      if (input.domain) existing.domain = input.domain;
    } else {
      set.competitors.push({
        id,
        name,
        domain: (input.domain || "").trim() || null,
        source: input.source || "declared",
        tracked: true,
        addedAt: new Date().toISOString(),
      });
    }
    await this.store.save(set);
    return this.store.load(projectId);
  }

  /** Adds everyone found, skipping any already known, and says how many. */
  async adopt(projectId: string, found: Array<{ name: string; domain: string | null }>, source: CompetitorSource): Promise<{ set: CompetitorSet; added: number }> {
    const set = await this.store.load(projectId);
    const known = new Set(set.competitors.map((row) => row.id));
    let added = 0;
    for (const row of found) {
      const name = row.name.trim();
      if (!name) continue;
      const id = competitorId(projectId, name);
      if (known.has(id)) continue;
      known.add(id);
      set.competitors.push({ id, name, domain: row.domain, source, tracked: true, addedAt: new Date().toISOString() });
      added += 1;
    }
    if (added) await this.store.save(set);
    return { set: await this.store.load(projectId), added };
  }

  async retire(projectId: string, ids: string[]): Promise<CompetitorSet> {
    const wanted = new Set(ids);
    const set = await this.store.load(projectId);
    for (const row of set.competitors) {
      if (wanted.has(row.id)) row.tracked = false;
    }
    await this.store.save(set);
    return this.store.load(projectId);
  }
}
