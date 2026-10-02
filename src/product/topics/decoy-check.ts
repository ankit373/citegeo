import { namesIdentity } from "./prompt-identity.js";
import { wilsonInterval } from "./proportion-interval.js";
import type { Competitor } from "./competitor-set.js";
import { matchesCompetitor } from "./competitor-set.js";
import type { PromptAnswer } from "./prompt-run-schema.js";

// A measurement with no error rate is an assertion. A decoy is a name declared
// to be irrelevant to these questions, carried through every run beside the
// brand, so the product reports how often it finds something that is not there.
//
// Two different errors come out of it, and they have different owners. A decoy
// the model really wrote is the model's noise. A decoy this product reported
// that the answer does not contain is this product's own mistake.

export const DECOY_SOURCE = "decoy";

export const DECOY_CAVEAT = "A decoy is a name you have declared irrelevant to these questions. Its share is read as the upper end of what it is consistent with rather than the share itself, because a name that never appeared across a handful of answers has not been shown to be rare. A brand under that figure has not been told apart from a name that should never have been there at all.";

export interface DecoyResult {
  name: string;
  /** Answers whose reported mentions include this decoy. */
  namedIn: number;
  /** Of those, answers whose own text contains the name. The model wrote it. */
  inText: number;
  /** Reported and absent from the answer. This product's mistake, not the
   * model's, and the only error here that is a bug rather than a finding. */
  absentFromText: number;
  /** namedIn over answers considered. Null with nothing answered. */
  share: number | null;
  /** The most that share is consistent with, given how many answers there are. */
  high: number | null;
}

export interface DecoyReport {
  considered: number;
  decoys: DecoyResult[];
  /** What a share has to beat to have been told apart from a name that should
   * never appear. Null with no decoy carried, which is not a floor of nought. */
  noiseFloor: number | null;
  /** Reported mentions of a decoy the answer does not contain, across all of
   * them. Every one of these is a false positive in the reading, not the model. */
  matcherErrors: number;
  /** The brand's own share, for the comparison the floor exists to make. */
  presenceRate: number | null;
  /** True where the brand's share does not clear the floor. Null where either
   * side is missing, because that is unknown rather than a pass. */
  clearsFloor: boolean | null;
  caveat: string;
}

export function isDecoy(competitor: Competitor): boolean {
  return competitor.source === DECOY_SOURCE;
}

export function buildDecoyReport(input: { answers: PromptAnswer[]; competitors: Competitor[] }): DecoyReport {
  const completed = input.answers.filter((answer) => answer.status === "completed");
  const decoys = input.competitors.filter((row) => row.tracked && isDecoy(row));
  const considered = completed.length;

  const results: DecoyResult[] = [];
  let matcherErrors = 0;
  for (const decoy of decoys) {
    let namedIn = 0;
    let inText = 0;
    let absent = 0;
    for (const answer of completed) {
      const hit = answer.mentions.some((mention) => matchesCompetitor(decoy, mention.name, mention.domain));
      if (!hit) continue;
      namedIn += 1;
      // The answer is the evidence. A name the model did not write is this
      // product having matched something that is not the decoy.
      const names = [decoy.name, ...(decoy.domain ? [decoy.domain] : [])];
      if (namesIdentity(answer.text, names)) inText += 1;
      else { absent += 1; matcherErrors += 1; }
    }
    const interval = wilsonInterval(namedIn, considered);
    results.push({
      name: decoy.name,
      namedIn,
      inText,
      absentFromText: absent,
      share: considered ? namedIn / considered : null,
      high: interval.high,
    });
  }

  // The widest upper end, because clearing the easiest decoy is not clearing
  // the floor. Null with no decoy, which is not the same as a floor of nought.
  const highs = results.map((row) => row.high).filter((value): value is number => value !== null);
  const noiseFloor = highs.length ? Math.max(...highs) : null;

  const naming = completed.filter((answer) => answer.mentions.some((mention) => mention.isTarget)).length;
  const presenceRate = considered ? naming / considered : null;

  return {
    considered,
    decoys: results.sort((left, right) => (right.high ?? 0) - (left.high ?? 0)),
    noiseFloor,
    matcherErrors,
    presenceRate,
    clearsFloor: noiseFloor === null || presenceRate === null ? null : presenceRate > noiseFloor,
    caveat: DECOY_CAVEAT,
  };
}
