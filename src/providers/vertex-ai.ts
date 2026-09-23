import { vertexEndpoint, vertexProjectId, vertexLocation } from "../config/env.js";
import type {
  AnswerProvider,
  AnswerResult,
  ProviderDefinition,
  ProviderRunInput,
  ProviderStructuredOutput,
  TokenUsage,
} from "../core/types.js";
import { dedupeCitations, extractGeminiGroundingCitations, extractTextUrlCitations } from "./citation-extractors.js";
import { postJsonWithRetry } from "./http.js";
import { failureCodeForStatus, ProviderRequestError } from "./provider-error.js";
import { makeSearchExecution } from "./search-execution.js";
import { vertexAccessToken } from "./vertex-auth.js";
import { extractGeminiWebQueries } from "./web-query-extractors.js";

// Vertex serves several vendors' models behind one request shape, so the id
// carries the publisher: "google/gemini-2.5-pro", "anthropic/claude-sonnet-4".
const DEFAULT_PUBLISHER = "google";

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export interface VertexModelRef {
  publisher: string;
  model: string;
}

export function splitVertexModel(id: string): VertexModelRef {
  const at = id.indexOf("/");
  if (at <= 0 || at === id.length - 1) return { publisher: DEFAULT_PUBLISHER, model: id };
  return { publisher: id.slice(0, at), model: id.slice(at + 1) };
}

export function vertexGenerateUrl(endpoint: string, project: string, location: string, id: string): string {
  const { publisher, model } = splitVertexModel(id);
  return `${endpoint}/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}`
    + `/publishers/${encodeURIComponent(publisher)}/models/${encodeURIComponent(model)}:generateContent`;
}

function extractText(raw: unknown): string {
  const candidates = Array.isArray(asObject(raw)?.candidates) ? asObject(raw)?.candidates as unknown[] : [];
  const parts = Array.isArray(asObject(asObject(candidates[0])?.content)?.parts)
    ? asObject(asObject(candidates[0])?.content)?.parts as unknown[]
    : [];
  return parts
    .map((part) => {
      const text = asObject(part)?.text;
      return typeof text === "string" ? text : "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function normalizeUsage(raw: unknown): TokenUsage | undefined {
  const usage = asObject(asObject(raw)?.usageMetadata);
  if (!usage) return undefined;
  const input = typeof usage.promptTokenCount === "number" ? usage.promptTokenCount : 0;
  const output = typeof usage.candidatesTokenCount === "number" ? usage.candidatesTokenCount : 0;
  const total = typeof usage.totalTokenCount === "number" ? usage.totalTokenCount : input + output;
  return { input, output, total };
}

function truncated(raw: unknown): boolean {
  const candidates = Array.isArray(asObject(raw)?.candidates) ? asObject(raw)?.candidates as unknown[] : [];
  return asObject(candidates[0])?.finishReason === "MAX_TOKENS";
}

// Vertex answers a failed call with either a bare object or a one-element
// array, and only the second shape carries the message worth reporting.
function failureMessage(raw: unknown, status: number): string {
  const body = Array.isArray(raw) ? raw[0] : raw;
  const message = asObject(asObject(body)?.error)?.message;
  return typeof message === "string" && message.trim()
    ? `${message.trim()} (HTTP ${status})`
    : `Vertex AI failed with HTTP ${status}`;
}

export class VertexAIProvider implements AnswerProvider {
  constructor(readonly definition: ProviderDefinition) {}

  async run(input: ProviderRunInput): Promise<AnswerResult> {
    const endpoint = vertexEndpoint();
    const project = vertexProjectId();
    const location = vertexLocation();
    if (!endpoint || !project || !location) {
      throw new Error('Missing GOOGLE_VERTEX_PROJECT_ID or GOOGLE_VERTEX_LOCATION for provider "vertex-ai".');
    }
    const url = vertexGenerateUrl(endpoint, project, location, input.model);
    const schema = input.responseJsonSchema;
    const body: Record<string, unknown> = {
      contents: [{ role: "user", parts: [{ text: input.prompt }] }],
      generationConfig: {
        temperature: input.temperature,
        maxOutputTokens: input.maxTokens,
        ...(schema ? { responseMimeType: "application/json", responseSchema: schema.schema } : {}),
      },
    };
    // Grounding and a response schema are mutually exclusive on Vertex, so a
    // schema wins: the caller asked for a shape, not for sources.
    if (input.webSearchEnabled && !schema) body.tools = [{ googleSearch: {} }];

    const token = await vertexAccessToken();
    const response = await postJsonWithRetry(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
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
    if (!text && !(input.preserveEmptyStructuredTruncation === true && schema && truncated(raw))) {
      throw new ProviderRequestError({ code: "empty_answer", message: "Vertex AI returned an empty answer." });
    }
    const structuredOutput: ProviderStructuredOutput | undefined = schema
      ? { transport: "response_json_schema", value: text }
      : undefined;
    const grounded = schema ? [] : extractGeminiGroundingCitations(raw);
    const citations = dedupeCitations([...grounded, ...extractTextUrlCitations(text, grounded.length)]);
    const webQueries = input.webSearchEnabled && !schema ? extractGeminiWebQueries(raw) : [];
    const search = makeSearchExecution({
      definition: this.definition,
      runInput: input,
      endpointKind: "official_api",
      endpointProtocol: "vertex_generate_content",
      endpointUrl: url,
      toolName: input.webSearchEnabled && !schema ? "google_search" : undefined,
      webQueries,
      citationCount: grounded.length,
      note: input.webSearchEnabled && schema
        ? "A response schema was requested, and Vertex rejects grounding alongside one, so nothing was searched."
        : input.webSearchEnabled
          ? "Provider-native Google Search grounding tool was supplied on the Vertex request."
          : undefined,
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
      webQueries,
      search,
      tokenUsage: normalizeUsage(raw),
      latencyMs: response.latencyMs,
      createdAt: new Date().toISOString(),
    };
  }
}
