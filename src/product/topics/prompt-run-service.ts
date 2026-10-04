import { randomUUID } from "node:crypto";
import type { AnswerResult } from "../../core/types.js";
import type { StructuredAsk } from "./topic-service.js";
import {
  engineAnalysisPrompt,
  engineAnalysisResponseSchema,
  parseEngineAnalysisOutput,
  ENGINE_ANALYSIS_SCHEMA_NAME,
  ENGINE_ANALYSIS_TOOL_DESCRIPTION,
} from "../engines/engine-answer-protocol.js";
import { modelsBlockedByAccount, type ProviderStatus } from "../configuration/provider-status.js";
import type { ProductBaseline, ProductModelSnapshot } from "../configuration/baseline-schema.js";
import type { ProductBaselineService } from "../configuration/baseline-service.js";
import type { ProductModelCatalog } from "../configuration/model-selection-schema.js";
import type { ProductProjectService } from "../projects/project-service.js";
import type { RecognitionAnswerExecutor } from "../recognition/recognition-service.js";
import { corroborateMentions } from "./mention-corroboration.js";
import { answerNamesBrand, type BrandIdentity } from "./brand-identity.js";
import {
  parsePromptAnswerOutput,
  plainAnswerPrompt,
  promptAnswerPrompt,
  promptAnswerResponseSchema,
  PROMPT_ANSWER_SCHEMA_HASH,
  PROMPT_ANSWER_SCHEMA_NAME,
  PROMPT_ANSWER_TOOL_DESCRIPTION,
} from "./prompt-answer-protocol.js";
import { countsTowardProgress, isLive, type AnswerMention, type PromptAnswer, type PromptRun } from "./prompt-run-schema.js";
import type { PromptRunFileStore } from "./prompt-run-store.js";
import { readStructuredValue } from "./structured-value.js";
import { activePrompts, type PromptIntent } from "./topic-schema.js";
import { audienceInstruction, GLOBAL_REGION, region, type Region } from "./region.js";
import { asRegion, trackedLocationFrom, type LocationService } from "./location.js";
import { DEFAULT_LANGUAGE, language, languageInstruction, plainLanguageInstruction, type AnswerLanguage } from "./language.js";
import { currentBaseline } from "../configuration/current-baseline.js";
import type { TopicService } from "./topic-service.js";
import type { BrowserEngine } from "../engines/browser-engine.js";
import type { Prompt } from "./topic-schema.js";
import { NO_PERSONA, personaFrom, personaInstruction, type Persona, type PersonaService } from "./persona.js";

/** Enough of the provider's own queries to see what it went looking for,
 * without turning every answer record into a search log. */
const SEARCH_QUERIES_KEPT = 8;

/** Asking the same question again is the only way to see how much of an answer
 * is the question and how much is the day. Each one is a paid call, so the
 * ceiling is low and the default is the single pass every run used to be. */
export const MAX_REPETITIONS = 10;

function repetitionsFrom(value: number | undefined): number {
  if (value === undefined) return 1;
  if (!Number.isInteger(value) || value < 1) {
    throw new PromptRunUnavailableError("Repetitions must be a whole number of at least one.");
  }
  if (value > MAX_REPETITIONS) {
    throw new PromptRunUnavailableError(`Repetitions are capped at ${MAX_REPETITIONS}, because each one is another paid call for every question and model.`);
  }
  return value;
}

export class PromptRunUnavailableError extends Error {}

function nowIso(): string {
  return new Date().toISOString();
}

