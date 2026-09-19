import test from "node:test";
import assert from "node:assert/strict";
import { identifyCrawler } from "../src/product/crawlers/crawler-identity.js";
import { parseAccessLog, parseAccessLogLine, parseLogTimestamp } from "../src/product/crawlers/access-log.js";
import { buildCrawlerActivity } from "../src/product/crawlers/crawler-activity.js";

const line = (path: string, ua: string, status = 200, when = "19/Sep/2026:12:00:00 +0000") =>
  `1.2.3.4 - - [${when}] "GET ${path} HTTP/1.1" ${status} 512 "-" "${ua}"`;

const GPTBOT = "Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)";
const CHATGPT_USER = "Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)";
const CLAUDEBOT = "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)";

test("overlapping vendor tokens resolve to the right bot", () => {
  assert.equal(identifyCrawler(GPTBOT)?.name, "GPTBot");
  assert.equal(identifyCrawler(CHATGPT_USER)?.name, "ChatGPT-User");
  assert.equal(identifyCrawler(CLAUDEBOT)?.name, "ClaudeBot");
  assert.equal(identifyCrawler("Mozilla/5.0 (compatible; Claude-User/1.0)")?.name, "Claude-User");
});

test("a live fetch is separated from a training crawl", () => {
  assert.equal(identifyCrawler(CHATGPT_USER)?.purpose, "live_fetch");
  assert.equal(identifyCrawler(GPTBOT)?.purpose, "training");
});

test("an ordinary browser is not a crawler", () => {
  assert.equal(identifyCrawler("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/140"), null);
});

test("a combined log line yields path, status, agent and an ISO timestamp", () => {
  const entry = parseAccessLogLine(line("/pricing", GPTBOT, 200));
  assert.equal(entry?.path, "/pricing");
  assert.equal(entry?.method, "GET");
  assert.equal(entry?.status, 200);
  assert.equal(entry?.at, "2026-09-19T12:00:00.000Z");
});

test("a malformed line is skipped rather than throwing", () => {
  assert.equal(parseAccessLogLine("not a log line"), null);
  assert.equal(parseAccessLogLine(""), null);
  assert.equal(parseAccessLog("garbage\n\nmore garbage").length, 0);
});

test("an unparseable timestamp does not discard the entry", () => {
  const entry = parseAccessLogLine(line("/x", GPTBOT, 200, "not-a-date"));
  assert.equal(entry?.path, "/x");
  assert.equal(entry?.at, null);
});

test("fetches are grouped by crawler and by page", () => {
  const activity = buildCrawlerActivity({
    entries: parseAccessLog([
      line("/pricing", GPTBOT),
      line("/pricing", CLAUDEBOT),
      line("/about", GPTBOT),
    ].join("\n")),
  });
  assert.equal(activity.totalFetches, 3);
  const gpt = activity.crawlers.find((row) => row.name === "GPTBot");
  assert.equal(gpt?.fetches, 2);
  assert.equal(gpt?.pages, 2);
  assert.equal(activity.pages[0]?.path, "/pricing");
  assert.deepEqual(activity.pages[0]?.crawlers, ["ClaudeBot", "GPTBot"]);
});

test("a query string and a trailing slash do not split one page in two", () => {
  const activity = buildCrawlerActivity({
    entries: parseAccessLog([line("/pricing/", GPTBOT), line("/pricing?utm=x", GPTBOT)].join("\n")),
  });
  assert.equal(activity.pages.length, 1);
  assert.equal(activity.pages[0]?.fetches, 2);
});

test("an allowed crawler that never arrives is reported, which is the actionable state", () => {
  const activity = buildCrawlerActivity({
    entries: parseAccessLog(line("/", GPTBOT)),
    allowedCrawlers: ["GPTBot", "ClaudeBot", "PerplexityBot"],
  });
  assert.deepEqual(activity.allowedButAbsent, ["ClaudeBot", "PerplexityBot"]);
});

test("a fetch is correlated with whether any answer cited that page", () => {
  const activity = buildCrawlerActivity({
    entries: parseAccessLog([line("/pricing", GPTBOT), line("/blog/x", GPTBOT)].join("\n")),
    citedPaths: ["/pricing", "/never-fetched"],
  });
  assert.equal(activity.pages.find((row) => row.path === "/pricing")?.cited, true);
  assert.deepEqual(activity.fetchedNeverCited, ["/blog/x"]);
  assert.deepEqual(activity.citedNeverFetched, ["/never-fetched"], "a citation with no fetch came from elsewhere");
});

test("error rate counts non-2xx responses served to crawlers", () => {
  const activity = buildCrawlerActivity({
    entries: parseAccessLog([line("/a", GPTBOT, 200), line("/b", GPTBOT, 404)].join("\n")),
  });
  assert.equal(activity.crawlers[0]?.errorRate, 0.5);
});

test("the window spans the first and last fetch seen", () => {
  const activity = buildCrawlerActivity({
    entries: parseAccessLog([
      line("/a", GPTBOT, 200, "19/Sep/2026:12:00:00 +0000"),
      line("/b", GPTBOT, 200, "17/Sep/2026:08:00:00 +0000"),
    ].join("\n")),
  });
  assert.equal(activity.window.from, "2026-09-17T08:00:00.000Z");
  assert.equal(activity.window.to, "2026-09-19T12:00:00.000Z");
});

test("timestamp parsing rejects a bad month instead of inventing one", () => {
  assert.equal(parseLogTimestamp("19/Xxx/2026:12:00:00 +0000"), null);
});
