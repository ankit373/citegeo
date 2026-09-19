import test from "node:test";
import assert from "node:assert/strict";
import { buildFanoutAnalysis, extractFanoutQueries } from "../src/product/insights/query-fanout.js";

test("a flat search_queries list is read", () => {
  assert.deepEqual(extractFanoutQueries({ search_queries: ["best stock screener india", "nse screener 2026"] }),
    ["best stock screener india", "nse screener 2026"]);
});

test("OpenRouter search results contribute the query that produced them", () => {
  assert.deepEqual(extractFanoutQueries({ search_results: [{ query: "tradomate review", url: "https://x" }] }),
    ["tradomate review"]);
});

test("Gemini grounding metadata is read from the candidate", () => {
  const raw = { candidates: [{ groundingMetadata: { webSearchQueries: ["indian equity screener"] } }] };
  assert.deepEqual(extractFanoutQueries(raw), ["indian equity screener"]);
});

test("an OpenAI web search call contributes its action query", () => {
  const raw = { output: [{ type: "web_search_call", action: { query: "nse bse screener" } }] };
  assert.deepEqual(extractFanoutQueries(raw), ["nse bse screener"]);
});

test("a tool call argument encoded as JSON text is parsed", () => {
  const raw = { choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify({ query: "top screeners" }) } }] } }] };
  assert.deepEqual(extractFanoutQueries(raw), ["top screeners"]);
});

test("malformed tool call arguments are skipped, not thrown", () => {
  const raw = { choices: [{ message: { tool_calls: [{ function: { arguments: "{ not json" } }] } }] };
  assert.deepEqual(extractFanoutQueries(raw), []);
});

test("an unknown response shape yields nothing rather than a guess", () => {
  assert.deepEqual(extractFanoutQueries({ something: "else" }), []);
  assert.deepEqual(extractFanoutQueries(null), []);
  assert.deepEqual(extractFanoutQueries("a string"), []);
});

test("the same query from two sources in one response is returned once", () => {
  const raw = { search_queries: ["best screener"], search_results: [{ query: "best screener" }] };
  assert.deepEqual(extractFanoutQueries(raw), ["best screener"]);
});

test("queries are ranked by how many answers produced them", () => {
  const analysis = buildFanoutAnalysis({
    answers: [
      { modelId: "a", raw: { search_queries: ["best stock screener", "nse tools"] } },
      { modelId: "b", raw: { search_queries: ["best stock screener"] } },
      { modelId: "c", raw: {} },
    ],
  });
  assert.equal(analysis.answers, 3);
  assert.equal(analysis.answersWithFanout, 2);
  assert.equal(analysis.queries[0]?.query, "best stock screener");
  assert.equal(analysis.queries[0]?.answers, 2);
  assert.deepEqual(analysis.queries[0]?.models, ["a", "b"]);
});

test("modifiers are measured from the captured queries, and singletons are dropped", () => {
  const analysis = buildFanoutAnalysis({
    answers: [
      { modelId: "a", raw: { search_queries: ["best screener 2026"] } },
      { modelId: "b", raw: { search_queries: ["best charting tool"] } },
    ],
  });
  const tokens = analysis.modifiers.map((row) => row.token);
  assert.ok(tokens.includes("best"), "best appears in two distinct queries");
  assert.equal(tokens.includes("2026"), false, "a token in one query only is not a pattern");
});

test("case differences do not create two entries for one query", () => {
  const analysis = buildFanoutAnalysis({
    answers: [
      { modelId: "a", raw: { search_queries: ["Best Screener"] } },
      { modelId: "b", raw: { search_queries: ["best screener"] } },
    ],
  });
  assert.equal(analysis.queries.length, 1);
  assert.equal(analysis.queries[0]?.answers, 2);
});
