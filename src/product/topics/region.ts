// An API request carries no location, so the model is told who is asking. That
// is a stated audience, not a geolocated query, and every figure says so.

export interface Region {
  id: string;
  label: string;
  /** BCP 47, used for the language the answer should be written in. */
  locale: string;
  /** How the audience is described to the model. */
  audience: string;
}

export const GLOBAL_REGION: Region = {
  id: "global",
  label: "No stated market",
  locale: "en",
  audience: "",
};

export const REGIONS: Region[] = [
  GLOBAL_REGION,
  { id: "us", label: "United States", locale: "en-US", audience: "someone in the United States" },
  { id: "gb", label: "United Kingdom", locale: "en-GB", audience: "someone in the United Kingdom" },
  { id: "in", label: "India", locale: "en-IN", audience: "someone in India" },
  { id: "ca", label: "Canada", locale: "en-CA", audience: "someone in Canada" },
  { id: "au", label: "Australia", locale: "en-AU", audience: "someone in Australia" },
  { id: "de", label: "Germany", locale: "en-DE", audience: "someone in Germany" },
  { id: "sg", label: "Singapore", locale: "en-SG", audience: "someone in Singapore" },
  { id: "ae", label: "United Arab Emirates", locale: "en-AE", audience: "someone in the United Arab Emirates" },
  { id: "br", label: "Brazil", locale: "en-BR", audience: "someone in Brazil" },
];

export function region(id: string): Region | undefined {
  return REGIONS.find((row) => row.id === id);
}

export function isRegionId(value: unknown): boolean {
  return typeof value === "string" && REGIONS.some((row) => row.id === value);
}

/** Empty for the global region, so a run with no market stated is identical to
 * one from before markets existed and stays comparable with it. */
export function audienceInstruction(row: Region): string {
  return row.audience ? `Answer as you would for ${row.audience}.` : "";
}

/** What the UI must say next to any regional figure. */
export const REGION_CAVEAT =
  "A market is stated to the model, not detected from a location. These are answers given to someone described as being in that market, which is not the same as answers served there.";
