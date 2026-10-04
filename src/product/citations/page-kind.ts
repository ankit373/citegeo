import type { SourcePage } from "./source-page.js";

// A page is cited for what it is as much as for what it says. Across a study of
// 100k responses the ranked best-of listicle was the most cited format at about
// a fifth of all citations, and roughly four citations in five went to a site
// belonging to a company in the category rather than to a publisher.
//
// Separately, every 2026 study of where a brand's own citations come from puts
// the brand's own domain at a twentieth to a tenth of them. Those are different
// questions and the panel reports both rather than one standing for the other.

export type PageFormat = "listicle" | "comparison" | "guide" | "documentation" | "review" | "forum" | "video" | "reference" | "article";

export type SourceKind = "yours" | "rival" | "social" | "community" | "video" | "reference" | "independent";

/** Published share of citations the ranked best-of listicle took, which is the
 * most cited format there. Carried so a project can see its own against it. */
export const LISTICLE_BASELINE = 0.21;

/** Published share of citations going to a company's own site rather than to
 * a publisher. Counted across every company in the category, not just yours. */
export const CORPORATE_BASELINE = 0.78;

/** Published share of a brand's citations that sit on the brand's own domain.
 * A band rather than a figure, because the studies disagree inside it. */
export const OWNED_BASELINE_LOW = 0.05;
export const OWNED_BASELINE_HIGH = 0.1;

export const KIND_CAVEAT = "Read off the pages these answers cited, from the address, the title and the shape of the markup. A page can be a comparison and a listicle at once and only its strongest signal is kept, so the split is a reading rather than a census. A site counts as a company's only where an answer named a brand at that domain, so a company nobody named reads as a publisher here. The baselines come from published studies, on their prompts and their engines.";

const VIDEO_HOSTS = ["youtube.com", "youtu.be", "vimeo.com", "dailymotion.com"];
const COMMUNITY_HOSTS = ["reddit.com", "quora.com", "stackexchange.com", "stackoverflow.com", "ycombinator.com", "discourse.org"];
const SOCIAL_HOSTS = ["linkedin.com", "twitter.com", "x.com", "facebook.com", "instagram.com", "tiktok.com", "threads.net", "pinterest.com"];
const REFERENCE_HOSTS = ["wikipedia.org", "wikidata.org", "britannica.com", "investopedia.com"];

function isOn(host: string, hosts: string[]): boolean {
  const lower = host.trim().toLocaleLowerCase();
  return hosts.some((known) => lower === known || lower.endsWith("." + known));
}

function under(host: string, domain: string): boolean {
  const lower = host.trim().toLocaleLowerCase();
  const target = domain.trim().toLocaleLowerCase();
  return Boolean(target) && (lower === target || lower.endsWith("." + target));
}

function words(value: string): string {
  return " " + value.trim().toLocaleLowerCase().split("/").join(" ").split("-").join(" ").split("_").join(" ") + " ";
}

function startsWithNumber(title: string): boolean {
  const first = title.trim().split(" ")[0] || "";
  return first.length > 0 && first.length <= 3 && Number.isFinite(Number(first));
}

/** Strongest signal wins, because a page is often two of these at once and a
 * census of overlapping labels adds to more than the citations there were. */
export function formatOf(page: { url: string; host: string; title: string | null; shape?: { headings: number; listItems: number; tables: number; paragraphs: number } | undefined; words: number }): PageFormat {
  const host = page.host.toLocaleLowerCase();
  if (isOn(host, VIDEO_HOSTS)) return "video";
  if (isOn(host, COMMUNITY_HOSTS)) return "forum";
  if (isOn(host, REFERENCE_HOSTS)) return "reference";
  const text = words((page.title || "") + " " + page.url);
  if (text.includes(" vs ") || text.includes(" versus ") || text.includes(" compared ") || text.includes(" comparison ")) return "comparison";
  const listy = Boolean(page.shape) && page.words > 0 && (page.shape as { listItems: number }).listItems / page.words > 0.01;
  const ranked = text.includes(" best ") || text.includes(" top ") || text.includes(" alternatives ") || startsWithNumber(page.title || "");
  if (ranked && (listy || startsWithNumber(page.title || ""))) return "listicle";
  if (text.includes(" review ") || text.includes(" reviews ")) return "review";
  if (host.startsWith("docs.") || text.includes(" docs ") || text.includes(" documentation ") || text.includes(" reference ")) return "documentation";
  if (text.includes(" how to ") || text.includes(" guide ") || text.includes(" tutorial ")) return "guide";
  if (ranked) return "listicle";
  return "article";
}

