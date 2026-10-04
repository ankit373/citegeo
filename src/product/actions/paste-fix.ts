import type { SiteSignals } from "./site-signals.js";

// A fix you can paste has to be right. Everything here is generated from
// something observed on the site, never from a guess at what the site is like,
// because a wrong snippet that looks authoritative is worse than no snippet.
//
// Asking for more than the site has outstanding does not produce more. It says
// how many there were and why, which is the difference between this and a
// product that ships a fixed number of suggestions a day whatever is true.

export const MAX_PER_DAY = 20;
export const DEFAULT_PER_DAY = 2;

/** Measured at a relative disadvantage for how much of an answer a page
 * accounts for, so it is offered with the figure rather than recommended. */
export const QA_FORMAT_PENALTY = "Published measurement puts question and answer formatting at a 5.74% relative disadvantage for how much of an answer a page accounts for. It is offered here with that figure rather than recommended, which is the opposite of what this fix is usually sold as.";

export type FixLanguage = "txt" | "html" | "json";

export interface PasteFix {
  id: string;
  title: string;
  /** What it changes, in measurement terms. */
  why: string;
  /** The observation it was generated from, so it can be disagreed with. */
  evidence: string;
  /** Where the snippet goes. */
  where: string;
  language: FixLanguage;
  snippet: string;
}

/** Something outstanding that cannot be generated correctly, so it is said
 * rather than pasted. Padding the list with these is how a wrong diff ships. */
export interface DescribedFix {
  id: string;
  title: string;
  why: string;
  evidence: string;
}

export interface PasteList {
  wanted: number;
  fixes: PasteFix[];
  described: DescribedFix[];
  /** Why there are fewer than asked for. Null when there are enough. */
  shortfall: string | null;
  caveat: string;
}

export const PASTE_CAVEAT = "Every snippet here is built from what this project observed on the site, so it can be checked against the evidence beside it. Anything that needs a value nobody has observed is described instead of generated, and asking for more a day does not invent any.";

export interface PasteInput {
  signals: SiteSignals;
  /** What the site says it is, read from its own pages. */
  profile?: { description: string | null; category: string | null; audience: string | null; features: string[] } | undefined;
  /** Pages the profile was read from, which is what llms.txt points at. */
  sources?: string[] | undefined;
  brandName: string;
  wanted?: number | undefined;
}

export function perDayFrom(value: unknown): number {
  const count = Number(value);
  if (!Number.isFinite(count)) return DEFAULT_PER_DAY;
  return Math.min(Math.max(Math.round(count), 1), MAX_PER_DAY);
}

/** Matched on the entity rather than the address, because a site writing it
 * without the www would be told to add what it already has. */
function listsEntity(sameAs: string[], id: string | null): boolean {
  if (!id) return false;
  return sameAs.some((entry) => entry.includes("wikidata.org") && entry.includes(id));
}

function jsonLd(value: Record<string, unknown>): string {
  return `<script type="application/ld+json">\n${JSON.stringify(value, null, 2)}\n</script>`;
}

function robotsSnippet(blocked: string[]): string {
  const lines: string[] = [];
  for (const agent of blocked) lines.push(`User-agent: ${agent}`, "Allow: /", "");
  return lines.join("\n").trim();
}

function llmsSnippet(input: PasteInput): string | null {
  const description = input.profile?.description;
  if (!description) return null;
  const lines = [`# ${input.brandName}`, "", `> ${description}`, ""];
  if (input.profile?.audience) lines.push(`Who it is for: ${input.profile.audience}`, "");
  // A blank feature reads as an empty bullet in a file somebody publishes.
  const features = (input.profile?.features || []).map((feature) => feature.trim()).filter(Boolean);
  if (features.length) {
    lines.push("## What it does", "");
    for (const feature of features.slice(0, 8)) lines.push(`- ${feature}`);
    lines.push("");
  }
  const pages = (input.sources || []).map((page) => page.trim()).filter(Boolean).slice(0, 12);
  if (pages.length) {
    lines.push("## Pages", "");
    for (const page of pages) lines.push(`- [${page}](${page})`);
    lines.push("");
  }
  return lines.join("\n").trim();
}

function organizationSnippet(input: PasteInput, sameAs: string[]): string {
  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: input.brandName,
    url: `https://${input.signals.domain}/`,
  };
  if (input.profile?.description) node.description = input.profile.description;
  if (sameAs.length) node.sameAs = sameAs;
  return jsonLd(node);
}

