import { getJson, putJson } from "../storage/object-store.js";
import { analyseExperiment, type ExperimentResult } from "./experiment-analysis.js";
import { ExperimentInputError, newExperiment, type Experiment, type ExperimentFile } from "./experiment-schema.js";
import type { ProductProjectFileStore } from "../projects/project-store.js";
import type { PromptAnswer } from "../topics/prompt-run-schema.js";
import type { AgentDraft } from "../agents/agent-schema.js";
import { armsBlocked, controlFor, treatedFor } from "./experiment-arms.js";

export interface ExperimentReport extends Experiment {
  result: ExperimentResult;
}

export class ExperimentService {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private key(projectId: string): string {
    return this.projects.keyFor(projectId, "experiments", "experiments.json");
  }

  private async load(projectId: string): Promise<ExperimentFile> {
    return (await getJson<ExperimentFile>(this.projects.objects, this.key(projectId))) || { projectId, experiments: [] };
  }

  async list(projectId: string, answers: PromptAnswer[]): Promise<ExperimentReport[]> {
    const file = await this.load(projectId);
    // Newest first: the one somebody is waiting on is the one just started.
    return [...file.experiments]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((experiment) => ({
        ...experiment,
        draftId: experiment.draftId || null,
        result: analyseExperiment({
          answers,
          treatedPromptIds: experiment.treatedPromptIds,
          controlPromptIds: experiment.controlPromptIds,
          changedAt: experiment.changedAt,
        }),
      }));
  }

  async start(projectId: string, input: {
    name: string;
    hypothesis: string;
    changed: string;
    treatedPromptIds: string[];
    controlPromptIds: string[];
    changedAt?: string | undefined;
    draftId?: string | null | undefined;
  }): Promise<Experiment> {
    const experiment = newExperiment({ projectId, ...input });
    const file = await this.load(projectId);
    file.experiments.push(experiment);
    await putJson(this.projects.objects, this.key(projectId), file);
    return experiment;
  }

  /** Say what the change was aimed at and the control is everything else with
   * a baseline, so the arms stop depending on what order somebody clicked in. */
  async startAgainst(projectId: string, input: {
    name: string;
    hypothesis: string;
    changed: string;
    treatedPromptIds: string[];
    changedAt?: string | undefined;
    draftId?: string | null | undefined;
  }, answers: PromptAnswer[]): Promise<Experiment> {
    // Before the arms, not after. A junk date reads as nobody having a
    // baseline, which would blame the control for a bad input.
    const asked = input.changedAt ? new Date(input.changedAt) : new Date();
    if (!Number.isFinite(asked.getTime())) throw new ExperimentInputError("The date the change was made has to be a date.");
    const changedAt = asked.toISOString();
    const treatedPromptIds = [...new Set(input.treatedPromptIds.filter(Boolean))];
    const file = await this.load(projectId);
    const excluded = file.experiments
      .filter((row) => row.status === "running")
      .flatMap((row) => row.treatedPromptIds);
    const control = controlFor({ answers, treatedPromptIds, changedAt, excluded });
    const blocked = armsBlocked(treatedPromptIds, control, changedAt);
    if (blocked) throw new ExperimentInputError(blocked);
    return this.start(projectId, { ...input, treatedPromptIds, controlPromptIds: control.promptIds, changedAt });
  }

  /** The measurement a published draft asks for, built from what the draft
   * already carries so nobody restates the change as a second selection. */
  async startFromDraft(projectId: string, draft: AgentDraft, answers: PromptAnswer[]): Promise<Experiment> {
    if (!draft.publishedAt) {
      throw new ExperimentInputError("A draft becomes an experiment once it is live, because the date it went live is the boundary between before and after.");
    }
    return this.startAgainst(projectId, {
      name: draft.title,
      hypothesis: draft.rationale,
      changed: draft.publishedUrl ? `Published: ${draft.publishedUrl}` : draft.title,
      treatedPromptIds: treatedFor(draft),
      changedAt: draft.publishedAt,
      draftId: draft.id,
    }, answers);
  }

  /** Stopped rather than deleted, because an experiment that was run is a
   * thing that happened whatever it found. */
  async stop(projectId: string, experimentId: string): Promise<Experiment> {
    const file = await this.load(projectId);
    const experiment = file.experiments.find((row) => row.id === experimentId);
    if (!experiment) throw new ExperimentInputError(`Experiment ${experimentId} does not exist.`);
    experiment.status = "stopped";
    experiment.stoppedAt = new Date().toISOString();
    await putJson(this.projects.objects, this.key(projectId), file);
    return experiment;
  }
}
