import { canonicalUrl } from "./canonical-url.js";
import { COMMUNITY_HOSTS, isOn, REFERENCE_HOSTS, SOCIAL_HOSTS, VIDEO_HOSTS } from "./page-kind.js";

// Read off the cited address alone, so every stored citation gets a type without
// fetching anything. A URL that carries no signal is unknown, never an article.

export const PAGE_TYPES = [
  "docs", "comparison", "forum", "news", "vendor", "article", "video", "social", "reference", "unknown",
] as const;

export type PageType = typeof PAGE_TYPES[number];

/** Which kind of signal decided the type, so a reader can check it by hand. */
export type PageTypeRule =
  | "known-host"
  | "subdomain"
  | "path-word"
  | "company-site"
  | "headline-slug"
  | "no-signal"
  | "unreadable";

export interface PageTypeReading {
  type: PageType;
  rule: PageTypeRule;
  /** The host, word or segment that matched. Empty where nothing did. */
  evidence: string;
}

export interface PageTypeDefinition {
  type: PageType;
  label: string;
  decidedBy: string;
}

export const PAGE_TYPE_DEFINITIONS: PageTypeDefinition[] = [
  { type: "docs", label: "Documentation", decidedBy: "A docs, help, support or developer subdomain, or a whole path segment such as docs, help, kb or api." },
  { type: "comparison", label: "Comparison or review", decidedBy: "A path word such as vs, versus, compare, alternatives, best, top, review or reviews." },
  { type: "forum", label: "Forum or community", decidedBy: "A known community host, a forum or community subdomain, or a path segment such as forum, threads or questions." },
  { type: "news", label: "News or press", decidedBy: "A news or press subdomain, or a path segment such as news, press or newsroom." },
  { type: "vendor", label: "Vendor product page", decidedBy: "A path segment such as pricing, features or product, or any page on your site or a tracked rival's that matched nothing stronger." },
  { type: "article", label: "Blog or article", decidedBy: "A path segment such as blog, article, guide or resources, or a last segment of four or more words." },
  { type: "video", label: "Video", decidedBy: "A known video host, or a watch or video path segment." },
  { type: "social", label: "Social post", decidedBy: "A known social network host." },
  { type: "reference", label: "Reference work", decidedBy: "A known encyclopedia or glossary host." },
  { type: "unknown", label: "Unknown", decidedBy: "The address carried none of the signals above, or could not be read." },
];

const SUBDOMAINS: Array<[string, PageType]> = [
  ["docs", "docs"], ["doc", "docs"], ["help", "docs"], ["support", "docs"], ["developer", "docs"],
  ["developers", "docs"], ["api", "docs"], ["kb", "docs"],
  ["forum", "forum"], ["forums", "forum"], ["community", "forum"], ["discuss", "forum"], ["answers", "forum"],
  ["news", "news"], ["press", "news"], ["newsroom", "news"],
  ["blog", "article"], ["blogs", "article"],
];

// Matched against any word of the path, because a slug states what the page is for.
const PURPOSE_WORDS = ["vs", "versus", "compare", "comparison", "comparisons", "alternative", "alternatives", "best", "top", "review", "reviews"];

// Matched against a whole path segment only, so a headline that mentions help is
// not a help page. The leftmost one wins, since that is the site's own section.
const SECTIONS: Array<[PageType, string[]]> = [
  ["docs", ["docs", "doc", "documentation", "help", "help center", "helpcenter", "support", "kb", "knowledge base", "knowledgebase", "manual", "api", "reference", "faq", "faqs"]],
  ["forum", ["forum", "forums", "community", "thread", "threads", "discussion", "discussions", "questions", "t"]],
  ["news", ["news", "press", "newsroom", "press releases", "pressroom", "announcements"]],
  ["video", ["watch", "video", "videos", "webinar", "webinars", "shorts"]],
  ["vendor", ["pricing", "price", "plans", "features", "feature", "product", "products", "solutions", "platform", "integrations", "download", "signup", "demo"]],
  ["article", ["blog", "blogs", "article", "articles", "post", "posts", "guide", "guides", "resources", "insights", "learn", "stories", "story", "tutorial", "tutorials", "magazine"]],
];

const HOST_LISTS: Array<[PageType, string[]]> = [
  ["video", VIDEO_HOSTS], ["forum", COMMUNITY_HOSTS], ["social", SOCIAL_HOSTS], ["reference", REFERENCE_HOSTS],
];

/** Each path segment as its words, split on hyphens, underscores and dots. */
function segmentsOf(path: string): string[][] {
  return path.toLocaleLowerCase().split("/").filter(Boolean).map((segment) => {
    let decoded = segment;
    try { decoded = decodeURIComponent(segment); } catch { /* kept as it arrived */ }
    const words: string[] = [];
    for (const piece of decoded.split("-")) {
      for (const part of piece.split("_")) words.push(...part.split(".").filter(Boolean));
    }
    return words;
  });
}

function purposeWord(words: string[]): string {
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index] || "";
    if (!PURPOSE_WORDS.includes(word)) continue;
    // "Best practices" is advice, not a ranking.
    const next = words[index + 1] || "";
    if (word === "best" && (next === "practice" || next === "practices")) continue;
    return word;
  }
  return "";
}

function isCompanySite(host: string, companyDomains: string[]): string {
  for (const domain of companyDomains) {
    const target = domain.trim().toLocaleLowerCase();
    const bare = target.startsWith("www.") ? target.slice(4) : target;
    if (bare && (host === bare || host.endsWith("." + bare))) return bare;
  }
  return "";
}

/** companyDomains are your site and any tracked rival's, which is what makes a
 * bare product page a vendor page rather than unknown. */
export function classifyPageType(raw: string, context: { companyDomains?: string[] } = {}): PageTypeReading {
  const url = canonicalUrl(raw);
  if (!url) return { type: "unknown", rule: "unreadable", evidence: raw.trim() };
  const host = url.host;

  for (const [type, hosts] of HOST_LISTS) {
    if (isOn(host, hosts)) return { type, rule: "known-host", evidence: host };
  }

  const labels = host.split(".");
  const first = labels.length > 2 ? labels[0] || "" : "";
  const subdomain = SUBDOMAINS.find(([label]) => label === first);

  const segments = segmentsOf(url.path);
  const purpose = purposeWord(segments.flat());
  // A comparison is the page's purpose, so it outranks the section it sits in.
  if (purpose) return { type: "comparison", rule: "path-word", evidence: purpose };
  if (subdomain) return { type: subdomain[1], rule: "subdomain", evidence: first };
  for (const segment of segments) {
    const phrase = segment.join(" ");
    const section = SECTIONS.find(([, list]) => list.includes(phrase));
    if (section) return { type: section[0], rule: "path-word", evidence: phrase };
  }

  const company = isCompanySite(host, context.companyDomains || []);
  if (company) return { type: "vendor", rule: "company-site", evidence: company };

  const last = segments[segments.length - 1] || [];
  if (last.length >= 4) return { type: "article", rule: "headline-slug", evidence: last.join(" ") };

  return { type: "unknown", rule: "no-signal", evidence: "" };
}

export function pageTypeLabel(type: PageType): string {
  return PAGE_TYPE_DEFINITIONS.find((row) => row.type === type)?.label || type;
}
