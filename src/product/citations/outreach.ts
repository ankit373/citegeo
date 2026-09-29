import { hostOf, type NamedOnPage, type SourcePage } from "./source-page.js";
import { ageFrom, freshnessReport, type Freshness, type FreshnessReport, type PageAge } from "./freshness.js";
import { canonicalUrl } from "./canonical-url.js";
import type { PromptAnswer } from "../topics/prompt-run-schema.js";

// A cited page you are missing from, on a question you lose, is the most
// specific thing this product can hand anybody. It names the page, the people
// already on it, and the position they hold.

/** Whose page this is. A rival's own page is cited work you can never appear
 * on, so offering it as somewhere to get listed wastes the reader's time. */
export type PageOwner = "yours" | "rival" | "independent";

export interface OutreachTarget {
  url: string;
  host: string;
  owner: PageOwner;
  title: string | null;
  /** Answers that cited this page. */
  citedBy: number;
  /** The questions those answers were given to. */
  prompts: string[];
  /** Answers citing it where the brand was named nowhere in the answer. */
  citedWithoutYou: number;
  namesYou: boolean;
  /** Who is on the page, in page order. A listicle's order is the finding. */
  rivals: NamedOnPage[];
  /** False for a page nobody can be added to, which is a rival's own site and
   * your own. Only an independent page is somewhere to ask to be listed. */
  reachable: boolean;
  /** Null when the page could not be read; its reason travels instead. */
  words: number | null;
  /** How old the page says it is. Undated when it says nothing, and unread
   * while nobody has read it back. */
  freshness: Freshness | "unread";
  ageDays: number | null;
  unread: string | null;
  why: string;
}

export interface OutreachPlan {
  /** Answers that carried at least one source. */
  answersWithCitations: number;
  answersConsidered: number;
  /** Pages harvested of the ones cited. */
  read: number;
  cited: number;
  targets: OutreachTarget[];
  /** Cited pages somebody could ask to be listed on. The number that matters:
   * a plan of ten rival-owned pages offers nowhere to go. */
  reachable: number;
  /** Cited pages belonging to a brand the answers named against you. */
  rivalOwned: number;
  /** How old the pages that were read say they are. Only read pages count,
   * because an unread page has no age rather than an unknown one. */
  freshness: FreshnessReport;
  /** True when nothing cited anything, which is a property of what ran. */
  unavailable: boolean;
}

function owns(host: string, domain: string): boolean {
  const clean = domain.trim().toLocaleLowerCase();
  if (!clean) return false;
  return host === clean || host.endsWith(`.${clean}`);
}

function ownerOf(host: string, yours: string, rivals: string[]): PageOwner {
  if (owns(host, yours)) return "yours";
  return rivals.some((domain) => owns(host, domain)) ? "rival" : "independent";
}

export function buildOutreachPlan(input: {
  answers: PromptAnswer[];
  pages: SourcePage[];
  /** The project's own domain, so its own pages are not offered as outreach. */
  domain?: string | undefined;
  /** Domains of the brands the answers named, so their own pages are not either. */
  rivalDomains?: string[] | undefined;
  /** Fixed by the caller in tests, so an age does not change with the clock. */
  now?: Date | undefined;
}): OutreachPlan {
  const completed = input.answers.filter((answer) => answer.status === "completed");
  const byUrl = new Map<string, { citedBy: number; withoutYou: number; prompts: Set<string> }>();
  let answersWithCitations = 0;

  for (const answer of completed) {
    if (answer.citationUrls.length) answersWithCitations += 1;
    const namedYou = answer.mentions.some((mention) => mention.isTarget);
    const cited = new Set<string>();
    for (const raw of answer.citationUrls) {
      const page = canonicalUrl(raw);
      if (page) cited.add(page.key);
    }
    for (const url of cited) {
      const row = byUrl.get(url) || { citedBy: 0, withoutYou: 0, prompts: new Set<string>() };
      row.citedBy += 1;
      if (!namedYou) row.withoutYou += 1;
      row.prompts.add(answer.promptText);
      byUrl.set(url, row);
    }
  }

  // Pages stored under a raw URL before this still have to be found, so the
  // lookup is keyed by the same canonical page the citations are grouped by.
  const read = new Map(input.pages.flatMap((page) => {
    const key = canonicalUrl(page.url)?.key;
    return key ? [[key, page] as const] : [];
  }));
  const ages = new Map<string, PageAge>();
  const targets: OutreachTarget[] = [...byUrl.entries()].map(([url, row]) => {
    const page = read.get(url);
    const rivals = page ? page.named.filter((named) => named.name) : [];
    const host = hostOf(url);
    const owner = ownerOf(host, input.domain || "", (input.rivalDomains || []).filter(Boolean));
    // A rival's own site is cited work nobody else can join, so it is reported
    // as a finding about who owns the answer rather than as somewhere to go.
    const why = owner === "rival"
      ? `This is ${host}, their own page. It was cited in ${row.citedBy} answer(s) and nobody can be added to it, so the way past it is an independent page that outranks it or a page of your own the models cite instead.`
      : owner === "yours"
        ? `This is your own page, cited in ${row.citedBy} answer(s). It is working.`
        : !page
      ? "Cited, and not read yet."
      : page.detail
        ? `Cited, and could not be read: ${page.detail}`
        : page.namesYou
          ? `You are already on this page. ${row.withoutYou} of ${row.citedBy} answer(s) cited it without naming you, so being on it is not enough here.`
          : rivals.length
            ? `You are not on this page. ${rivals.slice(0, 3).map((named) => named.name).join(", ")} are, and it was cited in ${row.citedBy} answer(s).`
            : `You are not on this page, and neither is anyone else the answers named.`;
    // Only a page that was read has an age. Nobody having looked is a
    // different state from the page giving no date, so the two never merge.
    const age = page && !page.detail
      ? ageFrom({ url, host, statedAt: page.statedAt ?? null, source: page.dateSource ?? null, ...(input.now === undefined ? {} : { now: input.now }) })
      : null;
    if (age) ages.set(url, age);
    return {
      url,
      host,
      owner,
      reachable: owner === "independent",
      freshness: age ? age.freshness : "unread",
      ageDays: age ? age.ageDays : null,
      title: page?.title || null,
      citedBy: row.citedBy,
      prompts: [...row.prompts],
      citedWithoutYou: row.withoutYou,
      namesYou: page ? page.namesYou : false,
      rivals,
      words: page && !page.detail ? page.words : null,
      unread: page ? page.detail : "Not read yet.",
      why,
    };
  });

  // Where you are missing and the page is doing the most work, first.
  // Somewhere you can actually get listed comes first, then where you are
  // missing, then where the page is doing the most work.
  targets.sort((left, right) =>
    Number(right.reachable) - Number(left.reachable)
    || Number(left.namesYou) - Number(right.namesYou)
    || right.citedWithoutYou - left.citedWithoutYou
    || right.citedBy - left.citedBy);

  return {
    answersWithCitations,
    reachable: targets.filter((row) => row.reachable).length,
    rivalOwned: targets.filter((row) => row.owner === "rival").length,
    answersConsidered: completed.length,
    freshness: freshnessReport([...ages.values()]),
    read: input.pages.filter((page) => !page.detail).length,
    cited: byUrl.size,
    targets,
    unavailable: byUrl.size === 0,
  };
}
