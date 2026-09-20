import { sha256 } from "../../utils/hash.js";
import type { ProductProjectFileStore } from "../projects/project-store.js";
import { getJson, putJson } from "../storage/object-store.js";

// A filter combination worth returning to. Four dropdowns set every time is
// how a view stops being looked at.

export interface SegmentFilters {
  topicId?: string | undefined;
  modelId?: string | undefined;
  regionId?: string | undefined;
  languageId?: string | undefined;
}

export interface Segment {
  id: string;
  name: string;
  filters: SegmentFilters;
  createdAt: string;
}

export interface SegmentSet {
  projectId: string;
  segments: Segment[];
  updatedAt: string;
}

export class SegmentError extends Error {}

const FILTER_KEYS: Array<keyof SegmentFilters> = ["topicId", "modelId", "regionId", "languageId"];

export function emptySegmentSet(projectId: string): SegmentSet {
  return { projectId, segments: [], updatedAt: new Date().toISOString() };
}

/** Only the filters that are set, so two segments differing by a blank field
 * are the same segment. */
export function normaliseFilters(filters: SegmentFilters): SegmentFilters {
  const out: SegmentFilters = {};
  for (const key of FILTER_KEYS) {
    const value = (filters[key] || "").trim();
    if (value) out[key] = value;
  }
  return out;
}

export function segmentId(projectId: string, filters: SegmentFilters): string {
  const normalised = normaliseFilters(filters);
  const stable = FILTER_KEYS.map((key) => `${key}=${normalised[key] || ""}`).join("&");
  return `segment-${sha256(JSON.stringify({ projectId, stable })).slice(0, 24)}`;
}

export function segmentQuery(filters: SegmentFilters): string {
  const normalised = normaliseFilters(filters);
  const parts = FILTER_KEYS.filter((key) => normalised[key]).map((key) => `${key}=${encodeURIComponent(normalised[key] as string)}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export class SegmentFileStore {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private key(projectId: string): string {
    return this.projects.keyFor(projectId, "segments.json");
  }

  async load(projectId: string): Promise<SegmentSet> {
    const parsed = await getJson<SegmentSet>(this.projects.objects, this.key(projectId));
    if (!parsed) return emptySegmentSet(projectId);
    return { ...emptySegmentSet(projectId), ...parsed, projectId };
  }

  async save(set: SegmentSet): Promise<void> {
    await putJson(this.projects.objects, this.key(set.projectId), { ...set, updatedAt: new Date().toISOString() });
  }
}

export class SegmentService {
  constructor(private readonly store: SegmentFileStore) {}

  async get(projectId: string): Promise<SegmentSet> {
    return this.store.load(projectId);
  }

  async save(projectId: string, input: { name: string; filters: SegmentFilters }): Promise<SegmentSet> {
    const name = input.name.trim();
    if (!name) throw new SegmentError("A saved view needs a name.");
    const filters = normaliseFilters(input.filters);
    // Saving the unfiltered view would be a button that does nothing.
    if (!Object.keys(filters).length) throw new SegmentError("Set at least one filter before saving a view.");
    const set = await this.store.load(projectId);
    const id = segmentId(projectId, filters);
    const existing = set.segments.find((row) => row.id === id);
    if (existing) existing.name = name;
    else set.segments.push({ id, name, filters, createdAt: new Date().toISOString() });
    await this.store.save(set);
    return this.store.load(projectId);
  }

  async remove(projectId: string, ids: string[]): Promise<SegmentSet> {
    const wanted = new Set(ids);
    const set = await this.store.load(projectId);
    set.segments = set.segments.filter((row) => !wanted.has(row.id));
    await this.store.save(set);
    return this.store.load(projectId);
  }
}
