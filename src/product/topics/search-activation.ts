import { providerAccess, type SearchPosture } from "../configuration/provider-access.js";
import { browserEngine } from "../engines/engine-registry.js";
import type { AnswerSourceId } from "../configuration/provider-id.js";
import type { PromptAnswer } from "./prompt-run-schema.js";

// Whether a source can be cited at all is decided before anything about the
// source: the surface has to have searched. Its own account of that is taken
// where there is one, and otherwise it stays unknown rather than being guessed.
//
// Counting an answer that never searched alongside one that searched and cited
// nobody puts two different populations under one denominator, and every rate
// built on it measures a mixture.

export type SearchActivation =
  /** The surface searched. It said so, sources came back, or it always grounds. */
  | "activated"
  /** It cannot search at all, so no source was ever possible. */
  | "unavailable"
  /** It can search and this run never asked it to. */
  | "not_requested"
  /** It could have searched and nothing says whether it did. */
  | "unknown";

export const ACTIVATION_CAVEAT = "Most providers report whether they ran a search, and where one does its own account is taken over any inference. Where none is recorded, an answer carrying a source searched and a surface with no web search could not, and anything else is unknown, because a search that found nothing and no search at all look identical from here.";

function postureOf(providerId: AnswerSourceId, modelId?: string): SearchPosture {
  // A browser surface has no provider row, and they do not behave alike. One
  // built out of a search result is always grounded; one that decides per
  // question is not, and calling both optional threw away the difference.
  if (providerId === "browser") {
    return browserEngine(modelId || "")?.grounding === "always" ? "always" : "optional";
  }
  return providerAccess(providerId)?.search || "optional";
}

export function activationOf(answer: Pick<PromptAnswer, "providerId" | "modelId" | "citationUrls" | "status" | "search">): SearchActivation {
  if (answer.status !== "completed") return "unknown";
  const posture = postureOf(answer.providerId, answer.modelId);
  // The provider's own account first. It is the only thing here that can tell
  // a search that found nothing from a search that never ran.
  const said = answer.search;
  if (said) {
    if (said.used) return "activated";
    if (said.usedMode === "requested_not_confirmed") return "unknown";
    return posture === "never" ? "unavailable" : "not_requested";
  }
  if (answer.citationUrls.length > 0) return "activated";
  if (posture === "never") return "unavailable";
  if (posture === "always") return "activated";
  return "unknown";
}

export interface ActivationSplit {
  considered: number;
  activated: number;
  unavailable: number;
  /** Could have searched and was not asked to. A measured nought, not a gap. */
  notRequested: number;
  unknown: number;
  /** Pr(A=1), only where nothing is unknown. Null otherwise, because a rate
   * over a population that is part unknown is not that population's rate. */
  rate: number | null;
  /** The band it lies in: every unknown answer not having searched, then all
   * of them having searched. Null with nothing considered. */
  low: number | null;
  high: number | null;
  caveat: string;
}

export function splitActivation(answers: PromptAnswer[]): ActivationSplit {
  const completed = answers.filter((answer) => answer.status === "completed");
  let activated = 0;
  let unavailable = 0;
  let notRequested = 0;
  let unknown = 0;
  for (const answer of completed) {
    const state = activationOf(answer);
    if (state === "activated") activated += 1;
    else if (state === "unavailable") unavailable += 1;
    else if (state === "not_requested") notRequested += 1;
    else unknown += 1;
  }
  const considered = completed.length;
  return {
    considered,
    activated,
    unavailable,
    notRequested,
    unknown,
    rate: considered && !unknown ? activated / considered : null,
    low: considered ? activated / considered : null,
    high: considered ? (activated + unknown) / considered : null,
    caveat: ACTIVATION_CAVEAT,
  };
}
