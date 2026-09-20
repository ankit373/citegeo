import { sha256 } from "../../utils/hash.js";
import type { BrandProfileService } from "../discovery/brand-profile-service.js";
import type { ProductInsightsService } from "../insights/insights-service.js";
import type { ProductProjectService } from "../projects/project-service.js";
import { resolveBrandIdentity, textNamesBrand, type BrandIdentity } from "./brand-identity.js";
import {
  parsePromptSetProposal,
  promptGenerationPrompt,
  promptGenerationResponseSchema,
  PROMPT_GENERATION_SCHEMA_NAME,
  PROMPT_GENERATION_TOOL_DESCRIPTION,
  type PromptGenerationSubject,
} from "./prompt-generation-protocol.js";
import {
  emptyTopicSet,
  normalizePrompt,
  type EntityStatus,
  type Prompt,
  type PromptIntent,
  type Topic,
  type TopicSet,
} from "./topic-schema.js";
import type { TopicFileStore } from "./topic-store.js";

/** What the service needs from a model. Injected so generation is testable without one. */
export interface StructuredAsk {
  (input: {
    projectId: string;
    prompt: string;
    schemaName: string;
    schemaDescription: string;
    schema: Record<string, unknown>;
  }): Promise<unknown>;
}

export interface GenerateOptions {
  topicCount?: number | undefined;
  promptsPerTopic?: number | undefined;
  /** What the company does, where the user knows it and the models do not.
   * Without it, generation has nothing to work from but invention. */
  businessDescription?: string | undefined;
  productCategory?: string | undefined;
  /** Rivals the user knows about. Comparison and alternatives prompts need a
   * real name, and a brand no model recognises yields none from the runs. */
  competitors?: Array<{ name: string; domain: string | null }> | undefined;
}

/** What the models have already said about the brand, used to ground generation. */
export interface BrandFacts {
  businessDescription: string | null;
  productCategory: string | null;
  competitors: Array<{ name: string; domain: string | null }>;
}

export const NO_BRAND_FACTS: BrandFacts = { businessDescription: null, productCategory: null, competitors: [] };

export class TopicSetUnavailableError extends Error {}

function now(): string {
  return new Date().toISOString();
}

function topicId(projectId: string, name: string): string {
  return `topic-${sha256(JSON.stringify({ projectId, name: name.trim().toLocaleLowerCase() })).slice(0, 24)}`;
}

function promptId(projectId: string, text: string): string {
  return `prompt-${sha256(JSON.stringify({ projectId, text: normalizePrompt(text) })).slice(0, 24)}`;
}

export class TopicService {
  constructor(
    private readonly store: TopicFileStore,
    private readonly projects: ProductProjectService,
    private readonly insights?: ProductInsightsService | undefined,
    private readonly profiles?: BrandProfileService | undefined,
  ) {}

  /** Read where it exists and left absent where it does not, never filled in:
   * guessed facts produce prompts for a company that does not exist. */
  async brandFacts(projectId: string): Promise<BrandFacts> {
    // The site is the best source: a brand no model recognises still has a
    // homepage that says what it does.
    const profile = await this.profiles?.get(projectId).catch(() => null);
    if (profile?.businessDescription) {
      return {
        businessDescription: profile.businessDescription,
        productCategory: profile.productCategory,
        competitors: profile.competitors,
      };
    }
    if (!this.insights) return NO_BRAND_FACTS;
    try {
      const built = await this.insights.build(projectId);
      const competitors = built.insights.shareOfVoice.competitors
        .map((row) => ({ name: row.name, domain: row.domain }))
        .filter((row) => Boolean(row.name));
      const category = built.insights.categories[0];
      return {
        businessDescription: null,
        productCategory: category ? category.value : null,
        competitors,
      };
    } catch {
      // No runs yet is the normal case on a new project, not a failure.
      return NO_BRAND_FACTS;
    }
  }

  async get(projectId: string): Promise<TopicSet> {
    return this.store.load(projectId);
  }

