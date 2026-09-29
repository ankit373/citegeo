import test from "node:test";
import assert from "node:assert/strict";
import { handleCrawlerApi } from "../src/product/crawlers/crawler-http.js";
import { citedPathsForDomain } from "../src/product/insights/insights-service.js";
import type { PromptAnswer } from "../src/product/topics/prompt-run-schema.js";

function answer(citationUrls: string[]): PromptAnswer {
  return {
    id: String(Math.random()), projectId: "p", runId: "r", promptId: "q", topicId: "t", promptText: "best tool",
    intent: "discovery", providerId: "browser", modelId: "perplexity-web", modelDisplayName: "Perplexity",
    regionId: "global", languageId: "en", status: "completed", text: "", mentions: [],
    citationUrls, errorCode: null, errorMessage: null, latencyMs: 1, createdAt: "",
  };
}

async function call(options: { answers?: PromptAnswer[] | undefined; fromRecognition: string[] }) {
  let seen: string[] = [];
  const handled = await handleCrawlerApi({
    method: "GET",
    route: ["api", "projects", "p", "crawlers"],
    send: () => undefined,
    crawlerLog: { ingest: async (input: { citedPaths?: string[] }) => { seen = input.citedPaths || []; return {}; } } as never,
    insights: { build: async () => ({ citedPaths: options.fromRecognition }) } as never,
    ...(options.answers ? { answers: async () => options.answers as PromptAnswer[], domain: async () => "example.com" } : {}),
  });
  assert.equal(handled, true);
  return seen;
}

test("citations from the prompt engine reach the crawler correlation", async () => {
  const seen = await call({
    answers: [answer(["https://example.com/pricing", "https://rival.test/roundup"])],
    fromRecognition: [],
  });
  assert.deepEqual(seen, ["/pricing"], "only the project's own pages are paths it can have served");
});

test("both archives are read, because reading one reported the other's pages as never cited", async () => {
  const seen = await call({
    answers: [answer(["https://example.com/features"])],
    fromRecognition: ["/pricing"],
  });
  assert.deepEqual(seen.slice().sort(), ["/features", "/pricing"]);
});

test("the same page cited in both archives is one path, not two", async () => {
  const seen = await call({ answers: [answer(["https://www.example.com/pricing/"])], fromRecognition: ["/pricing"] });
  assert.deepEqual(seen, ["/pricing"]);
});

test("without the prompt archive wired in it still answers, from what it has", async () => {
  assert.deepEqual(await call({ fromRecognition: ["/pricing"] }), ["/pricing"]);
});

test("a cited page on somebody else's domain is not a path this site ever served", () => {
  assert.deepEqual(citedPathsForDomain(["https://rival.test/best-tools", "https://example.com/a"], "example.com"), ["/a"]);
});

test("a rival's own page is not offered as somewhere to get listed", async () => {
  const { buildOutreachPlan } = await import("../src/product/citations/outreach.js");
  const answer = (urls: string[]) => ({
    id: "a", status: "completed", citationUrls: urls, mentions: [], promptText: "q", promptId: "q",
  }) as any;
  const plan = buildOutreachPlan({
    answers: [answer(["https://www.screener.in/features/", "https://blog.example.com/best-screeners", "https://tradomate.one/pricing"])],
    pages: [],
    domain: "tradomate.one",
    rivalDomains: ["screener.in"],
  });
  const byHost = new Map(plan.targets.map((row) => [row.host, row]));
  assert.equal(byHost.get("screener.in")?.owner, "rival", "a www host is the same brand");
  assert.equal(byHost.get("screener.in")?.reachable, false, "nobody can be added to a rival's own page");
  assert.equal(byHost.get("tradomate.one")?.owner, "yours");
  assert.equal(byHost.get("blog.example.com")?.owner, "independent");
  assert.equal(byHost.get("blog.example.com")?.reachable, true);
  assert.equal(plan.reachable, 1, "one of the three is somewhere to go");
  assert.equal(plan.rivalOwned, 1);
  assert.equal(plan.targets[0]?.host, "blog.example.com", "the page you can join comes first");
});

test("a rival's own page says what to do instead of nothing", async () => {
  const { buildOutreachPlan } = await import("../src/product/citations/outreach.js");
  const plan = buildOutreachPlan({
    answers: [{ id: "a", status: "completed", citationUrls: ["https://screener.in/x"], mentions: [], promptText: "q", promptId: "q" } as any],
    pages: [], domain: "tradomate.one", rivalDomains: ["screener.in"],
  });
  const why = plan.targets[0]?.why || "";
  assert.ok(why.includes("their own page"));
  assert.ok(why.includes("nobody can be added to it"), "the reader has to be told it is a dead end");
  assert.ok(why.includes("independent page") || why.includes("page of your own"), "and told what to do instead");
});

test("with no domains given nothing is wrongly called a rival", async () => {
  const { buildOutreachPlan } = await import("../src/product/citations/outreach.js");
  const plan = buildOutreachPlan({
    answers: [{ id: "a", status: "completed", citationUrls: ["https://screener.in/x"], mentions: [], promptText: "q", promptId: "q" } as any],
    pages: [],
  });
  assert.equal(plan.targets[0]?.owner, "independent", "an unknown domain is not assumed to be anybody's");
  assert.equal(plan.rivalOwned, 0);
});

test("harvesting and reading agree about who owns a page", async () => {
  const { buildOutreachPlan } = await import("../src/product/citations/outreach.js");
  const answers = [{ id: "a", status: "completed", citationUrls: ["https://screener.in/x"], mentions: [], promptText: "q", promptId: "q" } as any];
  const scope = { domain: "tradomate.one", rivalDomains: ["screener.in"] };
  // The harvest path used to build its plan with no scope, so the same page
  // read as a rival's before harvesting and independent afterwards.
  const beforeHarvest = buildOutreachPlan({ answers, pages: [], ...scope });
  const afterHarvest = buildOutreachPlan({ answers, pages: [], ...scope });
  assert.equal(beforeHarvest.targets[0]?.owner, afterHarvest.targets[0]?.owner);
  assert.equal(afterHarvest.targets[0]?.owner, "rival");
  assert.equal(afterHarvest.reachable, 0, "a harvested rival page is still nowhere to go");
});
