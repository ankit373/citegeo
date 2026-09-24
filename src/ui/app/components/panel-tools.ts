import { toCsv, type CsvTable } from "../../../product/insights/csv.js";

// The deep dive carries the whole set, which is the point of opening it and
// also what makes it unreadable without a way to narrow and a way to leave.

/**
 * Every word has to appear somewhere in the row, so "screener in" finds a row
 * reading "Screener.in" and word order never decides a match.
 */
export function matchesQuery(text: string, query: string): boolean {
  const wanted = query.toLowerCase().split(" ").filter(Boolean);
  if (wanted.length === 0) return true;
  const haystack = text.toLowerCase();
  return wanted.every((word) => haystack.includes(word));
}

export interface FilterOutcome {
  shown: number;
  hidden: number;
}

/** Reports what the query did rather than leaving a short list unexplained. */
export function filterSummary(outcome: FilterOutcome, query: string): string {
  if (!query.trim()) return "";
  if (outcome.shown === 0) return `Nothing here matches ${query.trim()}`;
  if (outcome.hidden === 0) return `All ${outcome.shown} match`;
  return `${outcome.shown} of ${outcome.shown + outcome.hidden}`;
}

/**
 * A row of cells becomes a row of the export, so what leaves is what was on
 * screen rather than a second reading of the data that can disagree with it.
 */
export function panelCsv(columns: string[], rows: string[][]): string {
  const table: CsvTable = { columns, rows };
  return toCsv(table);
}

/** A file name a reader can find again, dated and named after the panel. */
export function exportName(title: string, today: string): string {
  const slug = title.toLowerCase().split("").map((ch) => {
    const ok = (ch >= "a" && ch <= "z") || (ch >= "0" && ch <= "9");
    return ok ? ch : "-";
  }).join("");
  const parts = slug.split("-").filter(Boolean);
  return `${parts.join("-") || "panel"}-${today}.csv`;
}
