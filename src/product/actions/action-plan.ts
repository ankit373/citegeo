import type { SiteSignals } from "./site-signals.js";

// Every action is derived from something observed, never from a model's opinion
// about what the brand should do. The evidence field carries the observation so
// a reader can disagree with the conclusion and still check the fact.

export type ActionSeverity = "critical" | "high" | "medium" | "done";

export interface GeoAction {
  id: string;
  severity: ActionSeverity;
  title: string;
  /** Why this decides whether a model can cite the brand at all. */
  why: string;
  fix: string;
  evidence: string;
}

export interface RecognitionSummary {
  /** Models that answered and were parsed. */
  answered: number;
  recognized: number;
  /** Competitor names the models returned instead. */
  competitors: string[];
}

const SEVERITY_ORDER: Record<ActionSeverity, number> = { critical: 0, high: 1, medium: 2, done: 3 };

/** Travels with the finding, because the obvious reading of a blocked crawler
 * is the wrong one and this product used to state it. */
export const CRAWLER_ACCESS_CAVEAT = "Blocking these agents is not what stops an engine citing a domain. Across a study of four million citations, most sites disallowing each of these agents were cited anyway, and the measured cost of blocking was referred visits. That sample was large publishers with deep coverage elsewhere, so a brand nobody else writes about may not fare the same.";

function list(values: string[], limit: number): string {
  const head = values.slice(0, limit).join(", ");
  return values.length > limit ? `${head} and ${values.length - limit} more` : head;
}