  /** Only the target brand counts: naming a competitor is the entire point of
   * an alternatives or comparison prompt. */
  async targetIdentity(projectId: string): Promise<BrandIdentity> {
    const project = await this.projects.get(projectId);
    if (!project) throw new TopicSetUnavailableError(`Project ${projectId} does not exist.`);
    const profile = await this.profiles?.get(projectId).catch(() => null);
    // The brand's own category is what makes its name ambiguous, so it is read
    // from the profile rather than guessed at.
    const categoryText = [profile?.productCategory || "", ...(profile?.features || [])].join(" ").trim();
    return resolveBrandIdentity({
      brandName: project.brandName,
      aliases: project.aliases,
      domain: project.normalizedDomain,
      categoryText: categoryText || undefined,
    });
  }

  private buildPrompt(input: {
    projectId: string;
    topicId: string;
    text: string;
    intent: PromptIntent;
    source: Prompt["source"];
    identity: BrandIdentity;
    status: EntityStatus;
  }): Prompt {
    const named = textNamesBrand(input.text, input.identity);
    return {
      id: promptId(input.projectId, input.text),
      projectId: input.projectId,
      topicId: input.topicId,
      text: input.text.trim(),
      normalizedText: normalizePrompt(input.text),
      intent: input.intent,
      source: input.source,
      measuresVisibility: !named,
      visibilityExclusionReason: named ? "names_the_brand" : null,
      status: input.status,
      createdAt: now(),
      activatedAt: input.status === "active" ? now() : null,
    };
  }

  /** Stored as proposed, never active: what buyers ask is not something this
   * tool can observe, so a person approves it first. */
  async generate(projectId: string, ask: StructuredAsk, options: GenerateOptions = {}): Promise<TopicSet> {
    const project = await this.projects.get(projectId);
    if (!project) throw new TopicSetUnavailableError(`Project ${projectId} does not exist.`);
    const existing = await this.store.load(projectId);
    let facts = await this.brandFacts(projectId);
    if (!facts.businessDescription && !options.businessDescription && this.profiles) {
      // Nothing known and nothing supplied, so go and find out.
      const built = await this.profiles.build(projectId, ask);
      facts = { businessDescription: built.businessDescription, productCategory: built.productCategory, competitors: built.competitors };
    }
    const subject: PromptGenerationSubject = {
      brandName: project.brandName,
      domain: project.normalizedDomain,
      // What the user tells us outranks what the runs inferred: they know.
      businessDescription: options.businessDescription?.trim() || facts.businessDescription,
      productCategory: options.productCategory?.trim() || facts.productCategory,
      competitors: options.competitors?.length ? options.competitors : facts.competitors,
      topicCount: options.topicCount || 5,
      promptsPerTopic: options.promptsPerTopic || 6,
    };
    const raw = await ask({
      projectId,
      prompt: promptGenerationPrompt(subject),
      schemaName: PROMPT_GENERATION_SCHEMA_NAME,
      schemaDescription: PROMPT_GENERATION_TOOL_DESCRIPTION,
      schema: promptGenerationResponseSchema,
    });
    const proposal = parsePromptSetProposal(raw);
    if (proposal.analysisStatus !== "completed") {
      // Passing the model's reasons back is the difference between a dead end
      // and a next step.
      const reasons = proposal.unknowns.length
        ? ` The model could not proceed because: ${proposal.unknowns.join(" ")}`
        : "";
      const remedy = subject.businessDescription
        ? ""
        : " Describe what the company does and try again, or run a recognition test first so the models' own words can be used.";
      throw new TopicSetUnavailableError(
        `No usable prompt set was produced, so nothing was saved.${reasons}${remedy}`,
      );
    }
    const identity = await this.targetIdentity(projectId);
    const topics: Topic[] = [...existing.topics];
    const prompts: Prompt[] = [...existing.prompts];
    const seenTopics = new Set(topics.map((topic) => topic.id));
    const seenPrompts = new Set(prompts.map((prompt) => prompt.id));

    for (const proposed of proposal.topics) {
      const id = topicId(projectId, proposed.name);
      if (!seenTopics.has(id)) {
        seenTopics.add(id);
        topics.push({
          id,
          projectId,
          name: proposed.name,
          description: proposed.description,
          source: "generated",
          status: "proposed",
          createdAt: now(),
        });
      }
      for (const item of proposed.prompts) {
        const prompt = this.buildPrompt({
          projectId,
          topicId: id,
          text: item.text,
          intent: item.intent,
          source: "generated",
          identity,
          status: "proposed",
        });
        // The same question proposed twice is one prompt, not two data points.
        if (seenPrompts.has(prompt.id)) continue;
        seenPrompts.add(prompt.id);
        prompts.push(prompt);
      }
    }

    const set: TopicSet = { ...emptyTopicSet(projectId), topics, prompts, generatedAt: now() };
    await this.store.save(set);
    return this.store.load(projectId);
  }

