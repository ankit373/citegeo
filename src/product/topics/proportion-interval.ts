// A rate out of a handful of answers is not the rate, it is one draw from it.
// Answering the same question again returns a different set of sources often
// enough that a point estimate read alone invents precision nobody has.
//
// Wilson rather than the textbook normal interval, because at these counts the
// normal one runs past zero and past one and collapses to nothing at all when
// the count is zero or everything.

/** Two sided, about 95 percent. Named so the judgement travels with the range. */
export const INTERVAL_Z = 1.96;

export const INTERVAL_CAVEAT = "The range is what this many answers is consistent with, at about 95 percent. It covers the sampling, not the drift: asking the same question again on another day returns a different set of sources, and no interval from one pass can see that.";

export interface ProportionInterval {
  /** successes / trials. Null with nothing to divide by. */
  rate: number | null;
  low: number | null;
  high: number | null;
  trials: number;
  caveat: string;
}

export function wilsonInterval(successes: number, trials: number): ProportionInterval {
  if (!Number.isFinite(trials) || trials <= 0) {
    return { rate: null, low: null, high: null, trials: 0, caveat: INTERVAL_CAVEAT };
  }
  const hits = Math.min(Math.max(successes, 0), trials);
  const rate = hits / trials;
  const z2 = INTERVAL_Z * INTERVAL_Z;
  const denominator = 1 + z2 / trials;
  const centre = (rate + z2 / (2 * trials)) / denominator;
  const spread = (INTERVAL_Z * Math.sqrt((rate * (1 - rate) + z2 / (4 * trials)) / trials)) / denominator;
  return {
    rate,
    low: Math.max(0, centre - spread),
    high: Math.min(1, centre + spread),
    trials,
    caveat: INTERVAL_CAVEAT,
  };
}

/** True where the range is wide enough that the figure decides nothing. The
 * threshold is a judgement and travels with anything built on it. */
export const UNINFORMATIVE_WIDTH = 0.35;

export function tooWideToRead(interval: ProportionInterval): boolean {
  return interval.low !== null && interval.high !== null && interval.high - interval.low > UNINFORMATIVE_WIDTH;
}
