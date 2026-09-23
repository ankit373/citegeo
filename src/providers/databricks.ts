import { databricksHost } from "../config/env.js";
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

// The body is the OpenAI chat shape, but the served model is a path segment
// rather than a field, so the endpoint cannot be a fixed base url.

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function databricksInvocationUrl(host: string, endpointName: string): string {
  return `${host}/serving-endpoints/${encodeURIComponent(endpointName)}/invocations`;
}

function firstChoice(raw: unknown): Record<string, unknown> | null {
  const choices = asObject(raw)?.choices;
  return Array.isArray(choices) ? asObject(choices[0]) : null;
}

function extractText(raw: unknown): string {
  const content = asObject(firstChoice(raw)?.message)?.content;
  if (typeof content === "string") return content.trim();
  // Some served models answer with the block list rather than a plain string.
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

function failureMessage(raw: unknown, status: number): string {
  const root = asObject(raw);
  const message = root?.message ?? asObject(root?.error)?.message ?? root?.error_code;
  return typeof message === "string" && message.trim()
    ? `${message.trim()} (HTTP ${status})`
    : `Databricks failed with HTTP ${status}`;
}

export class DatabricksProvider implements AnswerProvider {
  constructor(readonly definition: ProviderDefinition) {}

  async run(input: ProviderRunInput): Promise<AnswerResult> {
    const host = databricksHost();
    if (!host) throw new Error('Missing DATABRICKS_HOST for provider "databricks".');
    const url = databricksInvocationUrl(host, input.model);
    const schema = input.responseJsonSchema;
    const body = JSON.stringify({
      messages: [{ role: "user", content: input.prompt }],
      max_tokens: input.maxTokens,
      temperature: input.temperature,
      ...(schema
        ? { response_format: { type: "json_schema", json_schema: { name: schema.name, schema: schema.schema, strict: true } } }
        : {}),
    });

    const response = await postJsonWithRetry(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${input.apiKey}` },
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
      throw new ProviderRequestError({ code: "empty_answer", message: "Databricks returned an empty answer." });
    }
    const structuredOutput: ProviderStructuredOutput | undefined = schema
      ? { transport: "response_json_schema", value: text }
      : undefined;
    const citations = dedupeCitations(extractTextUrlCitations(text, 0));
    const search = makeSearchExecution({
      definition: this.definition,
      runInput: input,
      endpointKind: "official_api",
      endpointProtocol: "databricks_serving",
      endpointUrl: url,
      webQueries: [],
      citationCount: 0,
      note: input.webSearchEnabled ? "A served endpoint carries no web search tool, so nothing was searched." : undefined,
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
