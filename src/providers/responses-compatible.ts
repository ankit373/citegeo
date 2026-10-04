import { DROPPABLE_PARAMETERS, refusedParameter } from "./provider-error.js";
import type {
  AnswerProvider,
  AnswerResult,
  Citation,
  ProviderDefinition,
  ProviderEndpointKind,
  ProviderRunInput,
  TokenUsage,
} from "../core/types.js";
import { dedupeCitations, extractResponseCitations, extractTextUrlCitations } from "./citation-extractors.js";
import { postJsonWithRetry } from "./http.js";
import { makeSearchExecution } from "./search-execution.js";
import { extractResponseWebQueries } from "./web-query-extractors.js";
import { failureCodeForStatus, ProviderRequestError } from "./provider-error.js";

interface ResponsesCompatibleOptions {
  definition: ProviderDefinition;
  endpoint: string;
  endpointKind?: ProviderEndpointKind | undefined;
  extraHeaders?: Record<string, string> | undefined;
  /** Azure Responses accepts its resource key in api-key rather than Bearer. */
  authHeader?: "bearer" | string | undefined;
  webSearchToolName?: string | undefined;
  citationExtractor?: (raw: unknown) => Citation[];
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function extractTextFromContent(content: unknown): string[] {
  if (typeof content === "string") return [content];
  if (!Array.isArray(content)) return [];
  return content
    .map((part) => {
      const obj = asObject(part);
      if (typeof obj?.text === "string") return obj.text;
      if (typeof obj?.output_text === "string") return obj.output_text;
      return "";
    })
    .filter(Boolean);
}

function extractText(raw: unknown): string {
  const root = asObject(raw);
  if (typeof root?.output_text === "string" && root.output_text.trim()) return root.output_text.trim();
  const output = Array.isArray(root?.output) ? root.output : [];
  const parts: string[] = [];
  for (const item of output) {
    const obj = asObject(item);
    if (typeof obj?.text === "string") parts.push(obj.text);
    parts.push(...extractTextFromContent(obj?.content));
  }
  return parts.filter(Boolean).join("\n").trim();
}

/** A function tool's arguments on this API arrive as their own output item,
 * not inside the message, so the text extractor never sees them. */
function extractFunctionArguments(raw: unknown, name: string): string {
  const output = Array.isArray(asObject(raw)?.output) ? (asObject(raw)?.output as unknown[]) : [];
  for (const item of output) {
    const obj = asObject(item);
    if (!obj || obj.type !== "function_call") continue;
    if (typeof obj.name === "string" && obj.name !== name) continue;
    if (typeof obj.arguments === "string" && obj.arguments.trim()) return obj.arguments;
  }
  return "";
}

function extractModelVersion(raw: unknown, fallback: string): string {
  const root = asObject(raw);
  return typeof root?.model === "string" ? root.model : fallback;
}

function normalizeUsage(raw: unknown): TokenUsage | undefined {
  const usage = asObject(asObject(raw)?.usage);
  if (!usage) return undefined;
  const input = typeof usage.input_tokens === "number" ? usage.input_tokens : 0;
  const output = typeof usage.output_tokens === "number" ? usage.output_tokens : 0;
  const total = typeof usage.total_tokens === "number" ? usage.total_tokens : input + output;
  return { input, output, total };
}

export class ResponsesCompatibleProvider implements AnswerProvider {
  readonly definition: ProviderDefinition;
  private readonly endpoint: string;
  private readonly endpointKind: ProviderEndpointKind;
  private readonly extraHeaders: Record<string, string>;
  private readonly authHeader: string;
  private readonly webSearchToolName: string;
  private readonly citationExtractor: (raw: unknown) => Citation[];

  constructor(options: ResponsesCompatibleOptions) {
    this.definition = options.definition;
    this.endpoint = options.endpoint;
    this.endpointKind = options.endpointKind || "official_api";
    this.extraHeaders = options.extraHeaders || {};
    this.authHeader = options.authHeader || "bearer";
    this.webSearchToolName = options.webSearchToolName || "web_search";
    this.citationExtractor = options.citationExtractor || extractResponseCitations;
  }