export function buildActionPlan(input: {
  signals: SiteSignals;
  recognition?: RecognitionSummary | undefined;
}): GeoAction[] {
  const { signals } = input;
  const actions: GeoAction[] = [];

  if (!signals.reachable) {
    return [{
      id: "site-unreachable",
      severity: "critical",
      title: "The site did not answer",
      why: "Nothing else can be assessed, and no crawler can read a page it cannot fetch.",
      fix: "Check DNS, TLS and that the origin serves a 200 for the homepage.",
      evidence: `https://${signals.domain}/ did not return a successful response at ${signals.checkedAt}.`,
    }];
  }

  // Blocking costs referred visits. It does not stop citation: measured across
  // millions of citations, most sites disallowing these agents were cited anyway.
  if (signals.robots.blocked.length) {
    actions.push({
      id: "crawlers-blocked",
      severity: "high",
      title: `${signals.robots.blocked.length} AI crawler(s) are disallowed in robots.txt`,
      why: "The measured cost of blocking is referred traffic, not citation. Engines cite blocked domains routinely, from a search result or from what they already hold, so this is worth fixing without expecting citations to follow from it.",
      fix: `Allow ${list(signals.robots.blocked, 4)} in robots.txt to recover the visits an answer sends. Expect a traffic change, and judge it on traffic.`,
      evidence: `robots.txt disallows: ${list(signals.robots.blocked, 8)}. ${CRAWLER_ACCESS_CAVEAT}`,
    });
  } else {
    actions.push({
      id: "crawlers-allowed",
      severity: "done",
      title: "AI crawlers can read the site",
      why: "Access is what carries a reader from an answer back to the site. It is not what decides whether the answer names you.",
      fix: "Nothing to do. Re-check after any robots.txt change.",
      evidence: `${signals.robots.allowed.length} of ${signals.robots.allowed.length + signals.robots.blocked.length} tracked crawlers are allowed.`,
    });
  }

  if (!signals.llmsTxt.present) {
    actions.push({
      id: "llms-txt-missing",
      severity: "medium",
      title: "No llms.txt",
      why: "It gives an engine a curated map of the site instead of leaving it to infer structure from crawling.",
      fix: "Publish /llms.txt listing the pages that describe what the product is, who it is for and what it covers.",
      evidence: `https://${signals.domain}/llms.txt did not return a document.`,
    });
  } else {
    actions.push({
      id: "llms-txt-present",
      severity: "done",
      title: "llms.txt is published",
      why: "The site already states its own structure for answer engines.",
      fix: "Keep it current when sections or pricing change.",
      evidence: `/llms.txt returned ${signals.llmsTxt.bytes.toLocaleString()} bytes.`,
    });
  }

  if (!signals.structuredData.organization) {
    actions.push({
      id: "organization-schema-missing",
      severity: "high",
      title: "No Organization schema on the homepage",
      why: "It is the machine-readable statement of who the brand is. Without it an engine has to guess the entity from prose.",
      fix: "Add JSON-LD Organization markup with name, url, logo, description and sameAs.",
      evidence: "No Organization, Corporation or LocalBusiness node found in the homepage JSON-LD.",
    });
  } else if (!signals.structuredData.sameAs.length) {
    actions.push({
      id: "sameas-missing",
      severity: "high",
      title: "Organization schema lists no sameAs links",
      why: "sameAs is how the markup points an engine at other records of the same entity. With none, the schema asserts the brand exists but offers nothing to check it against.",
      fix: "Add sameAs entries, starting with any independent record: Wikidata, Crunchbase, a registry or regulator listing, a review platform.",
      evidence: "Organization markup is present but carries no sameAs property.",
    });
  } else if (!signals.structuredData.independent.length) {
    actions.push({
      id: "sameas-all-owned",
      severity: "high",
      title: "Every sameAs link points at a profile the brand controls",
      why: "Self-published profiles restate the claim rather than corroborate it. Engines resolve an entity from sources outside the brand's control.",
      fix: "Add sameAs entries for independent records: Wikidata, Crunchbase, a regulator or registry listing, an industry directory, a review platform.",
      evidence: `sameAs lists ${signals.structuredData.sameAs.length} link(s), all on owned or social properties: ${list(signals.structuredData.sameAs, 4)}.`,
    });
  } else {
    actions.push({
      id: "sameas-independent",
      severity: "done",
      title: "Organization schema cites independent records",
      why: "Third-party records are what an engine uses to confirm an entity exists.",
      fix: "Keep adding independent records as they appear.",
      evidence: `${signals.structuredData.independent.length} independent sameAs link(s): ${list(signals.structuredData.independent, 4)}.`,
    });
  }

  if (!signals.wikidata.present) {
    actions.push({
      id: "wikidata-missing",
      severity: "high",
      title: "No Wikidata entity",
      why: "Wikidata is the entity backbone several engines reconcile names against. Absence makes the brand a string rather than a thing.",
      fix: "Create a Wikidata item once the brand meets notability: cite independent coverage, funding records or regulator filings, then link it from sameAs.",
      evidence: `A Wikidata entity search for "${signals.wikidata.searched}" returned no match.`,
    });
  } else {
    actions.push({
      id: "wikidata-present",
      severity: "done",
      title: "The brand resolves to a Wikidata entity",
      why: "Engines can reconcile the name to a stable identifier.",
      fix: "Keep the item accurate and linked from sameAs.",
      evidence: `Wikidata entity ${signals.wikidata.id}.`,
    });
  }

  const recognition = input.recognition;
  if (recognition && recognition.answered > 0) {
    if (recognition.recognized === 0) {
      actions.push({
        id: "no-model-recognition",
        severity: "critical",
        title: `No model recognised this domain (0 of ${recognition.answered})`,
        why: "The brand is absent from what the models learned. Technical fixes alone do not change this; only being written about elsewhere does.",
        fix: recognition.competitors.length
          ? `Match the corroboration the named alternatives already have. Start where they are listed and you are not: ${list(recognition.competitors, 5)}.`
          : "Get the brand into independent listings, comparisons and reviews for its category.",
        evidence: `${recognition.answered} model(s) answered, none returned a recognised brand for ${signals.domain}.`,
      });
    } else if (recognition.recognized < recognition.answered) {
      actions.push({
        id: "partial-model-recognition",
        severity: "high",
        title: `Only ${recognition.recognized} of ${recognition.answered} models recognised the domain`,
        why: "Recognition is uneven across engines, so visibility depends on which one a buyer asks.",
        fix: "Compare the answers that did and did not recognise it, and target the sources the failing engines rely on.",
        evidence: `${recognition.recognized} of ${recognition.answered} answers named the brand.`,
      });
    }
  } else {
    actions.push({
      id: "no-recognition-evidence",
      severity: "medium",
      title: "No recognition run to judge against",
      why: "The site checks above say whether a model can read the brand, not whether one knows it.",
      fix: "Run a recognition test so this plan can use real answers instead of site signals alone.",
      evidence: "No parsed model answers were supplied for this plan.",
    });
  }

  return actions.sort((left, right) => SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity]);
}
