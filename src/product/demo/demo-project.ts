import { join } from "node:path";
import { ProductProjectFileStore } from "../projects/project-store.js";
import type { ProductProject } from "../projects/project-schema.js";
import { AnswerIndexService } from "../index/answer-index-service.js";
import { CompetitorFileStore, competitorId, type Competitor } from "../topics/competitor-set.js";
import { corroborateMentions } from "../topics/mention-corroboration.js";
import type { AnswerMention, PromptAnswer, PromptRun, PromptRunStatus } from "../topics/prompt-run-schema.js";
import { PromptRunFileStore } from "../topics/prompt-run-store.js";
import { TopicFileStore } from "../topics/topic-store.js";
import { normalizePrompt, type Prompt, type PromptIntent, type Topic, type TopicSet } from "../topics/topic-schema.js";

// A made-up brand with made-up answers, so every screen can be shown without
// anyone's data and without a provider key. Generated from a fixed seed.

export const DEMO_PROJECT_ID = "demo-velloran-tea";
export const DEMO_BRAND = "Velloran Tea";
/** Reserved for documentation, so no real site can be reached through it. */
export const DEMO_DOMAIN = "velloran-tea.example";

const RIVALS = [
  { name: "Kettlewren", domain: "kettlewren.example", pull: 0.85 },
  { name: "Driftleaf", domain: "driftleaf.example", pull: 0.6 },
  { name: "Corvane Teas", domain: "corvane.example", pull: 0.45 },
  { name: "Mossgrove", domain: "mossgrove.example", pull: 0.3 },
];
/** Tracked and never named, which the product reports as a zero, not a gap. */
const SILENT_RIVAL = { name: "Amberstill", domain: "amberstill.example" };
const REVIEW_SITES = ["steepreview.example", "leafguide.example", "brewforum.example"];

const MODELS = [
  { id: "demo/assistant-a", name: "Demo assistant A", searches: true },
  { id: "demo/assistant-b", name: "Demo assistant B", searches: true },
  { id: "demo/assistant-c", name: "Demo assistant C", searches: false },
];

const TOPICS: Array<{ id: string; name: string; description: string; prompts: Array<{ text: string; intent: PromptIntent; subtopic?: string }> }> = [
  {
    id: "demo-topic-buying",
    name: "Buying loose-leaf tea",
    description: "Where a buyer starts when they want good tea delivered.",
    prompts: [
      { text: "best place to buy loose leaf tea online", intent: "discovery", subtopic: "Where to buy" },
      { text: "where to buy single estate green tea", intent: "discovery", subtopic: "Where to buy" },
      { text: "most ethical tea brands that ship worldwide", intent: "discovery", subtopic: "Sourcing" },
    ],
  },
  {
    id: "demo-topic-subscriptions",
    name: "Tea subscriptions",
    description: "Monthly boxes, the repeat purchase that matters most.",
    prompts: [
      { text: "best tea subscription box", intent: "discovery" },
      { text: "kettlewren alternatives", intent: "alternatives" },
      { text: "kettlewren vs driftleaf subscription", intent: "comparison" },
    ],
  },
  {
    id: "demo-topic-brewing",
    name: "Brewing help",
    description: "Questions that name a job rather than a shop.",
    prompts: [
      { text: "how long should i steep oolong", intent: "problem" },
      { text: "is velloran tea any good", intent: "brand" },
    ],
  },
];

/** One week apart. The shape is the point: a slow start, an outage, a recovery. */
const RUNS: Array<{ at: string; outcome: "good" | "partial" | "failed"; reach: number }> = [
  { at: "2026-09-07T09:00:00.000Z", outcome: "good", reach: 0.15 },
  { at: "2026-09-14T09:00:00.000Z", outcome: "partial", reach: 0.25 },
  { at: "2026-09-21T09:00:00.000Z", outcome: "failed", reach: 0 },
  { at: "2026-09-28T09:00:00.000Z", outcome: "good", reach: 0.35 },
  { at: "2026-10-05T09:00:00.000Z", outcome: "good", reach: 0.5 },
];

/** Each question asked twice, so a run has enough answers to read a figure off. */
const REPETITIONS = 2;

const FAILURES = [
  { code: "rate_limited", message: "Demo: the model was asked more often than its plan allows." },
  { code: "timeout", message: "Demo: the model did not answer in the time allowed." },
];

