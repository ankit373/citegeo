import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { indexCorpus, meaningfulTerms, openingQuestion } from "../src/product/demand/corpus-ingest.js";
import { buildDemandReport } from "../src/product/demand/demand-match.js";
import { CORPUS_SOURCES } from "../src/product/demand/corpus-schema.js";
import type { Prompt } from "../src/product/topics/topic-schema.js";

function prompt(id: string, text: string): Prompt {
  return { id, projectId: "p", topicId: "t", text, normalizedText: text, intent: "discovery", source: "authored", measuresVisibility: true, visibilityExclusionReason: null, status: "active", createdAt: "", activatedAt: null };
}

const LINES = [
  { conversation: [{ role: "user", content: "what are the best ai visibility tracking tools for a startup" }], timestamp: "2026-03-01T00:00:00Z" },
  { conversation: [{ role: "user", content: "best ai visibility tools compared" }], timestamp: "2026-03-05T00:00:00Z" },
  { messages: [{ role: "user", content: "write me a poem about rain" }], timestamp: "2026-03-03T00:00:00Z" },
  { conversation: [{ role: "assistant", content: "hi" }, { role: "user", content: "how do i monitor brand mentions in ai search" }] },
];

async function corpusFile(extra: string[] = []) {
  const dir = await mkdtemp(join(tmpdir(), "citegeo-corpus-"));
  const path = join(dir, "sample.jsonl");
  await writeFile(path, [...LINES.map((row) => JSON.stringify(row)), ...extra].join("\n"), "utf8");
  return { path, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test("the opening user turn is the question, not a later follow-up", () => {
  assert.equal(openingQuestion(LINES[3]), "how do i monitor brand mentions in ai search");
  assert.equal(openingQuestion({ conversation: [{ role: "assistant", content: "only me" }] }), null);
  assert.equal(openingQuestion("not an object"), null);
});

test("a pasted document is not a question and would otherwise dominate the index", () => {
  const long = "x".repeat(400);
  assert.equal(openingQuestion({ conversation: [{ role: "user", content: long }] }), null);
});

test("words in almost every question carry no signal and are dropped", () => {
  assert.deepEqual(meaningfulTerms("what is the best way to do this"), []);
  assert.deepEqual(meaningfulTerms("ai visibility tracking"), ["visibility", "tracking"]);
});

test("one malformed line does not make a corpus unreadable", async () => {
  const { path, cleanup } = await corpusFile(["not json at all", "", "   "]);
  try {
    const corpus = await indexCorpus({ sourceId: "wildchat", path });
    assert.equal(corpus.index.questions, 4);
    assert.equal(corpus.index.from, "2026-03-01");
    assert.equal(corpus.index.to, "2026-03-05");
  } finally {
    await cleanup();
  }
});

test("demand is two numbers, because one of them is always the wrong one to quote", async () => {
  const { path, cleanup } = await corpusFile();
  try {
    const corpus = await indexCorpus({ sourceId: "wildchat", path });
    const report = buildDemandReport({ corpus, prompts: [prompt("p1", "best ai visibility tools")] });
    const row = report.prompts[0];
    assert.equal(row?.match.exactTerms, 2, "questions containing every meaningful word");
    assert.ok((row?.match.relatedTerms || 0) >= (row?.match.exactTerms || 0), "the looser figure is never smaller");
    assert.ok(row?.match.examples.length, "a count with no examples cannot be checked");
  } finally {
    await cleanup();
  }
});

test("a prompt nobody asked about reads as zero, and an empty corpus reads as null", async () => {
  const { path, cleanup } = await corpusFile();
  try {
    const corpus = await indexCorpus({ sourceId: "wildchat", path });
    const report = buildDemandReport({ corpus, prompts: [prompt("p1", "quantum computing pricing")] });
    assert.equal(report.prompts[0]?.match.exactTerms, 0);
    assert.equal(report.prompts[0]?.shareOfCorpus, 0);

    // Zero over zero is not zero demand, it is no corpus.
    const empty = buildDemandReport({
      corpus: { index: { ...corpus.index, questions: 0 }, postings: new Map(), questions: [] },
      prompts: [prompt("p1", "anything")],
    });
    assert.equal(empty.prompts[0]?.shareOfCorpus, null);
  } finally {
    await cleanup();
  }
});

test("frequent terms no prompt covers are surfaced as the blind spot", async () => {
  const { path, cleanup } = await corpusFile();
  try {
    const corpus = await indexCorpus({ sourceId: "wildchat", path });
    const report = buildDemandReport({ corpus, prompts: [prompt("p1", "ai visibility")], uncoveredCount: 20 });
    const terms = report.uncoveredTerms.map((row) => row.term);
    assert.ok(terms.includes("tracking"), "a word the corpus uses and no prompt does");
    assert.ok(!terms.includes("visibility"), "a covered word is not a blind spot");
  } finally {
    await cleanup();
  }
});

test("every corpus names its licence, its source and what it is not", () => {
  assert.ok(CORPUS_SOURCES.length > 0);
  for (const source of CORPUS_SOURCES) {
    assert.ok(source.licence.length > 0, `${source.id} has no licence`);
    assert.ok(source.dataset.includes("/"), `${source.id} names no dataset`);
    assert.ok(source.caveat.length > 80, `${source.id} does not say what it is not`);
  }
});

test("a report carries the caveat of the corpus it came from", async () => {
  const { path, cleanup } = await corpusFile();
  try {
    const corpus = await indexCorpus({ sourceId: "lmsys", path });
    const report = buildDemandReport({ corpus, prompts: [prompt("p1", "ai visibility")] });
    assert.ok(report.caveat.includes("compare models"));
  } finally {
    await cleanup();
  }
});

test("a limit stops a multi-gigabyte corpus being read in full", async () => {
  const { path, cleanup } = await corpusFile();
  try {
    const corpus = await indexCorpus({ sourceId: "wildchat", path, limit: 2 });
    assert.equal(corpus.index.questions, 2);
  } finally {
    await cleanup();
  }
});
