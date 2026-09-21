import { randomUUID } from "node:crypto";
import type { ProductBaseline, ProductModelSnapshot } from "../configuration/baseline-schema.js";
import type { ProductBaselineService } from "../configuration/baseline-service.js";
import type { ProductModelCatalog } from "../configuration/model-selection-schema.js";
import type { ProductProjectService } from "../projects/project-service.js";
import type { RecognitionAnswerExecutor } from "../recognition/recognition-service.js";
import { answerNamesBrand, type BrandIdentity } from "./brand-identity.js";
import {
  parsePromptAnswerOutput,
  promptAnswerPrompt,
  promptAnswerResponseSchema,
  PROMPT_ANSWER_SCHEMA_HASH,
  PROMPT_ANSWER_SCHEMA_NAME,
  PROMPT_ANSWER_TOOL_DESCRIPTION,
} from "./prompt-answer-protocol.js";
import { isLive, type AnswerMention, type PromptAnswer, type PromptRun } from "./prompt-run-schema.js";
import type { PromptRunFileStore } from "./prompt-run-store.js";
import { readStructuredValue } from "./structured-value.js";
import { activePrompts, type PromptIntent } from "./topic-schema.js";
import { audienceInstruction, GLOBAL_REGION, region, type Region } from "./region.js";
import { DEFAULT_LANGUAGE, language, languageInstruction, type AnswerLanguage } from "./language.js";
import { currentBaseline } from "../configuration/current-baseline.js";
import type { TopicService } from "./topic-service.js";
import type { BrowserEngine } from "../engines/browser-engine.js";
import type { Prompt } from "./topic-schema.js";

export class PromptRunUnavailableError extends Error {}

function nowIso(): string {
  return new Date().toISOString();
}

export interface StartPromptRunInput {
  projectId: string;
  /** Limits the run to these prompts. Every active prompt when omitted. */
  promptIds?: string[] | undefined;
  /** Markets to ask in. The global region alone when omitted. */
  regionIds?: string[] | undefined;
  /** Languages to ask in. English alone when omitted. */
  languageIds?: string[] | undefined;
  /** Browser engines to ask as well as the saved models. These are the only
   * source here that is web-grounded by construction, so they carry sources. */
  engineIds?: string[] | undefined;
}

/** What the run needs from the engines domain, so the run service does not
 * depend on how an engine is driven or where its selection is stored. */
export interface EnginePlan {
  saved(projectId: string): Promise<string[]>;
  lookup(engineId: string): BrowserEngine | undefined;
  ask(input: { run: PromptRun; prompt: Prompt; engine: BrowserEngine; identity: BrandIdentity }): Promise<PromptAnswer>;
}

/** One answer per prompt per model per market is one observation. Nothing is
 * averaged here; the aggregation has to name the answers it came from. */
export class PromptRunService {
  constructor(
    private readonly store: PromptRunFileStore,
    private readonly topics: TopicService,
    private readonly projects: ProductProjectService,
    private readonly baselines: ProductBaselineService,
    private readonly executor: RecognitionAnswerExecutor,
    private readonly catalog?: ProductModelCatalog | undefined,
    private readonly engines?: EnginePlan | undefined,
  ) {}

  /** Splits the saved models into the ones the catalogue still says can answer
   * and the ones it does not. A catalogue that cannot be read blocks nothing. */
  private async usable(models: ProductModelSnapshot[]): Promise<{ run: ProductModelSnapshot[]; skipped: Array<{ modelId: string; reason: string }> }> {
    if (!this.catalog) return { run: models, skipped: [] };
    let current;
    try {
      current = await this.catalog.list();
    } catch {
      return { run: models, skipped: [] };
    }
    const run: ProductModelSnapshot[] = [];
    const skipped: Array<{ modelId: string; reason: string }> = [];
    for (const model of models) {
      const row = current.find((item) => item.providerId === model.providerId && item.modelId === model.modelId);
      if (row && !row.available) skipped.push({ modelId: model.modelId, reason: row.unavailableReason || "The catalogue reports it as unavailable." });
      else run.push(model);
    }
    return { run, skipped };
  }

  /** Ids asked to stop. In memory, because a cancel only means anything to the
   * process actually running the loop. */
  private readonly cancelled = new Set<string>();

  async listRuns(projectId: string): Promise<PromptRun[]> {
    return this.store.listRuns(projectId);
  }

  /** Stops after the answer in flight. A run cannot be torn out mid-request
   * without losing the answer the provider is already paying for. */
  async cancel(projectId: string, runId: string): Promise<PromptRun> {
    const run = (await this.store.listRuns(projectId)).find((row) => row.id === runId);
    if (!run) throw new PromptRunUnavailableError(`Run ${runId} does not exist.`);
    if (!isLive(run.status)) return run;
    this.cancelled.add(runId);
    const next: PromptRun = { ...run, status: "cancelling" };
    await this.store.saveRun(next);
    return next;
  }

