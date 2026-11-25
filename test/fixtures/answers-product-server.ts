import { productDataDir } from "../../src/config/env.js";
import { createProductServer } from "../../src/product/product-server.js";
import { ProductProjectFileStore } from "../../src/product/projects/project-store.js";
import { ProductProjectService } from "../../src/product/projects/project-service.js";
import { LocalObjectStore } from "../../src/product/storage/object-store.js";
import { TopicFileStore } from "../../src/product/topics/topic-store.js";
import { emptyTopicSet } from "../../src/product/topics/topic-schema.js";
import { SiteIconStore } from "../../src/product/discovery/site-icon-service.js";
import { PromptRunFileStore } from "../../src/product/topics/prompt-run-store.js";
import type { PromptAnswer, PromptRun } from "../../src/product/topics/prompt-run-schema.js";

// Two projects with cited answers, Acme over two runs and Other over one, so the Sources and Trust
// pages are drawn from real figures and a switch between them can be raced.
// The domains end in .com because a bare .example reads as one brand to the
// citation analysis.
const dir = productDataDir();
const store = new ProductProjectFileStore(dir, new LocalObjectStore(dir));
const projects = new ProductProjectService(store);
const acme = await projects.createDraft({ primaryDomain: "acme.com", name: "Acme", brandName: "Acme" });
const other = await projects.createDraft({ primaryDomain: "other.com", name: "Other", brandName: "Other" });
await projects.createDraft({ primaryDomain: "blank.com", name: "Blank" });

const first = "2026-11-10T10:00:00.000Z";
const second = "2026-11-20T10:00:00.000Z";
const topics = new TopicFileStore(store);
const runs = new PromptRunFileStore(store);

async function seed(projectId: string, brand: string, questions: string[], secondRun: boolean): Promise<void> {
  await topics.save({
    ...emptyTopicSet(projectId),
    topics: [{ id: "topic-1", projectId, name: "Invoicing", description: "", source: "authored", status: "active", createdAt: first }],
    prompts: questions.map((text, index) => ({
      id: `p${index + 1}`, projectId, topicId: "topic-1", text, normalizedText: text.toLocaleLowerCase(), intent: "discovery" as const, source: "authored" as const,
      measuresVisibility: true, visibilityExclusionReason: null, status: "active" as const, createdAt: first, activatedAt: first,
    })),
  });
  const saveRun = (id: string, at: string, requested: number, failed: number) => runs.saveRun({
    id, projectId, status: "completed", promptIds: [], modelIds: ["model-a"], regionIds: ["global"], languageIds: ["en"],
    answersRequested: requested, answersCompleted: requested - failed, answersFailed: failed, startedAt: at, completedAt: at,
  } as PromptRun);
  await saveRun(`${projectId}-run-1`, first, 4, 1);
  if (secondRun) await saveRun(`${projectId}-run-2`, second, 2, 0);
  let counter = 0;
  const add = (runNumber: number, promptId: string, named: boolean, citations: string[], over: Partial<PromptAnswer> = {}) => runs.saveAnswer({
    id: `${projectId}-a${counter++}`, projectId, runId: `${projectId}-run-${runNumber}`, promptId, topicId: "topic-1", promptText: questions[Number(promptId.slice(1)) - 1] || "", intent: "discovery",
    providerId: "openai", modelId: "model-a", modelDisplayName: "Model A", regionId: "global", languageId: "en", status: "completed",
    text: named ? `${brand} and Rival One are both good choices.` : "Rival One is the usual choice.",
    mentions: [
      ...(named ? [{ name: brand, domain: `${brand.toLowerCase()}.com`, recommendation: "positive" as const, mentionQuote: brand, firstMentionOffset: 0, firstMentionState: "unique" as const, isTarget: true }] : []),
      { name: "Rival One", domain: "rival.com", recommendation: "mentioned" as const, mentionQuote: "Rival One", firstMentionOffset: named ? 12 : 0, firstMentionState: "unique" as const, isTarget: false },
    ],
    citationUrls: citations, errorCode: null, errorMessage: null, latencyMs: 100, createdAt: runNumber === 1 ? first : second, ...over,
  } as PromptAnswer);
  const own = `https://${brand.toLowerCase()}.com`;
  await add(1, "p1", true, [`${own}/pricing`, "https://rival.com/best"]);
  await add(1, "p1", false, ["https://rival.com/best", "https://news.org/review"]);
  await add(1, "p2", true, [`${own}/pricing`]);
  await add(1, "p2", false, [], { status: "provider_failed", errorCode: "rate_limited", errorMessage: "Too many requests", text: "", mentions: [] });
  if (!secondRun) return;
  await add(2, "p1", false, ["https://rival.com/best"]);
  await add(2, "p2", true, [`${own}/guide`]);
}
await seed(acme.id, "Acme", ["best invoicing tools for small teams", "how to automate invoice reminders"], true);
await seed(other.id, "Other", ["best billing software", "how to chase late payments"], false);

// Marks already read as "none declared", so nothing reaches either site.
const readAt = new Date().toISOString();
const none = { url: null, readAt };
await new SiteIconStore(store).save({ "acme.com": none, "other.com": none, "rival.com": none, "news.org": none });

createProductServer().listen(Number(process.env.PORT || 8787), "127.0.0.1");
