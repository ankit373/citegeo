import { NARRATIVE_INSTRUCTION, parseJudgement, summariseNarrative } from "./narrative.js";
import type { NarrativeJudgement, NarrativeSummary } from "./narrative.js";

// Runs the narrative classifier over answers already on file. It reads stored
// evidence and never calls the answering model again, so labelling a run costs
// one cheap classifier call per answer and changes nothing about the evidence.

export interface NarrativeInput {
  modelRunId: string;
  modelId: string;
  /** The answer text to label, as archived. */
  answer: string;
}

/** Narrowed from AnswerProvider so a test needs no provider catalogue. */
export type NarrativeClassifier = (input: { prompt: string }) => Promise<string>;

export interface NarrativeReport {
  classified: number;
  skipped: number;
  judgements: NarrativeJudgement[];
  summary: NarrativeSummary;
}

function prompt(answer: string): string {
  // The answer is fenced so a classifier cannot mistake instructions inside it
  // for instructions addressed to itself.
  return `${NARRATIVE_INSTRUCTION}\n\nAnswer to label, between the markers:\n<<<ANSWER\n${answer}\nANSWER>>>`;
}

export async function classifyNarrative(input: {
  answers: NarrativeInput[];
  classify: NarrativeClassifier;
}): Promise<NarrativeReport> {
  const judgements: NarrativeJudgement[] = [];
  let skipped = 0;

  for (const answer of input.answers) {
    if (!answer.answer.trim()) {
      skipped += 1;
      continue;
    }
    let raw: string;
    try {
      raw = await input.classify({ prompt: prompt(answer.answer) });
    } catch {
      // A classifier failure is unknown, never a sentiment. Reporting neutral
      // here would turn an outage into a finding about the brand.
      judgements.push({
        modelRunId: answer.modelRunId,
        modelId: answer.modelId,
        sentiment: "unknown",
        themes: [],
        raw: "",
      });
      continue;
    }
    const parsed = parseJudgement(raw);
    judgements.push({
      modelRunId: answer.modelRunId,
      modelId: answer.modelId,
      sentiment: parsed.sentiment,
      themes: parsed.themes,
      raw,
    });
  }

  return {
    classified: judgements.length,
    skipped,
    judgements,
    summary: summariseNarrative(judgements),
  };
}
