import { providerAccess, type SearchPosture } from "../configuration/provider-access.js";
import type { AnswerSourceId } from "../configuration/provider-id.js";
import type { PromptAnswer } from "./prompt-run-schema.js";

// Whether a source can be cited at all is decided before anything about the
// source: the surface has to have searched. No provider reports that, so it is
// derived from what is observable, and stays unknown where it is not knowable.
//
// Counting an answer that never searched alongside one that searched and cited
// nobody puts two different populations under one denominator, and every rate
// built on it measures a mixture.

export type SearchActivation =
  /** The surface searched. Sources came back, or it always grounds. */
  | "activated"
  /** It cannot search at all, so no source was ever possible. */
  | "unavailable"
  /** It could have searched and no source came back. Both readings fit. */
  | "unknown";

export const ACTIVATION_CAVEAT = "No provider reports whether it searched. An answer carrying a source searched; a surface with no web search could not. An answer from a surface that could have searched and carried no source is unknown, because a search that found nothing and no search at all look identical from here.";

function postureOf(providerId: AnswerSourceId): SearchPosture {
  // A browser surface has no provider row. It can search and often does not,
  // which is the reason the unknown state exists rather than a default.
  if (providerId === "browser") return "optional";
  return providerAccess(providerId)?.search || "optional";
}

export function activationOf(answer: Pick<PromptAnswer, "providerId" | "citationUrls" | "status">): SearchActivation {
  if (answer.status !== "completed") return "unknown";
  if (answer.citationUrls.length > 0) return "activated";
  const posture = postureOf(answer.providerId);
  if (posture === "never") return "unavailable";
  if (posture === "always") return "activated";
  return "unknown";
}

export interface ActivationSplit {
  considered: number;
  activated: number;
  unavailable: number;
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
  let unknown = 0;
  for (const answer of completed) {
    const state = activationOf(answer);
    if (state === "activated") activated += 1;
    else if (state === "unavailable") unavailable += 1;
    else unknown += 1;
  }
  const considered = completed.length;
  return {
    considered,
    activated,
    unavailable,
    unknown,
    rate: considered && !unknown ? activated / considered : null,
    low: considered ? activated / considered : null,
    high: considered ? (activated + unknown) / considered : null,
    caveat: ACTIVATION_CAVEAT,
  };
}