export function sourceOf(page: { host: string; namesYou?: boolean }, scope: { domain?: string | undefined; rivalDomains?: string[] | undefined }): SourceKind {
  const host = page.host.toLocaleLowerCase();
  if (scope.domain && under(host, scope.domain)) return "yours";
  if ((scope.rivalDomains || []).some((domain) => under(host, domain))) return "rival";
  if (isOn(host, SOCIAL_HOSTS)) return "social";
  if (isOn(host, COMMUNITY_HOSTS)) return "community";
  if (isOn(host, VIDEO_HOSTS)) return "video";
  if (isOn(host, REFERENCE_HOSTS)) return "reference";
  // Not your site, not a site an answer named a brand for, and not one of the
  // kinds above. A publisher writing about the category, as far as this knows.
  return "independent";
}

export interface KindShare<T extends string> {
  kind: T;
  pages: number;
  share: number;
}

export interface PageKindReport {
  /** Cited pages read back, which is what every share is taken over. */
  pages: number;
  formats: Array<KindShare<PageFormat>>;
  sources: Array<KindShare<SourceKind>>;
  /** This project's listicle share against the published one. Null with
   * nothing read back. */
  listicleShare: number | null;
  listicleBaseline: number;
  /** Pages on a site belonging to a company in this category, yours included.
   * A publisher writing about the category is not one. */
  corporateShare: number | null;
  corporateBaseline: number;
  /** Pages on your own domain, which published work puts at a twentieth to a
   * tenth, so being absent here is usual rather than a finding. */
  ownedShare: number | null;
  ownedBaselineLow: number;
  ownedBaselineHigh: number;
  caveat: string;
}

function tally<T extends string>(values: T[]): Array<KindShare<T>> {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  const total = values.length;
  return [...counts.entries()]
    .map(([kind, pages]) => ({ kind, pages, share: total ? pages / total : 0 }))
    .sort((left, right) => right.pages - left.pages || left.kind.localeCompare(right.kind));
}

export function buildPageKinds(input: {
  pages: SourcePage[];
  domain?: string | undefined;
  rivalDomains?: string[] | undefined;
}): PageKindReport {
  // A page that would not load says nothing about what kind of page gets
  // cited, so it is left out rather than counted as an article.
  const readable = input.pages.filter((page) => !page.detail && page.title !== null);
  const formats = readable.map((page) => formatOf(page));
  const sources = readable.map((page) => sourceOf(page, { domain: input.domain, rivalDomains: input.rivalDomains }));
  const total = readable.length;
  const corporate = sources.filter((kind) => kind === "yours" || kind === "rival").length;
  const owned = sources.filter((kind) => kind === "yours").length;
  return {
    pages: total,
    formats: tally(formats),
    sources: tally(sources),
    listicleShare: total ? formats.filter((kind) => kind === "listicle").length / total : null,
    listicleBaseline: LISTICLE_BASELINE,
    corporateShare: total ? corporate / total : null,
    corporateBaseline: CORPORATE_BASELINE,
    ownedShare: total ? owned / total : null,
    ownedBaselineLow: OWNED_BASELINE_LOW,
    ownedBaselineHigh: OWNED_BASELINE_HIGH,
    caveat: KIND_CAVEAT,
  };
}
