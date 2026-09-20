// Real questions people asked an assistant, from an openly licensed corpus.
// A corpus is a historical sample, not live volume, and every figure says so.

export interface CorpusSource {
  id: string;
  label: string;
  licence: string;
  /** The dataset's own identifier. Where to get it is in docs/prompt-demand.md,
   * which keeps third-party hostnames out of production source. */
  dataset: string;
  /** What this sample is and is not, printed next to every figure from it. */
  caveat: string;
}

export const CORPUS_SOURCES: CorpusSource[] = [
  {
    id: "wildchat",
    label: "WildChat",
    licence: "ODC-BY",
    dataset: "allenai/WildChat-1M",
    caveat:
      "About a million conversations with GPT-3.5 and GPT-4, collected from people given free access in exchange for their chat logs. It is a sample of that population at that time, not a measure of everyone, and not current.",
  },
  {
    id: "lmsys",
    label: "LMSYS-Chat-1M",
    licence: "LMSYS-Chat-1M Dataset License",
    dataset: "lmsys/lmsys-chat-1m",
    caveat:
      "A million conversations from people trying models side by side. That population came to compare models, so the questions skew towards testing rather than buying.",
  },
];

export interface CorpusIndex {
  sourceId: string;
  /** Opening questions read from the corpus. */
  questions: number;
  /** Distinct lowercase tokens indexed. */
  vocabulary: number;
  /** Earliest and latest conversation seen, where the corpus dates them. */
  from: string | null;
  to: string | null;
  builtAt: string;
}

export interface DemandMatch {
  /** How many corpus questions contain every meaningful word of the prompt. */
  exactTerms: number;
  /** How many contain most of them, which is the looser and larger figure. */
  relatedTerms: number;
  /** Corpus questions closest to this prompt, as evidence for the count. */
  examples: string[];
}

export interface PromptDemand {
  promptId: string;
  text: string;
  match: DemandMatch;
  /** exactTerms as a share of the corpus, which is the only honest rate here. */
  shareOfCorpus: number | null;
}

export interface DemandReport {
  sourceId: string;
  index: CorpusIndex;
  caveat: string;
  prompts: PromptDemand[];
  /** Words common in the corpus that no tracked prompt covers. */
  uncoveredTerms: Array<{ term: string; questions: number }>;
}
