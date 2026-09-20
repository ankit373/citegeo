import test from "node:test";
import assert from "node:assert/strict";
import { buildCitationAnalysis } from "../src/product/topics/citation-analysis.js";
import { resolveBrandIdentity } from "../src/product/topics/brand-identity.js";
import { buildAnswerDigest } from "../src/product/alerts/answer-digest.js";
import type { AnswerMention, PromptAnswer } from "../src/product/topics/prompt-run-schema.js";
import type { HomeSummary } from "../src/product/alerts/home-summary.js";

const IDENTITY = resolveBrandIdentity({ brandName: "Ninethirty", domain: "ninethirty.ai" });

function mention(name: string, isTarget = false): AnswerMention {
  return { name, domain: null, recommendation: "mentioned", mentionQuote: null, firstMentionOffset: null, firstMentionState: "unresolved", isTarget };
}

function answer(overrides: Partial<PromptAnswer> = {}): PromptAnswer {
  return {
    id: `a-${Math.random()}`, projectId: "p", runId: "r", promptId: "q1", topicId: "t",
    promptText: "best screener", intent: "discovery", providerId: "openrouter", modelId: "m",
    modelDisplayName: "M", regionId: "global", languageId: "en", status: "completed",
    text: "", mentions: [], citationUrls: [], errorCode: null, errorMessage: null,
    latencyMs: 1, createdAt: "2026-01-01T00:00:00.000Z", ...overrides,
  };
}

test("your own pages are counted per page, not per domain", () => {
  const result = buildCitationAnalysis({
    identity: IDENTITY,
    answers: [
      answer({ citationUrls: ["https://ninethirty.ai/screener", "https://ninethirty.ai/pricing"], mentions: [mention("Ninethirty", true)] }),
      answer({ citationUrls: ["https://www.ninethirty.ai/screener?ref=x"], mentions: [mention("Ninethirty", true)] }),
    ],
  });
  const paths = result.ownPages.map((page) => page.path);
  assert.deepEqual(paths, ["/screener", "/pricing"], "most cited first");
  // www and a query string are the same page.
  assert.equal(result.ownPages[0]?.answers, 2);
});

test("one answer citing a domain three times is one answer", () => {
  const result = buildCitationAnalysis({
    identity: IDENTITY,
    answers: [answer({ citationUrls: ["https://rival.com/a", "https://rival.com/b", "https://rival.com/c"] })],
  });
  assert.equal(result.domains.find((row) => row.domain === "rival.com")?.answers, 1);
});

test("a page a rival won on a question that never named you is an opening", () => {
  const result = buildCitationAnalysis({
    identity: IDENTITY,
    answers: [
      answer({ promptText: "best screener", citationUrls: ["https://rival.com/guide"], mentions: [mention("Rival")] }),
      answer({ promptText: "named one", citationUrls: ["https://other.com/x"], mentions: [mention("Ninethirty", true)] }),
    ],
  });
  assert.deepEqual(result.openings.map((row) => row.domain), ["rival.com"]);
  assert.equal(result.openings[0]?.prompt, "best screener");
});

test("answers citing you while never naming you are counted, because that is a real state", () => {
  const result = buildCitationAnalysis({
    identity: IDENTITY,
    answers: [answer({ citationUrls: ["https://ninethirty.ai/x"], mentions: [mention("Rival")] })],
  });
  assert.equal(result.domains.find((row) => row.isTarget)?.answersWithoutYou, 1);
});

test("no citations anywhere is stated, and no citations because nothing ran is not", () => {
  assert.equal(buildCitationAnalysis({ identity: IDENTITY, answers: [answer({})] }).unavailable, true);
  assert.equal(buildCitationAnalysis({ identity: IDENTITY, answers: [] }).unavailable, false);
});

function home(overrides: Partial<HomeSummary> = {}): HomeSummary {
  return {
    projectId: "p", domain: "ninethirty.ai", score: 40, change: null, rank: 3, rivals: 9,
    answers: 12, alerts: [], weakestTopics: [], absentFrom: [], lastRun: null,
    setup: [], ready: true, showSetupOnly: false, ...overrides,
  };
}

test("a digest with nothing moved is not newsworthy and would not be sent", () => {
  const digest = buildAnswerDigest({ home: home(), previous: { score: 40, rank: 3, answers: 12, alertCount: 0 } });
  assert.equal(digest.newsworthy, false);
  assert.ok(digest.headline.includes("nothing moved"));
});

test("a digest with nothing measured is never newsworthy, however much is missing", () => {
  const digest = buildAnswerDigest({
    home: home({ answers: 0, score: null, absentFrom: [{ promptId: "q", text: "x", namedInstead: [] }] }),
  });
  assert.equal(digest.newsworthy, false);
});

test("a move is described with both figures", () => {
  const digest = buildAnswerDigest({ home: home({ score: 25 }), previous: { score: 40, rank: 3, answers: 12, alertCount: 0 } });
  assert.equal(digest.newsworthy, true);
  assert.ok(digest.lines.some((line) => line.includes("fell 15 to 25")));
});

test("a critical alert is news even when the numbers did not move", () => {
  const digest = buildAnswerDigest({
    home: home({ alerts: [{ kind: "topic_lost", severity: "critical", headline: "No answer named you", detail: "The previous run named you four times." }] }),
    previous: { score: 40, rank: 3, answers: 12, alertCount: 0 },
  });
  assert.equal(digest.newsworthy, true);
  assert.ok(digest.lines.some((line) => line.includes("No answer named you")));
});
