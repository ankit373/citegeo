import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProductProjectFileStore } from "../src/product/projects/project-store.js";
import { AgentDraftFileStore } from "../src/product/agents/agent-store.js";
import { AgentUnavailableError, ProductAgentService } from "../src/product/agents/agent-service.js";
import { ExperimentService } from "../src/product/experiments/experiment-service.js";
import { ExperimentInputError } from "../src/product/experiments/experiment-schema.js";
import type { AgentDraft } from "../src/product/agents/agent-schema.js";
import type { AnswerMention, PromptAnswer } from "../src/product/topics/prompt-run-schema.js";

const TARGET: AnswerMention = {
  name: "Tradomate", domain: null, recommendation: "positive", mentionQuote: null,
  firstMentionOffset: 0, firstMentionState: "unique", isTarget: true,
};

const BEFORE = "2026-05-01T00:00:00.000Z";
const LIVE = "2026-06-01T00:00:00.000Z";
const AFTER = "2026-07-01T00:00:00.000Z";

function answer(promptId: string, when: string): PromptAnswer {
  return {
    id: `${promptId}-${when}-${Math.random()}`, projectId: "p", runId: "r", promptId, topicId: "t",
    promptText: promptId, intent: "discovery", providerId: "openai", modelId: "gpt-4o",
    modelDisplayName: "M", regionId: "global", languageId: "en", status: "completed", text: "",
    mentions: [TARGET], citationUrls: [], errorCode: null, errorMessage: null,
    latencyMs: 1, createdAt: when,
  };
}

function draft(over: Partial<AgentDraft> = {}): AgentDraft {
  return {
    id: "d1", projectId: "p", templateId: "missing_answer", title: "Answer the screener question",
    body: "## Heading", rationale: "7 answers never named the brand.",
    sources: [{ kind: "prompt", reference: "q1", detail: "7 answer(s), brand never named" }],
    status: "approved", createdAt: BEFORE, reviewedAt: BEFORE, reviewNote: null,
    publishedUrl: null, publishedAt: null,
    ...over,
  };
}

