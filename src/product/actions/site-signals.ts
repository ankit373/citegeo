// What a model can actually reach and resolve about a domain. Everything here
// is observed from the live site or a free public API, never inferred, so an
// action derived from it can always name the evidence behind it.

/** Crawlers that feed the answer engines this product measures. */
export const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "meta-externalagent",
  "CCBot",
] as const;

export interface RobotsSignal {
  present: boolean;
  blocked: string[];
  allowed: string[];
}

export interface StructuredDataSignal {
  organization: boolean;
  sameAs: string[];
  /** sameAs entries pointing somewhere the brand does not control. */
  independent: string[];
}

export interface SiteSignals {
  domain: string;
  checkedAt: string;
  reachable: boolean;
  robots: RobotsSignal;
  llmsTxt: { present: boolean; bytes: number };
  structuredData: StructuredDataSignal;
  wikidata: { present: boolean; id: string | null; searched: string };
}

/** Profiles a brand publishes itself, so they corroborate nothing on their own. */
const OWNED_PROFILE_HOSTS = [
  "linkedin.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "instagram.com",
  "youtube.com",
  "tiktok.com",
  "pinterest.com",
  "threads.net",
  "medium.com",
  "substack.com",
];

function lower(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function splitLines(text: string): string[] {
  return text.split("\n").join("\r").split("\r");
}

function hostOf(url: string): string {
  try {
    return lower(new URL(url).hostname);
  } catch {
    return "";
  }
}

function isOwnedProfile(url: string, domain: string): boolean {
  const host = hostOf(url);
  if (!host) return true;
  if (host === lower(domain) || host.endsWith(`.${lower(domain)}`)) return true;
  return OWNED_PROFILE_HOSTS.some((owned) => host === owned || host.endsWith(`.${owned}`));
}

// robots.txt groups directives under the user-agent lines that precede them, and
// a blank line ends a group. Parsed by hand because this codebase bans regexes.
export function parseRobots(text: string): RobotsSignal {
  const rules = new Map<string, string[]>();
  let agents: string[] = [];
  let collecting = false;
  for (const raw of splitLines(text)) {
    const withoutComment = raw.split("#")[0] || "";
    const line = withoutComment.trim();
    if (!line) {
      agents = [];
      collecting = false;
      continue;
    }
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const field = lower(line.slice(0, separator));
    const value = line.slice(separator + 1).trim();
    if (field === "user-agent") {
      if (collecting) agents = [];
      agents.push(lower(value));
      collecting = false;
      continue;
    }
    if (field !== "disallow" && field !== "allow") continue;
    collecting = true;
    for (const agent of agents) {
      const existing = rules.get(agent) || [];
      existing.push(`${field} ${value}`);
      rules.set(agent, existing);
    }
  }

  const blockedFor = (agent: string): boolean => {
    const directives = rules.get(lower(agent)) || rules.get("*") || [];
    // A bare "Disallow: /" with no narrower Allow shuts the crawler out entirely.
    return directives.includes("disallow /") && !directives.includes("allow /");
  };

  const blocked: string[] = [];
  const allowed: string[] = [];
  for (const crawler of AI_CRAWLERS) (blockedFor(crawler) ? blocked : allowed).push(crawler);
  return { present: true, blocked, allowed };
}

export function parseStructuredData(html: string, domain: string): StructuredDataSignal {
  const marker = "application/ld+json";
  const sameAs: string[] = [];
  let organization = false;
  let cursor = 0;
  for (;;) {
    const found = html.indexOf(marker, cursor);
    if (found === -1) break;
    const open = html.indexOf(">", found);
    const close = html.indexOf("</script>", open);
    if (open === -1 || close === -1) break;
    let payload: unknown;
    try {
      payload = JSON.parse(html.slice(open + 1, close));
    } catch {
      cursor = close + 1;
      continue;
    }
    const root = payload as Record<string, unknown>;
    const graph = Array.isArray(payload) ? payload : (root?.["@graph"] as unknown[]) || [payload];
    for (const value of graph) {
      const node = value as Record<string, unknown> | null;
      if (!node || typeof node !== "object") continue;
      const type = node["@type"];
      const types = Array.isArray(type) ? type : [type];
      if (types.some((item) => item === "Organization" || item === "Corporation" || item === "LocalBusiness")) {
        organization = true;
      }
      const links = node.sameAs;
      if (Array.isArray(links)) {
        for (const link of links) if (typeof link === "string") sameAs.push(link);
      } else if (typeof links === "string") {
        sameAs.push(links);
      }
    }
    cursor = close + 1;
  }
  const unique = [...new Set(sameAs)];
  return {
    organization,
    sameAs: unique,
    independent: unique.filter((url) => !isOwnedProfile(url, domain)),
  };
}

async function text(url: string, timeoutMs: number): Promise<{ ok: boolean; body: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "follow" });
    if (!response.ok) return { ok: false, body: "" };
    return { ok: true, body: await response.text() };
  } catch {
    return { ok: false, body: "" };
  } finally {
    clearTimeout(timer);
  }
}

async function wikidataEntity(brand: string, timeoutMs: number): Promise<{ present: boolean; id: string | null; searched: string }> {
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&limit=5&search=${encodeURIComponent(brand)}`;
  const result = await text(url, timeoutMs);
  if (!result.ok) return { present: false, id: null, searched: brand };
  try {
    const payload = JSON.parse(result.body) as { search?: Array<{ id?: string }> };
    const first = payload.search?.[0];
    return first?.id ? { present: true, id: first.id, searched: brand } : { present: false, id: null, searched: brand };
  } catch {
    return { present: false, id: null, searched: brand };
  }
}

export interface SiteSignalOptions {
  timeoutMs?: number;
  brandName?: string | undefined;
}

export async function readSiteSignals(domain: string, options: SiteSignalOptions = {}): Promise<SiteSignals> {
  const timeoutMs = options.timeoutMs ?? 15000;
  const origin = `https://${domain}`;
  const [home, robots, llms, wikidata] = await Promise.all([
    text(`${origin}/`, timeoutMs),
    text(`${origin}/robots.txt`, timeoutMs),
    text(`${origin}/llms.txt`, timeoutMs),
    wikidataEntity(options.brandName || domain, timeoutMs),
  ]);
  return {
    domain,
    checkedAt: new Date().toISOString(),
    reachable: home.ok,
    robots: robots.ok ? parseRobots(robots.body) : { present: false, blocked: [], allowed: [] },
    llmsTxt: { present: llms.ok, bytes: llms.body.length },
    structuredData: home.ok
      ? parseStructuredData(home.body, domain)
      : { organization: false, sameAs: [], independent: [] },
    wikidata,
  };
}
