/** Some providers return a parsed object, some a JSON string, sometimes fenced.
 * Reading a string as an object makes every field absent and loses the payload. */
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