async function build() {
  const dir = await mkdtemp(join(tmpdir(), "citegeo-publish-"));
  const projects = new ProductProjectFileStore(dir);
  const store = new AgentDraftFileStore(projects);
  const known = { get: async () => ({ brandName: "Tradomate", normalizedDomain: "tradomate.one" }) };
  const agents = new ProductAgentService(known as never, (async () => ({})) as never, store);
  return { dir, store, agents, experiments: new ExperimentService(projects), cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test("a draft nobody approved cannot be recorded as live", async () => {
  const kit = await build();
  try {
    await kit.store.save(draft({ status: "awaiting_review" }));
    await assert.rejects(
      () => kit.agents.publish("p", "d1", { url: "https://tradomate.one/answer", at: LIVE }),
      (error: Error) => error instanceof AgentUnavailableError && error.message.includes("Only an approved draft"),
    );
  } finally {
    await kit.cleanup();
  }
});

test("recording a draft as live keeps where it went and when", async () => {
  const kit = await build();
  try {
    await kit.store.save(draft());
    const published = await kit.agents.publish("p", "d1", { url: "https://tradomate.one/answer", at: LIVE });
    assert.equal(published.publishedUrl, "https://tradomate.one/answer");
    assert.equal(published.publishedAt, LIVE);
    assert.equal(published.status, "approved", "publishing is not a decision, it is a date");
  } finally {
    await kit.cleanup();
  }
});

test("a draft is recorded as live once, because the second date would move the boundary", async () => {
  const kit = await build();
  try {
    await kit.store.save(draft({ publishedUrl: "https://tradomate.one/answer", publishedAt: LIVE }));
    await assert.rejects(
      () => kit.agents.publish("p", "d1", { url: "https://tradomate.one/other", at: BEFORE }),
      (error: Error) => error.message.includes("already recorded as live"),
    );
  } finally {
    await kit.cleanup();
  }
});

test("a live draft starts the experiment that measures it, against the question it was written for", async () => {
  const kit = await build();
  try {
    const answers = [answer("q1", BEFORE), answer("q2", BEFORE), answer("q3", BEFORE)];
    const live = draft({ publishedUrl: "https://tradomate.one/answer", publishedAt: LIVE });
    const experiment = await kit.experiments.startFromDraft("p", live, answers);
    assert.deepEqual(experiment.treatedPromptIds, ["q1"], "the draft already said which question it was written for");
    assert.deepEqual(experiment.controlPromptIds, ["q2", "q3"], "everything else with a baseline is the control");
    assert.equal(experiment.changedAt, LIVE, "the date it went live is the boundary");
    assert.equal(experiment.draftId, "d1");
    assert.ok(experiment.changed.includes("https://tradomate.one/answer"));
  } finally {
    await kit.cleanup();
  }
});

test("a date that is not a date is refused before the control is blamed for it", async () => {
  const kit = await build();
  try {
    const live = draft({ publishedUrl: "https://tradomate.one/answer", publishedAt: "whenever" });
    await assert.rejects(
      () => kit.experiments.startFromDraft("p", live, [answer("q2", BEFORE)]),
      (error: Error) => error.message.includes("has to be a date"),
    );
  } finally {
    await kit.cleanup();
  }
});

test("an experiment stored before drafts could start one reads as started by hand, not as undefined", async () => {
  const kit = await build();
  try {
    await kit.experiments.start("p", {
      name: "By hand", hypothesis: "", changed: "edited the homepage",
      treatedPromptIds: ["q1"], controlPromptIds: ["q2"],
    });
    const [stored] = await kit.experiments.list("p", []);
    assert.equal(stored?.draftId, null);
  } finally {
    await kit.cleanup();
  }
});

test("a draft nobody has said went live is not an experiment yet", async () => {
  const kit = await build();
  try {
    await assert.rejects(
      () => kit.experiments.startFromDraft("p", draft(), [answer("q2", BEFORE)]),
      (error: Error) => error instanceof ExperimentInputError && error.message.includes("date it went live"),
    );
  } finally {
    await kit.cleanup();
  }
});

test("with nothing left to act as a control, no experiment is written at all", async () => {
  const kit = await build();
  try {
    const live = draft({ publishedUrl: "https://tradomate.one/answer", publishedAt: LIVE });
    await assert.rejects(
      () => kit.experiments.startFromDraft("p", live, [answer("q1", BEFORE)]),
      (error: Error) => error.message.includes("No question other than"),
    );
    assert.deepEqual(await kit.experiments.list("p", []), [], "a refused experiment is not half saved");
  } finally {
    await kit.cleanup();
  }
});

test("a control that exists but has no baseline is not reported as a control that is taken", async () => {
  // The first live publish on a real project hit this and blamed another
  // experiment that did not exist.
  const kit = await build();
  try {
    const live = draft({ publishedUrl: "https://tradomate.one/answer", publishedAt: LIVE });
    await assert.rejects(
      () => kit.experiments.startFromDraft("p", live, [answer("q2", AFTER)]),
      (error: Error) => error.message.includes("answered before 2026-06-01") && !error.message.includes("running change"),
    );
  } finally {
    await kit.cleanup();
  }
});

test("a second live draft does not borrow the first one's treated question as its control", async () => {
  const kit = await build();
  try {
    const answers = [answer("q1", BEFORE), answer("q2", BEFORE), answer("q3", BEFORE)];
    await kit.experiments.startFromDraft("p", draft({ publishedUrl: "https://tradomate.one/a", publishedAt: LIVE }), answers);
    const second = await kit.experiments.startFromDraft("p", draft({
      id: "d2", title: "Second page",
      sources: [{ kind: "prompt", reference: "q2", detail: "never named" }],
      publishedUrl: "https://tradomate.one/b", publishedAt: LIVE,
    }), answers);
    assert.deepEqual(second.treatedPromptIds, ["q2"]);
    assert.deepEqual(second.controlPromptIds, ["q3"], "q1 was changed by the first experiment, so it cannot stand for nothing happening");
  } finally {
    await kit.cleanup();
  }
});
