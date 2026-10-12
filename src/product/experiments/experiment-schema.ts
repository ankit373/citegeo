import { randomUUID } from "node:crypto";

/** A change somebody made, written down before its effect is read, so the
 * question is fixed in advance rather than chosen once the numbers are in. */
export interface Experiment {
  id: string;
  projectId: string;
  name: string;
  /** What is expected to happen, stated before the answer is known. */
  hypothesis: string;
  /** What was actually changed, so somebody else can check it was. */
  changed: string;
  /** Questions the change is expected to move. */
  treatedPromptIds: string[];
  /** Questions it is not, which absorb whatever moved for everything. */
  controlPromptIds: string[];
  /** Answers before this are the baseline and after it are the outcome. */
  changedAt: string;
  status: "running" | "stopped";
  createdAt: string;
  stoppedAt: string | null;
  /** The draft this came from, where one did. Null for an experiment somebody
   * started by hand against a change the product never saw. */
  draftId: string | null;
}

export interface ExperimentFile {
  projectId: string;
  experiments: Experiment[];
}

export class ExperimentInputError extends Error {}

export function newExperiment(input: {
  projectId: string;
  name: string;
  hypothesis: string;
  changed: string;
  treatedPromptIds: string[];
  controlPromptIds: string[];
  changedAt?: string | undefined;
  draftId?: string | null | undefined;
}): Experiment {
  const name = input.name.trim();
  if (!name) throw new ExperimentInputError("An experiment needs a name.");
  const treated = [...new Set(input.treatedPromptIds.filter(Boolean))];
  const control = [...new Set(input.controlPromptIds.filter(Boolean))];
  if (!treated.length) throw new ExperimentInputError("An experiment needs at least one question the change is expected to move.");
  // A question on both sides is its own control, which would subtract the
  // effect from itself and report nothing however well the change worked.
  const both = treated.filter((id) => control.includes(id));
  if (both.length) throw new ExperimentInputError("A question cannot be both treated and control: it would be its own control.");
  const changedAt = input.changedAt ? new Date(input.changedAt) : new Date();
  if (!Number.isFinite(changedAt.getTime())) throw new ExperimentInputError("The date the change was made has to be a date.");
  return {
    id: `experiment-${randomUUID()}`,
    projectId: input.projectId,
    name,
    hypothesis: input.hypothesis.trim(),
    changed: input.changed.trim(),
    treatedPromptIds: treated,
    controlPromptIds: control,
    changedAt: changedAt.toISOString(),
    status: "running",
    createdAt: new Date().toISOString(),
    stoppedAt: null,
    draftId: input.draftId || null,
  };
}
