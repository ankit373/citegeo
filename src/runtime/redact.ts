// A log is the easiest place to leak a key. This is applied to every field a
// log or a span carries, not offered as something a caller may remember.

const SECRET_NAMES = [
  "authorization", "cookie", "set-cookie", "password", "secret", "token",
  "apikey", "api_key", "key", "credential", "private_key", "assertion",
  "access_token", "refresh_token", "client_secret", "session",
];

const KEPT = 4;

function looksSecret(name: string): boolean {
  const lower = name.toLocaleLowerCase();
  return SECRET_NAMES.some((needle) => lower === needle || lower.endsWith(`_${needle}`) || lower.includes(needle));
}

/** Enough to recognise which key it was, never enough to use it. */
export function maskValue(value: string): string {
  if (value.length <= KEPT) return "****";
  return `****${value.slice(-KEPT)}`;
}

export function redact(input: unknown, depth = 0): unknown {
  if (depth > 6 || input === null || input === undefined) return input;
  if (typeof input === "string" || typeof input === "number" || typeof input === "boolean") return input;
  if (Array.isArray(input)) return input.slice(0, 50).map((item) => redact(item, depth + 1));
  if (input instanceof Error) return { name: input.name, message: input.message };
  if (typeof input !== "object") return String(input);
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(input as Record<string, unknown>)) {
    if (looksSecret(name)) out[name] = typeof value === "string" ? maskValue(value) : "****";
    else out[name] = redact(value, depth + 1);
  }
  return out;
}

export function isSecretName(name: string): boolean {
  return looksSecret(name);
}
