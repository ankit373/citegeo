import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AnswerDigestBaselineStore, deliverAnswerDigest } from "../src/product/alerts/answer-digest-run.js";
import { buildAnswerDigest } from "../src/product/alerts/answer-digest.js";
import type { HomeSummary } from "../src/product/alerts/home-summary.js";

function home(overrides: Partial<HomeSummary> = {}): HomeSummary {
  return {
    projectId: "p", domain: "example.com", score: 25, change: null, rank: 3, rivals: 9,
    answers: 12, modelCount: 3, alerts: [], weakestTopics: [], absentFrom: [], lastRun: null,
    setup: [], ready: true, showSetupOnly: false, ...overrides,
  };
}

async function harness() {
  const dir = await mkdtemp(join(tmpdir(), "citegeo-digest-"));
  return { store: new AnswerDigestBaselineStore(dir), cleanup: () => rm(dir, { recursive: true, force: true }) };
}

const MOVED = () => buildAnswerDigest({ home: home(), previous: { score: 40, rank: 3, answers: 12, alertCount: 0 } });

test("nothing moved means nothing is sent, and no endpoint is even needed", async () => {
  const { store, cleanup } = await harness();
  try {
    const quiet = buildAnswerDigest({ home: home({ score: 40 }), previous: { score: 40, rank: 3, answers: 12, alertCount: 0 } });
    let called = false;
    const result = await deliverAnswerDigest({ digest: quiet, store, url: "https://hook.test", send: async () => { called = true; return { ok: true, status: 200 }; } });
    assert.equal(result.outcome, "no_news");
    assert.equal(called, false);
  } finally {
    await cleanup();
  }
});

test("news with no endpoint says so rather than failing", async () => {
  const { store, cleanup } = await harness();
  try {
    assert.equal((await deliverAnswerDigest({ digest: MOVED(), store })).outcome, "not_configured");
  } finally {
    await cleanup();
  }
});

test("a failed send leaves the baseline alone, so the news is offered again", async () => {
  const { store, cleanup } = await harness();
  try {
    const first = await deliverAnswerDigest({ digest: MOVED(), store, url: "https://hook.test", send: async () => ({ ok: false, status: 500 }) });
    assert.equal(first.outcome, "failed");
    assert.equal(await store.read("p"), null, "nothing was recorded as delivered");

    const second = await deliverAnswerDigest({ digest: MOVED(), store, url: "https://hook.test", send: async () => ({ ok: true, status: 200 }) });
    assert.equal(second.outcome, "sent");
    assert.equal((await store.read("p"))?.score, 25);
  } finally {
    await cleanup();
  }
});

test("a sender that throws is a failure, not a crash", async () => {
  const { store, cleanup } = await harness();
  try {
    const result = await deliverAnswerDigest({ digest: MOVED(), store, url: "https://hook.test", send: async () => { throw new Error("connection refused"); } });
    assert.equal(result.outcome, "failed");
    assert.ok(result.detail.includes("connection refused"));
  } finally {
    await cleanup();
  }
});

test("the delivered body is the digest itself, so a hook can read the figures", async () => {
  const { store, cleanup } = await harness();
  try {
    let body = "";
    await deliverAnswerDigest({ digest: MOVED(), store, url: "https://hook.test", send: async (input) => { body = input.body; return { ok: true, status: 200 }; } });
    const parsed = JSON.parse(body);
    assert.equal(parsed.domain, "example.com");
    assert.ok(parsed.lines.some((line: string) => line.includes("fell 15 to 25")));
  } finally {
    await cleanup();
  }
});