/** A small seeded generator, so the demo is the same on every machine. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function project(): ProductProject {
  return {
    id: DEMO_PROJECT_ID,
    name: `Demo: ${DEMO_BRAND} (made up)`,
    primaryDomain: DEMO_DOMAIN,
    normalizedDomain: DEMO_DOMAIN,
    brandName: DEMO_BRAND,
    aliases: ["Velloran"],
    defaultLanguage: "en",
    status: "active",
    createdAt: "2026-09-01T09:00:00.000Z",
    updatedAt: "2026-09-01T09:00:00.000Z",
  };
}

function topicSet(): TopicSet {
  const created = "2026-09-01T09:00:00.000Z";
  const topics: Topic[] = TOPICS.map((topic) => ({
    id: topic.id, projectId: DEMO_PROJECT_ID, name: topic.name, description: topic.description,
    source: "authored", status: "active", createdAt: created,
  }));
  const prompts: Prompt[] = TOPICS.flatMap((topic) => topic.prompts.map((row, index) => {
    const namesBrand = row.intent === "brand";
    return {
      id: `${topic.id}-q${index + 1}`,
      projectId: DEMO_PROJECT_ID,
      topicId: topic.id,
      text: row.text,
      normalizedText: normalizePrompt(row.text),
      intent: row.intent,
      subtopic: row.subtopic ?? null,
      source: "authored",
      measuresVisibility: !namesBrand,
      visibilityExclusionReason: namesBrand ? "names_the_brand" : null,
      status: "active",
      createdAt: created,
      activatedAt: created,
    };
  }));
  return { projectId: DEMO_PROJECT_ID, topics, prompts, generatedAt: null, updatedAt: created };
}

function competitors(): Competitor[] {
  return [...RIVALS.slice(0, 3), SILENT_RIVAL].map((rival) => ({
    id: competitorId(DEMO_PROJECT_ID, rival.name),
    name: rival.name,
    domain: rival.domain,
    source: "declared",
    tracked: true,
    addedAt: "2026-09-01T09:00:00.000Z",
  }));
}

const LINES = [
  (name: string) => `${name} is the one most buyers mention first, mainly for its single-estate range.`,
  (name: string) => `${name} is worth a look if you want a monthly box with tasting notes.`,
  (name: string) => `${name} is cheaper, though the selection is narrower.`,
  (name: string) => `Some reviewers say ${name} ships slowly outside its home market.`,
];

/** An answer naming a few brands in an order the seed decides. */
function answerBody(prompt: Prompt, reach: number, random: () => number): { text: string; mentions: AnswerMention[] } {
  const pool = RIVALS.filter((rival) => random() < rival.pull).map((rival) => ({ ...rival, target: false }));
  const brandAsked = prompt.intent === "brand";
  // A question the brand is never named in, so "absent from" has a row.
  const reachable = prompt.intent !== "problem";
  if (brandAsked || (reachable && random() < reach)) {
    const place = brandAsked ? 0 : Math.floor(random() * (pool.length + 1));
    pool.splice(place, 0, { name: DEMO_BRAND, domain: DEMO_DOMAIN, pull: 1, target: true });
  }
  const named = pool.slice(0, LINES.length);
  if (!named.length) {
    return { text: `There is no single answer to "${prompt.text}". It depends on taste and budget.`, mentions: [] };
  }
  const sentences = named.map((row, index) => (LINES[index] as (name: string) => string)(row.name));
  const text = [`Here are a few options for "${prompt.text}".`, ...sentences].join(" ");
  const mentions: AnswerMention[] = named.map((row, index) => ({
    name: row.name,
    domain: row.domain,
    recommendation: index === 0 ? "positive" : index === named.length - 1 && named.length > 2 ? "negative" : "mentioned",
    mentionQuote: sentences[index] || null,
    firstMentionOffset: null,
    firstMentionState: "unresolved",
    isTarget: row.target,
  }));
  return { text, mentions: corroborateMentions({ answer: text, mentions }) };
}

/** Cited pages: rivals' own pages, review sites, and the brand now and then. */
function citations(prompt: Prompt, mentions: AnswerMention[], random: () => number): string[] {
  const pages = mentions.filter((row) => !row.isTarget || random() < 0.5)
    .map((row) => `https://${row.domain}/${row.isTarget ? "blog/brewing-guide" : prompt.topicId.slice("demo-topic-".length)}`);
  const review = REVIEW_SITES[Math.floor(random() * REVIEW_SITES.length)] as string;
  return [...new Set([`https://${review}/${prompt.text.split(" ").join("-")}`, ...pages])];
}

type RunPlan = (typeof RUNS)[number];
type DemoModel = (typeof MODELS)[number];

