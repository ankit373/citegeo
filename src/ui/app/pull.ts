/** What a finished pull does to the page. A pull is slow, and the reader can open
 * another project while it runs, so its result only counts for the project it was for. */
export interface PullSettled<S> {
  /** The status to hold, or null when there is nothing of this project's to extend. */
  next: S | null;
  /** False once the reader has moved to another project: the result is dropped. */
  sameProject: boolean;
}

/** Whether the project a request was started for is still the one open. */
export function isOpen(startedFor: string, selectedNow: string): boolean {
  return startedFor === selectedNow;
}

export function settlePull<S extends { configured: boolean; report: R | null }, R>(startedFor: string, selectedNow: string, held: S | null, report: R): PullSettled<S> {
  if (!isOpen(startedFor, selectedNow)) return { next: null, sameProject: false };
  return { next: held ? { ...held, configured: true, report } : null, sameProject: true };
}

/** Reads for the project that was open when it started, and applies the result
 * only while that project still is. A late answer for another project is dropped,
 * whether it carries data or an error. */
export async function loadForProject<T>(
  startedFor: string,
  current: () => string,
  read: () => Promise<T>,
  apply: (value: T) => void,
  fail: () => void,
): Promise<boolean> {
  try {
    const value = await read();
    if (!isOpen(startedFor, current())) return false;
    apply(value);
    return true;
  } catch {
    if (!isOpen(startedFor, current())) return false;
    fail();
    return false;
  }
}
