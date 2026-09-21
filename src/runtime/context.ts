import { AsyncLocalStorage } from "node:async_hooks";

// Node loses the thread of a request across every await, timer and callback.
// AsyncLocalStorage carries it, so a log line written five layers down still
// knows which request it belongs to without that being threaded by hand.

export interface RequestScope {
  traceId: string;
  spanId: string;
  sampled: boolean;
  /** Set once the route is matched, so a log can be grouped by it. */
  route?: string;
  method?: string;
  projectId?: string;
}

const storage = new AsyncLocalStorage<RequestScope>();

export function runInScope<T>(scope: RequestScope, run: () => T): T {
  return storage.run(scope, run);
}

export function currentScope(): RequestScope | undefined {
  return storage.getStore();
}

/** Late-bound facts. The route is not known until it matches, and the project
 * is not known until the handler reads it. */
export function describeScope(fields: Partial<RequestScope>): void {
  const scope = storage.getStore();
  if (!scope) return;
  Object.assign(scope, fields);
}
