import { wilsonInterval, type ProportionInterval } from "./proportion-interval.js";

// A presence rate on its own answers nothing: 11% is poor for a household name
// and ordinary for a brand nobody has heard of. A study of 100k responses
// across 100+ brands put appearance rates at three tiers, so a figure can be
// read against the kind of brand it came from rather than against nothing.
//
// The tier is declared, never inferred. Guessing which tier a brand is in from
// its own visibility would make the comparison circular.

export type BrandTier = "household" | "mid_market" | "niche" | "unstated";

export interface TierBaseline {
  tier: BrandTier;
  label: string;
  /** Appearance rate reported for brands of this kind. */
  rate: number;
  note: string;
}

export const TIER_BASELINES: TierBaseline[] = [
  { tier: "household", label: "Global household name", rate: 0.73, note: "Named in roughly three answers in four." },
  { tier: "mid_market", label: "Mid-market or regional", rate: 0.44, note: "Named in a little under half." },
  { tier: "niche", label: "Niche or small", rate: 0.11, note: "Named in about one answer in nine." },
];

export const TIER_CAVEAT = "The baselines come from one published study of 100,000 responses across more than 100 brands, on its prompts and its engines, not yours. They say what a brand of this kind tended to get there, which is a far better question than whether a number is high, and still not a target. The tier is the one you declared: inferring it from your own visibility would compare the figure against itself.";

export interface TierComparison {
  tier: BrandTier;
  /** Null until a tier is declared, because there is nothing to compare to. */
  baseline: TierBaseline | null;
  /** The project's own presence, with the range it is consistent with. */
  presence: ProportionInterval;
  /** True where the baseline sits inside that range, so the brand is doing
   * what its kind does. Null where either side is missing. */
  typical: boolean | null;
  /** Above, below or level, only where the range settles it. Null otherwise. */
  standing: "above" | "below" | "typical" | null;
  caveat: string;
}

export function baselineFor(tier: BrandTier): TierBaseline | null {
  return TIER_BASELINES.find((row) => row.tier === tier) || null;
}

export function compareToTier(input: { tier: BrandTier; appearances: number; answers: number }): TierComparison {
  const presence = wilsonInterval(input.appearances, input.answers);
  const baseline = baselineFor(input.tier);
  if (!baseline || presence.low === null || presence.high === null) {
    return { tier: input.tier, baseline, presence, typical: null, standing: null, caveat: TIER_CAVEAT };
  }
  // Read off the range, not the point. A rate over a handful of answers that
  // happens to sit above a baseline has not beaten it.
  const typical = baseline.rate >= presence.low && baseline.rate <= presence.high;
  return {
    tier: input.tier,
    baseline,
    presence,
    typical,
    standing: typical ? "typical" : presence.low > baseline.rate ? "above" : "below",
    caveat: TIER_CAVEAT,
  };
}
