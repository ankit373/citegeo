import { domainLabel, namesIdentity, tokenize } from "./prompt-identity.js";

// When a brand is named after its own category, "best stock screener" and
// "Screener the product" are the same words. Name matching cannot separate
// them, and quietly guessing either way corrupts every figure built on it.

export interface BrandIdentity {
  /** Names that reliably mean this brand. */
  distinctive: string[];
  /** Names that are ordinary vocabulary in this brand's own category. */
  ambiguous: string[];
  /** The full host, which stays distinctive even when the name does not. */
  host: string;
  /** True when no name is left that reliably means the brand. */
  nameMatchingUnreliable: boolean;
  /** What the interface must say, when it must say something. */
  caveat: string | null;
}

/** A name is ambiguous when it is already a word in the category it sells into. */
function inCategoryVocabulary(name: string, categoryText: string): boolean {
  const needle = tokenize(name);
  if (!needle.length) return false;
  return namesIdentity(categoryText, [name]) || needle.every((token) => tokenize(categoryText).includes(token));
}

export function resolveBrandIdentity(input: {
  brandName: string;
  aliases?: string[] | undefined;
  domain: string;
  /** The category and features the brand publishes, from its own site. */
  categoryText?: string | undefined;
}): BrandIdentity {
  const host = input.domain.trim().toLocaleLowerCase();
  const candidates = [input.brandName, ...(input.aliases || []), domainLabel(host)]
    .map((value) => (value || "").trim())
    .filter(Boolean);

  const distinctive: string[] = [];
  const ambiguous: string[] = [];
  const category = (input.categoryText || "").trim();
  for (const name of [...new Set(candidates)]) {
    if (category && inCategoryVocabulary(name, category)) ambiguous.push(name);
    else distinctive.push(name);
  }

  const unreliable = distinctive.length === 0 && ambiguous.length > 0;
  return {
    distinctive,
    ambiguous,
    host,
    nameMatchingUnreliable: unreliable,
    caveat: unreliable
      ? `"${ambiguous[0]}" is an ordinary word in this category, so an answer using it may not be naming this brand. Visibility here is counted from ${host} appearing in the answer or in a citation, which undercounts rather than overcounts.`
      : null,
  };
}

/** Whether a body of text names the brand. Falls back to the host when the
 * name is a category word, because the host is still distinctive. */
export function textNamesBrand(text: string, identity: BrandIdentity): boolean {
  if (!identity.nameMatchingUnreliable && namesIdentity(text, identity.distinctive)) return true;
  return text.toLocaleLowerCase().includes(identity.host);
}

/** Whether an answer names the brand, reading its citations too. A link to the
 * site is a mention even when the prose never spells the name out. */
export function answerNamesBrand(input: { text: string; citationUrls: string[]; names: string[] }, identity: BrandIdentity): boolean {
  if (!identity.nameMatchingUnreliable && namesIdentity([input.text, ...input.names].join(" "), identity.distinctive)) return true;
  const haystack = [input.text, ...input.names, ...input.citationUrls].join(" ").toLocaleLowerCase();
  return haystack.includes(identity.host);
}
