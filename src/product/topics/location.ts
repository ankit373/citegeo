import { randomUUID } from "node:crypto";
import { getJson, putJson } from "../storage/object-store.js";
import type { ProductProjectFileStore } from "../projects/project-store.js";
import type { Region } from "./region.js";

// REGIONS is a fixed list of countries, which cannot answer "best dentist in
// Leeds" against "best dentist in Bristol". A location is a place this project
// defines, and it reaches the model exactly as a market does: as a stated
// audience, never as a geolocated query. The same caveat applies to both.

export class LocationUnavailableError extends Error {}

export interface Location {
  id: string;
  label: string;
  /** How the audience is described to the model, in its own words. */
  audience: string;
  /** BCP 47, for the language the answer should be written in. */
  locale: string;
  /** False once retired, kept so past answers still resolve to a label. */
  tracked: boolean;
  addedAt: string;
}

export interface LocationSet {
  projectId: string;
  locations: Location[];
  updatedAt: string;
}

/** A location behaves as a market in the run pipeline, so nothing downstream
 * needs to know which of the two it was asked with. */
export function asRegion(row: Location): Region {
  return { id: row.id, label: row.label, locale: row.locale, audience: row.audience };
}

export function locationFrom(set: LocationSet | null, id: string): Location | undefined {
  return set?.locations.find((row) => row.id === id);
}

export function trackedLocations(set: LocationSet): Location[] {
  return set.locations.filter((row) => row.tracked);
}

export class LocationService {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private key(projectId: string): string {
    return this.projects.keyFor(projectId, "locations", "set.json");
  }

  async get(projectId: string): Promise<LocationSet> {
    const row = await getJson<LocationSet>(this.projects.objects, this.key(projectId));
    return row && row.projectId === projectId ? row : { projectId, locations: [], updatedAt: new Date().toISOString() };
  }

  async add(projectId: string, input: { label: string; audience?: string | undefined; locale?: string | undefined }): Promise<LocationSet> {
    const label = input.label.trim();
    if (!label) throw new LocationUnavailableError("A location needs a name.");
    // Without an audience the model is told nothing, and the run would be a
    // copy of the unstated market under a different label.
    const audience = (input.audience || "").trim() || `someone in ${label}`;
    const locale = (input.locale || "").trim() || "en";
    const set = await this.get(projectId);
    const already = set.locations.find((row) => row.label.toLocaleLowerCase() === label.toLocaleLowerCase());
    if (already) {
      already.tracked = true;
      already.audience = audience;
      already.locale = locale;
    } else {
      set.locations.push({ id: `location-${randomUUID()}`, label, audience, locale, tracked: true, addedAt: new Date().toISOString() });
    }
    set.updatedAt = new Date().toISOString();
    await putJson(this.projects.objects, this.key(projectId), set);
    return set;
  }

  async retire(projectId: string, locationIds: string[]): Promise<LocationSet> {
    const set = await this.get(projectId);
    const wanted = new Set(locationIds);
    for (const row of set.locations) if (wanted.has(row.id)) row.tracked = false;
    set.updatedAt = new Date().toISOString();
    await putJson(this.projects.objects, this.key(projectId), set);
    return set;
  }
}
