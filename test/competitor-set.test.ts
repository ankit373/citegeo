import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CompetitorFileStore, CompetitorService, CompetitorSetError, matchesCompetitor } from "../src/product/topics/competitor-set.js";
import { buildTopicInsights } from "../src/product/topics/topic-insights.js";
import { ProductProjectFileStore } from "../src/product/projects/project-store.js";
import { ProductProjectService } from "../src/product/projects/project-service.js";
import type { Competitor } from "../src/product/topics/competitor-set.js";
import type { AnswerMention, PromptAnswer } from "../src/product/topics/prompt-run-schema.js";
import type { TopicSet } from "../src/product/topics/topic-schema.js";

async function harness() {
  const dir = await mkdtemp(join(tmpdir(), "citegeo-rivals-"));
  const store = new ProductProjectFileStore(dir);
  const project = await new ProductProjectService(store).createDraft({ name: "N", primaryDomain: "n.test", brandName: "N" });
  return { service: new CompetitorService(new CompetitorFileStore(store)), projectId: project.id, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test("a rival is matched by name or by domain label", () => {
  const rival: Competitor = { id: "r", name: "Screener", domain: "screener.in", source: "declared", tracked: true, addedAt: "" };
  assert.equal(matchesCompetitor(rival, "screener", null), true);
  assert.equal(matchesCompetitor(rival, "Something", "www.screener.in"), true);
  assert.equal(matchesCompetitor(rival, "Tickertape", "tickertape.in"), false);
});

test("adding the same rival twice keeps one, and re-adding a retired one tracks it again", async () => {
  const { service, projectId, cleanup } = await harness();
  try {
    await service.add(projectId, { name: "Rival", domain: "rival.com" });
    await service.add(projectId, { name: "rival" });
    const set = await service.get(projectId);
    assert.equal(set.competitors.length, 1);
    assert.equal(set.competitors[0]?.domain, "rival.com", "the domain is not lost by the second add");

    await service.retire(projectId, [set.competitors[0]!.id]);
    assert.equal((await service.get(projectId)).competitors[0]?.tracked, false);
    await service.add(projectId, { name: "Rival" });
    assert.equal((await service.get(projectId)).competitors[0]?.tracked, true);
  } finally {
    await cleanup();
  }
});

test("adopting skips what is already known and says how many were new", async () => {
  const { service, projectId, cleanup } = await harness();
  try {
    await service.add(projectId, { name: "Known" });
    const result = await service.adopt(projectId, [{ name: "Known", domain: null }, { name: "New", domain: "new.com" }], "discovered");
    assert.equal(result.added, 1);
    assert.equal(result.set.competitors.length, 2);
  } finally {
    await cleanup();
  }
});

test("a rival with no name is refused rather than stored blank", async () => {
  const { service, projectId, cleanup } = await harness();
  try {
    await assert.rejects(() => service.add(projectId, { name: "   " }), CompetitorSetError);
  } finally {
    await cleanup();
  }
});

const SET: TopicSet = { projectId: "p", topics: [], prompts: [], generatedAt: null, updatedAt: "" };

function answer(mentions: AnswerMention[]): PromptAnswer {
  return {
    id: `a-${Math.random()}`, projectId: "p", runId: "r", promptId: "q", topicId: "t", promptText: "q",
    intent: "discovery", providerId: "openrouter", modelId: "m", modelDisplayName: "M", regionId: "global",
    languageId: "en", status: "completed", text: "", mentions, citationUrls: [], errorCode: null,
    errorMessage: null, latencyMs: 1, createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function mention(name: string): AnswerMention {
  return { name, domain: null, recommendation: "mentioned", mentionQuote: null, firstMentionOffset: null, firstMentionState: "unresolved", isTarget: false };
}

test("a tracked rival no answer named shows as zero, not as absent", () => {
  // It was asked about. The answer is none, and hiding it hides the finding.
  const insights = buildTopicInsights({
    projectId: "p", set: SET,
    answers: [answer([mention("Seen")])],
    competitors: [
      { id: "a", name: "Seen", domain: null, source: "declared", tracked: true, addedAt: "" },
      { id: "b", name: "Unseen", domain: null, source: "declared", tracked: true, addedAt: "" },
    ],
  });
  const unseen = insights.trackedRivals.find((row) => row.name === "Unseen");
  assert.equal(unseen?.appearances, 0);
  assert.equal(unseen?.shareOfAnswers, 0);
  assert.equal(insights.trackedRivals.find((row) => row.name === "Seen")?.appearances, 1);
});

test("a retired rival drops out of the tracked list", () => {
  const insights = buildTopicInsights({
    projectId: "p", set: SET, answers: [answer([])],
    competitors: [{ id: "a", name: "Gone", domain: null, source: "declared", tracked: false, addedAt: "" }],
  });
  assert.deepEqual(insights.trackedRivals, []);
});

test("with nothing answered a tracked rival's share is null, not zero", () => {
  const insights = buildTopicInsights({
    projectId: "p", set: SET, answers: [],
    competitors: [{ id: "a", name: "Rival", domain: null, source: "declared", tracked: true, addedAt: "" }],
  });
  assert.equal(insights.trackedRivals[0]?.shareOfAnswers, null);
});
