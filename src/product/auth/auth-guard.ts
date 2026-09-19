import { ephemeralSecret, readCookie, safeEqual, verifySession } from "./session.js";

// Authentication is opt in. With no password set the server behaves exactly as
// it did before, because turning it on by default would lock out every existing
// local install on upgrade. SECURITY.md carries the warning for that case.
//
// When a password is set, everything is closed except the login route and the
// health check, which a load balancer needs before anyone can log in.

export const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;

export interface AuthConfig {
  enabled: boolean;
  password: string;
  secret: string;
  lifetimeMs: number;
}

export function authConfig(secret = ephemeralSecret()): AuthConfig {
  const password = process.env.AUTH_PASSWORD?.trim() || "";
  return {
    enabled: password.length > 0,
    password,
    secret: process.env.AUTH_SECRET?.trim() || secret,
    lifetimeMs: SESSION_LIFETIME_MS,
  };
}

/** Open without a session, because a closed one cannot be opened. */
const ALWAYS_OPEN = new Set(["/health", "/login", "/api/login", "/api/logout"]);

export function isOpenPath(pathname: string): boolean {
  if (ALWAYS_OPEN.has(pathname)) return true;
  // Brand assets are referenced by the login page itself.
  return pathname.startsWith("/assets/");
}

export interface AuthDecision {
  allowed: boolean;
  reason: "disabled" | "open_path" | "valid_session" | "no_session" | "expired_or_invalid";
}

export function authorise(input: {
  config: AuthConfig;
  pathname: string;
  cookieHeader?: string | undefined;
  now?: number;
}): AuthDecision {
  if (!input.config.enabled) return { allowed: true, reason: "disabled" };
  if (isOpenPath(input.pathname)) return { allowed: true, reason: "open_path" };
  const token = readCookie(input.cookieHeader, "citegeo_session");
  if (!token) return { allowed: false, reason: "no_session" };
  return verifySession(input.config.secret, token, input.now ?? Date.now())
    ? { allowed: true, reason: "valid_session" }
    : { allowed: false, reason: "expired_or_invalid" };
}

export function passwordMatches(config: AuthConfig, supplied: unknown): boolean {
  if (!config.enabled) return false;
  if (typeof supplied !== "string" || !supplied) return false;
  return safeEqual(supplied, config.password);
}
