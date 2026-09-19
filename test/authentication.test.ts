import test from "node:test";
import assert from "node:assert/strict";
import {
  clearedCookie,
  issueSession,
  readCookie,
  safeEqual,
  sessionCookie,
  verifySession,
} from "../src/product/auth/session.js";
import { authorise, isOpenPath, passwordMatches } from "../src/product/auth/auth-guard.js";
import type { AuthConfig } from "../src/product/auth/auth-guard.js";

const SECRET = "test-secret";
const HOUR = 60 * 60 * 1000;

function config(overrides: Partial<AuthConfig> = {}): AuthConfig {
  return { enabled: true, password: "correct horse", secret: SECRET, lifetimeMs: HOUR, ...overrides };
}

test("a freshly issued session verifies", () => {
  const token = issueSession(SECRET, HOUR, 1000);
  assert.equal(verifySession(SECRET, token, 1000), true);
});

test("a session past its expiry is refused", () => {
  const token = issueSession(SECRET, HOUR, 1000);
  assert.equal(verifySession(SECRET, token, 1000 + HOUR + 1), false);
});

test("a token signed with a different secret is refused", () => {
  const token = issueSession("other-secret", HOUR, 1000);
  assert.equal(verifySession(SECRET, token, 1000), false);
});

test("extending the expiry without resigning is refused", () => {
  const token = issueSession(SECRET, HOUR, 1000);
  const signature = token.slice(token.lastIndexOf(".") + 1);
  const forged = `${9_999_999_999_999}.${signature}`;
  assert.equal(verifySession(SECRET, forged, 1000), false);
});

test("a malformed token is refused rather than throwing", () => {
  for (const token of ["", ".", "nodot", ".onlysignature", "123."]) {
    assert.equal(verifySession(SECRET, token, 1000), false, token);
  }
});

test("comparison of different lengths is still safe and false", () => {
  assert.equal(safeEqual("short", "considerably longer"), false);
  assert.equal(safeEqual("same", "same"), true);
  assert.equal(safeEqual("same", "sane"), false);
});

test("the session cookie is HttpOnly and SameSite strict", () => {
  const cookie = sessionCookie("abc", HOUR, false);
  assert.ok(cookie.includes("HttpOnly"));
  assert.ok(cookie.includes("SameSite=Strict"));
  assert.ok(cookie.includes("Max-Age=3600"));
  assert.equal(cookie.includes("Secure"), false, "not marked secure over plain http");
});

test("the cookie is marked Secure when served over https", () => {
  assert.ok(sessionCookie("abc", HOUR, true).includes("Secure"));
  assert.ok(clearedCookie(true).includes("Max-Age=0"));
});

test("one cookie is read from a header holding several", () => {
  assert.equal(readCookie("a=1; citegeo_session=tok%20en; b=2", "citegeo_session"), "tok en");
  assert.equal(readCookie("a=1; b=2", "citegeo_session"), null);
  assert.equal(readCookie(undefined, "citegeo_session"), null);
});

test("with no password set the server behaves exactly as before", () => {
  const decision = authorise({ config: config({ enabled: false, password: "" }), pathname: "/api/projects" });
  assert.equal(decision.allowed, true);
  assert.equal(decision.reason, "disabled");
});

test("with a password set an anonymous request is refused", () => {
  const decision = authorise({ config: config(), pathname: "/api/projects" });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "no_session");
});

test("a valid session is admitted", () => {
  const token = issueSession(SECRET, HOUR, 1000);
  const decision = authorise({
    config: config(),
    pathname: "/api/projects",
    cookieHeader: `citegeo_session=${token}`,
    now: 1000,
  });
  assert.equal(decision.allowed, true);
});

test("an expired session is refused rather than treated as absent", () => {
  const token = issueSession(SECRET, HOUR, 1000);
  const decision = authorise({
    config: config(),
    pathname: "/api/projects",
    cookieHeader: `citegeo_session=${token}`,
    now: 1000 + HOUR + 1,
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "expired_or_invalid");
});

test("health and login stay open, because a closed door cannot be opened", () => {
  for (const path of ["/health", "/login", "/api/login", "/api/logout", "/assets/brand/citegeo-lockup.svg"]) {
    assert.equal(isOpenPath(path), true, path);
  }
  for (const path of ["/", "/api/projects", "/api/providers"]) {
    assert.equal(isOpenPath(path), false, path);
  }
});

test("a wrong password is refused and the right one accepted", () => {
  assert.equal(passwordMatches(config(), "correct horse"), true);
  assert.equal(passwordMatches(config(), "wrong horse"), false);
  assert.equal(passwordMatches(config(), ""), false);
  assert.equal(passwordMatches(config(), null), false);
});

test("no password can log in when authentication is off", () => {
  assert.equal(passwordMatches(config({ enabled: false, password: "" }), ""), false);
});
