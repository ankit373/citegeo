import type { ProductProjectService } from "../projects/project-service.js";
import type { PromptAnswer } from "../topics/prompt-run-schema.js";
import type { StructuredAsk } from "../topics/topic-service.js";
import { readStructuredValue } from "../topics/structured-value.js";
import { readSite, siteDigest } from "../discovery/site-read.js";
import {
  FACTCHECK_PROMPT_HASH,
  FACTCHECK_SCHEMA_HASH,
  FACTCHECK_SCHEMA_NAME,
  FACTCHECK_TOOL_DESCRIPTION,
  factcheckPrompt,
  factcheckResponseSchema,
} from "./factcheck-protocol.js";
import { parseFactCheck, type AnswerFactCheck, type FactCheckReport } from "./factcheck-schema.js";
import type { FactCheckFileStore } from "./factcheck-store.js";

export class FactCheckUnavailableError extends Error {}

export interface AnswerSource {
  listAnswers(projectId: string, runId?: string): Promise<PromptAnswer[]>;
}

/** Checking every answer costs one model call each, so the newest are taken
 * first and the rest are left for a later pass. */
const DEFAULT_LIMIT = 25;

export class ProductFactCheckService {
  constructor(
    private readonly projects: ProductProjectService,
    private readonly answers: AnswerSource,
    private readonly store: FactCheckFileStore,
  ) {}

  async get(projectId: string): Promise<FactCheckReport | null> {
    await this.projects.get(projectId);
    return this.store.load(projectId);
  }

  async run(projectId: string, ask: StructuredAsk, options: { limit?: number | undefined; runId?: string | undefined } = {}): Promise<FactCheckReport> {
    const project = await this.projects.get(projectId);
    if (!project) throw new FactCheckUnavailableError(`Project ${projectId} does not exist.`);

    const site = await readSite(project.normalizedDomain);
    if (!site.reachable) {
      throw new FactCheckUnavailableError(
        site.detail || `The pages at ${project.normalizedDomain} could not be read, so there is nothing to check against.`,
      );
    }
    const digest = siteDigest(site);

    const rows = await this.answers.listAnswers(projectId, options.runId);
    const usable = rows
      .filter((row) => row.status === "completed" && row.text.trim().length > 0)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, options.limit || DEFAULT_LIMIT);
    if (!usable.length) {
      throw new FactCheckUnavailableError("No completed answer has been stored for this project yet.");
    }

    const checked: AnswerFactCheck[] = [];
    let unreadable = 0;
    for (const answer of usable) {
      let parsed;
      try {
        const raw = await ask({
          projectId,
          prompt: factcheckPrompt({
            brandName: project.brandName,
            domain: project.normalizedDomain,
            answer: answer.text,
            digest,
          }),
          schemaName: FACTCHECK_SCHEMA_NAME,
          schemaDescription: FACTCHECK_TOOL_DESCRIPTION,
          schema: factcheckResponseSchema,
        });
        parsed = parseFactCheck(readStructuredValue(raw));
      } catch (_) {
        // One answer failing never discards the rest, and a failure is counted
        // rather than folded into the results as nothing found.
        unreadable += 1;
        continue;
      }
      if (parsed.status !== "completed") {
        unreadable += 1;
        continue;
      }
      checked.push({
        answerId: answer.id,
        promptId: answer.promptId,
        promptText: answer.promptText,
        modelId: answer.modelId,
        modelDisplayName: answer.modelDisplayName,
        claims: parsed.claims,
      });
    }

    if (!checked.length) {
      throw new FactCheckUnavailableError(
        `None of the ${usable.length} answers checked could be read. Nothing was saved.`,
      );
    }

    const report: FactCheckReport = {
      projectId,
      domain: site.domain,
      sources: site.pages.map((page) => page.url),
      answers: checked,
      unreadable,
      checkedAt: new Date().toISOString(),
      schemaHash: FACTCHECK_SCHEMA_HASH,
      promptHash: FACTCHECK_PROMPT_HASH,
    };
    await this.store.save(report);
    return report;
  }
}
