import { hostOf, type NamedOnPage, type SourcePage } from "./source-page.js";
import type { PromptAnswer } from "../topics/prompt-run-schema.js";

// A cited page you are missing from, on a question you lose, is the most
// specific thing this product can hand anybody. It names the page, the people
// already on it, and the position they hold.

export interface OutreachTarget {
  url: string;
  host: string;
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
  /** Null when the page could not be read; its reason travels instead. */
  words: number | null;
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
  /** True when nothing cited anything, which is a property of what ran. */
  unavailable: boolean;
}

export function buildOutreachPlan(input: { answers: PromptAnswer[]; pages: SourcePage[] }): OutreachPlan {
  const completed = input.answers.filter((answer) => answer.status === "completed");
  const byUrl = new Map<string, { citedBy: number; withoutYou: number; prompts: Set<string> }>();
  let answersWithCitations = 0;

  for (const answer of completed) {
    if (answer.citationUrls.length) answersWithCitations += 1;
    const namedYou = answer.mentions.some((mention) => mention.isTarget);
    for (const url of new Set(answer.citationUrls)) {
      const row = byUrl.get(url) || { citedBy: 0, withoutYou: 0, prompts: new Set<string>() };
      row.citedBy += 1;
      if (!namedYou) row.withoutYou += 1;
      row.prompts.add(answer.promptText);
      byUrl.set(url, row);
    }
  }

  const read = new Map(input.pages.map((page) => [page.url, page]));
  const targets: OutreachTarget[] = [...byUrl.entries()].map(([url, row]) => {
    const page = read.get(url);
    const rivals = page ? page.named.filter((named) => named.name) : [];
    const why = !page
      ? "Cited, and not read yet."
      : page.detail
        ? `Cited, and could not be read: ${page.detail}`
        : page.namesYou
          ? `You are already on this page. ${row.withoutYou} of ${row.citedBy} answer(s) cited it without naming you, so being on it is not enough here.`
          : rivals.length
            ? `You are not on this page. ${rivals.slice(0, 3).map((named) => named.name).join(", ")} are, and it was cited in ${row.citedBy} answer(s).`
            : `You are not on this page, and neither is anyone else the answers named.`;
    return {
      url,
      host: hostOf(url),
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
  targets.sort((left, right) =>
    Number(left.namesYou) - Number(right.namesYou)
    || right.citedWithoutYou - left.citedWithoutYou
    || right.citedBy - left.citedBy);

  return {
    answersWithCitations,
    answersConsidered: completed.length,
    read: input.pages.filter((page) => !page.detail).length,
    cited: byUrl.size,
    targets,
    unavailable: byUrl.size === 0,
  };
}
