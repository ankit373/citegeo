// A signed state proves this server started the flow. Marking it used is what
// stops the same callback URL, out of a browser history, running it again.

const used = new Map<string, number>();
/** Longer than the state's own lifetime, so nothing expires into reusable. */
const REMEMBER_MS = 30 * 60 * 1000;

export function resetUsedStates(): void {
  used.clear();
}

function sweep(now: number): void {
  for (const [state, at] of used) {
    if (now - at > REMEMBER_MS) used.delete(state);
  }
}

export function stateWasUsed(state: string, now = Date.now()): boolean {
  sweep(now);
  return used.has(state);
}

export function markStateUsed(state: string, now = Date.now()): void {
  sweep(now);
  used.set(state, now);
}
