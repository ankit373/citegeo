// A figure with no period behind it cannot move. Comparison needs two windows
// of equal length, and an honest answer when the earlier one holds nothing.

export interface Window {
  /** Inclusive. */
  from: string;
  /** Exclusive, so two adjacent windows never share an answer. */
  to: string;
}

const DAY_MS = 86_400_000;

/** Days each named range covers. "all" has no window and so no comparison. */
export const RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

export function windowFor(range: string, now: Date): Window | null {
  const days = RANGE_DAYS[range];
  if (!days) return null;
  const end = now.getTime();
  return { from: new Date(end - days * DAY_MS).toISOString(), to: new Date(end).toISOString() };
}

/** The window of equal length immediately before this one, never overlapping. */
export function previousWindow(window: Window): Window {
  const from = Date.parse(window.from);
  const to = Date.parse(window.to);
  const span = to - from;
  return { from: new Date(from - span).toISOString(), to: window.from };
}

export function withinWindow(createdAt: string, window: Window | null): boolean {
  if (!window) return true;
  const at = Date.parse(createdAt);
  if (Number.isNaN(at)) return false;
  return at >= Date.parse(window.from) && at < Date.parse(window.to);
}

export function sliceByWindow<T extends { createdAt: string }>(rows: T[], window: Window | null): T[] {
  if (!window) return rows;
  return rows.filter((row) => withinWindow(row.createdAt, window));
}

export interface Delta {
  current: number | null;
  previous: number | null;
  /** current minus previous, null when either side has nothing to compare. */
  change: number | null;
  /** Why there is no change, so an absent comparison is never drawn as flat. */
  reason: "compared" | "no_earlier_period" | "not_measurable";
}

/**
 * Nothing in the earlier window is not a rise from zero. It is the absence of
 * a comparison, and saying so is the only honest reading.
 */
export function delta(current: number | null, previous: number | null, previousAnswers: number): Delta {
  if (current === null) return { current, previous, change: null, reason: "not_measurable" };
  if (previousAnswers === 0 || previous === null) {
    return { current, previous: null, change: null, reason: "no_earlier_period" };
  }
  return { current, previous, change: Math.round((current - previous) * 10) / 10, reason: "compared" };
}
