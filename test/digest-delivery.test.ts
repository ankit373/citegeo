import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DigestBaselineStore, deliverDigest } from "../src/product/reporting/delivery.js";
import type { Digest } from "../src/product/reporting/digest.js";

function digest(overrides: Partial<Digest> = {}): Digest {
  return {
    projectId: "p",
    domain: "example.com",
    builtAt: "2026-01-01T00:00:00.000Z",
    newsworthy: true,
    reasons: ["Visibility moved from 0% to 50%."],
    headline: "example.com: 50% visibility",
    baseline: { visibilityScore: 0.5, recognized: 2, answered: 4, criticalCount: 0, citationGapCount: 0 },
    signalChanges: [],
    criticalActions: [],
    newCitationGaps: [],
    ...overrides,
  };
}

async function withStore(run: (store: DigestBaselineStore) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "citegeo-digest-"));
  try {
    await run(new DigestBaselineStore(dir));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("nothing is sent when there is no news", async () => {
  await withStore(async (store) => {
    let calls = 0;
    const result = await deliverDigest({
      digest: digest({ newsworthy: false, reasons: [] }),
      store,
      url: "https://hooks.example/x",
      send: async () => { calls += 1; return { ok: true, status: 200 }; },
    });
    assert.equal(result.outcome, "no_news");
    assert.equal(calls, 0);
  });
});

test("with no destination configured it says so rather than failing", async () => {
  await withStore(async (store) => {
    const previous = process.env.REPORT_WEBHOOK_URL;
    delete process.env.REPORT_WEBHOOK_URL;
    try {
      const result = await deliverDigest({ digest: digest(), store, send: async () => ({ ok: true, status: 200 }) });
      assert.equal(result.outcome, "not_configured");
    } finally {
      if (previous !== undefined) process.env.REPORT_WEBHOOK_URL = previous;
    }
  });
});

test("a successful delivery records the baseline so the next digest can diff", async () => {
  await withStore(async (store) => {
    const result = await deliverDigest({
      digest: digest(),
      store,
      url: "https://hooks.example/x",
      send: async () => ({ ok: true, status: 200 }),
    });
    assert.equal(result.outcome, "sent");
    assert.deepEqual(await store.read("p"), digest().baseline);
  });
});

test("a rejected delivery leaves the baseline alone, so the news is offered again", async () => {
  await withStore(async (store) => {
    const result = await deliverDigest({
      digest: digest(),
      store,
      url: "https://hooks.example/x",
      send: async () => ({ ok: false, status: 500 }),
    });
    assert.equal(result.outcome, "failed");
    assert.equal(result.status, 500);
    assert.equal(await store.read("p"), null, "recording it would swallow the change it was meant to report");
  });
});

test("a transport error is failure, not silent success", async () => {
  await withStore(async (store) => {
    const result = await deliverDigest({
      digest: digest(),
      store,
      url: "https://hooks.example/x",
      send: async () => { throw new Error("DNS failure"); },
    });
    assert.equal(result.outcome, "failed");
    assert.ok(result.detail.includes("DNS failure"));
    assert.equal(await store.read("p"), null);
  });
});

test("the digest is sent as JSON to the configured url", async () => {
  await withStore(async (store) => {
    const seen: Array<{ url: string; body: string }> = [];
    await deliverDigest({
      digest: digest(),
      store,
      url: "https://hooks.example/target",
      send: async (input) => { seen.push(input); return { ok: true, status: 204 }; },
    });
    assert.equal(seen[0]?.url, "https://hooks.example/target");
    const parsed = JSON.parse(seen[0]?.body || "{}") as Digest;
    assert.equal(parsed.domain, "example.com");
    assert.equal(parsed.reasons.length, 1);
  });
});

test("baselines are kept per project", async () => {
  await withStore(async (store) => {
    const send = async () => ({ ok: true, status: 200 });
    await deliverDigest({ digest: digest({ projectId: "a" }), store, url: "https://x", send });
    await deliverDigest({
      digest: digest({ projectId: "b", baseline: { visibilityScore: 1, recognized: 4, answered: 4, criticalCount: 0, citationGapCount: 0 } }),
      store,
      url: "https://x",
      send,
    });
    assert.equal((await store.read("a"))?.visibilityScore, 0.5);
    assert.equal((await store.read("b"))?.visibilityScore, 1);
  });
});

test("an unreadable baseline reads as none rather than throwing", async () => {
  await withStore(async (store) => {
    assert.equal(await store.read("never-written"), null);
  });
});
