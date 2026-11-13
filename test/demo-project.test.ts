import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEMO_DOMAIN, DEMO_PROJECT_ID, writeDemoProject } from "../src/product/demo/demo-project.js";
import { ProductProjectFileStore } from "../src/product/projects/project-store.js";
import { CompetitorFileStore } from "../src/product/topics/competitor-set.js";
import { PromptRunFileStore } from "../src/product/topics/prompt-run-store.js";
import { TopicFileStore } from "../src/product/topics/topic-store.js";
import { buildTopicInsights } from "../src/product/topics/topic-insights.js";
import { domainLabel } from "../src/product/topics/prompt-identity.js";

async function readBack() {
  const dir = await mkdtemp(join(tmpdir(), "citegeo-demo-"));
  const written = await writeDemoProject(dir);
  const store = new ProductProjectFileStore(dir);
  const runStore = new PromptRunFileStore(store);
  const [project, set, rivals, runs, answers] = await Promise.all([
    store.read(DEMO_PROJECT_ID),
    new TopicFileStore(store).load(DEMO_PROJECT_ID),
    new CompetitorFileStore(store).load(DEMO_PROJECT_ID),
    runStore.listRuns(DEMO_PROJECT_ID),
    runStore.listAnswers(DEMO_PROJECT_ID),
  ]);
  const insights = buildTopicInsights({ projectId: DEMO_PROJECT_ID, set, answers, runs, competitors: rivals.competitors });
  return { dir, written, project, set, rivals, runs, answers, insights };
}

test("the demo reads back through the stores the server uses", async () => {
  const demo = await readBack();
  try {
    assert.ok(demo.project, "the project is listed");
    assert.equal(demo.runs.length, demo.written.runs.length);
    assert.equal(demo.answers.length, demo.written.answers.length);
    assert.ok(demo.set.prompts.length > 0);
  } finally {
    await rm(demo.dir, { recursive: true, force: true });
  }
});

test("the demo is marked as made up, and points at no real site", async () => {
  const demo = await readBack();
  try {
    assert.ok(demo.project?.name.startsWith("Demo:"));
    assert.ok(demo.project?.name.includes("made up"));
    const hosts = [
      DEMO_DOMAIN,
      ...demo.rivals.competitors.map((row) => row.domain || ""),
      ...demo.answers.flatMap((answer) => answer.citationUrls.map((url) => new URL(url).hostname)),
      ...demo.answers.flatMap((answer) => answer.mentions.map((row) => row.domain || "")),
    ];
    for (const host of hosts) assert.ok(host.endsWith(".example"), `${host} is a reserved name`);
    for (const answer of demo.answers) assert.ok(answer.modelDisplayName.startsWith("Demo "));
  } finally {
    await rm(demo.dir, { recursive: true, force: true });
  }
});

test("the demo covers good runs, failed runs, rivals and citations", async () => {
  const demo = await readBack();
  try {
    const statuses = new Set(demo.runs.map((run) => run.status));
    assert.ok(statuses.has("completed"), "a run that went well");
    assert.ok(statuses.has("partial"), "a run where one model failed");
    assert.ok(statuses.has("failed"), "a run where everything failed");
    assert.ok(demo.insights.failureReasons.length >= 2, "failures carry their causes");
    assert.ok(demo.insights.leaderboard.some((row) => row.isTarget), "the brand is named");
    assert.ok(demo.insights.leaderboard.filter((row) => !row.isTarget).length >= 3, "and so are rivals");
    assert.ok(demo.insights.trackedRivals.some((row) => row.appearances === 0), "a tracked rival nobody named");
    assert.ok(demo.insights.absentFrom.length > 0, "a question the brand is never named in");
    assert.ok(demo.answers.some((answer) => answer.citationUrls.length > 0), "answers cite pages");
    assert.ok(demo.answers.some((answer) => answer.status === "completed" && !answer.citationUrls.length), "and one model never searches");
    assert.notEqual(demo.insights.trend.change, null, "there is a move to report");
  } finally {
    await rm(demo.dir, { recursive: true, force: true });
  }
});

test("the demo is the same every time it is written", async () => {
  const first = await readBack();
  const second = await readBack();
  try {
    assert.deepEqual(second.written, first.written);
  } finally {
    await rm(first.dir, { recursive: true, force: true });
    await rm(second.dir, { recursive: true, force: true });
  }
});

test("a made-up site on a reserved name reads as its own name", () => {
  assert.equal(domainLabel(DEMO_DOMAIN), "velloran tea");
  assert.notEqual(domainLabel("kettlewren.example"), domainLabel("driftleaf.example"));
  assert.equal(domainLabel("example.com"), "example", "a real name that happens to be the word");
});
