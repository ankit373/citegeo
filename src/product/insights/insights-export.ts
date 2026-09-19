import { toCsv } from "./csv.js";
import type { CsvTable } from "./csv.js";
import type { ProjectInsights } from "./insights-service.js";

// Which analytics leave as a file, and in what shape. Pure, so the mapping can
// be tested without a server, and separate from the route so adding a table is
// not a change to HTTP code.

export type ExportTable = "visibility" | "voice" | "citations" | "gap" | "fanout" | "categories";

export function exportTables(built: ProjectInsights): Record<ExportTable, CsvTable> {
  const core = built.insights;
  return {
    visibility: {
      columns: ["model", "modelId", "answered", "recognized", "visibility"],
      rows: core.visibility.byModel.map((row) => [row.displayName, row.modelId, row.answered, row.recognized, row.score]),
    },
    voice: {
      columns: ["brand", "domain", "mentions", "share", "isTarget"],
      rows: [[core.shareOfVoice.target.name, core.shareOfVoice.target.domain, core.shareOfVoice.target.mentions, core.shareOfVoice.target.share, true] as unknown[]]
        .concat(core.shareOfVoice.competitors.map((row) => [row.name, row.domain, row.mentions, row.share, false])),
    },
    citations: {
      columns: ["domain", "answers", "isTarget", "models"],
      rows: core.citations.domains.map((row) => [row.domain, row.answers, row.isTarget, row.models]),
    },
    gap: {
      columns: ["domain", "answers", "competitors", "models"],
      rows: built.citationGap.map((row) => [row.domain, row.answers, row.competitors, row.models]),
    },
    fanout: {
      columns: ["query", "answers", "models"],
      rows: built.fanout.queries.map((row) => [row.query, row.answers, row.models]),
    },
    categories: {
      columns: ["category", "count"],
      rows: core.categories.map((row) => [row.value, row.count]),
    },
  };
}

export function exportNames(): string[] {
  return ["visibility", "voice", "citations", "gap", "fanout", "categories"];
}

/** Accepts "gap" or "gap.csv", since a browser asks for the latter. */
export function exportTable(built: ProjectInsights, name: string): string | null {
  const key = name.endsWith(".csv") ? name.slice(0, -4) : name;
  const tables = exportTables(built);
  const table = tables[key as ExportTable];
  return table ? toCsv(table) : null;
}
