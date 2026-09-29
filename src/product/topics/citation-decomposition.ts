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

export const DECOMPOSITION_CAVEAT = "Being cited needs the surface to search and then to cite you. These are reported apart because a share among the answers that searched is not a share of all answers, and the two differ by however often nothing searched at all.";

export interface CitationDecomposition {
  activation: ActivationSplit;
  /** Answers where the surface searched. The denominator of the second term. */
  activated: number;
  /** Of those, the ones citing the project's own domain. */
  citedYou: number;
  /** Pr(cited | searched). Null with nothing activated to divide by. */
  citedGivenActivated: number | null;
  /** Pr(cited) overall, the two terms multiplied. Null wherever the activation
   * term is unknown, because a product with an unknown factor is unknown. */
  overall: number | null;
  /** The band it lies in while any answer's activation is unknown. */
  overallLow: number | null;
  overallHigh: number | null;
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
  const conditional = searched.length ? citedYou / searched.length : null;

  return {
    activation,
    activated: searched.length,
    citedYou,
    citedGivenActivated: conditional,
    overall: conditional !== null && activation.rate !== null ? conditional * activation.rate : null,
    overallLow: conditional !== null && activation.low !== null ? conditional * activation.low : null,
    overallHigh: conditional !== null && activation.high !== null ? conditional * activation.high : null,
    caveat: DECOMPOSITION_CAVEAT,
  };
}
