import test from "node:test";
import assert from "node:assert/strict";
import type { CitationAnalysis } from "../src/product/topics/citation-analysis.js";
import { citationStanding, positionReport } from "../src/product/topics/position-metrics.js";
import type { PromptStanding } from "../src/product/topics/topic-insights.js";

function prompt(rank: number | null, measures = true): PromptStanding {
  return {
    promptId: "p", topicId: "t", subtopic: null, text: "q", intent: "commercial",
    measuresVisibility: measures,
    score: { answers: 1, appearances: rank === null ? 0 : 1, presenceRate: null, prominence: null, sentiment: null, score: null },
    rank, entitiesNamed: 4, byModel: [], ahead: [], standing: [],
  } as unknown as PromptStanding;
}

test("the mean place is taken over the prompts that named you, and says how many did not", () => {
  const report = positionReport([prompt(1), prompt(2), prompt(6), prompt(null)]);
  assert.equal(report.averagePosition, 3);
  assert.equal(report.ranked, 3);
  assert.equal(report.unranked, 1);
  assert.equal(report.best, 1);
  assert.equal(report.worst, 6);
});

test("a prompt that never named you is not scored as last", () => {
  // Scoring an absence as last would make the mean depend on how many rivals
  // happened to be listed, which is a fact about the answer and not the brand.
  const withAbsence = positionReport([prompt(2), prompt(null), prompt(null)]);
  assert.equal(withAbsence.averagePosition, 2);
  assert.equal(withAbsence.unranked, 2);
});

test("a prompt that names the brand itself is left out of position entirely", () => {
  const report = positionReport([prompt(1, false), prompt(4)]);
  assert.equal(report.averagePosition, 4);
  assert.equal(report.ranked, 1);
  assert.equal(report.unranked, 0);
});

test("never being named anywhere reports no position rather than nought", () => {
  const report = positionReport([prompt(null), prompt(null)]);
  assert.equal(report.averagePosition, null);
  assert.equal(report.best, null);
  assert.equal(report.worst, null);
  assert.equal(report.unranked, 2);
});

function analysis(domains: Array<{ domain: string; answers: number; isTarget?: boolean }>): CitationAnalysis {
  return {
    answersWithCitations: 10, answersConsidered: 10, ownPages: [], openings: [], unavailable: false,
    domains: domains.map((row) => ({
      domain: row.domain, answers: row.answers, pages: 1,
      isTarget: row.isTarget === true, answersWithoutYou: 0,
    })),
  };
}

test("citation rank and share are read off the cited domains", () => {
  const standing = citationStanding(analysis([
    { domain: "rival.com", answers: 10 },
    { domain: "mine.com", answers: 6, isTarget: true },
    { domain: "other.com", answers: 4 },
  ]));
  assert.equal(standing.rank, 2);
  assert.equal(standing.share, 6 / 20);
  assert.deepEqual(standing.ahead.map((row) => row.domain), ["rival.com"]);
  assert.equal(standing.leader?.domain, "rival.com");
});

test("ties share a place and the next place skips", () => {
  const standing = citationStanding(analysis([
    { domain: "a.com", answers: 9 },
    { domain: "b.com", answers: 9 },
    { domain: "mine.com", answers: 5, isTarget: true },
  ]));
  // Two domains are level ahead, so the brand is third rather than second.
  assert.equal(standing.rank, 3);
  assert.equal(standing.ahead.length, 2);
});

test("a brand level with the leader shares first place", () => {
  const standing = citationStanding(analysis([
    { domain: "rival.com", answers: 7 },
    { domain: "mine.com", answers: 7, isTarget: true },
  ]));
  assert.equal(standing.rank, 1);
  assert.equal(standing.ahead.length, 0);
});

test("an uncited brand reports no rank, and still names who is being cited", () => {
  const standing = citationStanding(analysis([
    { domain: "rival.com", answers: 8 },
    { domain: "other.com", answers: 3 },
  ]));
  assert.equal(standing.rank, null);
  assert.equal(standing.share, null);
  assert.equal(standing.leader?.domain, "rival.com");
  assert.deepEqual(standing.ahead.map((row) => row.domain), ["rival.com", "other.com"]);
});

test("nothing cited anywhere is not a rank of one", () => {
  const standing = citationStanding(analysis([]));
  assert.equal(standing.rank, null);
  assert.equal(standing.leader, null);
});
