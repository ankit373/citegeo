import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// A signed session token. There is one account, so this carries an expiry and
// nothing else: no user id to leak, no server-side session table to keep, and
// no way to promote a token to a different identity because there isn't one.
//
// Format: <expiryMillis>.<hmac of the expiry>. Both halves are checked, and the
// comparison is constant time so a wrong signature reveals nothing by how long
// it takes to reject.

export const SESSION_COOKIE = "citegeo_session";

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function issueSession(secret: string, lifetimeMs: number, now = Date.now()): string {
  const expiry = String(now + lifetimeMs);
  return `${expiry}.${sign(secret, expiry)}`;
}

/** Constant time even when the lengths differ, which a bare === is not. */
export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  if (a.length !== b.length) {
    // Still compare something of equal length so the answer does not arrive
    // sooner for a wrong-length input.
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

export function verifySession(secret: string, token: string, now = Date.now()): boolean {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;
  const expiry = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!safeEqual(signature, sign(secret, expiry))) return false;
  const expiresAt = Number(expiry);
  return Number.isFinite(expiresAt) && expiresAt > now;
}

/** Reads one cookie from a header without a regex. */
export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const equals = trimmed.indexOf("=");
    if (equals === -1) continue;
    if (trimmed.slice(0, equals) !== name) continue;
    return decodeURIComponent(trimmed.slice(equals + 1));
  }
  return null;
}

export function sessionCookie(token: string, lifetimeMs: number, secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    // Strict, because nothing here is meant to be reached from another site.
    "SameSite=Strict",
    `Max-Age=${Math.floor(lifetimeMs / 1000)}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearedCookie(secure: boolean): string {
  const parts = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Strict", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/**
 * Derives a signing secret when the operator did not supply one. Regenerated
 * each boot, so restarting signs everyone out rather than reusing a secret
 * derived from the password itself.
 */
export function ephemeralSecret(): string {
  return randomBytes(32).toString("base64url");
}
