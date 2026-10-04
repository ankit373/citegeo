import { getJson, putJson } from "../storage/object-store.js";
import { analyseExperiment, type ExperimentResult } from "./experiment-analysis.js";
import { ExperimentInputError, newExperiment, type Experiment, type ExperimentFile } from "./experiment-schema.js";
import type { ProductProjectFileStore } from "../projects/project-store.js";
import type { PromptAnswer } from "../topics/prompt-run-schema.js";

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
  }): Promise<Experiment> {
    const experiment = newExperiment({ projectId, ...input });
    const file = await this.load(projectId);
    file.experiments.push(experiment);
    await putJson(this.projects.objects, this.key(projectId), file);
    return experiment;
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
