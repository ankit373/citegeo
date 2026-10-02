import { tokenize } from "../topics/prompt-identity.js";

// A citation says a page was listed. It does not say the answer used it.
// Published work separating the two found one engine citing twice as many
// pages as another and absorbing a fifth as much, so the count is not the
// finding. What is shared between the page and the answer is.
//
// Nothing here is inferred from a page that could not be read. That is unknown,
// never nought: an unread page is not a page the answer ignored.

/** Words in a run that has to match for the answer to be taken from the page.
 * Short runs match on common phrasing; long ones only catch copied sentences. */
export const PHRASE_WORDS = 6;

/** Cited pages after which position stops being evidence of anything. */
const POSITION_DEPTH = 10;

/** Shorter words are grammar. Longer ones are what the page is about, and are
 * what an answer written off a page carries over from it. */
const CONTENT_WORD = 5;

export interface SharedPhrase {
  /** The words themselves, so the reader can go and look. */
  text: string;
  /** Where it starts in the answer, for ordering. */
  at: number;
}

export interface PageUptake {
  url: string;
  host: string;
  /** Null where the page could not be read, so nothing can be said. */
  uptake: number | null;
  /** Share of the answer's own vocabulary this page could account for. The
   * measure that carries the weight, because models rewrite rather than copy. */
  shared: number | null;
  /** Runs of words the answer and the page both contain. Rare, and strong
   * evidence when they are there, which is why they travel as the receipt. */
  phrases: SharedPhrase[];
  /** Share of the answer's paragraphs this page could account for. */
  coverage: number | null;
  /** Place in the answer's citation list, from one. Earlier is cited harder. */
  citedAt: number;
  /** Why there is no figure, when there is none. */
  detail: string | null;
}

function words(value: string): string[] {
  return tokenize(value).filter(Boolean);
}

/** Every run of PHRASE_WORDS words in the text, as a set. */
function runs(value: string[]): Set<string> {
  const out = new Set<string>();
  for (let start = 0; start + PHRASE_WORDS <= value.length; start += 1) {
    out.add(value.slice(start, start + PHRASE_WORDS).join(" "));
  }
  return out;
}

/** Runs the answer and the page share, in the order the answer has them.
 * Overlapping runs are merged, so one copied sentence reads as one phrase. */
export function sharedPhrases(answer: string, page: string): SharedPhrase[] {
  const left = words(answer);
  const right = runs(words(page));
  if (!left.length || !right.size) return [];
  const found: SharedPhrase[] = [];
  let open: { start: number; end: number } | null = null;
  for (let start = 0; start + PHRASE_WORDS <= left.length; start += 1) {
    const run = left.slice(start, start + PHRASE_WORDS).join(" ");
    if (!right.has(run)) continue;
    if (open && start <= open.end) open.end = start + PHRASE_WORDS;
    else {
      if (open) found.push({ text: left.slice(open.start, open.end).join(" "), at: open.start });
      open = { start, end: start + PHRASE_WORDS };
    }
  }
  if (open) found.push({ text: left.slice(open.start, open.end).join(" "), at: open.start });
  return found;
}

function contentWords(value: string): Set<string> {
  return new Set(words(value).filter((word) => word.length >= CONTENT_WORD));
}

/** How much of what the answer is about this page is also about. Models
 * rewrite rather than copy, so this and not copied wording is the signal. */
export function termOverlap(answer: string, page: string): number | null {
  const mine = contentWords(answer);
  if (!mine.size) return null;
  const theirs = contentWords(page);
  if (!theirs.size) return null;
  let shared = 0;
  for (const word of mine) if (theirs.has(word)) shared += 1;
  return shared / mine.size;
}

/** Paragraphs of the answer this page could account for, over paragraphs with
 * enough words in them to be about anything. */