export interface StartPromptRunInput {
  projectId: string;
  /** How many times to ask each question of each model. One when omitted, so
   * a run asked before this existed and one asked now are the same run. */
  repetitions?: number | undefined;
  /** Limits the run to these prompts. Every active prompt when omitted. */
  promptIds?: string[] | undefined;
  /** Markets to ask in. The global region alone when omitted. */
  regionIds?: string[] | undefined;
  /** Languages to ask in. English alone when omitted. */
  languageIds?: string[] | undefined;
  /** Personas to ask on behalf of. Nobody stated when omitted, which is how
   * every run before personas existed was asked. */
  personaIds?: string[] | undefined;
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
    private readonly personas?: PersonaService | undefined,
    private readonly locations?: LocationService | undefined,
    /** What each provider can run right now. Absent in a test, which blocks
     * nothing, because an unknown account is not an empty one. */
    private readonly providerStatus?: (() => Promise<ProviderStatus[]>) | undefined,
    /** Reads a grounded answer back into mentions. Absent leaves the grounded
     * path on one call, which measures the JSON instead of the answer. */
    private readonly read?: StructuredAsk | undefined,
  ) {}

  /** Splits the saved models into the ones the catalogue still says can answer
   * and the ones it does not. A catalogue that cannot be read blocks nothing. */
  private async usable(models: ProductModelSnapshot[]): Promise<{ run: ProductModelSnapshot[]; skipped: Array<{ modelId: string; reason: string }> }> {
    const skipped: Array<{ modelId: string; reason: string }> = [];
    let kept = models;
    if (this.catalog) {
      let current;
      try {
        current = await this.catalog.list();
      } catch {
        current = null;
      }
      if (current) {
        const listed = current;
        kept = [];
        for (const model of models) {
          const row = listed.find((item) => item.providerId === model.providerId && item.modelId === model.modelId);
          if (row && !row.available) skipped.push({ modelId: model.modelId, reason: row.unavailableReason || "The catalogue reports it as unavailable." });
          else kept.push(model);
        }
      }
    }
    // The catalogue says what exists. The account says what can be paid for,
    // and asking a model the account cannot pay for files one error a question.
    if (this.providerStatus) {
      try {
        const statuses = await this.providerStatus();
        const blocked = modelsBlockedByAccount(kept.map((model) => ({ providerId: model.providerId, modelId: model.modelId })), statuses);
        if (blocked.length) {
          const ids = new Set(blocked.map((row) => row.modelId));
          skipped.push(...blocked);
          kept = kept.filter((model) => !ids.has(model.modelId));
        }
      } catch {
        // An account that cannot be read blocks nothing, the same rule the
        // catalogue follows, because unknown is not empty.
      }
    }
    return { run: kept, skipped };
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


    const repetitions = repetitionsFrom(input.repetitions);
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
    // A location this project defined is a market as far as the run is
    // concerned, so both are resolved here and nothing downstream has to care.
    const locationSet = this.locations ? await this.locations.get(input.projectId) : null;
    const regions: Region[] = (input.regionIds && input.regionIds.length ? input.regionIds : [GLOBAL_REGION.id]).map((id) => {
      const found = region(id);
      if (found) return found;
      const place = trackedLocationFrom(locationSet, id);
      if (place) return asRegion(place);
      throw new PromptRunUnavailableError(`Unknown market "${id}".`);
    });

    const languages: AnswerLanguage[] = (input.languageIds && input.languageIds.length ? input.languageIds : [DEFAULT_LANGUAGE.id]).map((id) => {
      const found = language(id);
      if (!found) throw new PromptRunUnavailableError(`Unknown language "${id}".`);
      return found;
    });

    // An unknown persona is refused rather than dropped, or the run would
    // cover fewer audiences than it was asked for and never say so.
    const personaSet = this.personas ? await this.personas.get(input.projectId) : null;
    const personas: Persona[] = (input.personaIds && input.personaIds.length ? input.personaIds : [NO_PERSONA.id]).map((id) => {
      const found = personaFrom(personaSet, id);
      if (!found) throw new PromptRunUnavailableError(`Unknown persona "${id}".`);
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
      personaIds: personas.map((row) => row.id),
      skippedModels: skipped,
      repetitions,
      answersRequested: repetitions * prompts.length * (models.length * regions.length * languages.length * personas.length + chosenEngines.length),
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
            if (stopped) break;
            for (const who of personas) {
              if (stopped) break;
              for (let pass = 1; pass <= repetitions; pass += 1) {
                if (this.cancelled.has(run.id)) { stopped = true; break; }
                // Written before the call so the interface can name what is in
                // flight rather than only how many are done.
                run.currentPromptText = prompt.text;
                run.currentModelId = model.modelId;
                await this.store.saveRun(run);
                const answer = await this.ask({ run, baseline, model, prompt, identity, market, tongue, who });
                await this.store.saveAnswer({ ...answer, repetition: pass });
                if (countsTowardProgress(answer)) run.answersCompleted += 1;
                else run.answersFailed += 1;
                // Progress is written as it happens, so a long run is readable while it runs.
                await this.store.saveRun(run);
              }
            }
          }
        }
      }
      for (const engine of chosenEngines) {
        if (stopped) break;
        for (let pass = 1; pass <= repetitions; pass += 1) {
          if (this.cancelled.has(run.id)) { stopped = true; break; }
          run.currentPromptText = prompt.text;
          run.currentModelId = engine.id;
          await this.store.saveRun(run);
          const answer = await this.engines?.ask({ run, prompt, engine, identity });
          if (!answer) continue;
          await this.store.saveAnswer({ ...answer, repetition: pass });
          if (countsTowardProgress(answer)) run.answersCompleted += 1;
          else run.answersFailed += 1;
          await this.store.saveRun(run);
        }
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

  /** A grounded answer and its sources come back as prose, so the mentions are
   * read from that prose, the same two steps a browser surface already takes. */
  private async readGrounded(
    base: Omit<PromptAnswer, "status" | "text" | "mentions" | "citationUrls" | "errorCode" | "errorMessage" | "latencyMs">,
    input: { prompt: { text: string }; identity: BrandIdentity; run: PromptRun },
    result: AnswerResult,
  ): Promise<PromptAnswer> {
    const providerCitations = result.citations.map((citation) => citation.url).filter(Boolean);
    const citationUrls = [...new Set(providerCitations)];
    const search = result.search
      ? {
          requested: result.search.requested,
          used: result.search.used,
          usedMode: result.search.usedMode,
          queries: result.search.webQueries.slice(0, SEARCH_QUERIES_KEPT),
        }
      : undefined;
    const shell = {
      ...base,
      ...(result.modelVersion ? { modelVersion: result.modelVersion } : {}),
      text: result.text,
      citationUrls,
      ...(search ? { search } : {}),
      latencyMs: result.latencyMs,
    };
    if (!result.text.trim()) {
      return { ...shell, status: "no_answer", mentions: [], errorCode: "empty_answer", errorMessage: "The provider searched and returned no answer to read.", };
    }
    let analysis;
    try {
      analysis = parseEngineAnalysisOutput(await (this.read as StructuredAsk)({
        projectId: input.run.projectId,
        prompt: engineAnalysisPrompt({ question: input.prompt.text, answer: result.text }),
        schemaName: ENGINE_ANALYSIS_SCHEMA_NAME,
        schemaDescription: ENGINE_ANALYSIS_TOOL_DESCRIPTION,
        schema: engineAnalysisResponseSchema,
      }));
    } catch (error) {
      // The answer and its sources are real and kept. Only the reading failed.
      return {
        ...shell,
        status: "analysis_failed",
        mentions: [],
        errorCode: "analysis_failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
    if (analysis.analysisStatus !== "completed") {
      return { ...shell, status: "analysis_failed", mentions: [], errorCode: "unreadable_answer", errorMessage: "The reader could not finish reading this answer, so it counts as nothing rather than as an absence of mentions." };
    }
    const reported: AnswerMention[] = analysis.mentions.map((row) => ({
      ...row,
      isTarget: answerNamesBrand({ text: "", citationUrls: row.domain ? [row.domain] : [], names: [row.name] }, input.identity),
    }));
    return {
      ...shell,
      status: "completed",
      mentions: corroborateMentions({ answer: result.text, mentions: reported }),
      errorCode: null,
      errorMessage: null,
    };
  }

  private async ask(input: {
    run: PromptRun;
    baseline: ProductBaseline;
    model: ProductModelSnapshot;
    prompt: { id: string; topicId: string; text: string; intent: PromptIntent };
    identity: BrandIdentity;
    market: Region;
    tongue: AnswerLanguage;
    who: Persona;
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
      personaId: input.who.id,
      createdAt: nowIso(),
    };

    // A grounded provider drops its source annotations the moment a schema is
    // attached, so the answer is asked for plainly and then read in a step.
    const grounded = input.model.webSearchMode === "provider_native" && Boolean(this.read);
    try {
      const result = await this.executor.execute({
        baseline: input.baseline,
        modelSnapshot: input.model,
        ...(grounded ? { unstructured: true } : {}),
        prompt: (grounded ? plainAnswerPrompt : promptAnswerPrompt)({
          question: input.prompt.text,
          languageInstruction: grounded ? plainLanguageInstruction(input.tongue) : languageInstruction(input.tongue),
          audience: [audienceInstruction(input.market), personaInstruction(input.who)].filter(Boolean).join(" "),
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

      if (grounded) return await this.readGrounded(base, input, result);
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
      const reported: AnswerMention[] = parsed.mentions.map((row) => ({
        ...row,
        isTarget: answerNamesBrand(
          { text: "", citationUrls: row.domain ? [row.domain] : [], names: [row.name] },
          input.identity,
        ),
      }));
      // One call wrote the answer and reported what it named, so the positions
      // are recounted from the text instead of taken on the model's word.
      const mentions = corroborateMentions({ answer: parsed.answer, mentions: reported });

      const providerCitations = result.citations.map((citation) => citation.url).filter(Boolean);
      const citationUrls = [...new Set([...providerCitations, ...parsed.citationUrls])];
      // The provider already says whether it searched. Inferring it from
      // whether a citation came back cannot tell a search that found nothing
      // from no search at all, and that guess was the wider half of the band.
      const search = result.search
        ? {
            requested: result.search.requested,
            used: result.search.used,
            usedMode: result.search.usedMode,
            queries: result.search.webQueries.slice(0, SEARCH_QUERIES_KEPT),
          }
        : undefined;

      return {
        ...base,
        // What the provider says it ran, not what was asked for. Some only
        // echo the request back, which the reading has to tell apart.
        ...(result.modelVersion ? { modelVersion: result.modelVersion } : {}),
        status: "completed",
        text: parsed.answer,
        mentions,
        citationUrls,
        ...(search ? { search } : {}),
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
