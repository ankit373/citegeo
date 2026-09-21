// Twenty-five pairs of `thing` and `thingState` said the same thing in two
// places, and nothing stopped one being read while the other said it had not
// loaded. One type instead, so the four states are the four the product cares
// about and the compiler will not let a caller skip one.

export type Loadable<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; value: T }
  | { status: "error"; error: string };

export const idle: Loadable<never> = { status: "idle" };
export const loading: Loadable<never> = { status: "loading" };

export function ready<T>(value: T): Loadable<T> {
  return { status: "ready", value };
}

export function failed<T>(error: unknown): Loadable<T> {
  return { status: "error", error: error instanceof Error ? error.message : String(error) };
}

/** The value, or nothing. Nothing is not an empty value: a caller that wants
 * to tell "not loaded" from "loaded and empty" must ask the status. */
export function valueOf<T>(held: Loadable<T>): T | null {
  return held.status === "ready" ? held.value : null;
}

export function isReady<T>(held: Loadable<T>): held is { status: "ready"; value: T } {
  return held.status === "ready";
}

export function needsLoad<T>(held: Loadable<T>): boolean {
  return held.status === "idle";
}

/** Renders the four states in one place, so no page invents a fifth. */
export function match<T>(held: Loadable<T>, handlers: {
  idle?: () => string;
  loading: () => string;
  error: (error: string) => string;
  ready: (value: T) => string;
}): string {
  if (held.status === "ready") return handlers.ready(held.value);
  if (held.status === "error") return handlers.error(held.error);
  if (held.status === "loading") return handlers.loading();
  return (handlers.idle || handlers.loading)();
}
