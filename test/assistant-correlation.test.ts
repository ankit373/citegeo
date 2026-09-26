import test from "node:test";
import assert from "node:assert/strict";
import { CORRELATION_CAVEAT, familyOf, linkAssistants, quadrantFor } from "../src/product/topics/assistant-correlation.js";

test("a model rented through a cloud is still its vendor's model", () => {
  assert.equal(familyOf("openai"), "chatgpt");
  assert.equal(familyOf("azure-openai"), "chatgpt");
  assert.equal(familyOf("anthropic"), "claude");
  assert.equal(familyOf("ChatGPT"), "chatgpt");
  assert.equal(familyOf("Perplexity"), "perplexity");
});

test("something unrecognised keeps its own name rather than joining the wrong family", () => {
  assert.equal(familyOf("some-new-thing"), "some-new-thing");
});

test("named with nobody arriving is a different finding from arrivals nothing explains", () => {
  assert.equal(quadrantFor(62, 10, 40), "working");
  assert.equal(quadrantFor(62, 10, 0), "named_no_arrivals");
  assert.equal(quadrantFor(0, 10, 40), "arrivals_not_named");
  assert.equal(quadrantFor(0, 10, 0), "absent");
});

test("nothing asked and nobody arriving is not measurable, not absent", () => {
  // Absent means asked and not named. This is neither asked nor arrived, and
  // calling it absent would invent a finding.
  assert.equal(quadrantFor(null, 0, 0), "not_measurable");
  assert.equal(quadrantFor(null, 5, 0), "not_measurable");
});

test("arrivals from an assistant nothing here asked are reported, not dropped", () => {
  const rows = linkAssistants({
    visibility: [],
    arrivals: [{ source: "ChatGPT", sessions: 68, engaged: 49 }],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.assistant, "chatgpt");
  assert.equal(rows[0]!.quadrant, "arrivals_not_named");
  assert.equal(rows[0]!.sessions, 68);
});

test("several models answering for one assistant weight by what each contributed", () => {
  // A model that answered twice should not count as much as one that answered
  // twenty times, which a flat mean would let it do.
  const rows = linkAssistants({
    visibility: [
      { providerId: "openai", displayName: "a", score: 80, answers: 20 },
      { providerId: "azure-openai", displayName: "b", score: 10, answers: 2 },
    ],
    arrivals: [{ source: "ChatGPT", sessions: 5, engaged: 3 }],
  });
  assert.equal(rows[0]!.assistant, "chatgpt");
  assert.equal(rows[0]!.answers, 22);
  assert.equal(rows[0]!.score, 73.6);
  assert.equal(rows[0]!.quadrant, "working");
});

test("rows come back busiest first, so the biggest disagreement is on top", () => {
  const rows = linkAssistants({
    visibility: [{ providerId: "gemini", displayName: "g", score: 50, answers: 4 }],
    arrivals: [{ source: "Claude", sessions: 9, engaged: 4 }, { source: "Gemini", sessions: 1, engaged: 1 }],
  });
  assert.deepEqual(rows.map((row) => row.assistant), ["claude", "gemini"]);
});

test("the caveat says the two are different measurements", () => {
  assert.ok(CORRELATION_CAVEAT.includes("provider API"));
  assert.ok(CORRELATION_CAVEAT.includes("neither explains the other"));
});
