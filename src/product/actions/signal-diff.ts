import type { SiteSignals } from "./site-signals.js";

// A snapshot says what is true now. Two snapshots say what changed, which is
// the part worth alerting on: a crawler that was allowed and is not any more,
// an llms.txt that disappeared, a sameAs list that lost its only independent
// record. Nothing here infers a cause, only that a value moved.

export type SignalDirection = "improved" | "regressed" | "changed";

export interface SignalChange {
  field: string;
  direction: SignalDirection;
  before: string;
  after: string;
  detail: string;
}

function listDiff(before: string[], after: string[]): { added: string[]; removed: string[] } {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  return {
    added: after.filter((value) => !beforeSet.has(value)).sort(),
    removed: before.filter((value) => !afterSet.has(value)).sort(),
  };
}

export function diffSignals(before: SiteSignals, after: SiteSignals): SignalChange[] {
  const changes: SignalChange[] = [];

  if (before.reachable !== after.reachable) {
    changes.push({
      field: "reachable",
      direction: after.reachable ? "improved" : "regressed",
      before: String(before.reachable),
      after: String(after.reachable),
      detail: after.reachable ? "The site answers again." : "The site stopped answering, so nothing below can be trusted.",
    });
    // Everything else is derived from a fetch that failed, so stop here rather
    // than reporting a site going down as every signal regressing at once.
    if (!after.reachable) return changes;
  }

  const crawlers = listDiff(before.robots.blocked, after.robots.blocked);
  if (crawlers.added.length) {
    changes.push({
      field: "robots.blocked",
      direction: "regressed",
      before: before.robots.blocked.join(", ") || "none",
      after: after.robots.blocked.join(", ") || "none",
      detail: `Now disallowed: ${crawlers.added.join(", ")}. Those engines can no longer cite this domain.`,
    });
  }
  if (crawlers.removed.length) {
    changes.push({
      field: "robots.allowed",
      direction: "improved",
      before: before.robots.blocked.join(", ") || "none",
      after: after.robots.blocked.join(", ") || "none",
      detail: `No longer disallowed: ${crawlers.removed.join(", ")}.`,
    });
  }

  if (before.llmsTxt.present !== after.llmsTxt.present) {
    changes.push({
      field: "llmsTxt",
      direction: after.llmsTxt.present ? "improved" : "regressed",
      before: before.llmsTxt.present ? "published" : "absent",
      after: after.llmsTxt.present ? "published" : "absent",
      detail: after.llmsTxt.present ? "llms.txt is published." : "llms.txt stopped resolving.",
    });
  }

  if (before.structuredData.organization !== after.structuredData.organization) {
    changes.push({
      field: "structuredData.organization",
      direction: after.structuredData.organization ? "improved" : "regressed",
      before: String(before.structuredData.organization),
      after: String(after.structuredData.organization),
      detail: after.structuredData.organization
        ? "Organization markup appeared on the homepage."
        : "Organization markup disappeared from the homepage.",
    });
  }

  const independent = listDiff(before.structuredData.independent, after.structuredData.independent);
  if (independent.added.length || independent.removed.length) {
    changes.push({
      field: "structuredData.independent",
      // Losing every independent record is the regression that matters, since
      // owned profiles corroborate nothing on their own.
      direction: after.structuredData.independent.length >= before.structuredData.independent.length ? "improved" : "regressed",
      before: String(before.structuredData.independent.length),
      after: String(after.structuredData.independent.length),
      detail: [
        independent.added.length ? `Added: ${independent.added.join(", ")}.` : "",
        independent.removed.length ? `Removed: ${independent.removed.join(", ")}.` : "",
      ].filter(Boolean).join(" "),
    });
  }

  if (before.wikidata.present !== after.wikidata.present) {
    changes.push({
      field: "wikidata",
      direction: after.wikidata.present ? "improved" : "regressed",
      before: before.wikidata.id || "absent",
      after: after.wikidata.id || "absent",
      detail: after.wikidata.present
        ? `The brand now resolves to ${after.wikidata.id}.`
        : "The brand no longer resolves to a Wikidata entity.",
    });
  }

  return changes;
}
