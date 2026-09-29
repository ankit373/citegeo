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
}

export function countDrafts(drafts: AgentDraft[]): DraftCounts {
  const counts: DraftCounts = { awaiting_review: 0, approved: 0, rejected: 0 };
  for (const draft of drafts) counts[draft.status] += 1;
  return counts;
}
