/** What a finished pull does to the page. A pull is slow, and the reader can open
 * another project while it runs, so its result only counts for the project it was for. */
export interface PullSettled<S> {
  /** The status to hold, or null when there is nothing of this project's to extend. */
  next: S | null;
  /** False once the reader has moved to another project: the result is dropped. */
  sameProject: boolean;
}

export function settlePull<S extends { configured: boolean; report: R | null }, R>(startedFor: string, selectedNow: string, held: S | null, report: R): PullSettled<S> {
  if (startedFor !== selectedNow) return { next: null, sameProject: false };
  return { next: held ? { ...held, configured: true, report } : null, sameProject: true };
}
