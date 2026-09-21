// One place for every figure the interface prints, so "not measurable" reads
// the same everywhere and a null never renders as a zero.

export function percent(value: number | null | undefined): string {
  return value === null || value === undefined ? "Not measurable" : `${Math.round(value * 100)}%`;
}

export function score(value: number | null | undefined): string {
  return value === null || value === undefined ? "Not measurable" : String(value);
}

export function rank(value: number | null | undefined): string {
  return value === null || value === undefined ? "Not named" : `#${value}`;
}

export function count(value: number, singular: string, plural = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function shortDate(value: string | null | undefined): string {
  return value ? value.slice(0, 16).replace("T", " ") : "";
}

export function seconds(milliseconds: number | null | undefined): string {
  return milliseconds === null || milliseconds === undefined ? "no timing" : `${Math.round(milliseconds / 100) / 10}s`;
}
