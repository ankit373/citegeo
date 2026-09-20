import { load } from "cheerio";

// Reads enough of a site to say what the company does. Not a crawler: a
// handful of pages a human would open to answer that same question.

export interface SitePage {
  url: string;
  title: string;
  description: string;
  headings: string[];
  text: string;
}

export interface SiteRead {
  domain: string;
  reachable: boolean;
  pages: SitePage[];
  /** Why nothing could be read, when nothing could. */
  detail: string | null;
}

/** Pages that answer "what is this" before any others on a product site. */
const LIKELY_PATHS = ["", "/about", "/product", "/features", "/pricing", "/how-it-works"];

function normalizeDomain(value: string): string {
  const trimmed = value.trim().toLocaleLowerCase();
  const withScheme = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme).hostname;
  } catch {
    return trimmed;
  }
}

/** Collapses runs of whitespace without a regex, which this codebase bans. */
function squash(value: string): string {
  const out: string[] = [];
  let space = false;
  for (const character of value) {
    const blank = character === " " || character === "\n" || character === "\t" || character === "\r";
    if (blank) { space = true; continue; }
    if (space && out.length) out.push(" ");
    space = false;
    out.push(character);
  }
  return out.join("").trim();
}

function readPage(url: string, html: string): SitePage {
  const document = load(html);
  const meta = (name: string) =>
    squash(document(`meta[name="${name}"]`).attr("content") || document(`meta[property="${name}"]`).attr("content") || "");
  // Scripts and styles are not prose, and they dominate a naive text read.
  document("script,style,noscript,svg").remove();
  const headings: string[] = [];
  document("h1,h2,h3").each((_, node) => {
    const text = squash(document(node).text());
    if (text && headings.length < 30) headings.push(text);
  });
  return {
    url,
    title: squash(document("title").first().text()) || meta("og:title"),
    description: meta("description") || meta("og:description"),
    headings,
    text: squash(document("body").text()).slice(0, 4000),
  };
}

async function fetchHtml(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "citegeo-site-read", accept: "text/html" },
    });
    if (!response.ok) return null;
    const type = response.headers.get("content-type") || "";
    if (!type.includes("html")) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function readSite(domain: string, options: { timeoutMs?: number; maxPages?: number } = {}): Promise<SiteRead> {
  const host = normalizeDomain(domain);
  const timeoutMs = options.timeoutMs || 15000;
  const maxPages = options.maxPages || 4;
  const pages: SitePage[] = [];

  for (const path of LIKELY_PATHS) {
    if (pages.length >= maxPages) break;
    const html = await fetchHtml(`https://${host}${path}`, timeoutMs);
    if (!html) continue;
    const page = readPage(`https://${host}${path}`, html);
    // A page with nothing to read adds noise to the profile, not signal.
    if (page.text.length < 200 && !page.description) continue;
    pages.push(page);
  }

  return {
    domain: host,
    reachable: pages.length > 0,
    pages,
    detail: pages.length ? null : `Nothing readable was served from https://${host}. It may be down, or behind a login or a bot check.`,
  };
}

/** The site as one block a model can read, capped so a long site cannot
 * crowd out the instructions around it. */
export function siteDigest(read: SiteRead, limit = 9000): string {
  const parts: string[] = [];
  for (const page of read.pages) {
    parts.push(`URL: ${page.url}`);
    if (page.title) parts.push(`Title: ${page.title}`);
    if (page.description) parts.push(`Description: ${page.description}`);
    if (page.headings.length) parts.push(`Headings: ${page.headings.join(" | ")}`);
    if (page.text) parts.push(`Text: ${page.text}`);
    parts.push("");
  }
  return parts.join("\n").slice(0, limit);
}
