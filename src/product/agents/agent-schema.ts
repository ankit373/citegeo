// A draft is never published by this product. It is written, it carries the
// evidence it came from, and a person decides what happens to it.

export type DraftStatus = "awaiting_review" | "approved" | "rejected";

export const DRAFT_STATUSES: DraftStatus[] = ["awaiting_review", "approved", "rejected"];

/** What the draft was built from, so a reader can disagree with the draft and
 * still check the observation under it. */
export interface DraftSource {
  kind: "prompt" | "entity" | "citation";
  reference: string;
  detail: string;
}

export interface AgentDraft {
  id: string;
  projectId: string;
  templateId: string;
  title: string;
  /** Markdown. Nothing here renders it as HTML or sends it anywhere. */
  body: string;
  /** Why this was worth drafting, stated from the evidence rather than the model. */
  rationale: string;
  sources: DraftSource[];
  status: DraftStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  /** Where it went live, and when. Null until somebody records it. Nothing
   * downstream can use a draft as a before and after boundary without a date. */
  publishedUrl: string | null;
  publishedAt: string | null;
}

/** A draft said to be live, with somewhere to check it. */
export interface DraftPublication {
  url: string;
  at: string;
}

function httpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** A publication with no readable URL is a claim that something shipped with
 * no way for anybody to check it, so it is not recorded. */
export function parsePublication(value: unknown): DraftPublication | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const url = httpUrl(row.url);
  if (!url) return null;
  const asked = typeof row.at === "string" && row.at.trim() ? new Date(row.at.trim()) : new Date();
  if (!Number.isFinite(asked.getTime())) return null;
  return { url, at: asked.toISOString() };
}

/** Drafts written before publication was recorded have neither field. Reading
 * one back as undefined would make "not published" indistinguishable from a
 * field nobody wrote. */
export function withPublication(draft: AgentDraft): AgentDraft {
  return { ...draft, publishedUrl: draft.publishedUrl || null, publishedAt: draft.publishedAt || null };
}

export function isPublished(draft: AgentDraft): boolean {
  return Boolean(draft.publishedAt);
}

export interface DraftReview {
  status: Extract<DraftStatus, "approved" | "rejected">;
  note: string | null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export interface ParsedDraft {
  status: "completed" | "unusable";
  title: string;
  body: string;
  rationale: string;
}

/** A draft without a title or a body is not a draft. Saving one would put an
 * empty page in a review queue and call it work. */
export function parseDraft(value: unknown): ParsedDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { status: "unusable", title: "", body: "", rationale: "" };
  const row = value as Record<string, unknown>;
  if (row.analysisStatus !== "completed") return { status: "unusable", title: "", body: "", rationale: "" };
  const title = text(row.title);
  const body = text(row.body);
  if (!title || !body) return { status: "unusable", title: "", body: "", rationale: "" };
  return { status: "completed", title, body, rationale: text(row.rationale) };
}

export function isReviewable(draft: AgentDraft): boolean {
  return draft.status === "awaiting_review";
}

export interface DraftCounts {
  awaiting_review: number;
  approved: number;
  rejected: number;
  /** Approved and recorded as live. The only ones anything can be measured on. */
  published: number;
}

export function countDrafts(drafts: AgentDraft[]): DraftCounts {
  const counts: DraftCounts = { awaiting_review: 0, approved: 0, rejected: 0, published: 0 };
  for (const draft of drafts) {
    counts[draft.status] += 1;
    if (isPublished(draft)) counts.published += 1;
  }
  return counts;
}
