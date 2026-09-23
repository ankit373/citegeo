import { watsonxApiVersion, watsonxEndpoint, watsonxProjectId } from "../config/env.js";
import type {
  AnswerProvider,
  AnswerResult,
  ProviderDefinition,
  ProviderRunInput,
  ProviderStructuredOutput,
  TokenUsage,
} from "../core/types.js";
import { dedupeCitations, extractTextUrlCitations } from "./citation-extractors.js";
import { postJsonWithRetry } from "./http.js";
import { failureCodeForStatus, ProviderRequestError } from "./provider-error.js";
import { makeSearchExecution } from "./search-execution.js";
import { watsonxAccessToken } from "./watsonx-auth.js";

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function watsonxChatUrl(endpoint: string, version: string): string {
  return `${endpoint}/ml/v1/text/chat?version=${encodeURIComponent(version)}`;
}

function firstChoice(raw: unknown): Record<string, unknown> | null {
  const choices = asObject(raw)?.choices;
  return Array.isArray(choices) ? asObject(choices[0]) : null;
}

function extractText(raw: unknown): string {
  const content = asObject(firstChoice(raw)?.message)?.content;
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      const text = asObject(block)?.text;
      return typeof text === "string" ? text : "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function normalizeUsage(raw: unknown): TokenUsage | undefined {
  const usage = asObject(asObject(raw)?.usage);
  if (!usage) return undefined;
  const input = typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : 0;
  const output = typeof usage.completion_tokens === "number" ? usage.completion_tokens : 0;
  const total = typeof usage.total_tokens === "number" ? usage.total_tokens : input + output;
  return { input, output, total };
}

// A rejected call answers with a list of faults, and the first one carries the
// message worth reporting.
function failureMessage(raw: unknown, status: number): string {
  const errors = asObject(raw)?.errors;
  const first = Array.isArray(errors) ? asObject(errors[0]) : null;
  const message = first?.message ?? asObject(raw)?.message;
  return typeof message === "string" && message.trim()
    ? `${message.trim()} (HTTP ${status})`
    : `watsonx failed with HTTP ${status}`;
}

export class WatsonxProvider implements AnswerProvider {
  constructor(readonly definition: ProviderDefinition) {}

  async run(input: ProviderRunInput): Promise<AnswerResult> {
    const endpoint = watsonxEndpoint();
    const project = watsonxProjectId();
    if (!endpoint || !project) {
      throw new Error('Missing WATSONX_REGION or WATSONX_PROJECT_ID for provider "watsonx".');
    }
    const url = watsonxChatUrl(endpoint, watsonxApiVersion());
    const schema = input.responseJsonSchema;
    const body = JSON.stringify({
      model_id: input.model,
      project_id: project,
      messages: [{ role: "user", content: input.prompt }],
      max_tokens: input.maxTokens,
      temperature: input.temperature,
      ...(schema
        ? { response_format: { type: "json_schema", json_schema: { name: schema.name, schema: schema.schema } } }
        : {}),
    });

    const token = await watsonxAccessToken(input.apiKey);
    const response = await postJsonWithRetry(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
      body,
    });

    const raw = response.data;
    if (!response.ok) {
      throw new ProviderRequestError({
        code: failureCodeForStatus(response.status),
        message: failureMessage(raw, response.status),
        status: response.status,
      });
    }

    const text = extractText(raw);
    const truncated = firstChoice(raw)?.finish_reason === "length";
    if (!text && !(input.preserveEmptyStructuredTruncation === true && schema && truncated)) {
      throw new ProviderRequestError({ code: "empty_answer", message: "watsonx returned an empty answer." });
    }
    const structuredOutput: ProviderStructuredOutput | undefined = schema
      ? { transport: "response_json_schema", value: text }
      : undefined;
    const citations = dedupeCitations(extractTextUrlCitations(text, 0));
    const search = makeSearchExecution({
      definition: this.definition,
      runInput: input,
      endpointKind: "official_api",
      endpointProtocol: "watsonx_text_chat",
      endpointUrl: url,
      webQueries: [],
      citationCount: 0,
      note: input.webSearchEnabled ? "The chat API carries no web search tool, so nothing was searched." : undefined,
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
