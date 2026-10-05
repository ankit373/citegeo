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
  /** The uploaded log, for a POST. Reading it is the caller's job, because
   * only the server knows how big a body it is willing to take. */
  readText?: (() => Promise<string>) | undefined;
}): Promise<boolean> {
  const { method, route, send } = input;
  if (route.length !== 4) return false;
  if (route[0] !== "api" || route[1] !== "projects" || route[3] !== "crawlers") return false;
  if (method !== "GET" && method !== "POST") return false;
  const projectId = route[2] || "";

  try {
    const built = await input.insights.build(projectId);
    const fromPrompts = input.answers && input.domain
      ? citedPathsForDomain(
          (await input.answers(projectId)).flatMap((answer) => answer.citationUrls),
          await input.domain(projectId),
        )
      : [];
    const scope = { citedPaths: [...new Set([...built.citedPaths, ...fromPrompts])] };
    // An upload is the door for anyone without a shell on this machine, which
    // was everybody: the log could only ever be named by an environment
    // variable set where the server runs.
    if (method === "POST") {
      const text = input.readText ? await input.readText() : "";
      if (!text.trim()) {
        send(400, { error: "No log was uploaded. Post the contents of a combined-format access log." });
        return true;
      }
      send(200, await input.crawlerLog.addLog(projectId, text, scope));
      return true;
    }
    send(200, await input.crawlerLog.ingest(projectId, scope));
  } catch (error) {
    send(404, { error: error instanceof Error ? error.message : String(error) });
  }
  return true;
}
