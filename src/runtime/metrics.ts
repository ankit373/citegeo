import { BoundedSeries } from "./cardinality.js";

// Counters and histograms, in memory, exported on a schedule. Cumulative
// temporality, which is what a collector expects and what survives a scrape
// being missed.

/** Latency in milliseconds. Explicit boundaries rather than generated ones,
 * because a bucket edge is a decision about what "slow" means here. */
export const LATENCY_BUCKETS_MS = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000];

const MAX_SERIES_PER_INSTRUMENT = 200;

export type Labels = Record<string, string | number | boolean>;

/** Sorted, so {a,b} and {b,a} are one series rather than two. */
export function seriesKey(labels: Labels): string {
  const keys = Object.keys(labels).sort();
  let out = "";
  for (const key of keys) out += `${key}\u0000${String(labels[key])}\u0001`;
  return out;
}

function labelsFrom(key: string): Labels {
  const out: Labels = {};
  for (const pair of key.split("\u0001")) {
    if (!pair) continue;
    const [name, value] = pair.split("\u0000");
    if (name) out[name] = value ?? "";
  }
  return out;
}

interface Bucketed {
  counts: number[];
  sum: number;
  count: number;
}

export class Counter {
  private readonly series = new BoundedSeries<{ value: number }>(MAX_SERIES_PER_INSTRUMENT, () => ({ value: 0 }));

  constructor(readonly name: string, readonly unit = "1", readonly description = "") {}

  add(amount: number, labels: Labels = {}): void {
    this.series.get(seriesKey(labels)).value += amount;
  }

  collect(): Array<{ labels: Labels; value: number }> {
    return this.series.entries().map(([key, held]) => ({ labels: labelsFrom(key), value: held.value }));
  }
}

export class Histogram {
  private readonly series: BoundedSeries<Bucketed>;

  constructor(readonly name: string, readonly boundaries = LATENCY_BUCKETS_MS, readonly unit = "ms", readonly description = "") {
    this.series = new BoundedSeries<Bucketed>(MAX_SERIES_PER_INSTRUMENT, () => ({
      counts: new Array<number>(boundaries.length + 1).fill(0),
      sum: 0,
      count: 0,
    }));
  }

  /** Binary search for the bucket: O(log b) rather than a scan, which matters
   * because this is called on every request and every provider call. */
  private bucketFor(value: number): number {
    let low = 0;
    let high = this.boundaries.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (value <= (this.boundaries[middle] as number)) high = middle;
      else low = middle + 1;
    }
    return low;
  }

  observe(value: number, labels: Labels = {}): void {
    const held = this.series.get(seriesKey(labels));
    held.counts[this.bucketFor(value)] = (held.counts[this.bucketFor(value)] || 0) + 1;
    held.sum += value;
    held.count += 1;
  }

  collect(): Array<{ labels: Labels; counts: number[]; sum: number; count: number }> {
    return this.series.entries().map(([key, held]) => ({
      labels: labelsFrom(key),
      counts: [...held.counts],
      sum: held.sum,
      count: held.count,
    }));
  }
}

export class Registry {
  private readonly counters = new Map<string, Counter>();
  private readonly histograms = new Map<string, Histogram>();

  counter(name: string, unit?: string, description?: string): Counter {
    const held = this.counters.get(name);
    if (held) return held;
    const made = new Counter(name, unit, description);
    this.counters.set(name, made);
    return made;
  }

  histogram(name: string, boundaries?: number[], unit?: string, description?: string): Histogram {
    const held = this.histograms.get(name);
    if (held) return held;
    const made = new Histogram(name, boundaries, unit, description);
    this.histograms.set(name, made);
    return made;
  }

  allCounters(): Counter[] {
    return [...this.counters.values()];
  }

  allHistograms(): Histogram[] {
    return [...this.histograms.values()];
  }
}

export const metrics = new Registry();
