// The password is the only thing between a reachable port and every credential
// this product holds. Loopback is the default, so this matters most to whoever
// changes HOST and does not think about what else that opens.

/** Tries allowed before the delay starts climbing. */
const FREE_ATTEMPTS = 5;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 5 * 60 * 1000;
/** A quiet period long enough that a slow guesser gains nothing by waiting. */
const FORGET_AFTER_MS = 15 * 60 * 1000;

interface Attempts {
  failures: number;
  lockedUntilMs: number;
  lastFailureMs: number;
}

const seen = new Map<string, Attempts>();

export function resetThrottle(): void {
  seen.clear();
}

/** Doubles per failure past the free allowance, to a ceiling. */
export function delayFor(failures: number): number {
  if (failures <= FREE_ATTEMPTS) return 0;
  const steps = failures - FREE_ATTEMPTS - 1;
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * Math.pow(2, steps));
}

export interface ThrottleVerdict {
  allowed: boolean;
  /** Seconds the caller is told to wait, so the answer is actionable. */
  retryAfterSeconds: number;
}

export function checkAttempt(key: string, now = Date.now()): ThrottleVerdict {
  const row = seen.get(key);
  if (!row) return { allowed: true, retryAfterSeconds: 0 };
  // A long enough gap is treated as a fresh start, so one fat-fingered evening
  // does not lock someone out the next morning.
  if (now - row.lastFailureMs > FORGET_AFTER_MS) {
    seen.delete(key);
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (now < row.lockedUntilMs) {
    return { allowed: false, retryAfterSeconds: Math.ceil((row.lockedUntilMs - now) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordFailure(key: string, now = Date.now()): void {
  const row = seen.get(key) || { failures: 0, lockedUntilMs: 0, lastFailureMs: 0 };
  const failures = (now - row.lastFailureMs > FORGET_AFTER_MS ? 0 : row.failures) + 1;
  seen.set(key, { failures, lastFailureMs: now, lockedUntilMs: now + delayFor(failures) });
}

/** A correct password clears the record, so the delay never outlives the doubt. */
export function recordSuccess(key: string): void {
  seen.delete(key);
}
