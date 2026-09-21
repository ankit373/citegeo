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
