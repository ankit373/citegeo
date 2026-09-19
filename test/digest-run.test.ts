import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDigests } from "../src/product/reporting/digest-run.js";
import { DigestBaselineStore } from "../src/product/reporting/delivery.js";

function insightsFor(recognized: number, answered: number) {
  return {
    insights: {
      target: "example.com",
      answered,
      visibility: { recognized, answered, score: answered ? recognized / answered : null, byModel: [] },
      shareOfVoice: { target: { name: "Example", domain: "example.com", mentions: 0, share: null }, competitors: [] },
      citations: { answersWithCitations: 0, targetCitedIn: 0, domains: [] },
      categories: [],
    },
    citationGap: [],
  };
}

const signalsWith = (changes: unknown[]) => ({
  history: async () => [{
    id: "s", projectId: "p", capturedAt: "2026-01-01T00:00:00.000Z", changes,
    signals: {
      domain: "example.com", checkedAt: "2026-01-01T00:00:00.000Z", reachable: true,
      robots: { present: true, blocked: [], allowed: ["GPTBot"] },
      llmsTxt: { present: true, bytes: 10 },
      structuredData: { organization: true, sameAs: [], independent: [] },
      wikidata: { present: false, id: null, searched: "Example" },
    },
  }],
});

async function harness(run: (store: DigestBaselineStore) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "citegeo-digestrun-"));
  try {
    await run(new DigestBaselineStore(dir));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const projectsWith = (ids: string[]) => ({
  list: async () => ids.map((id) => ({ id, normalizedDomain: `${id}.example`, name: id })),
});

test("each project gets its own digest", async () => {
  await harness(async (store) => {
    const sent: string[] = [];
    const outcomes = await runDigests({
      projects: projectsWith(["a", "b"]) as never,
      insights: { build: async () => insightsFor(1, 2) } as never,
      signals: signalsWith([]) as never,
      store,
      url: "https://hooks.example/x",
      send: async ({ body }) => { sent.push(JSON.parse(body).domain); return { ok: true, status: 200 }; },
    });
    assert.equal(outcomes.length, 2);
    assert.deepEqual(sent.sort(), ["a.example", "b.example"]);
  });
});

test("a second pass with nothing changed sends nothing", async () => {
  await harness(async (store) => {
    let sends = 0;
    const deps = {
      projects: projectsWith(["a"]) as never,
      insights: { build: async () => insightsFor(1, 2) } as never,
      signals: signalsWith([]) as never,
      store,
      url: "https://hooks.example/x",
      send: async () => { sends += 1; return { ok: true, status: 200 }; },
    };
    await runDigests(deps);
    assert.equal(sends, 1, "the first digest is news");
    const second = await runDigests(deps);
    assert.equal(sends, 1, "the second has nothing to say");
    assert.equal(second[0]?.result.outcome, "no_news");
  });
});

test("one project failing does not stop the others", async () => {
  await harness(async (store) => {
    const outcomes = await runDigests({
      projects: projectsWith(["broken", "fine"]) as never,
      insights: {
        build: async (id: string) => {
          if (id === "broken") throw new Error("evidence unreadable");
          return insightsFor(1, 2);
        },
      } as never,
      signals: signalsWith([]) as never,
      store,
      url: "https://hooks.example/x",
      send: async () => ({ ok: true, status: 200 }),
    });
    assert.equal(outcomes.length, 2);
    assert.equal(outcomes.find((row) => row.projectId === "broken")?.result.outcome, "failed");
    assert.equal(outcomes.find((row) => row.projectId === "fine")?.result.outcome, "sent");
  });
});

test("a project never probed still reports its model evidence", async () => {
  await harness(async (store) => {
    const outcomes = await runDigests({
      projects: projectsWith(["a"]) as never,
      insights: { build: async () => insightsFor(0, 4) } as never,
      signals: { history: async () => [] } as never,
      store,
      url: "https://hooks.example/x",
      send: async () => ({ ok: true, status: 200 }),
    });
    assert.equal(outcomes[0]?.result.outcome, "sent");
  });
});

test("a site signal change is carried into the digest", async () => {
  await harness(async (store) => {
    const bodies: string[] = [];
    await runDigests({
      projects: projectsWith(["a"]) as never,
      insights: { build: async () => insightsFor(1, 2) } as never,
      signals: signalsWith([{ field: "llmsTxt", direction: "regressed", before: "published", after: "absent", detail: "llms.txt stopped resolving." }]) as never,
      store,
      url: "https://hooks.example/x",
      send: async ({ body }) => { bodies.push(body); return { ok: true, status: 200 }; },
    });
    const digest = JSON.parse(bodies[0] || "{}");
    assert.equal(digest.signalChanges.length, 1);
    assert.ok(digest.reasons.some((reason: string) => reason.includes("llms.txt")));
  });
});