  /**
   * Marks runs left "running" by a process that is gone. Nothing can be in
   * flight when the server has only just started, so a live record at that
   * moment is a lie the interface would otherwise keep telling.
   */
  async reconcileInterrupted(projectId: string): Promise<number> {
    let count = 0;
    for (const run of await this.store.listRuns(projectId)) {
      if (!isLive(run.status)) continue;
      await this.store.saveRun({ ...run, status: "interrupted", completedAt: nowIso() });
      count += 1;
    }
    return count;
  }

  async listAnswers(projectId: string, runId?: string): Promise<PromptAnswer[]> {
    return this.store.listAnswers(projectId, runId);
  }

  async start(input: StartPromptRunInput): Promise<PromptRun> {
    const project = await this.projects.get(input.projectId);
    if (!project) throw new PromptRunUnavailableError(`Project ${input.projectId} does not exist.`);

    const live = (await this.store.listRuns(input.projectId)).find((row) => isLive(row.status));
    if (live) {
      throw new PromptRunUnavailableError(
        `A run is already going (${live.answersCompleted} of ${live.answersRequested} answers). Stop it before starting another.`,
      );
    }


    const set = await this.topics.get(input.projectId);
    const wanted = input.promptIds ? new Set(input.promptIds) : null;
    const prompts = activePrompts(set).filter((prompt) => !wanted || wanted.has(prompt.id));
    if (!prompts.length) {
      throw new PromptRunUnavailableError(
        "No active prompts. Generate a set and activate the ones worth tracking before running.",
      );
    }

    const chosenEngines = await this.chosenEngines(input);
    const baseline = await this.currentBaseline(input.projectId);
    if (!baseline.modelSnapshots.length && !chosenEngines.length) {
      throw new PromptRunUnavailableError("No models are saved for this project. Choose models and save a configuration first.");
    }
    const { run: models, skipped } = await this.usable(baseline.modelSnapshots);
    if (!models.length && !chosenEngines.length) {
      throw new PromptRunUnavailableError(
        `Every saved model is unusable: ${skipped.map((row) => `${row.modelId} (${row.reason})`).join("; ")}`,
      );
    }

    const identity = await this.topics.targetIdentity(input.projectId);

    // An unknown market id is refused rather than quietly dropped, or a run
    // would silently cover fewer markets than it was asked for.
    const regions: Region[] = (input.regionIds && input.regionIds.length ? input.regionIds : [GLOBAL_REGION.id]).map((id) => {
      const found = region(id);
      if (!found) throw new PromptRunUnavailableError(`Unknown market "${id}".`);
      return found;
    });

    const languages: AnswerLanguage[] = (input.languageIds && input.languageIds.length ? input.languageIds : [DEFAULT_LANGUAGE.id]).map((id) => {
      const found = language(id);
      if (!found) throw new PromptRunUnavailableError(`Unknown language "${id}".`);
      return found;
    });

    const run: PromptRun = {
      id: `prompt-run-${randomUUID()}`,
      projectId: input.projectId,
      status: "running",
      promptIds: prompts.map((prompt) => prompt.id),
      modelIds: models.map((model) => model.modelId),
      regionIds: regions.map((row) => row.id),
      languageIds: languages.map((row) => row.id),
      skippedModels: skipped,
      answersRequested: prompts.length * (models.length * regions.length * languages.length + chosenEngines.length),
      answersCompleted: 0,
      answersFailed: 0,
      startedAt: nowIso(),
      completedAt: null,
    };
    await this.store.saveRun(run);

    let stopped = false;
    for (const prompt of prompts) {
      if (stopped) break;
      for (const model of models) {
        if (stopped) break;
        for (const market of regions) {
          if (stopped) break;
          for (const tongue of languages) {
            if (this.cancelled.has(run.id)) { stopped = true; break; }
            // Written before the call so the interface can name what is in
            // flight rather than only how many are done.
            run.currentPromptText = prompt.text;
            run.currentModelId = model.modelId;
            await this.store.saveRun(run);
            const answer = await this.ask({ run, baseline, model, prompt, identity, market, tongue });
            await this.store.saveAnswer(answer);
            if (answer.status === "completed") run.answersCompleted += 1;
            else run.answersFailed += 1;
            // Progress is written as it happens, so a long run is readable while it runs.
            await this.store.saveRun(run);
          }
        }
      }
      for (const engine of chosenEngines) {
        if (stopped) break;
        if (this.cancelled.has(run.id)) { stopped = true; break; }
        run.currentPromptText = prompt.text;
        run.currentModelId = engine.id;
        await this.store.saveRun(run);
        const answer = await this.engines?.ask({ run, prompt, engine, identity });
        if (!answer) continue;
        await this.store.saveAnswer(answer);
        if (answer.status === "completed") run.answersCompleted += 1;
        else run.answersFailed += 1;
        await this.store.saveRun(run);
      }
    }

    this.cancelled.delete(run.id);
    run.currentPromptText = undefined;
    run.currentModelId = undefined;
    run.status = stopped
      ? "cancelled"
      : run.answersCompleted === 0
        ? "failed"
        : run.answersFailed > 0
          ? "partial"
          : "completed";
    run.completedAt = nowIso();
    await this.store.saveRun(run);
    return run;
  }

