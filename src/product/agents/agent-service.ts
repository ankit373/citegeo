import { randomUUID } from "node:crypto";
import type { ProductProjectService } from "../projects/project-service.js";
import type { StructuredAsk } from "../topics/topic-service.js";
import type { TopicInsights } from "../topics/topic-insights.js";
import { readStructuredValue } from "../topics/structured-value.js";
import { readSite, siteDigest } from "../discovery/site-read.js";
import {
  AGENT_PROMPT_HASH,
  AGENT_SCHEMA_HASH,
  AGENT_SCHEMA_NAME,
  AGENT_TOOL_DESCRIPTION,
  agentPrompt,
  agentResponseSchema,
} from "./agent-protocol.js";
import { parseDraft, type AgentDraft, type DraftReview } from "./agent-schema.js";
import { AGENT_TEMPLATES, briefFor, templateById, type TemplateId } from "./agent-templates.js";
import type { AgentDraftFileStore } from "./agent-store.js";

export class AgentUnavailableError extends Error {}

/** The same shape the other handlers take, so there is one way to reach the
 * topic insights rather than a second service holding them. */
export type InsightsSource = (projectId: string) => Promise<TopicInsights>;

export interface TemplateOffer {
  id: TemplateId;
  label: string;
  purpose: string;
  needs: string;
  /** Null when the template can run. Otherwise what is missing, in words. */
  blocked: string | null;
  rationale: string;
}

export class ProductAgentService {
  constructor(
    private readonly projects: ProductProjectService,
    private readonly insights: InsightsSource,
    private readonly store: AgentDraftFileStore,
  ) {}

  /** What each template would do against the evidence that exists right now,
   * so a blocked one says why instead of failing when it is asked for. */
  async offers(projectId: string): Promise<TemplateOffer[]> {
    await this.projects.get(projectId);
    const insights = await this.insights(projectId);
    return AGENT_TEMPLATES.map((template) => {
      const brief = briefFor(template.id, insights);
      return {
        id: template.id,
        label: template.label,
        purpose: template.purpose,
        needs: template.needs,
        blocked: brief.blocked,
        rationale: brief.rationale,
      };
    });
  }

  async list(projectId: string): Promise<AgentDraft[]> {
    await this.projects.get(projectId);
    return this.store.list(projectId);
  }

  async draft(projectId: string, templateId: string, ask: StructuredAsk): Promise<AgentDraft> {
    const project = await this.projects.get(projectId);
    if (!project) throw new AgentUnavailableError(`Project ${projectId} does not exist.`);
    const template = templateById(templateId);
    if (!template) throw new AgentUnavailableError(`No workflow called ${templateId}.`);

    const insights = await this.insights(projectId);
    const brief = briefFor(template.id, insights);
    if (!brief.instruction) {
      throw new AgentUnavailableError(brief.blocked || "There is no evidence to draft from yet.");
    }

    const site = await readSite(project.normalizedDomain);
    if (!site.reachable) {
      throw new AgentUnavailableError(
        site.detail || `The pages at ${project.normalizedDomain} could not be read, so nothing can be written from them.`,
      );
    }

    // A provider that refused says why. Letting it out as a 500 turned "your
    // account has no credits" into "the server failed".
    let raw: unknown;
    try {
      raw = await ask({
      projectId,
      prompt: agentPrompt({
        brandName: project.brandName,
        domain: project.normalizedDomain,
        instruction: brief.instruction,
        digest: siteDigest(site),
      }),
      schemaName: AGENT_SCHEMA_NAME,
      schemaDescription: AGENT_TOOL_DESCRIPTION,
      schema: agentResponseSchema,
      });
    } catch (error) {
      throw new AgentUnavailableError(error instanceof Error ? error.message : "No model could write this draft.");
    }
    const parsed = parseDraft(readStructuredValue(raw));
    if (parsed.status !== "completed") {
      throw new AgentUnavailableError(
        `The pages at ${site.domain} did not carry enough to write this honestly, so nothing was saved.`,
      );
    }

    // A draft arrives awaiting review and there is no path that skips it.
    const draft: AgentDraft = {
      id: randomUUID(),
      projectId,
      templateId: template.id,
      title: parsed.title,
      body: parsed.body,
      rationale: parsed.rationale || brief.rationale,
      sources: brief.sources,
      status: "awaiting_review",
      createdAt: new Date().toISOString(),
      reviewedAt: null,
      reviewNote: null,
    };
    await this.store.save(draft);
    return draft;
  }

  async review(projectId: string, draftId: string, decision: DraftReview): Promise<AgentDraft> {
    await this.projects.get(projectId);
    const draft = await this.store.read(projectId, draftId);
    if (!draft) throw new AgentUnavailableError("That draft does not exist.");
    // A decision is made once. Re-deciding would lose who decided what before.
    if (draft.status !== "awaiting_review") {
      throw new AgentUnavailableError(`That draft was already ${draft.status.split("_").join(" ")}.`);
    }
    const reviewed: AgentDraft = {
      ...draft,
      status: decision.status,
      reviewedAt: new Date().toISOString(),
      reviewNote: decision.note,
    };
    await this.store.save(reviewed);
    return reviewed;
  }

  static readonly schemaHash = AGENT_SCHEMA_HASH;
  static readonly promptHash = AGENT_PROMPT_HASH;
}
