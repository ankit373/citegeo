import test from "node:test";
import assert from "node:assert/strict";
import { parseAccessLog, readAccessLog } from "../src/product/crawlers/access-log.js";
import { CloudFrontReader, cdnTimestamp, parseJsonLogLine, pathOnly } from "../src/product/crawlers/cdn-log.js";

const GPTBOT = "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot";

// A Cloudflare Logpush line, fields as Cloudflare names them.
const CLOUDFLARE = JSON.stringify({
  ClientRequestMethod: "GET",
  ClientRequestPath: "/pricing",
  ClientRequestURI: "/pricing?ref=x",
  EdgeResponseStatus: 200,
  ClientRequestUserAgent: GPTBOT,
  EdgeStartTimestamp: "2026-09-19T12:00:00Z",
});

// A Vercel log drain line, where the request is nested under proxy and the
// user agent arrives as the list of headers seen.
const VERCEL = JSON.stringify({
  id: "1",
  timestamp: 1789732800000,
  proxy: { method: "GET", path: "/docs?utm=1", statusCode: 200, userAgent: [GPTBOT], timestamp: 1789732800000 },
});

const CLOUDFRONT_HEADER = "#Version: 1.0";
const CLOUDFRONT_FIELDS = "#Fields: date time x-edge-location sc-bytes c-ip cs-method cs(Host) cs-uri-stem sc-status cs(Referer) cs(User-Agent)";
const CLOUDFRONT_ROW = ["2026-09-19", "12:00:00", "LHR1", "1024", "1.2.3.4", "GET", "example.com", "/guide", "200", "-",
  "Mozilla/5.0%20AppleWebKit/537.36%20(KHTML,%20like%20Gecko);%20compatible;%20GPTBot/1.2"].join("\t");

test("a Cloudflare line is read as a fetch", () => {
  const entry = parseJsonLogLine(CLOUDFLARE);
  assert.equal(entry?.path, "/pricing");
  assert.equal(entry?.method, "GET");
  assert.equal(entry?.status, 200);
  assert.equal(entry?.userAgent, GPTBOT);
  assert.equal(entry?.at, "2026-09-19T12:00:00.000Z");
});

test("a Vercel line is read although its request is nested under proxy", () => {
  const entry = parseJsonLogLine(VERCEL);
  assert.equal(entry?.path, "/docs", "the query string would split one page into a row per visitor");
  assert.equal(entry?.status, 200);
  assert.equal(entry?.userAgent, GPTBOT, "a user agent sent as a list is still a user agent");
});

test("a JSON line that is not a request record is not counted as one", () => {
  assert.equal(parseJsonLogLine('{"level":"info","msg":"started"}'), null);
  assert.equal(parseJsonLogLine('{"path":"/x"}'), null, "a path with no agent says nothing about a crawler");
  assert.equal(parseJsonLogLine('{"userAgent":"GPTBot"}'), null);
  assert.equal(parseJsonLogLine("not json"), null);
  assert.equal(parseJsonLogLine('{"broken'), null);
});

test("a CloudFront row is read against its own field header", () => {
  const reader = new CloudFrontReader();
  assert.equal(reader.ready, false);
  assert.equal(reader.header(CLOUDFLARE), false, "a JSON line is not a header");
  assert.equal(reader.header(CLOUDFRONT_HEADER), true);
  assert.equal(reader.header(CLOUDFRONT_FIELDS), true);
  assert.equal(reader.ready, true);
  const entry = reader.line(CLOUDFRONT_ROW);
  assert.equal(entry?.path, "/guide");
  assert.equal(entry?.status, 200);
  assert.ok(entry?.userAgent.includes("GPTBot/1.2"), "CloudFront percent-encodes the agent");
  assert.ok(entry?.userAgent.includes(" "), "the encoded spaces have to come back");
  assert.equal(entry?.at, "2026-09-19T12:00:00.000Z");
});

