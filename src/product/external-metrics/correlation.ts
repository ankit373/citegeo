/** Small, dependency-free correlation helpers for the external-metrics view.
 * They intentionally describe association only: the UI must never turn a
 * correlation into “this optimisation caused that traffic change”. */

export interface CorrelationPoint {
  observedAt: string;
  value: number | null;
}

export interface CorrelationResult {
  method: "pearson" | "spearman";
  lagDays: number;
  pairedObservations: number;
  coefficient: number | null;
}

const MIN_PAIRS = 12;
const DAY = 24 * 60 * 60 * 1000;

function finite(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function pearson(values: Array<[number, number]>): number | null {
  if (values.length < MIN_PAIRS) return null;
  const left = values.map(([value]) => value);
  const right = values.map(([, value]) => value);
  const leftMean = mean(left);
  const rightMean = mean(right);
  let numerator = 0;
  let leftSquare = 0;
  let rightSquare = 0;
  for (const [a, b] of values) {
    const aDelta = a - leftMean;
    const bDelta = b - rightMean;
    numerator += aDelta * bDelta;
    leftSquare += aDelta * aDelta;
    rightSquare += bDelta * bDelta;
  }
  return leftSquare && rightSquare ? numerator / Math.sqrt(leftSquare * rightSquare) : null;
}

function ranks(values: number[]): number[] {
  const order = values.map((value, index) => ({ value, index })).sort((left, right) => left.value - right.value);
  const result = new Array<number>(values.length);
  for (let start = 0; start < order.length;) {
    let end = start + 1;
    while (end < order.length && order[end]?.value === order[start]?.value) end += 1;
    const rank = (start + 1 + end) / 2;
    for (let index = start; index < end; index += 1) result[order[index]!.index] = rank;
    start = end;
  }
  return result;
}

function closePoint(points: CorrelationPoint[], at: number): CorrelationPoint | null {
  const tolerance = 4 * DAY;
  let best: CorrelationPoint | null = null;
  let distance = Infinity;
  for (const point of points) {
    if (!finite(point.value)) continue;
    const candidate = Math.abs(Date.parse(point.observedAt) - at);
    if (candidate <= tolerance && candidate < distance) { best = point; distance = candidate; }
  }
  return best;
}

/** Aligns sparse weekly/monthly pulls to the nearest evidence sample, then
 * evaluates the advertised lead/lag. A null result means insufficient or
 * constant data—not zero correlation. */
export function correlate(input: {
  left: CorrelationPoint[];
  right: CorrelationPoint[];
  lagDays?: number;
  method?: "pearson" | "spearman";
}): CorrelationResult {
  const lagDays = input.lagDays || 0;
  const method = input.method || "pearson";
  const pairs: Array<[number, number]> = [];
  for (const left of input.left) {
    if (!finite(left.value)) continue;
    const right = closePoint(input.right, Date.parse(left.observedAt) + lagDays * DAY);
    if (right && finite(right.value)) pairs.push([left.value, right.value]);
  }
  const measured = method === "spearman"
    ? (() => {
        const leftRanks = ranks(pairs.map(([value]) => value));
        const rightRanks = ranks(pairs.map(([, value]) => value));
        return pearson(leftRanks.map((value, index) => [value, rightRanks[index]!] as [number, number]));
      })()
    : pearson(pairs);
  return { method, lagDays, pairedObservations: pairs.length, coefficient: measured };
}
