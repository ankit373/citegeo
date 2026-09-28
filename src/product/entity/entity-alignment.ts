import type { SiteSignals } from "../actions/site-signals.js";

// Whether a model can resolve this brand to a stable entity, and what actually
// corroborates it. Signals read what the site publishes; this is the judgement
// on top, and it never counts a claim the brand makes about itself as evidence
// that the brand is who it says it is.

export type AnchorKind = "wikidata" | "independent_profile" | "structured_data" | "owned_profile";

export interface EntityAnchor {
  kind: AnchorKind;
  value: string;
  /** False when the brand controls it, which is most of them. */
  independent: boolean;
}

export interface EntityAlignment {
  domain: string;
  /** Anchors somebody other than the brand controls. Only these corroborate. */
  corroborated: number;
  anchors: EntityAnchor[];
  /** What is absent, said as an absence rather than counted as a zero. */
  missing: string[];
  /** Ways this entity can be resolved to the wrong thing. */
  risks: string[];
  checkedAt: string;
}

function host(url: string): string {
  const scheme = url.indexOf("://");
  const rest = scheme === -1 ? url : url.slice(scheme + 3);
  const slash = rest.indexOf("/");
  return (slash === -1 ? rest : rest.slice(0, slash)).toLocaleLowerCase();
}

/** A brand publishing a link to its own profile says nothing about whether it
 * is who it claims. Corroboration has to come from somewhere it cannot edit. */
export function anchorsFrom(signals: SiteSignals): EntityAnchor[] {
  const anchors: EntityAnchor[] = [];
  if (signals.wikidata.present && signals.wikidata.id) {
    anchors.push({ kind: "wikidata", value: signals.wikidata.id, independent: true });
  }
  if (signals.structuredData.organization) {
    anchors.push({ kind: "structured_data", value: signals.domain, independent: false });
  }
  const independent = new Set(signals.structuredData.independent.map((url) => url));
  for (const url of signals.structuredData.sameAs) {
    anchors.push({
      kind: independent.has(url) ? "independent_profile" : "owned_profile",
      value: host(url) || url,
      independent: independent.has(url),
    });
  }
  return anchors;
}

export function alignEntity(signals: SiteSignals): EntityAlignment {
  const anchors = anchorsFrom(signals);
  const missing: string[] = [];
  const risks: string[] = [];

  if (!signals.structuredData.organization) {
    missing.push("No Organization markup, so nothing on the site states in machine-readable form who publishes it.");
  }
  if (!signals.wikidata.present) {
    missing.push(`No Wikidata entity was found for "${signals.wikidata.searched}", which is the anchor a model is most likely to resolve against.`);
  }
  if (!signals.structuredData.sameAs.length) {
    missing.push("Organization markup names no sameAs, so nothing links this domain to the same brand anywhere else.");
  }

  const corroborated = anchors.filter((row) => row.independent).length;
  if (!corroborated) {
    // Every anchor pointing at something the brand controls is a circle.
    risks.push("Nothing corroborates this entity from outside the brand's own control, so a model has only the site's word for who it is.");
  }
  if (signals.structuredData.sameAs.length && !signals.structuredData.independent.length) {
    risks.push("Every sameAs points at a profile the brand publishes itself, which cannot confirm the entity.");
  }
  if (!signals.reachable) {
    risks.push("The site could not be read, so none of this is a current reading.");
  }

  return {
    domain: signals.domain,
    corroborated,
    anchors,
    missing,
    risks,
    checkedAt: signals.checkedAt,
  };
}
