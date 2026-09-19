// What the models assert about a brand, and whether any of it is backed.
// Profound's FactCheck names inaccurate claims. This stores claim-to-citation
// links, so it can also name an assertion with no source behind it at all,
// which is the more common failure and the one nothing else reports.
//
// Nothing here decides that a claim is false. It reports disagreement, absence
// of a source, and distance from what the brand itself declares. A reader draws
// the conclusion, because a wrong accusation is worse than silence.

export type ClaimField = "brand" | "businessDescription" | "productCategory";

export const CLAIM_FIELDS: ClaimField[] = ["brand", "businessDescription", "productCategory"];

export interface AnswerClaims {
  modelId: string;
  displayName: string;
  values: Partial<Record<ClaimField, string | null>>;
  /** Fields with at least one citation linked to them. */
  sourcedFields: ClaimField[];
}

export interface ClaimDisagreement {
  field: ClaimField;
  variants: Array<{ value: string; models: string[] }>;
}

export interface UnsourcedClaim {
  field: ClaimField;
  models: string[];
  /** Answers that asserted the field with no citation behind it. */
  count: number;
}

export interface DeclaredMismatch {
  field: ClaimField;
  declared: string;
  asserted: string;
  models: string[];
}

export interface ClaimAudit {
  answers: number;
  disagreements: ClaimDisagreement[];
  unsourced: UnsourcedClaim[];
  /** Assertions sharing no meaningful word with what the brand declares. */
  mismatches: DeclaredMismatch[];
}

const STOP_WORDS = new Set([
  "a", "an", "and", "the", "for", "of", "to", "in", "on", "with", "that", "this",
  "is", "are", "be", "by", "or", "as", "at", "from", "it", "its", "platform",
  "tool", "service", "company", "solution", "software", "app", "website", "site",
]);

const SEPARATORS = [" ", ",", ".", ";", ":", "/", "\\", "(", ")", "[", "]", "-", "–", "—", "\"", "'", "!", "?", "|", "\n", "\t"];

/** Split on punctuation without a regex, then drop filler words. */
export function meaningfulWords(value: string): Set<string> {
  let parts = [value.toLocaleLowerCase()];
  for (const separator of SEPARATORS) {
    const next: string[] = [];
    for (const part of parts) for (const piece of part.split(separator)) next.push(piece);
    parts = next;
  }
  const words = new Set<string>();
  for (const part of parts) {
    const word = part.trim();
    if (word.length < 3 || STOP_WORDS.has(word)) continue;
    words.add(word);
  }
  return words;
}

function normalise(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function buildClaimAudit(input: {
  answers: AnswerClaims[];
  /** What the brand says about itself, used only to measure distance. */
  declared?: Partial<Record<ClaimField, string>> | undefined;
}): ClaimAudit {
  const answers = input.answers;
  const disagreements: ClaimDisagreement[] = [];
  const unsourced: UnsourcedClaim[] = [];
  const mismatches: DeclaredMismatch[] = [];

  for (const field of CLAIM_FIELDS) {
    const variants = new Map<string, { value: string; models: Set<string> }>();
    const unsourcedModels = new Set<string>();
    let unsourcedCount = 0;

    for (const answer of answers) {
      const raw = answer.values[field];
      if (!raw || !raw.trim()) continue;
      const key = normalise(raw);
      const existing = variants.get(key) || { value: raw.trim(), models: new Set<string>() };
      existing.models.add(answer.modelId);
      variants.set(key, existing);

      if (!answer.sourcedFields.includes(field)) {
        unsourcedModels.add(answer.modelId);
        unsourcedCount += 1;
      }

      const declared = input.declared?.[field];
      if (declared && declared.trim()) {
        const declaredWords = meaningfulWords(declared);
        const assertedWords = meaningfulWords(raw);
        const shared = [...assertedWords].some((word) => declaredWords.has(word));
        // Only a complete absence of overlap is reported. Partial difference is
        // normal paraphrase, and flagging it would manufacture false alarms.
        if (!shared && declaredWords.size > 0 && assertedWords.size > 0) {
          const already = mismatches.find((row) => row.field === field && normalise(row.asserted) === key);
          if (already) already.models.push(answer.modelId);
          else mismatches.push({ field, declared: declared.trim(), asserted: raw.trim(), models: [answer.modelId] });
        }
      }
    }

    if (variants.size > 1) {
      disagreements.push({
        field,
        variants: [...variants.values()]
          .map((row) => ({ value: row.value, models: [...row.models].sort() }))
          .sort((left, right) => right.models.length - left.models.length),
      });
    }
    if (unsourcedCount > 0) {
      unsourced.push({ field, models: [...unsourcedModels].sort(), count: unsourcedCount });
    }
  }

  for (const row of mismatches) row.models = [...new Set(row.models)].sort();

  return { answers: answers.length, disagreements, unsourced, mismatches };
}
