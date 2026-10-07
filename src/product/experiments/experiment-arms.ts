import type { AgentDraft } from "../agents/agent-schema.js";
import type { PromptAnswer } from "../topics/prompt-run-schema.js";

// Splitting one hand-made list down the middle makes the arms an artefact of
// the order somebody clicked in rather than of what was changed.

/** The questions a draft was written against, read off the evidence it
 * carries rather than asked for a second time. */
export function treatedFor(draft: AgentDraft): string[] {
  const ids = draft.sources
    .filter((source) => source.kind === "prompt")
    .map((source) => source.reference.trim())
    .filter(Boolean);
  return [...new Set(ids)].sort();
}

export interface ControlInput {
  answers: PromptAnswer[];
  treatedPromptIds: string[];
  /** The moment the change went live. Only questions already being answered
   * before it can stand for how things were going anyway. */
  changedAt: string;
  /** Questions another running experiment already treats. Their pages were
   * changed too, so they cannot stand for nothing having happened. */
  excluded?: string[];
}

export interface ControlArm {
  promptIds: string[];
  /** Had a baseline, but another running change already treats them. */
  withheld: string[];
  /** Answered at some point, either side of the change. Separates tracking
   * nothing else from tracking things only since the change. */
  everAnswered: number;
}

/** Every question with a baseline that the change was not aimed at. A question
 * first asked after the change has no before side, so pooling it would dilute
 * the baseline with answers that never had one. */
export function controlFor(input: ControlInput): ControlArm {
  const changed = new Date(input.changedAt).getTime();
  const treated = new Set(input.treatedPromptIds);
  const excluded = new Set(input.excluded || []);
  const baseline = new Set<string>();
  const everAnswered = new Set<string>();
  for (const answer of input.answers) {
    if (answer.status !== "completed" || treated.has(answer.promptId)) continue;
    everAnswered.add(answer.promptId);
    const at = new Date(answer.createdAt).getTime();
    if (!Number.isFinite(changed) || !Number.isFinite(at) || at >= changed) continue;
    baseline.add(answer.promptId);
  }
  const withheld = [...baseline].filter((id) => excluded.has(id)).sort();
  return {
    promptIds: [...baseline].filter((id) => !excluded.has(id)).sort(),
    withheld,
    everAnswered: everAnswered.size,
  };
}

/** Null when the arms can be built. An empty control has three different
 * causes and saying the wrong one sends somebody to fix the wrong thing. */
export function armsBlocked(treated: string[], control: ControlArm, changedAt: string): string | null {
  if (!treated.length) return "No tracked question is named as the one this change was aimed at, so there is nothing to measure it against.";
  if (control.promptIds.length) return null;
  if (control.withheld.length) {
    return "Every other question with a baseline is already treated by a running change, so none of them can stand for nothing having happened. Stop one of those experiments, or track a question this change was not aimed at.";
  }
  const day = changedAt.slice(0, 10);
  if (control.everAnswered) {
    return `No other tracked question was answered before ${day}, so nothing has a baseline to compare against. Record the date it actually went live, or run the questions and record it again.`;
  }
  return "No question other than the one this change was aimed at is being tracked, so there is nothing to act as a control.";
}