  async addTopic(projectId: string, input: { name: string; description?: string }): Promise<TopicSet> {
    const name = input.name.trim();
    if (!name) throw new TopicSetUnavailableError("A topic needs a name.");
    const set = await this.store.load(projectId);
    const id = topicId(projectId, name);
    if (!set.topics.some((topic) => topic.id === id)) {
      set.topics.push({
        id,
        projectId,
        name,
        description: (input.description || "").trim(),
        source: "authored",
        // A topic the user wrote is one they want, so it does not need approving.
        status: "active",
        createdAt: now(),
      });
      await this.store.save(set);
    }
    return this.store.load(projectId);
  }

  async addPrompt(projectId: string, input: { topicId: string; text: string; intent: PromptIntent }): Promise<TopicSet> {
    const text = input.text.trim();
    if (!text) throw new TopicSetUnavailableError("A prompt needs text.");
    const set = await this.store.load(projectId);
    if (!set.topics.some((topic) => topic.id === input.topicId)) {
      throw new TopicSetUnavailableError(`Topic ${input.topicId} does not exist.`);
    }
    const identity = await this.targetIdentity(projectId);
    const prompt = this.buildPrompt({
      projectId,
      topicId: input.topicId,
      text,
      intent: input.intent,
      source: "authored",
      identity,
      status: "active",
    });
    if (!set.prompts.some((existing) => existing.id === prompt.id)) {
      set.prompts.push(prompt);
      await this.store.save(set);
    }
    return this.store.load(projectId);
  }

  /** One question per line. Blank lines and duplicates are skipped rather than
   * refused, because a pasted list always has both. */
  async addPrompts(projectId: string, input: { topicId: string; text: string; intent: PromptIntent }): Promise<{ set: TopicSet; added: number; skipped: number }> {
    const set = await this.store.load(projectId);
    if (!set.topics.some((topic) => topic.id === input.topicId)) {
      throw new TopicSetUnavailableError(`Topic ${input.topicId} does not exist.`);
    }
    const identity = await this.targetIdentity(projectId);
    const seen = new Set(set.prompts.map((prompt) => prompt.id));
    let added = 0;
    let skipped = 0;
    for (const line of input.text.split("\n")) {
      const text = line.trim();
      if (!text) continue;
      const prompt = this.buildPrompt({ projectId, topicId: input.topicId, text, intent: input.intent, source: "authored", identity, status: "active" });
      if (seen.has(prompt.id)) {
        skipped += 1;
        continue;
      }
      seen.add(prompt.id);
      set.prompts.push(prompt);
      added += 1;
    }
    if (!added && !skipped) throw new TopicSetUnavailableError("No questions were found in that text.");
    if (added) await this.store.save(set);
    return { set: await this.store.load(projectId), added, skipped };
  }

  /** Moves prompts, and the topics holding them, from proposed to active. */
  async activate(projectId: string, promptIds: string[]): Promise<TopicSet> {
    const wanted = new Set(promptIds);
    const set = await this.store.load(projectId);
    const activatedTopics = new Set<string>();
    for (const prompt of set.prompts) {
      if (!wanted.has(prompt.id) || prompt.status === "active") continue;
      prompt.status = "active";
      prompt.activatedAt = now();
      activatedTopics.add(prompt.topicId);
    }
    for (const topic of set.topics) {
      // A topic with an active prompt is active, or its prompts would run under
      // a heading the UI still shows as merely proposed.
      if (activatedTopics.has(topic.id)) topic.status = "active";
    }
    await this.store.save(set);
    return this.store.load(projectId);
  }

  async retire(projectId: string, promptIds: string[]): Promise<TopicSet> {
    const wanted = new Set(promptIds);
    const set = await this.store.load(projectId);
    for (const prompt of set.prompts) {
      if (wanted.has(prompt.id)) prompt.status = "retired";
    }
    for (const topic of set.topics) {
      const live = set.prompts.some((prompt) => prompt.topicId === topic.id && prompt.status !== "retired");
      if (!live && topic.status !== "retired") topic.status = "retired";
    }
    await this.store.save(set);
    return this.store.load(projectId);
  }
}
