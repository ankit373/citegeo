import test from "node:test";
import assert from "node:assert/strict";
import { armsBlocked, controlFor, treatedFor, type ControlArm } from "../src/product/experiments/experiment-arms.js";
import { parsePublication, withPublication, countDrafts, type AgentDraft } from "../src/product/agents/agent-schema.js";
import type { AnswerMention, PromptAnswer } from "../src/product/topics/prompt-run-schema.js";

const TARGET: AnswerMention = {
  name: "Tradomate", domain: null, recommendation: "positive", mentionQuote: null,
  firstMentionOffset: 0, firstMentionState: "unique", isTarget: true,
};

const CHANGED = "2026-06-01T00:00:00.000Z";
const BEFORE = "2026-05-01T00:00:00.000Z";
const AFTER = "2026-07-01T00:00:00.000Z";

function answer(promptId: string, when: string, status: PromptAnswer["status"] = "completed"): PromptAnswer {
  return {
    id: `${promptId}-${when}-${Math.random()}`, projectId: "p", runId: "r", promptId, topicId: "t",
    promptText: promptId, intent: "discovery", providerId: "openai", modelId: "gpt-4o",
    modelDisplayName: "M", regionId: "global", languageId: "en", status, text: "",
    mentions: [TARGET], citationUrls: [], errorCode: null, errorMessage: null,
    latencyMs: 1, createdAt: when,
  };
}

function draft(over: Partial<AgentDraft> = {}): AgentDraft {
  return {
    id: "d1", projectId: "p", templateId: "missing_answer", title: "Answer the screener question",
    body: "## Heading", rationale: "7 answers never named the brand.",
    sources: [
      { kind: "prompt", reference: "q1", detail: "7 answer(s), brand never named" },
      { kind: "entity", reference: "rival.com", detail: "named in 6 answer(s)" },
    ],
    status: "approved", createdAt: BEFORE, reviewedAt: BEFORE, reviewNote: null,
    publishedUrl: null, publishedAt: null,
    ...over,
  };
}

test("the treated arm is read off the draft, not asked for a second time", () => {
  assert.deepEqual(treatedFor(draft()), ["q1"]);
});

const SOME: ControlArm = { promptIds: ["q2"], withheld: [], everAnswered: 1 };

test("a rival named on the draft is evidence, never a question to measure", () => {
  const only = treatedFor(draft({ sources: [{ kind: "entity", reference: "rival.com", detail: "named" }] }));
  assert.deepEqual(only, [], "an entity is not a question anything can be measured on");
  assert.ok(armsBlocked(only, SOME, CHANGED)?.includes("No tracked question is named"));
});

test("the control is everything else that already had a baseline", () => {
  const control = controlFor({
    answers: [answer("q1", BEFORE), answer("q2", BEFORE), answer("q3", BEFORE)],
    treatedPromptIds: ["q1"], changedAt: CHANGED,
  });
  assert.deepEqual(control.promptIds, ["q2", "q3"]);
});

test("a question first asked after the change cannot be a control", () => {
  // Pooling it would add outcome answers to an arm that never had a baseline,
  // which moves the control's before and after for reasons that are not the change.
  const control = controlFor({
    answers: [answer("q2", BEFORE), answer("q3", AFTER)],
    treatedPromptIds: ["q1"], changedAt: CHANGED,
  });
  assert.deepEqual(control.promptIds, ["q2"]);
});

test("a question another running experiment treats is not a control here", () => {
  const control = controlFor({
    answers: [answer("q2", BEFORE), answer("q3", BEFORE)],
    treatedPromptIds: ["q1"], changedAt: CHANGED, excluded: ["q3"],
  });
  assert.deepEqual(control.promptIds, ["q2"], "its page was changed too, so it cannot stand for nothing happening");
  assert.deepEqual(control.withheld, ["q3"]);
});

test("an answer that failed is not a baseline", () => {
  const control = controlFor({
    answers: [answer("q2", BEFORE, "provider_failed"), answer("q3", BEFORE)],
    treatedPromptIds: ["q1"], changedAt: CHANGED,
  });
  assert.deepEqual(control.promptIds, ["q3"]);
});

test("an empty control says which of its three causes applies", () => {
  // Reported live against a real project: the control was empty because no
  // question had been answered before the publish date, and it said the wrong one.
  const withheld = armsBlocked(["q1"], { promptIds: [], withheld: ["q2"], everAnswered: 1 }, CHANGED);
  assert.ok(withheld && withheld.includes("already treated by a running change"));

  const noBaseline = armsBlocked(["q1"], { promptIds: [], withheld: [], everAnswered: 4 }, CHANGED);
  assert.ok(noBaseline && noBaseline.includes("answered before 2026-06-01"), noBaseline || "");
  assert.ok(!noBaseline?.includes("running change"), "nothing was withheld, so nothing should be blamed on another experiment");

  const nothingTracked = armsBlocked(["q1"], { promptIds: [], withheld: [], everAnswered: 0 }, CHANGED);
  assert.ok(nothingTracked && nothingTracked.includes("No question other than"));

  assert.equal(armsBlocked(["q1"], SOME, CHANGED), null);
});

test("a publication needs somewhere a reader can go and check", () => {
  assert.equal(parsePublication({ url: "" }), null);
  assert.equal(parsePublication({ url: "not a url" }), null);
  assert.equal(parsePublication({ url: "ftp://example.com/page" }), null, "a page nobody can open is not a published page");
  const ok = parsePublication({ url: "https://example.com/answer", at: "2026-06-01" });
  assert.equal(ok?.url, "https://example.com/answer");
  assert.equal(ok?.at, "2026-06-01T00:00:00.000Z");
});

test("a publication with no date is dated now rather than refused", () => {
  const ok = parsePublication({ url: "https://example.com/answer" });
  assert.ok(ok && Number.isFinite(new Date(ok.at).getTime()));
});

test("a draft written before publication was recorded reads as not published, not as undefined", () => {
  const old = { ...draft() } as Record<string, unknown>;
  delete old.publishedUrl;
  delete old.publishedAt;
  const read = withPublication(old as unknown as AgentDraft);
  assert.equal(read.publishedUrl, null);
  assert.equal(read.publishedAt, null);
});

test("published is counted apart from approved, because only a live page can be measured", () => {
  const counts = countDrafts([
    draft({ id: "a", status: "approved" }),
    draft({ id: "b", status: "approved", publishedUrl: "https://example.com/b", publishedAt: AFTER }),
    draft({ id: "c", status: "rejected" }),
  ]);
  assert.deepEqual(counts, { awaiting_review: 0, approved: 2, rejected: 1, published: 1 });
});