function coverageOf(answer: string, page: string): number | null {
  const paragraphs = answer.split("\n").map((line) => line.trim()).filter((line) => words(line).length >= PHRASE_WORDS);
  if (!paragraphs.length) return null;
  const hit = paragraphs.filter((line) => (termOverlap(line, page) ?? 0) >= 0.5).length;
  return hit / paragraphs.length;
}

/** Earlier in the citation list counts for more, flattening out once a list is
 * long enough that its tail is a dump rather than a ranking. */
function positionWeight(citedAt: number): number {
  if (citedAt <= 0) return 0;
  if (citedAt > POSITION_DEPTH) return 0;
  return (POSITION_DEPTH - citedAt + 1) / POSITION_DEPTH;
}

export interface UptakeInput {
  answerText: string;
  page: { url: string; host: string; text?: string | undefined; detail?: string | null | undefined };
  /** Place in this answer's citation list, from one. */
  citedAt: number;
}

export function uptakeOf(input: UptakeInput): PageUptake {
  const shell = { url: input.page.url, host: input.page.host, citedAt: input.citedAt };
  const text = input.page.text || "";
  if (!text) {
    return {
      ...shell,
      uptake: null,
      shared: null,
      phrases: [],
      coverage: null,
      detail: input.page.detail || "The page has not been read back, so nothing can be said about what the answer took from it.",
    };
  }
  const shared = termOverlap(input.answerText, text);
  // The component carrying half the weight. Without it the rest would be
  // averaged against a nought nobody measured.
  if (shared === null) {
    return {
      ...shell,
      uptake: null,
      shared: null,
      phrases: [],
      coverage: null,
      detail: "Neither the answer nor the page carries enough words to compare, so nothing can be said about what was taken from it.",
    };
  }
  const phrases = sharedPhrases(input.answerText, text);
  const coverage = coverageOf(input.answerText, text);
  // Four things that can each be checked on their own, because a composite
  // nobody can take apart is a number nobody can argue with. Copied wording
  // is the smallest share because it is the rarest, not the weakest.
  const spread = coverage ?? 0;
  const copied = Math.min(phrases.length / 3, 1);
  const place = positionWeight(input.citedAt);
  return {
    ...shell,
    uptake: Math.round((0.5 * shared + 0.25 * spread + 0.15 * place + 0.1 * copied) * 1000) / 1000,
    shared,
    phrases: phrases.slice(0, 5),
    coverage,
    detail: null,
  };
}

export const UPTAKE_CAVEAT = "Mostly how much of the answer's own vocabulary the page could account for, because models rewrite rather than copy: across these answers, exact runs of six words appear almost never. Two pages on the same subject will both score, so read it as a ranking between the pages cited for one answer rather than as a share of the answer each one wrote. It is compared against the first part of a long page, so a page that answers late is undersold.";

/** Below this, a cited page has less in common with the answer than two pages
 * on the same subject normally do, so it is worth calling out. */
export const WEAK_SHARE = 0.3;

export interface UptakeSummary {
  /** Cited pages that were read back, so a figure was possible. */
  measured: number;
  /** Cited pages not read back yet. Not counted as nought uptake. */
  unread: number;
  /** Mean uptake over the measured ones. Null with none. */
  mean: number | null;
  /** Pages cited whose subject the answer barely touches. */
  citedNotUsed: number;
  pages: PageUptake[];
  caveat: string;
}

export function summariseUptake(rows: PageUptake[]): UptakeSummary {
  const measured = rows.filter((row) => row.uptake !== null);
  const total = measured.reduce((sum, row) => sum + (row.uptake || 0), 0);
  return {
    measured: measured.length,
    unread: rows.length - measured.length,
    mean: measured.length ? Math.round((total / measured.length) * 1000) / 1000 : null,
    citedNotUsed: measured.filter((row) => (row.shared ?? 0) < WEAK_SHARE).length,
    // Least used first: a page cited and not used is the surprising one.
    pages: [...rows].sort((left, right) => (left.uptake ?? 2) - (right.uptake ?? 2)),
    caveat: UPTAKE_CAVEAT,
  };
}
