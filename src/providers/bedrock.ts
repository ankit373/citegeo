import { bedrockRuntimeEndpoint } from "../config/env.js";
import type {
  AnswerProvider,
  AnswerResult,
  ProviderDefinition,
  ProviderRunInput,
  ProviderStructuredOutput,
  TokenUsage,
} from "../core/types.js";
import { bedrockCredentials, signBedrockRequest } from "./bedrock-signing.js";
import { dedupeCitations, extractTextUrlCitations } from "./citation-extractors.js";
import { postJsonWithRetry } from "./http.js";
import { failureCodeForStatus, ProviderRequestError } from "./provider-error.js";
import { makeSearchExecution } from "./search-execution.js";

// Converse is the one request shape every model family on Bedrock accepts.
// InvokeModel takes each vendor's own body, which is eight parsers, not one.

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function contentBlocks(raw: unknown): unknown[] {
  const message = asObject(asObject(asObject(raw)?.output)?.message);
  return Array.isArray(message?.content) ? message.content : [];
}

function extractText(raw: unknown): string {
  return contentBlocks(raw)
    .map((block) => {
      const text = asObject(block)?.text;
      return typeof text === "string" ? text : "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractToolInput(raw: unknown, toolName: string): unknown {
  for (const block of contentBlocks(raw)) {
    const use = asObject(asObject(block)?.toolUse);
    if (use?.name === toolName && use.input !== undefined) return use.input;
  }
  return undefined;
}

function normalizeUsage(raw: unknown): TokenUsage | undefined {
  const usage = asObject(asObject(raw)?.usage);
  if (!usage) return undefined;
  const input = typeof usage.inputTokens === "number" ? usage.inputTokens : 0;
  const output = typeof usage.outputTokens === "number" ? usage.outputTokens : 0;
  const total = typeof usage.totalTokens === "number" ? usage.totalTokens : input + output;
  return { input, output, total };
}

function failureMessage(raw: unknown, status: number): string {
  const root = asObject(raw);
  const message = root?.message ?? root?.Message;
  return typeof message === "string" && message.trim()
    ? `${message.trim()} (HTTP ${status})`
    : `Amazon Bedrock failed with HTTP ${status}`;
}

interface OutputSchema {
  name: string;
  description: string;
  schema: Record<string, unknown>;
}

/**
 * Converse has no response-format field, so a schema is asked for as a tool the
 * model is forced to call. The transport says so rather than claiming otherwise.
 */
function outputSchema(input: ProviderRunInput): OutputSchema | undefined {
  if (input.structuredOutputTool) return input.structuredOutputTool;
  if (!input.responseJsonSchema) return undefined;
  return {
    name: input.responseJsonSchema.name,
    description: "Return the answer as one call to this tool.",
    schema: input.responseJsonSchema.schema,
  };
}

/** A region-scoped model id has to be escaped: Bedrock ids carry a colon, and
 * an inference-profile ARN carries slashes the route would otherwise split. */
export function bedrockConverseUrl(runtimeEndpoint: string, model: string): URL {
  return new URL(`${runtimeEndpoint}/model/${encodeURIComponent(model)}/converse`);
}

export class BedrockProvider implements AnswerProvider {
  constructor(readonly definition: ProviderDefinition) {}

  async run(input: ProviderRunInput): Promise<AnswerResult> {
    const runtime = bedrockRuntimeEndpoint();
    if (!runtime) throw new Error('Missing AWS_BEDROCK_REGION for provider "bedrock".');
    const credentials = bedrockCredentials(input.apiKey);
    const url = bedrockConverseUrl(runtime, input.model);
    const tool = outputSchema(input);
    const body = JSON.stringify({
      messages: [{ role: "user", content: [{ text: input.prompt }] }],
      inferenceConfig: { maxTokens: input.maxTokens, temperature: input.temperature },
      ...(tool
        ? {
            toolConfig: {
              tools: [{ toolSpec: { name: tool.name, description: tool.description, inputSchema: { json: tool.schema } } }],
              toolChoice: { tool: { name: tool.name } },
            },
          }
        : {}),
    });

    const headers = signBedrockRequest({ method: "POST", url, body, service: "bedrock-runtime", credentials });
    const response = await postJsonWithRetry(url.toString(), { method: "POST", headers, body });
    const raw = response.data;
    if (!response.ok) {
      throw new ProviderRequestError({
        code: failureCodeForStatus(response.status),
        message: failureMessage(raw, response.status),
        status: response.status,
      });
    }

    const toolInput = tool ? extractToolInput(raw, tool.name) : undefined;
    const text = toolInput === undefined ? extractText(raw) : JSON.stringify(toolInput);
    // Keep an empty token-limited answer only when the caller retries it; everyone else gets empty_answer.
    const truncated = asObject(raw)?.stopReason === "max_tokens";
    if (!text && !(input.preserveEmptyStructuredTruncation === true && tool && truncated)) {
      throw new ProviderRequestError({ code: "empty_answer", message: "Amazon Bedrock returned an empty answer." });
    }
    const structuredOutput: ProviderStructuredOutput | undefined = tool
      ? { transport: "function_tool", value: toolInput === undefined ? text : toolInput }
      : undefined;
    const citations = dedupeCitations(extractTextUrlCitations(text, 0));
    const search = makeSearchExecution({
      definition: this.definition,
      runInput: input,
      endpointKind: "official_api",
      endpointProtocol: "bedrock_converse",
      endpointUrl: url.toString(),
      webQueries: [],
      citationCount: 0,
      note: input.webSearchEnabled ? "Bedrock Converse carries no web search tool, so nothing was searched." : undefined,
    });

    return {
      providerId: this.definition.id,
      providerName: this.definition.label,
      sourceType: this.definition.sourceType,
      sourceLabel: `Source: ${this.definition.label} API`,
      resultCaveat: this.definition.resultCaveat,
      model: input.model,
      modelVersion: input.model,
      text,
      structuredOutput,
      rawProviderResponse: raw,
      citations,
      webQueries: [],
      search,
      tokenUsage: normalizeUsage(raw),
      latencyMs: response.latencyMs,
      createdAt: new Date().toISOString(),
    };
  }
}
