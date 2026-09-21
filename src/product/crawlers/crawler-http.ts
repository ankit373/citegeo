import { citedPathsForDomain } from "../insights/insights-service.js";
import type { CrawlerLogIngestService } from "./crawler-ingest.js";
import type { ProductInsightsService } from "../insights/insights-service.js";
import type { PromptAnswer } from "../topics/prompt-run-schema.js";

export type CrawlerJsonSender = (status: number, body: unknown) => void;

// Ingestion is incremental, so answering a request reads only what the log
// gained since the last pass. The cited paths come from both archives: the
// prompt engine is where citations land now, and reading only the older one
// reported every page it cites as fetched and never cited.
export async function handleCrawlerApi(input: {
  method: string;
  route: string[];
  send: CrawlerJsonSender;
  crawlerLog: CrawlerLogIngestService;
  insights: ProductInsightsService;
  /** Archived prompt answers, for the citations the prompt engine produced. */
  answers?: ((projectId: string) => Promise<PromptAnswer[]>) | undefined;
  domain?: ((projectId: string) => Promise<string>) | undefined;
}): Promise<boolean> {
  const { method, route, send } = input;
  if (method !== "GET" || route.length !== 4) return false;
  if (route[0] !== "api" || route[1] !== "projects" || route[3] !== "crawlers") return false;
  const projectId = route[2] || "";

  try {
    const built = await input.insights.build(projectId);
    const fromPrompts = input.answers && input.domain
      ? citedPathsForDomain(
          (await input.answers(projectId)).flatMap((answer) => answer.citationUrls),
          await input.domain(projectId),
        )
      : [];
    send(200, await input.crawlerLog.ingest({ citedPaths: [...new Set([...built.citedPaths, ...fromPrompts])] }));
  } catch (error) {
    send(404, { error: error instanceof Error ? error.message : String(error) });
  }
  return true;
}
