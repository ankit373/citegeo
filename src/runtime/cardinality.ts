// Metric labels are the usual way a metrics pipeline is taken down: one label
// carrying a user id or a URL and the series count grows without bound. This
// caps the distinct label sets and folds the rest into one visible bucket, so
// the failure is a named series called "overflow" rather than an outage.

export const OVERFLOW = "__overflow__";

export class BoundedSeries<T> {
  private readonly series = new Map<string, T>();
  private overflowed = 0;

  constructor(private readonly limit: number, private readonly make: () => T) {
    if (limit < 2) throw new Error("A bounded series needs room for one key and the overflow.");
  }

  /** O(1). The cap counts the overflow series too, so the total is bounded by
   * the limit rather than by the limit plus one, which is what a cap means. */
  get(key: string): T {
    const held = this.series.get(key);
    if (held) return held;
    if (this.series.size >= this.limit - 1) {
      this.overflowed += 1;
      const spill = this.series.get(OVERFLOW);
      if (spill) return spill;
      const made = this.make();
      this.series.set(OVERFLOW, made);
      return made;
    }
    const made = this.make();
    this.series.set(key, made);
    return made;
  }

  entries(): Array<[string, T]> {
    return [...this.series.entries()];
  }

  /** Distinct keys that were folded away, so the cap is reported. */
  get overflowCount(): number {
    return this.overflowed;
  }

  get size(): number {
    return this.series.size;
  }

  clear(): void {
    this.series.clear();
    this.overflowed = 0;
  }
}