  /** The engines the request named, or the ones the project saved. An engine
   * the registry does not know is refused rather than silently dropped. */
  private async chosenEngines(input: StartPromptRunInput): Promise<BrowserEngine[]> {
    if (!this.engines) return [];
    const wanted = input.engineIds && input.engineIds.length
      ? input.engineIds
      : await this.engines.saved(input.projectId);
    return wanted.map((id) => {
      const found = this.engines?.lookup(id);
      if (!found) throw new PromptRunUnavailableError(`Unknown engine "${id}".`);
      return found;
    });
  }

  private async currentBaseline(projectId: string): Promise<ProductBaseline> {
    const current = currentBaseline(await this.baselines.list(projectId));
    if (!current) throw new PromptRunUnavailableError("This project has no saved configuration to run against.");
    return current;
  }

  private async ask(input: {
    run: PromptRun;
    baseline: ProductBaseline;
    model: ProductModelSnapshot;
    prompt: { id: string; topicId: string; text: string; intent: PromptIntent };
    identity: BrandIdentity;
    market: Region;
    tongue: AnswerLanguage;
  }): Promise<PromptAnswer> {
    const base = {
      id: `prompt-answer-${randomUUID()}`,
      projectId: input.run.projectId,
      runId: input.run.id,
      promptId: input.prompt.id,
      topicId: input.prompt.topicId,
      promptText: input.prompt.text,
      intent: input.prompt.intent,
      providerId: input.model.providerId,
      modelId: input.model.modelId,
      modelDisplayName: input.model.displayName,
      regionId: input.market.id,
      languageId: input.tongue.id,
      createdAt: nowIso(),
    };

    try {
      const result = await this.executor.execute({
        baseline: input.baseline,
        modelSnapshot: input.model,
        prompt: promptAnswerPrompt({
          question: input.prompt.text,
          languageInstruction: languageInstruction(input.tongue),
          audience: audienceInstruction(input.market),
        }),
        requestParameters: {
          model: input.model.modelId,
          temperature: 0,
          maxTokens: 2000,
          responseSchemaName: PROMPT_ANSWER_SCHEMA_NAME,
          responseSchemaHash: PROMPT_ANSWER_SCHEMA_HASH,
          structuredOutputTransport: "response_json_schema",
          requireProviderParameters: false,
          webSearchEnabled: input.model.webSearchMode === "provider_native",
          webSearchMode: input.model.webSearchMode,
        },
        structuredOutput: {
          name: PROMPT_ANSWER_SCHEMA_NAME,
          description: PROMPT_ANSWER_TOOL_DESCRIPTION,
          schema: promptAnswerResponseSchema,
        },
      });

      if (!result.structuredOutput) {
        return {
          ...base,
          status: "analysis_failed",
          text: result.text || "",
          mentions: [],
          citationUrls: [],
          errorCode: "no_structured_output",
          errorMessage: "The provider returned no structured payload, so nothing could be counted from it.",
          latencyMs: result.latencyMs,
        };
      }

      const parsed = parsePromptAnswerOutput(readStructuredValue(result.structuredOutput.value));
      if (parsed.analysisStatus !== "completed") {
        return {
          ...base,
          status: "analysis_failed",
          text: parsed.answer || result.text || "",
          mentions: [],
          citationUrls: [],
          errorCode: "unreadable_answer",
          errorMessage: "The answer could not be read as a completed observation, so it counts as nothing rather than as an absence of mentions.",
          latencyMs: result.latencyMs,
        };
      }

      // Decided here from the project's own identity, never from the model's
      // opinion of who it was talking about.
      const mentions: AnswerMention[] = parsed.mentions.map((row) => ({
        ...row,
        isTarget: answerNamesBrand(
          { text: "", citationUrls: row.domain ? [row.domain] : [], names: [row.name] },
          input.identity,
        ),
      }));

      const providerCitations = result.citations.map((citation) => citation.url).filter(Boolean);
      const citationUrls = [...new Set([...providerCitations, ...parsed.citationUrls])];

      return {
        ...base,
        status: "completed",
        text: parsed.answer,
        mentions,
        citationUrls,
        errorCode: null,
        errorMessage: null,
        latencyMs: result.latencyMs,
      };
    } catch (error) {
      return {
        ...base,
        status: "provider_failed",
        text: "",
        mentions: [],
        citationUrls: [],
        errorCode: "provider_error",
        errorMessage: error instanceof Error ? error.message : String(error),
        latencyMs: null,
      };
    }
  }
}
