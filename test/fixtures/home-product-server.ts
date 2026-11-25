import { productDataDir } from "../../src/config/env.js";
import { createProductServer } from "../../src/product/product-server.js";
import { ProductProjectFileStore } from "../../src/product/projects/project-store.js";
import { ProductProjectService } from "../../src/product/projects/project-service.js";
import { LocalObjectStore } from "../../src/product/storage/object-store.js";
import { TopicFileStore } from "../../src/product/topics/topic-store.js";
import { emptyTopicSet, type Prompt } from "../../src/product/topics/topic-schema.js";
import { SiteIconStore } from "../../src/product/discovery/site-icon-service.js";
import { PromptRunFileStore } from "../../src/product/topics/prompt-run-store.js";
import type { PromptAnswer, PromptRun } from "../../src/product/topics/prompt-run-schema.js";

// A project with one archived run and a second with nothing, so Home can be
// drawn from real answers without calling a provider.
const dir = productDataDir();
const store = new ProductProjectFileStore(dir, new LocalObjectStore(dir));
const projects = new ProductProjectService(store);
const acme = await projects.createDraft({ primaryDomain: "acme.example", name: "Acme", brandName: "Acme" });
await projects.createDraft({ primaryDomain: "blank.example", name: "Blank" });

const at = "2026-11-20T10:00:00.000Z";
const prompt = (id: string, text: string, over: Partial<Prompt> = {}): Prompt => ({
  id, projectId: acme.id, topicId: "topic-1", text, normalizedText: text.toLocaleLowerCase(), intent: "discovery", source: "authored",
  measuresVisibility: true, visibilityExclusionReason: null, status: "active", createdAt: at, activatedAt: at, ...over,
});
// Two tracked questions with answers, one that names the brand, one proposed and not asked,
// and one retired with its topic, so the Questions page has every state to draw.
const prompts = [
  prompt("p1", "best invoicing tools for small teams"),
  prompt("p2", "how to automate invoice reminders"),
  prompt("p3", "is Acme any good for invoicing", { intent: "brand", measuresVisibility: false, visibilityExclusionReason: "names_the_brand" }),
  prompt("p4", "Acme vs Rival One for invoicing", { intent: "comparison", status: "proposed", activatedAt: null }),
  prompt("p5", "old question nobody asks", { topicId: "topic-2", status: "retired" }),
];
await new TopicFileStore(store).save({
  ...emptyTopicSet(acme.id),
  topics: [
    { id: "topic-1", projectId: acme.id, name: "Invoicing", description: "", source: "authored", status: "active", createdAt: at },
    { id: "topic-2", projectId: acme.id, name: "Old ideas", description: "", source: "authored", status: "retired", createdAt: at },
  ],
  prompts,
});

const runs = new PromptRunFileStore(store);
const run: PromptRun = {
  id: "run-1", projectId: acme.id, status: "completed", promptIds: ["p1", "p2"], modelIds: ["model-a"], regionIds: ["global"], languageIds: ["en"],
  answersRequested: 4, answersCompleted: 4, answersFailed: 0, startedAt: at, completedAt: at,
};
await runs.saveRun(run);
const answer = (id: string, promptId: string, named: boolean): PromptAnswer => ({
  id, projectId: acme.id, runId: run.id, promptId, topicId: "topic-1", promptText: prompts.find((row) => row.id === promptId)?.text || "", intent: "discovery",
  providerId: "openai", modelId: "model-a", modelDisplayName: "Model A", regionId: "global", languageId: "en", status: "completed",
  text: named ? "Acme and Rival One are both good choices." : "Rival One is the usual choice.",
  mentions: [
    ...(named ? [{ name: "Acme", domain: "acme.example", recommendation: "positive" as const, mentionQuote: "Acme", firstMentionOffset: 0, firstMentionState: "unique" as const, isTarget: true }] : []),
    { name: "Rival One", domain: "rival.example", recommendation: "mentioned" as const, mentionQuote: "Rival One", firstMentionOffset: named ? 9 : 0, firstMentionState: "unique" as const, isTarget: false },
  ],
  citationUrls: [], errorCode: null, errorMessage: null, latencyMs: 100, createdAt: at,
});
await runs.saveAnswer(answer("a1", "p1", true));
await runs.saveAnswer(answer("a2", "p1", false));
await runs.saveAnswer(answer("a3", "p2", true));
await runs.saveAnswer(answer("a4", "p2", true));

// Marks already read as "none declared", so the board makes no request to either site.
const readAt = new Date().toISOString();
await new SiteIconStore(store).save({ "acme.example": { url: null, readAt }, "rival.example": { url: null, readAt } });

createProductServer().listen(Number(process.env.PORT || 8787), "127.0.0.1");
