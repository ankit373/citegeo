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
import { parseDraft, type AgentDraft, type DraftPublication, type DraftReview } from "./agent-schema.js";
import { AGENT_TEMPLATES, briefFor, briefsFor, templateById, type TemplateId } from "./agent-templates.js";
import type { CitedPage, PageLookup, TemplateBrief } from "./agent-templates.js";
import { canonicalUrl } from "../citations/canonical-url.js";
import type { SourcePage } from "../citations/source-page.js";
import type { AgentDraftFileStore } from "./agent-store.js";

export class AgentUnavailableError extends Error {}

export interface BatchOutcome {
  drafts: AgentDraft[];
  /** Gaps that were tried and produced nothing, each with the reason. */
  skipped: Array<{ rationale: string; reason: string }>;
  /** Gaps the template found, before any were tried. */
  considered: number;
}

/** The same shape the other handlers take, so there is one way to reach the
 * topic insights rather than a second service holding them. */
export type InsightsSource = (projectId: string) => Promise<TopicInsights>;

/** The brand's pages as text, or why they could not be read. Injectable so the
 * drafting path can be tested without a network read deciding the result. */
export type PagesSource = (domain: string) => Promise<{ digest: string; detail: string | null }>;

/** Pages already read back from citations. A page nothing read is reported as
 * unread rather than left out, so the brief is not quietly shorter. */
export type CitedPagesSource = (projectId: string) => Promise<SourcePage[]>;

function lookupOver(pages: SourcePage[]): PageLookup {
  const byKey = new Map<string, CitedPage>();
  for (const page of pages) {
    const key = canonicalUrl(page.url)?.key;
    // A page read before its title was kept is still the page that was cited.
    if (!key || (byKey.has(key) && !page.title)) continue;
    byKey.set(key, { url: page.url, host: page.host, title: page.title, headings: page.headings, namesYou: page.namesYou });
  }
  return (url: string) => byKey.get(canonicalUrl(url)?.key || url) || null;
}

async function readPages(domain: string): Promise<{ digest: string; detail: string | null }> {
  const site = await readSite(domain);
  if (!site.reachable) return { digest: "", detail: site.detail || `The pages at ${domain} could not be read.` };
  return { digest: siteDigest(site), detail: null };
}

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
    private readonly pages: PagesSource = readPages,
    private readonly cited: CitedPagesSource = async () => [],
  ) {}

  private async lookup(projectId: string): Promise<PageLookup> {
    // A failed read must not stop a draft. The brief then says the pages were
    // not read, which is true, rather than failing the whole workflow.
    return lookupOver(await this.cited(projectId).catch(() => []));
  }

  /** What each template would do against the evidence that exists right now,
   * so a blocked one says why instead of failing when it is asked for. */
  async offers(projectId: string): Promise<TemplateOffer[]> {
    await this.projects.get(projectId);
    const [insights, page] = await Promise.all([this.insights(projectId), this.lookup(projectId)]);
    return AGENT_TEMPLATES.map((template) => {
      const brief = briefFor(template.id, insights, page);
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

    const [insights, page] = await Promise.all([this.insights(projectId), this.lookup(projectId)]);
    const brief = briefFor(template.id, insights, page);
    if (!brief.instruction) {
      throw new AgentUnavailableError(brief.blocked || "There is no evidence to draft from yet.");
    }

    const site = await this.pages(project.normalizedDomain);
    if (site.detail) throw new AgentUnavailableError(site.detail);

    return this.write(projectId, project, template.id, brief, site.digest, ask);
  }

  /** The one writer both paths use, so a batch draft and a single draft cannot
   * come out differently. */
  private async write(
    projectId: string,
    project: { brandName: string; normalizedDomain: string },
    templateId: TemplateId,
    brief: TemplateBrief,
    digest: string,
    ask: StructuredAsk,
  ): Promise<AgentDraft> {
    // A provider that refused says why. Letting it out as a 500 turned "your
    // account has no credits" into "the server failed".
    let raw: unknown;
    try {
      raw = await ask({
        projectId,
        prompt: agentPrompt({
          brandName: project.brandName,
          domain: project.normalizedDomain,
          instruction: brief.instruction || "",
          digest,
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
        `The pages at ${project.normalizedDomain} did not carry enough to write this honestly, so nothing was saved.`,
      );
    }

    // A draft arrives awaiting review and there is no path that skips it.
    const draft: AgentDraft = {
      id: randomUUID(),
      projectId,
      templateId,
      title: parsed.title,
      body: parsed.body,
      rationale: parsed.rationale || brief.rationale,
      sources: brief.sources,
      status: "awaiting_review",
      createdAt: new Date().toISOString(),
      reviewedAt: null,
      reviewNote: null,
      publishedUrl: null,
      publishedAt: null,
    };
    await this.store.save(draft);
    return draft;
  }

  /** One call, one draft per gap the template can act on. A batch is the only
   * way to work through a backlog without asking for each one by hand. */
  async draftBatch(projectId: string, templateId: string, ask: StructuredAsk, limit = 5): Promise<BatchOutcome> {
    const project = await this.projects.get(projectId);
    if (!project) throw new AgentUnavailableError(`Project ${projectId} does not exist.`);
    const template = templateById(templateId);
    if (!template) throw new AgentUnavailableError(`No workflow called ${templateId}.`);

    const [insights, page] = await Promise.all([this.insights(projectId), this.lookup(projectId)]);
    const briefs = briefsFor(template.id, insights, limit, page).filter((brief) => brief.instruction);
    if (!briefs.length) {
      throw new AgentUnavailableError(briefFor(template.id, insights, page).blocked || "There is no evidence to draft from yet.");
    }

    const site = await this.pages(project.normalizedDomain);
    if (site.detail) throw new AgentUnavailableError(site.detail);
    const digest = site.digest;

    const drafts: AgentDraft[] = [];
    const skipped: Array<{ rationale: string; reason: string }> = [];
    for (const brief of briefs) {
      try {
        // One gap failing never discards the drafts already written, and a
        // batch that half worked says which half.
        drafts.push(await this.write(projectId, project, template.id, brief, digest, ask));
      } catch (error) {
        skipped.push({ rationale: brief.rationale, reason: error instanceof Error ? error.message : String(error) });
      }
    }
    if (!drafts.length) {
      throw new AgentUnavailableError(skipped[0]?.reason || "Nothing could be drafted.");
    }
    return { drafts, skipped, considered: briefs.length };
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

  /** The one thing this product never knew: that the page went live, and when.
   * Without that date no later run can be read as before or after the change,
   * so an approved draft was the end of the line. */
  async publish(projectId: string, draftId: string, publication: DraftPublication): Promise<AgentDraft> {
    await this.projects.get(projectId);
    const draft = await this.store.read(projectId, draftId);
    if (!draft) throw new AgentUnavailableError("That draft does not exist.");
    if (draft.status !== "approved") {
      throw new AgentUnavailableError("Only an approved draft can be recorded as published, because nothing else was agreed to go live.");
    }
    if (draft.publishedAt) {
      throw new AgentUnavailableError(`That draft was already recorded as live at ${draft.publishedUrl}.`);
    }
    const published: AgentDraft = { ...draft, publishedUrl: publication.url, publishedAt: publication.at };
    await this.store.save(published);
    return published;
  }

  static readonly schemaHash = AGENT_SCHEMA_HASH;
  static readonly promptHash = AGENT_PROMPT_HASH;
}
