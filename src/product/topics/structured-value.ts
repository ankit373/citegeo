/**
 * What a provider puts in `structuredOutput.value`.
 *
 * Some return a parsed object and some return the JSON as a string, sometimes
 * inside a markdown code fence. Nothing in the type says which, so a caller
 * that assumes an object gets an object-shaped read of a string: every field
 * reads as absent and the whole payload is silently discarded as unparseable.
 * That is exactly how a correct prompt set arrived and was thrown away.
 */
export function readStructuredValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  const body = trimmed.startsWith("```") ? withoutCodeFence(trimmed) : trimmed;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function withoutCodeFence(trimmed: string): string {
  const firstLineEnd = trimmed.indexOf("\n");
  const closingFence = trimmed.lastIndexOf("```");
  if (firstLineEnd === -1 || closingFence <= firstLineEnd) return trimmed;
  return trimmed.slice(firstLineEnd + 1, closingFence).trim();
}
