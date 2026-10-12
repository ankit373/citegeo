import test from "node:test";
import assert from "node:assert/strict";
import { appendFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CrawlerLogIngestService, CrawlerLogStateStore, UPLOAD_SOURCE } from "../src/product/crawlers/crawler-ingest.js";
import { ProductProjectFileStore } from "../src/product/projects/project-store.js";
import { completeLines, emptyCrawlerState, mergeCrawlerEntries, planNextRead } from "../src/product/crawlers/crawler-state.js";
import { parseAccessLog } from "../src/product/crawlers/access-log.js";

const PROJECT = "p-1";
const GPTBOT = "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)";
const CLAUDEBOT = "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)";
const line = (path: string, ua: string, status = 200, when = "19/Sep/2026:12:00:00 +0000") =>
  `1.2.3.4 - - [${when}] "GET ${path} HTTP/1.1" ${status} 512 "-" "${ua}"\n`;

async function harness(run: (input: { dir: string; log: string; service: CrawlerLogIngestService }) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), "citegeo-ingest-"));
  try {
    const log = join(dir, "access.log");
    const service = new CrawlerLogIngestService(new CrawlerLogStateStore(new ProductProjectFileStore(dir)), () => log);
    await run({ dir, log, service });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("only whole lines are consumed, so a half-written line is left for next time", () => {
  const { text, consumed } = completeLines("full line\npartial line without a break");
  assert.equal(text, "full line\n");
  assert.equal(consumed, 10);
});

test("a chunk with no line break consumes nothing", () => {
  assert.deepEqual(completeLines("no break yet"), { text: "", consumed: 0 });
});

test("a shrunken file is read from the start and its old counts are void", () => {
  const state = { ...emptyCrawlerState("/x"), offset: 5000 };
  assert.deepEqual(planNextRead(state, 100), { start: 0, restarted: true });
  assert.deepEqual(planNextRead(state, 6000), { start: 5000, restarted: false });
});

test("merging is additive across separate batches", () => {
  let state = emptyCrawlerState("/x");
  state = mergeCrawlerEntries(state, parseAccessLog(line("/a", GPTBOT)));
  state = mergeCrawlerEntries(state, parseAccessLog(line("/a", GPTBOT) + line("/b", GPTBOT)));
  assert.equal(state.totalFetches, 3);
  assert.equal(state.crawlers.GPTBot?.fetches, 3);
  assert.deepEqual(state.crawlers.GPTBot?.pages, ["/a", "/b"], "a repeated page is listed once");
  assert.equal(state.pages["/a"]?.fetches, 2);
});

test("a second pass reads only what was appended", async () => {
  await harness(async ({ log, service }) => {
    await writeFile(log, line("/a", GPTBOT));
    const first = await service.ingest(PROJECT);
    assert.equal(first.state, "ingested");
    assert.equal(first.linesParsed, 1);

    await appendFile(log, line("/b", CLAUDEBOT));
    const second = await service.ingest(PROJECT);
    assert.equal(second.linesParsed, 1, "only the appended line is parsed again");
    assert.equal(second.activity?.totalFetches, 2, "and the counts accumulate");
  });
});

test("an unchanged log does no work and still reports the accumulated activity", async () => {
  await harness(async ({ log, service }) => {
    await writeFile(log, line("/a", GPTBOT));
    await service.ingest(PROJECT);
    const again = await service.ingest(PROJECT);
    assert.equal(again.state, "up_to_date");
    assert.equal(again.bytesRead, 0);
    assert.equal(again.activity?.totalFetches, 1);
  });
});

test("a rotated log is detected and counted from the start rather than doubled", async () => {
  await harness(async ({ log, service }) => {
    await writeFile(log, line("/a", GPTBOT) + line("/b", GPTBOT) + line("/c", GPTBOT));
    const first = await service.ingest(PROJECT);
    assert.equal(first.activity?.totalFetches, 3);

    await writeFile(log, line("/fresh", GPTBOT));
    const second = await service.ingest(PROJECT);
    assert.equal(second.restarted, true);
    assert.equal(second.activity?.totalFetches, 1, "the rotated file's history is not carried over");
  });
});

test("a partial trailing line is not consumed until it is complete", async () => {
  await harness(async ({ log, service }) => {
    await writeFile(log, line("/a", GPTBOT) + '1.2.3.4 - - [19/Sep/2026:12:00:00 +0000] "GET /part');
    const first = await service.ingest(PROJECT);
    assert.equal(first.linesParsed, 1);

    await appendFile(log, 'ial HTTP/1.1" 200 512 "-" "' + GPTBOT + '"\n');
    const second = await service.ingest(PROJECT);
    assert.equal(second.linesParsed, 1);
    assert.equal(second.activity?.pages.some((page) => page.path === "/partial"), true);
  });
});

test("pointing at a different log starts fresh rather than mixing two sites", async () => {
  await harness(async ({ dir, log }) => {
    const store = new CrawlerLogStateStore(new ProductProjectFileStore(dir));
    await writeFile(log, line("/a", GPTBOT));
    await new CrawlerLogIngestService(store, () => log).ingest(PROJECT);

    const other = join(dir, "other.log");
    await writeFile(other, line("/z", GPTBOT));
    const outcome = await new CrawlerLogIngestService(store, () => other).ingest(PROJECT);
    assert.equal(outcome.activity?.totalFetches, 1);
    assert.equal(outcome.source, other);
  });
});

test("with no log configured it says so instead of reporting an empty crawl", async () => {
  await harness(async ({ dir }) => {
    const service = new CrawlerLogIngestService(new CrawlerLogStateStore(new ProductProjectFileStore(dir)), () => undefined);
    const outcome = await service.ingest(PROJECT);
    assert.equal(outcome.state, "not_configured");
    assert.equal(outcome.activity, null);
  });
});

test("a missing file is unreadable rather than empty", async () => {
  await harness(async ({ dir }) => {
    const service = new CrawlerLogIngestService(new CrawlerLogStateStore(new ProductProjectFileStore(dir)), () => join(dir, "absent.log"));
    const outcome = await service.ingest(PROJECT);
    assert.equal(outcome.state, "unreadable");
  });
});

test("current() reports stored activity without touching the log", async () => {
  await harness(async ({ log, service }) => {
    await writeFile(log, line("/a", GPTBOT));
    await service.ingest(PROJECT);
    await rm(log);
    const outcome = await service.current(PROJECT);
    assert.equal(outcome.activity?.totalFetches, 1, "the log is gone but the evidence was kept");
  });
});

test("an uploaded log is counted against the project that uploaded it", async () => {
  await harness(async ({ service }) => {
    const text = line("/pricing", GPTBOT) + line("/docs", CLAUDEBOT);
    const first = await service.addLog(PROJECT, text);
    assert.equal(first.state, "ingested");
    assert.equal(first.linesParsed, 2);
    assert.equal(first.source, UPLOAD_SOURCE);
    assert.equal(first.activity?.totalFetches, 2);

    // Another project on the same server has its own state and sees none of it.
    const other = await service.current("p-2");
    assert.equal(other.activity, null);
  });
});

test("the same log uploaded twice is counted once", async () => {
  await harness(async ({ service }) => {
    const text = line("/pricing", GPTBOT);
    await service.addLog(PROJECT, text);
    const again = await service.addLog(PROJECT, text);
    assert.equal(again.state, "already_counted");
    assert.equal(again.activity?.totalFetches, 1, "a second post of the same bytes would double every figure");
  });
});

test("a project counting its own log is left out of the server's", async () => {
  await harness(async ({ log, service }) => {
    await service.addLog(PROJECT, line("/pricing", GPTBOT));
    await writeFile(log, line("/somebody-elses-site", CLAUDEBOT), "utf8");
    const pass = await service.ingest(PROJECT);
    assert.equal(pass.state, "up_to_date");
    assert.equal(pass.activity?.totalFetches, 1, "the server's log is a different site's traffic");
  });
});

test("an uploaded log survives a read where no path is configured", async () => {
  // The read reported not_configured before it looked, so an upload could be
  // made and never seen again.
  const { mkdtemp: make } = await import("node:fs/promises");
  const dir = await make(join(tmpdir(), "citegeo-upload-"));
  try {
    const service = new CrawlerLogIngestService(new CrawlerLogStateStore(new ProductProjectFileStore(dir)), () => undefined);
    await service.addLog(PROJECT, line("/pricing", GPTBOT));
    const read = await service.ingest(PROJECT);
    assert.equal(read.state, "up_to_date");
    assert.equal(read.activity?.totalFetches, 1);
    assert.equal((await service.ingest("p-nothing")).state, "not_configured");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