test("CloudFront columns are found by name, not by position", () => {
  const reader = new CloudFrontReader();
  reader.header("#Fields: cs(User-Agent) cs-uri-stem sc-status cs-method");
  const entry = reader.line(["GPTBot/1.2", "/reordered", "404", "HEAD"].join("\t"));
  assert.equal(entry?.path, "/reordered");
  assert.equal(entry?.status, 404);
  assert.equal(entry?.method, "HEAD");
});

test("a CloudFront row before its header is not guessed at", () => {
  assert.equal(new CloudFrontReader().line(CLOUDFRONT_ROW), null);
});

test("epoch seconds, milliseconds and nanoseconds all land in the right year", () => {
  assert.equal(cdnTimestamp(1789819200), "2026-09-19T12:00:00.000Z");
  assert.equal(cdnTimestamp(1789819200000), "2026-09-19T12:00:00.000Z");
  assert.equal(cdnTimestamp(1789819200000000000), "2026-09-19T12:00:00.000Z");
  assert.equal(cdnTimestamp("2026-09-19T12:00:00Z"), "2026-09-19T12:00:00.000Z");
});

test("a timestamp that cannot be read is null rather than now", () => {
  assert.equal(cdnTimestamp("not a date"), null);
  assert.equal(cdnTimestamp(""), null);
  assert.equal(cdnTimestamp(0), null);
  assert.equal(cdnTimestamp(undefined), null);
});

test("a full URL is reduced to its path, and a query is dropped", () => {
  assert.equal(pathOnly("https://example.com/a/b?x=1"), "/a/b");
  assert.equal(pathOnly("https://example.com"), "/");
  assert.equal(pathOnly("/a?x=1"), "/a");
  assert.equal(pathOnly(""), "");
});

test("one file can carry all three shapes and every fetch is read", () => {
  const combined = `1.2.3.4 - - [19/Sep/2026:12:00:00 +0000] "GET /origin HTTP/1.1" 200 12 "-" "${GPTBOT}"`;
  const text = [CLOUDFRONT_HEADER, CLOUDFRONT_FIELDS, CLOUDFLARE, combined, CLOUDFRONT_ROW, VERCEL, "", "garbage"].join("\n");
  const paths = parseAccessLog(text).map((entry) => entry.path);
  assert.deepEqual(paths, ["/pricing", "/origin", "/guide", "/docs"]);
});

test("a header line is never counted as a fetch", () => {
  assert.deepEqual(parseAccessLog([CLOUDFRONT_HEADER, CLOUDFRONT_FIELDS].join("\n")), []);
});

test("a CloudFront header carries into the next incremental read", () => {
  // The header sits once at the top of the file and the ingest resumes past
  // it, so without carrying it every later row is dropped in silence.
  const fields = "#Fields: date time cs-method cs-uri-stem sc-status cs(User-Agent)";
  const row = (path: string) => ["2026-09-19", "12:00:00", "GET", path, "200", "GPTBot/1.2"].join("\t");
  const first = readAccessLog([fields, row("/a")].join("\n"));
  assert.deepEqual(first.entries.map((entry) => entry.path), ["/a"]);
  assert.ok(first.fields.includes("cs-uri-stem"), "the header has to come back out to be carried");

  const second = readAccessLog([row("/b"), row("/c")].join("\n"), first.fields);
  assert.deepEqual(second.entries.map((entry) => entry.path), ["/b", "/c"]);

  const withoutCarrying = readAccessLog([row("/b"), row("/c")].join("\n"));
  assert.deepEqual(withoutCarrying.entries, [], "this is what the bug looked like");
});

test("a later header replaces the carried one rather than being ignored", () => {
  const carried = ["date", "time", "cs-method", "cs-uri-stem", "sc-status", "cs(User-Agent)"];
  const text = ["#Fields: cs(User-Agent) cs-uri-stem", ["GPTBot/1.2", "/new"].join("\t")].join("\n");
  assert.deepEqual(readAccessLog(text, carried).entries.map((entry) => entry.path), ["/new"]);
});
