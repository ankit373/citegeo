import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { readSourcePage, hostOf } from "../src/product/citations/source-page.js";
import { buildOutreachPlan } from "../src/product/citations/outreach.js";
import type { PromptAnswer } from "../src/product/topics/prompt-run-schema.js";

const PAGE = `<html><head><title>Best stock screeners in India</title>
<meta name="description" content="Ten tools compared"></head><body>
<h1>Best stock screeners in India</h1>
<h2>1. Screener.in</h2><p>Screener.in is the best for fundamentals.</p>
<h2>2. Chartink</h2><p>Chartink wins on technical scans.</p>
<h2>Also ran</h2><p>Often overlooked, and oftentimes skipped.</p>
</body></html>`;

async function serve(handler: (path: string) => { status: number; type: string; body: string }): Promise<{ base: string; close: () => Promise<void> }> {
  const server: Server = createServer((request, response) => {
    const result = handler(request.url || "/");
    response.writeHead(result.status, { "content-type": result.type });
    response.end(result.body);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  return {
    base: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function read(base: string, path = "/", names = ["Screener.in", "Chartink", "Ten", "Tradomate"]) {
  return readSourcePage({ url: base + path, names, brandNames: ["tradomate"], brandHost: "tradomate.one" });
}

test("a cited page is read back with who is on it, in the order the page puts them", async () => {
  const site = await serve(() => ({ status: 200, type: "text/html", body: PAGE }));
  try {
    const page = await read(site.base);
    assert.equal(page.detail, null);
    assert.equal(page.title, "Best stock screeners in India");
    assert.deepEqual(page.named.map((row) => row.name), ["Screener.in", "Chartink"]);
    assert.ok((page.named[0]?.firstAt || 0) < (page.named[1]?.firstAt || 0));
    assert.equal(page.named[1]?.underHeading, "2. Chartink");
    assert.equal(page.namesYou, false);
  } finally {
    await site.close();
  }
});

test("a name is matched on whole tokens, so Ten is not on a page because of often", async () => {
  const site = await serve(() => ({ status: 200, type: "text/html", body: PAGE }));
  try {
    const page = await read(site.base);
    assert.equal(page.named.some((row) => row.name === "Ten"), false);
  } finally {
    await site.close();
  }
});

test("the brand is found by its host in a link even where the prose never names it", async () => {
  const body = `<html><head><title>Roundup</title></head><body><p>Some tools.</p><a href="https://tradomate.one/pricing">here</a></body></html>`;
  const site = await serve(() => ({ status: 200, type: "text/html", body }));
  try {
    assert.equal((await read(site.base)).namesYou, true);
  } finally {
    await site.close();
  }
});

test("gone, refused and not-a-page are told apart rather than collapsing into one failure", async () => {
  const site = await serve((path) =>
    path === "/gone" ? { status: 404, type: "text/html", body: "" }
      : path === "/refused" ? { status: 403, type: "text/html", body: "" }
        : { status: 200, type: "application/pdf", body: "%PDF" });
  try {
    assert.ok((await read(site.base, "/gone")).detail?.includes("gone (404)"));
    assert.ok((await read(site.base, "/refused")).detail?.includes("refused"));
    assert.ok((await read(site.base, "/file")).detail?.includes("Not a page"));
    // Unread is unread: no name on an unread page reads as absent, not as empty.
    assert.deepEqual((await read(site.base, "/gone")).named, []);
    assert.equal((await read(site.base, "/gone")).title, null);
  } finally {
    await site.close();
  }
});

function answer(citationUrls: string[], namedYou: boolean): PromptAnswer {
  return {
    id: String(Math.random()), projectId: "p", runId: "r", promptId: "q", topicId: "t",
    promptText: "best screener", intent: "discovery", providerId: "browser", modelId: "perplexity-web",
    modelDisplayName: "Perplexity", regionId: "global", languageId: "en", status: "completed", text: "",
    mentions: namedYou
      ? [{ name: "You", domain: null, recommendation: "positive", mentionQuote: null, firstMentionOffset: 0, firstMentionState: "unique", isTarget: true }]
      : [],
    citationUrls, errorCode: null, errorMessage: null, latencyMs: 1, createdAt: "",
  };
}

const page = (url: string, namesYou: boolean, names: string[] = []) => ({
  url, host: hostOf(url), fetchedAt: "", title: url, description: "", headings: [], words: 500,
  namesYou, named: names.map((name, index) => ({ name, firstAt: index * 10, underHeading: null })), detail: null,
});

test("the pages you are missing from, doing the most work, come first", async () => {
  const plan = buildOutreachPlan({
    answers: [
      answer(["https://a.test/x", "https://b.test/y"], false),
      answer(["https://a.test/x"], false),
      answer(["https://c.test/z"], true),
    ],
    pages: [page("https://a.test/x", false, ["Rival"]), page("https://b.test/y", false), page("https://c.test/z", true)],
  });
  assert.deepEqual(plan.targets.map((row) => row.host), ["a.test", "b.test", "c.test"]);
  assert.equal(plan.targets[0]?.citedWithoutYou, 2);
  assert.ok(plan.targets[0]?.why.includes("Rival"));
  assert.ok(plan.targets[2]?.why.includes("You are already on this page"));
});

test("no citation anywhere is unavailable, which is a property of what ran", () => {
  const plan = buildOutreachPlan({ answers: [answer([], false)], pages: [] });
  assert.equal(plan.unavailable, true);
  assert.equal(plan.cited, 0);
  assert.equal(plan.targets.length, 0);
});

test("a cited page nobody has read yet says so rather than reading as a page you are missing from", () => {
  const plan = buildOutreachPlan({ answers: [answer(["https://a.test/x"], false)], pages: [] });
  assert.equal(plan.read, 0);
  assert.equal(plan.targets[0]?.unread, "Not read yet.");
  assert.equal(plan.targets[0]?.words, null);
  assert.ok(plan.targets[0]?.why.includes("not read yet"));
});