export function readyToPaste(input: PasteInput): PasteList {
  const wanted = perDayFrom(input.wanted ?? DEFAULT_PER_DAY);
  const fixes: PasteFix[] = [];
  const described: DescribedFix[] = [];
  const { signals } = input;

  if (!signals.reachable) {
    return {
      wanted,
      fixes: [],
      described: [{
        id: "site-unreachable",
        title: "The site did not answer",
        why: "Nothing can be generated from a site nobody can read, including by a crawler.",
        evidence: `https://${signals.domain}/ did not return a successful response at ${signals.checkedAt}.`,
      }],
      shortfall: "Nothing could be generated, because the site did not answer when it was last checked.",
      caveat: PASTE_CAVEAT,
    };
  }

  if (signals.robots.blocked.length) {
    fixes.push({
      id: "allow-crawlers",
      title: `Allow ${signals.robots.blocked.length} AI crawler(s) in robots.txt`,
      why: "The measured cost of blocking is referred traffic rather than citation, so expect a traffic change and judge it on traffic.",
      evidence: `robots.txt disallows ${signals.robots.blocked.join(", ")}.`,
      where: `https://${signals.domain}/robots.txt`,
      language: "txt",
      snippet: robotsSnippet(signals.robots.blocked),
    });
  }

  const wikidata = signals.wikidata.present && signals.wikidata.id
    ? `https://www.wikidata.org/wiki/${signals.wikidata.id}`
    : null;

  if (!signals.llmsTxt.present) {
    const snippet = llmsSnippet(input);
    if (snippet) {
      fixes.push({
        id: "publish-llms-txt",
        title: "Publish llms.txt",
        why: "It states the site's own structure for an answer engine instead of leaving it to infer one from crawling.",
        evidence: `https://${signals.domain}/llms.txt did not return a document. This is built from what the site says about itself on the pages already read.`,
        where: `https://${signals.domain}/llms.txt`,
        language: "txt",
        snippet,
      });
    } else {
      described.push({
        id: "publish-llms-txt",
        title: "Publish llms.txt",
        why: "It states the site's own structure for an answer engine instead of leaving it to infer one from crawling.",
        evidence: "No description has been read from the site yet, so writing one here would be inventing what the company does.",
      });
    }
  }

  if (!signals.structuredData.organization) {
    fixes.push({
      id: "organization-schema",
      title: "Add Organization schema to the homepage",
      why: "It is the machine readable statement of who the brand is. Without it an engine infers the entity from prose.",
      evidence: "No Organization, Corporation or LocalBusiness node was found in the homepage JSON-LD."
        + (wikidata ? ` The sameAs entry is the Wikidata entity this domain already resolves to.` : ""),
      where: "The <head> of the homepage",
      language: "html",
      snippet: organizationSnippet(input, wikidata ? [wikidata] : []),
    });
  } else if (wikidata && !listsEntity(signals.structuredData.sameAs, signals.wikidata.id)) {
    fixes.push({
      id: "sameas-wikidata",
      title: "Point sameAs at the Wikidata entity",
      why: "sameAs is how the markup offers something outside the brand's control to check it against, and this is a record that already exists.",
      evidence: `Wikidata entity ${signals.wikidata.id} resolves for this brand and the existing sameAs does not list it.`,
      where: "The Organization node already on the homepage",
      language: "json",
      snippet: JSON.stringify({ sameAs: [...signals.structuredData.sameAs, wikidata] }, null, 2),
    });
  } else if (!signals.structuredData.independent.length) {
    described.push({
      id: "sameas-all-owned",
      title: "Add a sameAs link to a record you do not control",
      why: "Self published profiles restate the claim rather than corroborate it. Engines resolve an entity from records outside the brand's control.",
      evidence: `sameAs lists ${signals.structuredData.sameAs.length} link(s), all on owned or social properties. Nobody has observed an independent record for this brand, so one cannot be written here.`,
    });
  }

  if (!signals.wikidata.present) {
    described.push({
      id: "wikidata-missing",
      title: "Create a Wikidata item once the brand meets notability",
      why: "Wikidata is the entity backbone several engines reconcile names against, so absence makes the brand a string rather than a thing.",
      evidence: `A Wikidata entity search for "${signals.wikidata.searched}" returned no match. The item has to be created there by a person, with independent sources.`,
    });
  }

  // Offered last and never counted toward the day, because the published
  // measurement for it is negative and this product does not ship that blind.
  described.push({
    id: "qa-format",
    title: "Question and answer formatting, with the figure against it",
    why: QA_FORMAT_PENALTY,
    evidence: "Reported across a study of citation absorption on AI search platforms, comparing pages in the top and bottom quartile of how much of an answer they account for.",
  });

  const shortfall = fixes.length >= wanted
    ? null
    : `${fixes.length} of the ${wanted} asked for. Everything else outstanding needs a value nobody has observed, so it is described below rather than generated.`;

  return { wanted, fixes: fixes.slice(0, wanted), described, shortfall, caveat: PASTE_CAVEAT };
}
