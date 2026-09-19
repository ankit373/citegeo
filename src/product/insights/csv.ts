// RFC 4180 CSV, written by hand because the architecture test bans regexes.
// Export exists so a finding can leave this tool without being retyped.

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join(" | ") : String(value);
  const needsQuotes = text.includes(",") || text.includes("\"") || text.includes("\n") || text.includes("\r");
  if (!needsQuotes) return text;
  return `"${text.split("\"").join("\"\"")}"`;
}

export interface CsvTable {
  columns: string[];
  rows: Array<Array<unknown>>;
}

export function toCsv(table: CsvTable): string {
  const lines = [table.columns.map(cell).join(",")];
  for (const row of table.rows) lines.push(row.map(cell).join(","));
  // A trailing newline keeps the file well formed for tools that append.
  return `${lines.join("\r\n")}\r\n`;
}
