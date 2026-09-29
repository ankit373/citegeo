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

const DATED = `<html><head><title>Dated</title>
<script type="application/ld+json">{"datePublished":"2026-06-01T00:00:00Z"}</script>
</head><body><h1>Dated</h1><p>Chartink is listed here.</p></body></html>`;

test("the date a cited page states about itself is read back with it", async () => {
  const site = await serve(() => ({ status: 200, type: "text/html", body: DATED }));
  try {
    const read = await readSourcePage({ url: site.base + "/", names: [], brandNames: ["tradomate"], brandHost: "tradomate.one" });
    assert.equal(read.statedAt, "2026-06-01T00:00:00.000Z");
    assert.equal(read.dateSource, "json_ld");
  } finally {
    await site.close();
  }
});

test("a page that states no date is read back undated, never as new", async () => {
  const site = await serve(() => ({ status: 200, type: "text/html", body: PAGE }));
  try {
    const read = await readSourcePage({ url: site.base + "/", names: [], brandNames: ["x"], brandHost: "x.test" });
    assert.equal(read.statedAt, null);
    assert.equal(read.dateSource, null);
  } finally {
    await site.close();
  }
});

const NOW = new Date("2026-09-29T00:00:00.000Z");

const datedPage = (url: string, statedAt: string | null) => ({
  ...page(url, false),
  statedAt,
  dateSource: statedAt ? ("json_ld" as const) : null,
});

test("a cited page carries its age into the plan, counted from the date it gave", () => {
  const plan = buildOutreachPlan({
    answers: [answer(["https://a.test/x"], false)],
    pages: [datedPage("https://a.test/x", "2026-09-19T00:00:00.000Z")],
    now: NOW,
  });
  assert.equal(plan.targets[0]?.ageDays, 10);
  assert.equal(plan.targets[0]?.freshness, "fresh");
  assert.equal(plan.freshness.fresh, 1);
  assert.equal(plan.freshness.medianAgeDays, 10);
});

test("a page nobody has read is unread, which is not a page that gave no date", () => {
  const plan = buildOutreachPlan({
    answers: [answer(["https://a.test/x", "https://b.test/y"], false)],
    pages: [datedPage("https://b.test/y", null)],
    now: NOW,
  });
  const unread = plan.targets.find((row) => row.host === "a.test");
  const undated = plan.targets.find((row) => row.host === "b.test");
  assert.equal(unread?.freshness, "unread");
  assert.equal(unread?.ageDays, null);
  assert.equal(undated?.freshness, "undated");
  assert.equal(plan.freshness.undated, 1, "the unread page has no age at all, so it is not counted as undated");
  assert.equal(plan.freshness.medianAgeDays, null);
});

test("a page read back before dates were captured reads as undated, not as fresh", () => {
  const plan = buildOutreachPlan({
    answers: [answer(["https://a.test/x"], false)],
    pages: [page("https://a.test/x", false)],
    now: NOW,
  });
  assert.equal(plan.targets[0]?.freshness, "undated");
  assert.equal(plan.targets[0]?.ageDays, null);
});

test("the ninety day judgement travels with the plan's figures", () => {
  const plan = buildOutreachPlan({ answers: [answer(["https://a.test/x"], false)], pages: [], now: NOW });
  assert.ok(plan.freshness.caveat.includes("judgement, not a measurement"));
});
