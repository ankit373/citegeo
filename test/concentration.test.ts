import test from "node:test";
import assert from "node:assert/strict";
import { AT_RANKS, buildConcentrationReport, CONCENTRATION_CAVEAT } from "../src/product/citations/concentration.js";
import type { PromptAnswer } from "../src/product/topics/prompt-run-schema.js";

function answer(urls: string[], over: Partial<PromptAnswer> = {}): PromptAnswer {
  return {
    id: String(Math.random()), projectId: "p", runId: "r", promptId: "q", topicId: "t",
    promptText: "best screener", intent: "discovery", providerId: "openai", modelId: "gpt-4o",
    modelDisplayName: "M", regionId: "global", languageId: "en", status: "completed", text: "",
    mentions: [], citationUrls: urls, errorCode: null, errorMessage: null, latencyMs: 1, createdAt: "",
    ...over,
  };
}

test("one domain cited ten times in one answer is one observation", () => {
  // Otherwise a single chatty answer decides the shape of the category.
  const report = buildConcentrationReport({
    answers: [answer(Array.from({ length: 10 }, (_, i) => `https://a.test/${i}`)), answer(["https://b.test/x"])],
  });
  assert.equal(report.hosts.find((row) => row.host === "a.test")?.answers, 1);
  assert.equal(report.hosts.length, 2);
  assert.equal(report.answersWithCitations, 2);
});

test("one domain holding everything is as concentrated as it gets", () => {
  const report = buildConcentrationReport({ answers: [answer(["https://a.test/1"]), answer(["https://a.test/2"])] });
  assert.equal(report.halfHeldBy, 1);
  assert.equal(report.topShares[0]?.share, 1);
  assert.equal(report.gini, 0, "one domain alone is not unequal, it is the whole population");
});

test("many domains cited equally spread the half out", () => {
  const answers = Array.from({ length: 10 }, (_, i) => answer([`https://h${i}.test/x`]));
  const report = buildConcentrationReport({ answers });
  assert.equal(report.halfHeldBy, 5);
  assert.equal(report.gini, 0, "cited equally is not concentrated");
});

test("a long tail behind a few big domains shows in the curve", () => {
  const answers = [
    ...Array.from({ length: 8 }, () => answer(["https://big.test/x"])),
    ...Array.from({ length: 6 }, (_, i) => answer([`https://small${i}.test/x`])),
  ];
  const report = buildConcentrationReport({ answers });
  assert.equal(report.hosts[0]?.host, "big.test");
  assert.equal(report.halfHeldBy, 1);
  assert.ok((report.gini || 0) > 0.3, `a dominant domain should show, got ${report.gini}`);
});

test("the curve is reported at several points, because one number hides the shape", () => {
  const answers = Array.from({ length: 20 }, (_, i) => answer([`https://h${i % 12}.test/x`]));
  const report = buildConcentrationReport({ answers });
  assert.deepEqual(report.topShares.map((row) => row.rank), AT_RANKS);
  for (let index = 1; index < report.topShares.length; index += 1) {
    assert.ok((report.topShares[index]?.share || 0) >= (report.topShares[index - 1]?.share || 0), "the curve never falls");
  }
});

test("your own domain is found, including a subdomain of it", () => {
  const report = buildConcentrationReport({
    answers: [answer(["https://big.test/x"]), answer(["https://big.test/y"]), answer(["https://blog.mine.test/p"])],
    domain: "mine.test",
  });
  assert.equal(report.yourRank, 2);
  assert.equal(report.hosts.find((row) => row.host === "blog.mine.test")?.isYours, true);
});

test("a domain nobody cited has no rank rather than the last one", () => {
  const report = buildConcentrationReport({ answers: [answer(["https://big.test/x"])], domain: "mine.test" });
  assert.equal(report.yourRank, null);
});

test("answers that cited nothing are not answers citing everyone equally", () => {
  const report = buildConcentrationReport({ answers: [answer([]), answer([]), answer(["https://a.test/x"])] });
  assert.equal(report.answersWithCitations, 1);
  assert.equal(report.hosts.length, 1);
});

test("with nothing cited every figure is unknown rather than nought", () => {
  const report = buildConcentrationReport({ answers: [answer([])] });
  assert.equal(report.halfHeldBy, null);
  assert.equal(report.gini, null);
  assert.deepEqual(report.hosts, []);
});

test("a failed answer did not decline to cite anyone", () => {
  const report = buildConcentrationReport({ answers: [answer(["https://a.test/x"], { status: "provider_failed" })] });
  assert.equal(report.answersWithCitations, 0);
});

test("the caveat says what the population is", () => {
  assert.ok(CONCENTRATION_CAVEAT.includes("not the web"));
  assert.equal(buildConcentrationReport({ answers: [] }).caveat, CONCENTRATION_CAVEAT);
});
