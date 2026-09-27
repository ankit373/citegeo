import type { ProductProjectService } from "../projects/project-service.js";
import type { ProductProjectFileStore } from "../projects/project-store.js";
import type { PromptAnswer } from "../topics/prompt-run-schema.js";
import type { StructuredAsk } from "../topics/topic-service.js";
import { readStructuredValue } from "../topics/structured-value.js";
import { getJson, putJson } from "../storage/object-store.js";
import {
  SHOPPING_SCHEMA_NAME,
  SHOPPING_TOOL_DESCRIPTION,
  shoppingPrompt,
  shoppingResponseSchema,
} from "./shopping-protocol.js";
import {
  SHOPPING_CAVEAT,
  merchantStandings,
  namedRate,
  parseShoppingAnswer,
  standings,
  type ShoppingAnswer,
  type ShoppingReport,
} from "./shopping-schema.js";

export class ShoppingUnavailableError extends Error {}

export interface AnswerSource {
  listAnswers(projectId: string, runId?: string): Promise<PromptAnswer[]>;
}

const DEFAULT_LIMIT = 30;

export class ShoppingFileStore {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private key(projectId: string): string {
    return this.projects.keyFor(projectId, "shopping.json");
  }

  async load(projectId: string): Promise<ShoppingReport | null> {
    return getJson<ShoppingReport>(this.projects.objects, this.key(projectId));
  }

  async save(report: ShoppingReport): Promise<void> {
    await putJson(this.projects.objects, this.key(report.projectId), report);
  }
}

export class ProductShoppingService {
  constructor(
    private readonly projects: ProductProjectService,
    private readonly answers: AnswerSource,
    private readonly store: ShoppingFileStore,
  ) {}

  async get(projectId: string): Promise<ShoppingReport | null> {
    await this.projects.get(projectId);
    return this.store.load(projectId);
  }

  async run(projectId: string, ask: StructuredAsk, options: { limit?: number | undefined; runId?: string | undefined } = {}): Promise<ShoppingReport> {
    const project = await this.projects.get(projectId);
    if (!project) throw new ShoppingUnavailableError(`Project ${projectId} does not exist.`);

    const rows = await this.answers.listAnswers(projectId, options.runId);
    const usable = rows
      .filter((row) => row.status === "completed" && row.text.trim().length > 0)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, options.limit || DEFAULT_LIMIT);
    if (!usable.length) {
      throw new ShoppingUnavailableError("No completed answer has been stored for this project yet.");
    }

    const read: ShoppingAnswer[] = [];
    let lastFailure = "";
    for (const answer of usable) {
      let parsed;
      try {
        const raw = await ask({
          projectId,
          prompt: shoppingPrompt({ question: answer.promptText, answer: answer.text }),
          schemaName: SHOPPING_SCHEMA_NAME,
          schemaDescription: SHOPPING_TOOL_DESCRIPTION,
          schema: shoppingResponseSchema,
        });
        parsed = parseShoppingAnswer(readStructuredValue(raw));
      } catch (error) {
        // Kept so a run that read nothing can say why rather than implying the
        // answers simply had nothing in them.
        lastFailure = error instanceof Error ? error.message : String(error);
        continue;
      }
      // A question that was not a buying question is not a shopping answer, and
      // counting it would dilute every rate below.
      if (parsed.status !== "completed" || !parsed.intent) continue;
      read.push({
        answerId: answer.id,
        promptId: answer.promptId,
        promptText: answer.promptText,
        intent: parsed.intent,
        modelId: answer.modelId,
        modelDisplayName: answer.modelDisplayName,
        namedAnyProduct: parsed.products.length > 0,
        products: parsed.products,
      });
    }

    if (!read.length) {
      throw new ShoppingUnavailableError(lastFailure
        || `None of the ${usable.length} answers read were answers to a buying question, so there is nothing to report.`);
    }

    const report: ShoppingReport = {
      projectId,
      brandName: project.brandName,
      answers: read,
      genericAnswers: read.filter((row) => !row.namedAnyProduct).length,
      products: standings(read, project.brandName),
      merchants: merchantStandings(read),
      namedRate: namedRate(read, project.brandName),
      caveat: SHOPPING_CAVEAT,
      checkedAt: new Date().toISOString(),
    };
    await this.store.save(report);
    return report;
  }
}