  async run(input: ProviderRunInput): Promise<AnswerResult> {
    const body: Record<string, unknown> = {
      model: input.model,
      input: input.prompt,
      temperature: input.temperature,
      max_output_tokens: input.maxTokens,
    };
    const tools: unknown[] = [];
    if (input.webSearchEnabled) tools.push({ type: this.webSearchToolName });
    // This API carries a schema in its own field and a tool at the top level,
    // and asking for neither is how a grounded answer came back unreadable.
    if (input.structuredOutputTool) {
      tools.push({
        type: "function",
        name: input.structuredOutputTool.name,
        description: input.structuredOutputTool.description,
        parameters: input.structuredOutputTool.schema,
      });
    } else if (input.responseJsonSchema) {
      body.text = {
        format: {
          type: "json_schema",
          name: input.responseJsonSchema.name,
          strict: true,
          schema: input.responseJsonSchema.schema,
        },
      };
    }
    if (tools.length) body.tools = tools;

    const headers = {
      ...(this.authHeader === "bearer" ? { Authorization: `Bearer ${input.apiKey}` } : { [this.authHeader]: input.apiKey }),
      "Content-Type": "application/json",
      ...this.extraHeaders,
    };
    const post = () => postJsonWithRetry(this.endpoint, { method: "POST", headers, body: JSON.stringify(body) });

    let response = await post();
    let error = asObject(asObject(response.data)?.error);
    // A model that refuses a sampling parameter is asked again without it
    // rather than counted as a failure, and the answer says it was dropped.
    const dropped: string[] = [];
    const refused = !response.ok ? refusedParameter(error) : null;
    if (refused && DROPPABLE_PARAMETERS.has(refused) && refused in body) {
      delete body[refused];
      dropped.push(refused);
      response = await post();
      error = asObject(asObject(response.data)?.error);
    }

    const raw = response.data;
    if (!response.ok || error) {
      const message = typeof error?.message === "string" ? error.message : `Provider ${this.definition.id} failed with HTTP ${response.status}`;
      throw new ProviderRequestError({ code: failureCodeForStatus(response.status), message, status: response.status });
    }

    const toolArguments = input.structuredOutputTool
      ? extractFunctionArguments(raw, input.structuredOutputTool.name)
      : "";
    const text = toolArguments || extractText(raw);
    if (!text) throw new ProviderRequestError({ code: "empty_answer", message: `Provider ${this.definition.id} returned an empty answer.` });
    const structuredOutput = toolArguments
      ? { transport: "function_tool" as const, value: toolArguments }
      : input.responseJsonSchema
        ? { transport: "response_json_schema" as const, value: text }
        : undefined;
    const nativeCitations = this.citationExtractor(raw);
    const citations = dedupeCitations([...nativeCitations, ...extractTextUrlCitations(text, nativeCitations.length)]);
    const webQueries = extractResponseWebQueries(raw);
    const search = makeSearchExecution({
      definition: this.definition,
      runInput: input,
      endpointKind: this.endpointKind,
      endpointProtocol: "responses",
      endpointUrl: this.endpoint,
      toolName: this.webSearchToolName,
      webQueries,
      citationCount: nativeCitations.length,
      note: input.webSearchEnabled ? "Provider-native web search tool was supplied on the Responses API request." : undefined,
    });

    return {
      providerId: this.definition.id,
      providerName: this.definition.label,
      sourceType: this.definition.sourceType,
      sourceLabel: `Source: ${this.definition.label} API`,
      resultCaveat: dropped.length
        ? `${this.definition.resultCaveat} This model refused ${dropped.join(" and ")}, so the answer was taken at its own default instead of the one asked for.`
        : this.definition.resultCaveat,
      model: input.model,
      modelVersion: extractModelVersion(raw, input.model),
      text,
      structuredOutput,
      rawProviderResponse: raw,
      citations,
      webQueries,
      search,
      tokenUsage: normalizeUsage(raw),
      latencyMs: response.latencyMs,
      createdAt: new Date().toISOString(),
    };
  }
}
