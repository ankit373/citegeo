import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProductProjectFileStore } from "../src/product/projects/project-store.js";
import { ProductProjectService } from "../src/product/projects/project-service.js";
import { SiteSignalFileStore } from "../src/product/actions/signal-store.js";
import { SiteSignalProbeService } from "../src/product/actions/signal-probe.js";
import type { SiteSignals } from "../src/product/actions/site-signals.js";

function signals(overrides: Partial<SiteSignals> = {}): SiteSignals {
  return {
    domain: "example.com",
    checkedAt: "2026-01-01T00:00:00.000Z",
    reachable: true,
    robots: { present: true, blocked: [], allowed: ["GPTBot"] },
    llmsTxt: { present: true, bytes: 10 },
    structuredData: { organization: true, sameAs: [], independent: [] },
    wikidata: { present: false, id: null, searched: "Example" },
    ...overrides,
  };
}

async function withProject(run: (input: {
  projects: ProductProjectService;
  store: SiteSignalFileStore;
  projectId: string;
}) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "citegeo-signals-"));
  try {
    const fileStore = new ProductProjectFileStore(root);
    const projects = new ProductProjectService(fileStore);
    const project = await projects.createDraft({ primaryDomain: "example.com", name: "Example" });
    await run({ projects, store: new SiteSignalFileStore(fileStore), projectId: project.id });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("the first capture stores a snapshot with no changes", async () => {
  await withProject(async ({ projects, store, projectId }) => {
    const probe = new SiteSignalProbeService(projects, store, async () => signals());
    const snapshot = await probe.capture(projectId);
    assert.deepEqual(snapshot.changes, []);
    assert.equal((await store.list(projectId)).length, 1);
  });
});

test("a later capture records what moved since the last one", async () => {
  await withProject(async ({ projects, store, projectId }) => {
    let current = signals();
    const probe = new SiteSignalProbeService(projects, store, async () => current);
    await probe.capture(projectId, new Date("2026-01-01T00:00:00Z"));
    current = signals({ robots: { present: true, blocked: ["GPTBot"], allowed: [] } });
    const second = await probe.capture(projectId, new Date("2026-01-02T00:00:00Z"));
    assert.equal(second.changes.length, 1);
    assert.equal(second.changes[0]?.direction, "regressed");
  });
});

test("history is newest first", async () => {
  await withProject(async ({ projects, store, projectId }) => {
    const probe = new SiteSignalProbeService(projects, store, async () => signals());
    await probe.capture(projectId, new Date("2026-01-01T00:00:00Z"));
    await probe.capture(projectId, new Date("2026-01-03T00:00:00Z"));
    const history = await probe.history(projectId);
    assert.equal(history[0]?.capturedAt, "2026-01-03T00:00:00.000Z");
  });
});

test("probeDue skips a project whose snapshot is still current", async () => {
  await withProject(async ({ projects, store, projectId }) => {
    let reads = 0;
    const probe = new SiteSignalProbeService(projects, store, async () => { reads += 1; return signals(); });
    await probe.capture(projectId, new Date("2026-01-01T00:00:00Z"));
    assert.equal(reads, 1);
    const outcomes = await probe.probeDue(new Date("2026-01-01T06:00:00Z"), 24);
    assert.equal(reads, 1, "nothing was fetched again");
    assert.equal(outcomes[0]?.captured, false);
  });
});

test("probeDue captures once the interval has elapsed", async () => {
  await withProject(async ({ projects, store, projectId }) => {
    let reads = 0;
    const probe = new SiteSignalProbeService(projects, store, async () => { reads += 1; return signals(); });
    await probe.capture(projectId, new Date("2026-01-01T00:00:00Z"));
    const outcomes = await probe.probeDue(new Date("2026-01-02T01:00:00Z"), 24);
    assert.equal(reads, 2);
    assert.equal(outcomes[0]?.captured, true);
  });
});

test("a project with no snapshot is always due", async () => {
  await withProject(async ({ projects, store, projectId }) => {
    const probe = new SiteSignalProbeService(projects, store, async () => signals());
    const outcomes = await probe.probeDue(new Date("2026-01-01T00:00:00Z"), 24);
    assert.equal(outcomes.length, 1);
    assert.equal(outcomes[0]?.projectId, projectId);
    assert.equal(outcomes[0]?.captured, true);
  });
});

test("one unreachable project does not stop the others being probed", async () => {
  await withProject(async ({ projects, store }) => {
    const second = await projects.createDraft({ primaryDomain: "other.example", name: "Other" });
    const probe = new SiteSignalProbeService(projects, store, async (domain) => {
      if (domain === "example.com") throw new Error("DNS failure");
      return signals({ domain });
    });
    const outcomes = await probe.probeDue(new Date("2026-01-01T00:00:00Z"), 24);
    assert.equal(outcomes.length, 1);
    assert.equal(outcomes[0]?.projectId, second.id);
  });
});
