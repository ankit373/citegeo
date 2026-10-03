import type { StructuredAsk } from "./topic-service.js";

// A rewording has to ask the same thing in different words. A model is good at
// that and bad at knowing when it has changed the question, so the schema makes
// it say what each one keeps, and anything naming the brand is dropped.

export const WORDING_SCHEMA_NAME = "question_wordings";

export const WORDING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["wordings"],
  properties: {
    wordings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "sameIntent"],
        properties: {
          text: { type: "string" },
          /** False where the model thinks it has drifted. Its own word, kept
           * so a drifted wording is dropped rather than quietly compared. */
          sameIntent: { type: "boolean" },
        },
      },
    },
  },
} as const;

export function wordingPrompt(input: { question: string; count: number }): string {
  return [
    "Rewrite this question in other words. Someone with the same need would type any of them.",
    "",
    `Question: ${input.question}`,
    "",
    `Write ${input.count} rewordings.`,
    "Keep the intent identical. Change the wording, the order and the register.",
    "Never name a brand, a product or a company that the question does not already name.",
    "Do not make the question narrower or broader.",
    "Set sameIntent false for any rewording you are not sure keeps the same intent.",
  ].join("\n");
}

export interface ProposedWording {
  text: string;
  sameIntent: boolean;
}

/** Only the ones the model vouched for, deduplicated and never the original. */
export function readWordings(value: unknown, original: string): string[] {
  const parsed = value as { wordings?: ProposedWording[] } | null;
  const rows = Array.isArray(parsed?.wordings) ? parsed.wordings : [];
  const seen = new Set([original.trim().toLocaleLowerCase()]);
  const out: string[] = [];
  for (const row of rows) {
    const text = typeof row?.text === "string" ? row.text.trim() : "";
    if (!text || row?.sameIntent !== true) continue;
    const key = text.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

export async function proposeWordings(input: {
  ask: StructuredAsk;
  projectId: string;
  question: string;
  count: number;
}): Promise<string[]> {
  const value = await input.ask({
    projectId: input.projectId,
    prompt: wordingPrompt({ question: input.question, count: input.count }),
    schemaName: WORDING_SCHEMA_NAME,
    schemaDescription: "Rewordings of one question that keep its intent.",
    schema: WORDING_SCHEMA as unknown as Record<string, unknown>,
  });
  return readWordings(value, input.question);
}
