import type { ProductBaseline } from "./baseline-schema.js";

/** The configuration in force, which is the newest, not the first ever saved.
 * Taking [0] ran generation against a nine-model set retired long ago. */
export function currentBaseline(baselines: ProductBaseline[], activeBaselineId?: string): ProductBaseline | null {
  if (!baselines.length) return null;
  const active = activeBaselineId ? baselines.find((row) => row.id === activeBaselineId) : undefined;
  if (active) return active;
  return [...baselines].sort((left, right) => right.version - left.version)[0] || null;
}
