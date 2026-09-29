import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SourcePageService } from "../src/product/citations/source-service.js";
import { ProductProjectFileStore } from "../src/product/projects/project-store.js";
import { putJson } from "../src/product/storage/object-store.js";
import { sha256 } from "../src/utils/hash.js";
import { canonicalUrl } from "../src/product/citations/canonical-url.js";
import type { BrandIdentity } from "../src/product/topics/brand-identity.js";
import type { PromptAnswer } from "../src/product/topics/prompt-run-schema.js";

const BODY = `<html><head><title>Dated</title>
<script type="application/ld+json">{"datePublished":"2026-06-01T00:00:00Z"}</script>
</head><body><h1>Dated</h1><p>Nothing much.</p></body></html>`;

const IDENTITY: BrandIdentity = {
  distinctive: ["tradomate"], ambiguous: [], host: "tradomate.one",
  nameMatchingUnreliable: false, caveat: null,
};

function answerFor(url: string): PromptAnswer {
  return {
    id: "a", projectId: "p", runId: "r", promptId: "q", topicId: "t",
    promptText: "best screener", intent: "discovery", providerId: "browser", modelId: "m",
    modelDisplayName: "M", regionId: "global", languageId: "en", status: "completed", text: "",
    mentions: [], citationUrls: [url], errorCode: null, errorMessage: null, latencyMs: 1, createdAt: "",
  };
}

async function harness() {
  let hits = 0;
  const server: Server = createServer((_request, response) => {
    hits += 1;
    response.writeHead(200, { "content-type": "text/html" });
    response.end(BODY);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  const dir = await mkdtemp(join(tmpdir(), "citegeo-harvest-"));
  const projects = new ProductProjectFileStore(dir);
  return {
    url: `http://127.0.0.1:${address.port}/a`,
    projects,
    pages: new SourcePageService(projects),
    hits: () => hits,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(dir, { recursive: true, force: true });
    },
  };
}

test("a harvested page keeps the date it stated, so its age is readable later", async () => {
  const kit = await harness();
  try {
    const result = await kit.pages.harvest({
      projectId: "p", answers: [answerFor(kit.url)], identity: IDENTITY, names: [],
    });
    assert.equal(result.read, 1);
    const stored = await kit.pages.list("p");
    assert.equal(stored[0]?.statedAt, "2026-06-01T00:00:00.000Z");
    assert.equal(result.plan.targets[0]?.freshness !== "unread", true);
  } finally {
    await kit.close();
  }
});

test("a page already read with a date is not fetched again", async () => {
  const kit = await harness();
  try {
    await kit.pages.harvest({ projectId: "p", answers: [answerFor(kit.url)], identity: IDENTITY, names: [] });
    assert.equal(kit.hits(), 1);
    const again = await kit.pages.harvest({ projectId: "p", answers: [answerFor(kit.url)], identity: IDENTITY, names: [] });
    assert.equal(kit.hits(), 1, "re-reading it is another request for an answer already held");
    assert.equal(again.skipped, 1);
  } finally {
    await kit.close();
  }
});

test("a record stored before dates were read is read once more, not left undated forever", async () => {
  const kit = await harness();
  try {
    // What a record written by an earlier version looks like: no date field.
    const key = canonicalUrl(kit.url)?.key || kit.url;
    await putJson(kit.projects.objects, kit.projects.keyFor("p", "source-pages", `${sha256(key)}.json`), {
      url: kit.url, host: "127.0.0.1", fetchedAt: "", title: "Dated", description: "",
      headings: [], words: 3, namesYou: false, named: [], detail: null,
    });
    const result = await kit.pages.harvest({ projectId: "p", answers: [answerFor(kit.url)], identity: IDENTITY, names: [] });
    assert.equal(kit.hits(), 1, "the old record has no date at all, which is not a page that stated none");
    assert.equal(result.read, 1);
    const stored = await kit.pages.list("p");
    assert.equal(stored[0]?.statedAt, "2026-06-01T00:00:00.000Z");
  } finally {
    await kit.close();
  }
});