function answerFor(run: PromptRun, plan: RunPlan, prompt: Prompt, model: DemoModel, slot: { prompt: number; model: number; repetition: number }, random: () => number): PromptAnswer {
  const order = (slot.prompt * MODELS.length + slot.model) * REPETITIONS + slot.repetition;
  const base = {
    id: `${run.id}-${prompt.id}-${slot.model + 1}-${slot.repetition}`,
    projectId: DEMO_PROJECT_ID,
    runId: run.id,
    promptId: prompt.id,
    topicId: prompt.topicId,
    promptText: prompt.text,
    intent: prompt.intent,
    providerId: "openai-compatible" as const,
    modelId: model.id,
    modelDisplayName: model.name,
    regionId: "global",
    languageId: "en",
    repetition: slot.repetition,
    createdAt: new Date(Date.parse(run.startedAt) + order * 7000).toISOString(),
  };
  if (plan.outcome === "failed" || (plan.outcome === "partial" && slot.model === 1)) {
    const failure = plan.outcome === "failed"
      ? { code: "authentication", message: "Demo: the provider refused the key." }
      : FAILURES[slot.prompt % FAILURES.length] as { code: string; message: string };
    return { ...base, status: "provider_failed", text: "", mentions: [], citationUrls: [], errorCode: failure.code, errorMessage: failure.message, latencyMs: null };
  }
  const body = answerBody(prompt, plan.reach, random);
  return {
    ...base,
    status: "completed",
    text: body.text,
    mentions: body.mentions,
    citationUrls: model.searches ? citations(prompt, body.mentions, random) : [],
    search: model.searches
      ? { requested: true, used: true, usedMode: "provider_native", queries: [prompt.text] }
      : { requested: false, used: false, usedMode: "none", queries: [] },
    errorCode: null,
    errorMessage: null,
    latencyMs: 1200 + Math.floor(random() * 3000),
  };
}

function answersFor(run: PromptRun, plan: RunPlan, set: TopicSet, random: () => number): PromptAnswer[] {
  const answers: PromptAnswer[] = [];
  set.prompts.forEach((prompt, promptIndex) => {
    MODELS.forEach((model, modelIndex) => {
      for (let repetition = 1; repetition <= REPETITIONS; repetition += 1) {
        answers.push(answerFor(run, plan, prompt, model, { prompt: promptIndex, model: modelIndex, repetition }, random));
      }
    });
  });
  return answers;
}

function runRecord(index: number, plan: RunPlan, set: TopicSet): PromptRun {
  const status: PromptRunStatus = plan.outcome === "good" ? "completed" : plan.outcome;
  return {
    id: `demo-run-${index + 1}`,
    projectId: DEMO_PROJECT_ID,
    status,
    promptIds: set.prompts.map((prompt) => prompt.id),
    modelIds: MODELS.map((model) => model.id),
    regionIds: ["global"],
    languageIds: ["en"],
    repetitions: REPETITIONS,
    answersRequested: set.prompts.length * MODELS.length * REPETITIONS,
    answersCompleted: 0,
    answersFailed: 0,
    startedAt: plan.at,
    completedAt: new Date(Date.parse(plan.at) + 15 * 60 * 1000).toISOString(),
  };
}

/** Writes the demo project under a product data directory, through the same
 * stores the server reads, and returns what it wrote. */
export async function writeDemoProject(rootDir: string): Promise<{ project: ProductProject; runs: PromptRun[]; answers: PromptAnswer[] }> {
  const store = new ProductProjectFileStore(rootDir);
  const runStore = new PromptRunFileStore(store, new AnswerIndexService({ dir: join(rootDir, "index") }));
  const random = seeded(20260901);
  const set = topicSet();
  await store.save(project());
  await new TopicFileStore(store).save(set);
  await new CompetitorFileStore(store).save({ projectId: DEMO_PROJECT_ID, competitors: competitors(), updatedAt: "2026-09-01T09:00:00.000Z" });

  const runs: PromptRun[] = [];
  const answers: PromptAnswer[] = [];
  for (const [index, plan] of RUNS.entries()) {
    const run = runRecord(index, plan, set);
    const written = answersFor(run, plan, set, random);
    run.answersCompleted = written.filter((answer) => answer.status === "completed").length;
    run.answersFailed = written.length - run.answersCompleted;
    for (const answer of written) await runStore.saveAnswer(answer);
    await runStore.saveRun(run);
    runs.push(run);
    answers.push(...written);
  }
  return { project: project(), runs, answers };
}
