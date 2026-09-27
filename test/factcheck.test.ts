import test from "node:test";
import assert from "node:assert/strict";
import {
  groupClaims,
  parseClaim,
  parseFactCheck,
  tally,
  type FactCheckReport,
} from "../src/product/factcheck/factcheck-schema.js";
import { factcheckPrompt, factcheckResponseSchema } from "../src/product/factcheck/factcheck-protocol.js";

function claim(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    quote: "Tradomate is free to use.",
    claim: "Tradomate is free.",
    verdict: "contradicted",
    sourceQuote: "Plans start at 499 a month.",
    detail: "The pricing page states a paid plan.",
    ...over,
  };
}

function report(answers: FactCheckReport["answers"]): FactCheckReport {
  return {
    projectId: "p", domain: "example.com", sources: ["https://example.com/"],
    answers, unreadable: 0, checkedAt: "2026-01-01T00:00:00.000Z", schemaHash: "s", promptHash: "p",
  };
}

function answer(modelDisplayName: string, claims: FactCheckReport["answers"][number]["claims"]): FactCheckReport["answers"][number] {
  return { answerId: "a", promptId: "q", promptText: "?", modelId: "m", modelDisplayName, claims };
}

test("a claim without its quote or verdict is not evidence, so it is dropped", () => {
  assert.equal(parseClaim(claim({ quote: "  " })), null);
  assert.equal(parseClaim(claim({ claim: "" })), null);
  assert.equal(parseClaim(claim({ verdict: "false" })), null, "only the three verdicts are accepted");
  assert.equal(parseClaim(claim({ verdict: "probably" })), null);
});

test("a verdict against the pages must carry the page sentence that settles it", () => {
  // Without a source quote there is nothing to check against, which is what
  // unsupported means. Reporting it as contradicted would be an accusation.
  assert.equal(parseClaim(claim({ verdict: "contradicted", sourceQuote: "" })), null);
  assert.equal(parseClaim(claim({ verdict: "supported", sourceQuote: null })), null);
  const ok = parseClaim(claim());
  assert.equal(ok?.verdict, "contradicted");
  assert.equal(ok?.sourceQuote, "Plans start at 499 a month.");
});

test("an unsupported claim reports no source rather than a stray one", () => {
  const parsed = parseClaim(claim({ verdict: "unsupported", sourceQuote: "something the model invented" }));
  assert.equal(parsed?.verdict, "unsupported");
  assert.equal(parsed?.sourceQuote, null);
});

test("an unreadable check yields no claims rather than an empty success", () => {
  assert.deepEqual(parseFactCheck({ analysisStatus: "unreadable", claims: [claim()] }), { status: "unreadable", claims: [] });
  assert.deepEqual(parseFactCheck(null), { status: "unreadable", claims: [] });
  assert.deepEqual(parseFactCheck("nope"), { status: "unreadable", claims: [] });
});

test("an answer with nothing checkable is a completed check, not a failure", () => {
  assert.deepEqual(parseFactCheck({ analysisStatus: "completed", claims: [] }), { status: "completed", claims: [] });
});

test("a malformed claim does not discard the good ones beside it", () => {
  const parsed = parseFactCheck({ analysisStatus: "completed", claims: [claim({ verdict: "nonsense" }), claim()] });
  assert.equal(parsed.status, "completed");
  assert.equal(parsed.claims.length, 1);
});

test("the same wrong claim from four models is one finding, not four", () => {
  const rows = report([
    answer("A", [parseClaim(claim())!]),
    answer("B", [parseClaim(claim({ quote: "It costs nothing." }))!]),
    answer("C", [parseClaim(claim({ claim: "Tradomate is FREE." }))!]),
  ]);
  const grouped = groupClaims(rows, "contradicted");
  assert.equal(grouped.length, 1, "the claim is grouped, not the sentence that carried it");
  assert.deepEqual(grouped[0]?.models, ["A", "B", "C"]);
  assert.equal(grouped[0]?.occurrences.length, 3);
});

test("grouping puts the most widely repeated claim first", () => {
  const rows = report([
    answer("A", [parseClaim(claim({ claim: "rare" }))!]),
    answer("B", [parseClaim(claim({ claim: "common" }))!]),
    answer("C", [parseClaim(claim({ claim: "common" }))!]),
  ]);
  assert.equal(groupClaims(rows, "contradicted")[0]?.claim, "common");
});

test("grouping never mixes verdicts", () => {
  const rows = report([answer("A", [
    parseClaim(claim({ claim: "x", verdict: "contradicted" }))!,
    parseClaim(claim({ claim: "y", verdict: "unsupported" }))!,
  ])]);
  assert.deepEqual(groupClaims(rows, "contradicted").map((row) => row.claim), ["x"]);
  assert.deepEqual(groupClaims(rows, "unsupported").map((row) => row.claim), ["y"]);
});

test("the tally counts every verdict across every answer", () => {
  const rows = report([answer("A", [
    parseClaim(claim({ verdict: "supported" }))!,
    parseClaim(claim({ claim: "b", verdict: "unsupported" }))!,
    parseClaim(claim({ claim: "c", verdict: "unsupported" }))!,
  ])]);
  assert.deepEqual(tally(rows), { supported: 1, contradicted: 0, unsupported: 2 });
});

test("the schema offers no verdict that calls a claim false", () => {
  // The product reports disagreement with the pages, never falsity.
  const properties = (factcheckResponseSchema as any).properties.claims.items.properties;
  assert.deepEqual(properties.verdict.enum, ["supported", "contradicted", "unsupported"]);
});

test("the prompt refuses the model's own knowledge as evidence", () => {
  const prompt = factcheckPrompt({ brandName: "Tradomate", domain: "example.com", answer: "A", digest: "B" });
  assert.ok(prompt.includes("The pages are the only evidence"), "the pages have to be the only authority");
  assert.ok(prompt.includes("mark it unsupported"), "an unaddressed claim has to have somewhere to go");
  assert.ok(prompt.includes("Tradomate") && prompt.includes("A") && prompt.includes("B"));
});
