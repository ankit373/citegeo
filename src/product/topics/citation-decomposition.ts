import { activationOf, splitActivation, type ActivationSplit } from "./search-activation.js";
import { domainLabel } from "./prompt-identity.js";
import type { BrandIdentity } from "./brand-identity.js";
import type { PromptAnswer } from "./prompt-run-schema.js";

// Being cited is three things happening in order, not one: the surface
// searches, your page is among what it retrieved, and the answer cites it.
// Pr(cited) = Pr(searched) x Pr(retrieved | searched) x Pr(cited | retrieved).
//
// Retrieval is not observable from here, so the middle two are reported
// together. Reporting the pair alone and calling it visibility states a rate
// among answers that searched as though it held over all of them.

export const DECOMPOSITION_CAVEAT = "Being cited needs the surface to search and then to cite you. These are reported apart because a share among the answers that searched is not a share of all answers, and the two differ by however often nothing searched at all. The share of all answers is exact: an answer that carried no source cited nobody. The share among those that searched is not, because which answers searched is not fully knowable.";

export interface CitationDecomposition {
  activation: ActivationSplit;
  /** Answers known to have searched. The smallest the second denominator can be. */
  activated: number;
  /** Of those, the ones citing the project's own domain. */
  citedYou: number;
  /** Pr(cited | searched). Null while any activation is unknown, because those
   * answers may belong in the denominator and there is no way to tell. */
  citedGivenActivated: number | null;
  /** The band it lies in: every unknown answer having searched, then none. */
  citedGivenActivatedLow: number | null;
  citedGivenActivatedHigh: number | null;
  /** Pr(cited) over every answer, and exact even where activation is not. An
   * answer carrying no source cited nobody, so it cannot be one that cited you. */
  overall: number | null;
  caveat: string;
}

function hostOfUrl(raw: string): string | null {
  try {
    const host = new URL(raw).hostname.toLocaleLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

function citesYou(answer: PromptAnswer, identity: BrandIdentity): boolean {
  const target = domainLabel(identity.host);
  for (const raw of answer.citationUrls) {
    const host = hostOfUrl(raw);
    if (!host) continue;
    if (host === identity.host || domainLabel(host) === target) return true;
  }
  return false;
}

export function decomposeCitations(input: { answers: PromptAnswer[]; identity: BrandIdentity }): CitationDecomposition {
  const completed = input.answers.filter((answer) => answer.status === "completed");
  const activation = splitActivation(completed);
  const searched = completed.filter((answer) => activationOf(answer) === "activated");
  const citedYou = searched.filter((answer) => citesYou(answer, input.identity)).length;
  // An unknown answer carried no source, so it cited nobody. It can widen the
  // denominator of the conditional and never the count of answers citing you.
  const widest = searched.length + activation.unknown;
  const low = widest ? citedYou / widest : null;
  const high = searched.length ? citedYou / searched.length : null;

  return {
    activation,
    activated: searched.length,
    citedYou,
    citedGivenActivated: activation.unknown ? null : high,
    citedGivenActivatedLow: low,
    citedGivenActivatedHigh: high,
    overall: completed.length ? citedYou / completed.length : null,
    caveat: DECOMPOSITION_CAVEAT,
  };
}
