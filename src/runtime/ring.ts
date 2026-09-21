// A queue that cannot grow without bound. A collector that stops answering
// must not turn into a memory leak, so the oldest entry is dropped and the
// drop is counted rather than hidden.

export class RingBuffer<T> {
  private readonly items: Array<T | undefined>;
  private head = 0;
  private size = 0;
  private dropped = 0;

  constructor(readonly capacity: number) {
    if (capacity < 1) throw new Error("A ring buffer holds at least one item.");
    this.items = new Array<T | undefined>(capacity);
  }

  /** O(1). Returns false when this push displaced an older entry. */
  push(item: T): boolean {
    const at = (this.head + this.size) % this.capacity;
    if (this.size === this.capacity) {
      this.items[this.head] = item;
      this.head = (this.head + 1) % this.capacity;
      this.dropped += 1;
      return false;
    }
    this.items[at] = item;
    this.size += 1;
    return true;
  }

  /** Empties the buffer in insertion order. O(n) once, not O(n) per read. */
  drain(): T[] {
    const out: T[] = new Array<T>(this.size);
    for (let index = 0; index < this.size; index += 1) {
      const at = (this.head + index) % this.capacity;
      out[index] = this.items[at] as T;
      this.items[at] = undefined;
    }
    this.head = 0;
    this.size = 0;
    return out;
  }

  get length(): number {
    return this.size;
  }

  /** How many entries were lost, so the gap is reported rather than silent. */
  get droppedCount(): number {
    return this.dropped;
  }

  resetDropped(): number {
    const was = this.dropped;
    this.dropped = 0;
    return was;
  }
}
