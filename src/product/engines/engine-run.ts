import { randomUUID } from "node:crypto";
import { answerNamesBrand, type BrandIdentity } from "../topics/brand-identity.js";
import { askEngine, type BrowserEngine, type EngineOutcome, type EngineRunOptions } from "./browser-engine.js";
import { engineAnalysisPrompt, parseEngineAnalysisOutput, ENGINE_ANALYSIS_SCHEMA_NAME, ENGINE_ANALYSIS_TOOL_DESCRIPTION, engineAnalysisResponseSchema } from "./engine-answer-protocol.js";
import { BROWSER_SOURCE_ID } from "../configuration/provider-id.js";
import type { AnswerMention, PromptAnswer } from "../topics/prompt-run-schema.js";
import type { StructuredAsk } from "../topics/topic-service.js";

// A browser engine is the only answer source here that is web-grounded by
// construction, so it is where citations come from at all.

export interface EngineAskInput {
  projectId: string;
  runId: string;
  prompt: { id: string; topicId: string; text: string; intent: PromptAnswer["intent"] };
  engine: BrowserEngine;
  identity: BrandIdentity;
  regionId: string;
  languageId: string;
  ask: StructuredAsk;
  options?: EngineRunOptions | undefined;
  /** How the surface is driven. The default attaches to the browser; a caller
   * that already holds an outcome supplies it instead of reaching for one. */
  drive?: ((engine: BrowserEngine, question: string, options: EngineRunOptions) => Promise<EngineOutcome>) | undefined;
}

function base(input: EngineAskInput) {
  return {
    id: `prompt-answer-${randomUUID()}`,
    projectId: input.projectId,
    runId: input.runId,
    promptId: input.prompt.id,
    topicId: input.prompt.topicId,
    promptText: input.prompt.text,
    intent: input.prompt.intent,
    providerId: BROWSER_SOURCE_ID as PromptAnswer["providerId"],
    modelId: input.engine.id,
    modelDisplayName: input.engine.label,
    regionId: input.regionId,
    languageId: input.languageId,
    createdAt: new Date().toISOString(),
  };
}

/** The brand is marked from its own identity, not from the reader's opinion of
 * which name is the target, which it is told nothing about. */
function marked(mentions: AnswerMention[], identity: BrandIdentity): AnswerMention[] {
  return mentions.map((mention) => ({
    ...mention,
    isTarget: answerNamesBrand(
      { text: "", citationUrls: mention.domain ? [mention.domain] : [], names: [mention.name] },
      identity,
    ),
  }));
}

export async function askBrowserEngine(input: EngineAskInput): Promise<PromptAnswer> {
  const started = Date.now();
  const drive = input.drive || askEngine;
  const outcome = await drive(input.engine, input.prompt.text, input.options || {});
  const shell = base(input);

  if (outcome.state !== "answered") {
    return {
      ...shell,
      // Four outcomes, three of them not an answer. None of them is an answer
      // that named nobody, which is what an empty row would claim.
      status: outcome.state === "no_answer" ? "no_answer" : "provider_failed",
      text: "",
      mentions: [],
      citationUrls: [],
      errorCode: outcome.state,
      errorMessage: outcome.detail,
      latencyMs: Date.now() - started,
    };
  }

  const answer = outcome.answer;
  let analysis;
  try {
    analysis = parseEngineAnalysisOutput(await input.ask({
      projectId: input.projectId,
      prompt: engineAnalysisPrompt({ question: input.prompt.text, answer: answer.text }),
      schemaName: ENGINE_ANALYSIS_SCHEMA_NAME,
      schemaDescription: ENGINE_ANALYSIS_TOOL_DESCRIPTION,
      schema: engineAnalysisResponseSchema,
    }));
  } catch (error) {
    // The answer is real and archived; only the reading of it failed.
    return {
      ...shell,
      status: "analysis_failed",
      text: answer.text,
      mentions: [],
      citationUrls: answer.citationUrls,
      errorCode: "analysis_failed",
      errorMessage: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - started,
    };
  }

  if (analysis.analysisStatus !== "completed") {
    return {
      ...shell,
      status: "analysis_failed",
      text: answer.text,
      mentions: [],
      citationUrls: answer.citationUrls,
      errorCode: "analysis_unknown",
      errorMessage: "The reader could not report on this answer.",
      latencyMs: Date.now() - started,
    };
  }

  return {
    ...shell,
    status: "completed",
    text: answer.text,
    mentions: marked(analysis.mentions.map((row) => ({ ...row, isTarget: false })), input.identity),
    citationUrls: answer.citationUrls,
    errorCode: null,
    errorMessage: null,
    latencyMs: Date.now() - started,
  };
}
