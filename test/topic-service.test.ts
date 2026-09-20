import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProductProjectFileStore } from "../src/product/projects/project-store.js";
import { ProductProjectService } from "../src/product/projects/project-service.js";
import { TopicFileStore } from "../src/product/topics/topic-store.js";
import { TopicService, TopicSetUnavailableError } from "../src/product/topics/topic-service.js";
import { parsePromptSetProposal } from "../src/product/topics/prompt-generation-protocol.js";

async function harness() {
  const dir = await mkdtemp(join(tmpdir(), "citegeo-topics-"));
  const store = new ProductProjectFileStore(dir);
  const projects = new ProductProjectService(store);
  const project = await projects.createDraft({ name: "Ninethirty", primaryDomain: "ninethirty.ai", brandName: "Ninethirty" });
  const service = new TopicService(new TopicFileStore(store), projects);
  return { service, projectId: project.id, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

const PROPOSAL = {
  analysisStatus: "completed",
  topics: [
    {
      name: "Screening",
      description: "How a trader picks a screener.",
      prompts: [
        { text: "best stock screener for indian markets", intent: "discovery" },
        { text: "is ninethirty any good", intent: "brand" },
      ],
    },
  ],
  unknowns: [],
};

test("a generated set is proposed, never activated, because nobody has read it yet", async () => {
  const { service, projectId, cleanup } = await harness();
  try {
    const set = await service.generate(projectId, async () => PROPOSAL);
    assert.equal(set.topics.length, 1);
    assert.equal(set.prompts.length, 2);
    assert.ok(set.prompts.every((prompt) => prompt.status === "proposed"));
    assert.ok(set.generatedAt);
  } finally {
    await cleanup();
  }
});

test("a prompt naming the brand is kept but cannot measure visibility", async () => {
  const { service, projectId, cleanup } = await harness();
  try {
    const set = await service.generate(projectId, async () => PROPOSAL);
    const branded = set.prompts.find((prompt) => prompt.intent === "brand");
    const discovery = set.prompts.find((prompt) => prompt.intent === "discovery");
    assert.equal(branded?.measuresVisibility, false);
    assert.equal(branded?.visibilityExclusionReason, "names_the_brand");
    // The model will discuss the brand whatever it thinks, so an appearance
    // there is not evidence of being found.
    assert.equal(discovery?.measuresVisibility, true);
  } finally {
    await cleanup();
  }
});

test("a model that returns nothing usable saves nothing at all", async () => {
  const { service, projectId, cleanup } = await harness();
  try {
    await assert.rejects(
      () => service.generate(projectId, async () => ({ analysisStatus: "completed", topics: [], unknowns: [] })),
      TopicSetUnavailableError,
    );
    const set = await service.get(projectId);
    assert.equal(set.prompts.length, 0, "a failed generation must not leave a half set behind");
  } finally {
    await cleanup();
  }
});

test("activating a prompt activates the topic holding it", async () => {
  const { service, projectId, cleanup } = await harness();
  try {
    const generated = await service.generate(projectId, async () => PROPOSAL);
    const first = generated.prompts[0]!;
    const set = await service.activate(projectId, [first.id]);
    assert.equal(set.prompts.find((prompt) => prompt.id === first.id)?.status, "active");
    assert.equal(set.topics[0]?.status, "active", "prompts must not run under a heading still marked proposed");
  } finally {
    await cleanup();
  }
});

test("generating twice does not create the same question twice", async () => {
  const { service, projectId, cleanup } = await harness();
  try {
    await service.generate(projectId, async () => PROPOSAL);
    const set = await service.generate(projectId, async () => PROPOSAL);
    assert.equal(set.prompts.length, 2);
    assert.equal(set.topics.length, 1);
  } finally {
    await cleanup();
  }
});

test("a prompt written by hand is active immediately and belongs to a real topic", async () => {
  const { service, projectId, cleanup } = await harness();
  try {
    const withTopic = await service.addTopic(projectId, { name: "Pricing" });
    const topicId = withTopic.topics[0]!.id;
    const set = await service.addPrompt(projectId, { topicId, text: "cheapest screener in india", intent: "discovery" });
    assert.equal(set.prompts[0]?.status, "active");
    await assert.rejects(
      () => service.addPrompt(projectId, { topicId: "topic-nope", text: "x", intent: "discovery" }),
      TopicSetUnavailableError,
    );
  } finally {
    await cleanup();
  }
});

test("a malformed topic is dropped rather than repaired into something plausible", () => {
  const parsed = parsePromptSetProposal({
    analysisStatus: "completed",
    topics: [
      { name: "Good", description: "", prompts: [{ text: "a question", intent: "discovery" }] },
      { name: "No prompts", description: "", prompts: [] },
      { name: "Bad intent", description: "", prompts: [{ text: "q", intent: "vibes" }] },
      { description: "nameless", prompts: [{ text: "q", intent: "discovery" }] },
    ],
    unknowns: [],
  });
  assert.equal(parsed.topics.length, 1);
  assert.equal(parsed.topics[0]?.name, "Good");
});

test("a proposal with nothing usable is unknown, never an empty success", () => {
  const parsed = parsePromptSetProposal({ analysisStatus: "completed", topics: [], unknowns: [] });
  assert.equal(parsed.analysisStatus, "unknown");
});
