import { domainLabel } from "./prompt-identity.js";
import type { BrandIdentity } from "./brand-identity.js";
import type { PromptAnswer } from "./prompt-run-schema.js";

// Which pages the models actually reach for. A domain-level count says you are
// cited; a page-level one says which page to write more of, which is the only
// version anyone can act on.

export interface CitedPage {
  url: string;
  /** The path alone, which is what a site owner recognises. */
  path: string;
  answers: number;
  /** The questions that produced it, as evidence for the count. */
  prompts: string[];
}

export interface CitedDomain {
  domain: string;
  answers: number;
  pages: number;
  isTarget: boolean;
  /** Answers citing this domain where the brand was not named at all. */
  answersWithoutYou: number;
}

export interface CitationAnalysis {
  /** Answers that carried at least one source. */
  answersWithCitations: number;
  answersConsidered: number;
  ownPages: CitedPage[];
  domains: CitedDomain[];
  /** Pages a rival won on a question no answer named you in. */
  openings: Array<{ url: string; domain: string; prompt: string }>;
  /** True when nothing cited anything, which is a property of the models run. */
  unavailable: boolean;
}

function parsed(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function host(url: URL): string {
  const lower = url.hostname.toLocaleLowerCase();
  return lower.startsWith("www.") ? lower.slice(4) : lower;
}

export function buildCitationAnalysis(input: { answers: PromptAnswer[]; identity: BrandIdentity }): CitationAnalysis {
  const completed = input.answers.filter((answer) => answer.status === "completed");
  const targetLabel = domainLabel(input.identity.host);

  const pages = new Map<string, CitedPage>();
  const domains = new Map<string, CitedDomain>();
  const openings: Array<{ url: string; domain: string; prompt: string }> = [];
  let withCitations = 0;

  for (const answer of completed) {
    if (!answer.citationUrls.length) continue;
    withCitations += 1;
    const namedYou = answer.mentions.some((mention) => mention.isTarget);
    // One answer citing a domain three times is one answer, not three.
    const seenDomains = new Set<string>();
    const seenPages = new Set<string>();

    for (const raw of answer.citationUrls) {
      const url = parsed(raw);
      if (!url) continue;
      const domain = host(url);
      const isTarget = domain === input.identity.host || domainLabel(domain) === targetLabel;

      if (!seenDomains.has(domain)) {
        seenDomains.add(domain);
        const row = domains.get(domain) || { domain, answers: 0, pages: 0, isTarget, answersWithoutYou: 0 };
        row.answers += 1;
        if (!namedYou) row.answersWithoutYou += 1;
        domains.set(domain, row);
        if (!isTarget && !namedYou) openings.push({ url: raw, domain, prompt: answer.promptText });
      }

      if (isTarget) {
        // Built from the normalised host, or www and non-www are two pages.
        const key = `https://${domain}${url.pathname}`;
        if (seenPages.has(key)) continue;
        seenPages.add(key);
        const page = pages.get(key) || { url: key, path: url.pathname || "/", answers: 0, prompts: [] };
        page.answers += 1;
        if (!page.prompts.includes(answer.promptText)) page.prompts.push(answer.promptText);
        pages.set(key, page);
      }
    }
  }

  for (const [domain, row] of domains) {
    row.pages = [...pages.keys()].filter((key) => key.startsWith(`https://${domain}/`) || key === `https://${domain}`).length;
  }

  return {
    answersWithCitations: withCitations,
    answersConsidered: completed.length,
    ownPages: [...pages.values()].sort((left, right) => right.answers - left.answers),
    domains: [...domains.values()].sort((left, right) => right.answers - left.answers),
    // The clearest opening first: the page a rival won most often.
    openings: openings.slice(0, 20),
    unavailable: completed.length > 0 && withCitations === 0,
  };
}
