import { getJson, putJson } from "../storage/object-store.js";
import { buildAgreement, reviewable, sampleFor, type AgreementReport, type CheckField, type ReviewItem, type Verdict } from "./human-check.js";
import type { ProductProjectFileStore } from "../projects/project-store.js";
import type { PromptAnswer } from "./prompt-run-schema.js";

/** Enough to say something about the agreement rate without asking somebody to
 * read an afternoon of answers. */
export const SAMPLE_SIZE = 20;

interface VerdictFile {
  projectId: string;
  verdicts: Verdict[];
}

export class HumanCheckService {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private key(projectId: string): string {
    return this.projects.keyFor(projectId, "human-check", "verdicts.json");
  }

  private async load(projectId: string): Promise<VerdictFile> {
    return (await getJson<VerdictFile>(this.projects.objects, this.key(projectId))) || { projectId, verdicts: [] };
  }

  /** The queue, with what has already been judged taken out of it. */
  async queue(projectId: string, answers: PromptAnswer[], size = SAMPLE_SIZE): Promise<{ items: ReviewItem[]; remaining: number }> {
    const items = reviewable(answers);
    const stored = await this.load(projectId);
    const done = new Set(stored.verdicts.map((verdict) => verdict.id + "\u0000" + verdict.field));
    const sample = sampleFor(items, size, projectId);
    const left = sample.filter((item) => !done.has(item.id + "\u0000recommendation") || !done.has(item.id + "\u0000isTarget"));
    return { items: left, remaining: left.length };
  }

  async agreement(projectId: string, answers: PromptAnswer[]): Promise<AgreementReport> {
    const stored = await this.load(projectId);
    return buildAgreement({ items: reviewable(answers), verdicts: stored.verdicts });
  }

  /** One verdict per mention per field. A reviewer changing their mind replaces
   * what they said rather than being counted twice. */
  async record(projectId: string, input: { id: string; field: CheckField; agreed: boolean; correction?: string | undefined }): Promise<AgreementReport> {
    if (!input.id) throw new Error("A verdict needs the mention it is about.");
    const stored = await this.load(projectId);
    const kept = stored.verdicts.filter((verdict) => !(verdict.id === input.id && verdict.field === input.field));
    kept.push({
      id: input.id,
      field: input.field,
      agreed: input.agreed,
      correction: input.agreed ? undefined : (input.correction || "").trim() || undefined,
      at: new Date().toISOString(),
    });
    await putJson(this.projects.objects, this.key(projectId), { projectId, verdicts: kept });
    return this.agreement(projectId, []);
  }
}
