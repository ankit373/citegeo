// The searches an engine actually ran behind one prompt, read out of the
// archived provider response rather than inferred from a corpus.
//
// Every provider names the field differently, so each shape is read explicitly
// and an unknown shape yields nothing rather than a guess.

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pushString(into: string[], value: unknown): void {
  if (typeof value !== "string") return;
  const query = value.trim();
  if (query) into.push(query);
}

/** Reads fanout queries from whichever provider shape the response uses. */
export function extractFanoutQueries(raw: unknown): string[] {
  const found: string[] = [];
  const root = asObject(raw);
  if (!root) return [];

  // Perplexity and OpenRouter both surface a flat list.
  for (const value of asArray(root.search_queries)) pushString(found, value);

  // OpenRouter search results carry the query that produced each result.
  for (const value of asArray(root.search_results)) {
    const result = asObject(value);
    pushString(found, result?.query);
  }

  // Gemini grounding metadata, on the candidate or at the root.
  const grounding = asObject(root.groundingMetadata);
  for (const value of asArray(grounding?.webSearchQueries)) pushString(found, value);
  for (const candidate of asArray(root.candidates)) {
    const meta = asObject(asObject(candidate)?.groundingMetadata);
    for (const value of asArray(meta?.webSearchQueries)) pushString(found, value);
  }

  // OpenAI style tool calls: an action carrying the query it searched for.
  for (const value of asArray(root.output)) {
    const item = asObject(value);
    if (item?.type !== "web_search_call") continue;
    const action = asObject(item.action);
    pushString(found, action?.query);
    for (const query of asArray(action?.queries)) pushString(found, query);
  }

  // OpenRouter pipeline metadata from a server tool stage.
  const metadata = asObject(root.openrouter_metadata);
  for (const value of asArray(metadata?.pipeline)) {
    const stage = asObject(value);
    if (stage?.type !== "server_tools") continue;
    const data = asObject(stage.data);
    for (const query of asArray(data?.queries)) pushString(found, query);
    pushString(found, data?.query);
  }

  // Tool calls written into the message, where the argument is JSON text.
  for (const value of asArray(root.choices)) {
    const message = asObject(asObject(value)?.message);
    for (const call of asArray(message?.tool_calls)) {
      const fn = asObject(asObject(call)?.function);
      if (typeof fn?.arguments !== "string") continue;
      try {
        const parsed = asObject(JSON.parse(fn.arguments));
        pushString(found, parsed?.query);
        for (const query of asArray(parsed?.queries)) pushString(found, query);
      } catch {
        continue;
      }
    }
  }

  return [...new Set(found)];
}

export interface FanoutQuery {
  query: string;
  /** Answers whose provider response contained this query. */
  answers: number;
  models: string[];
}

export interface FanoutModifier {
  token: string;
  /** Distinct queries containing this token. */
  queries: number;
}

export interface FanoutAnalysis {
  answersWithFanout: number;
  answers: number;
  queries: FanoutQuery[];
  /** Words the engines added most often, measured from these queries alone. */
  modifiers: FanoutModifier[];
}

const SEPARATORS = [" ", ",", ".", ";", ":", "/", "\\", "(", ")", "[", "]", "\"", "'", "?", "!", "|", "\n", "\t"];

const STOP_WORDS = new Set([
  "a", "an", "and", "the", "for", "of", "to", "in", "on", "with", "that", "this",
  "is", "are", "be", "by", "or", "as", "at", "from", "it", "its", "what", "which",
  "how", "who", "vs", "versus",
]);

function words(value: string): string[] {
  let parts = [value.toLocaleLowerCase()];
  for (const separator of SEPARATORS) {
    const next: string[] = [];
    for (const part of parts) for (const piece of part.split(separator)) next.push(piece);
    parts = next;
  }
  return parts.map((part) => part.trim()).filter((part) => part.length >= 2 && !STOP_WORDS.has(part));
}

export function buildFanoutAnalysis(input: {
  answers: Array<{ modelId: string; raw: unknown }>;
}): FanoutAnalysis {
  const queries = new Map<string, { query: string; answers: number; models: Set<string> }>();
  let answersWithFanout = 0;

  for (const answer of input.answers) {
    const extracted = extractFanoutQueries(answer.raw);
    if (!extracted.length) continue;
    answersWithFanout += 1;
    for (const query of extracted) {
      const key = query.toLocaleLowerCase();
      const existing = queries.get(key) || { query, answers: 0, models: new Set<string>() };
      existing.answers += 1;
      existing.models.add(answer.modelId);
      queries.set(key, existing);
    }
  }

  // Measured from the captured queries, not from a published list, so the
  // modifiers reflect this category rather than search in general.
  const modifiers = new Map<string, number>();
  for (const entry of queries.values()) {
    for (const word of new Set(words(entry.query))) {
      modifiers.set(word, (modifiers.get(word) || 0) + 1);
    }
  }

  return {
    answers: input.answers.length,
    answersWithFanout,
    queries: [...queries.values()]
      .map((row) => ({ query: row.query, answers: row.answers, models: [...row.models].sort() }))
      .sort((left, right) => right.answers - left.answers || left.query.localeCompare(right.query)),
    modifiers: [...modifiers.entries()]
      .filter(([, count]) => count > 1)
      .map(([token, count]) => ({ token, queries: count }))
      .sort((left, right) => right.queries - left.queries || left.token.localeCompare(right.token)),
  };
}
