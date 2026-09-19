import type { CrawlerLogIngestService } from "./crawler-ingest.js";
import type { ProductInsightsService } from "../insights/insights-service.js";

export type CrawlerJsonSender = (status: number, body: unknown) => void;

// Ingestion is incremental, so answering a request reads only what the log
// gained since the last pass. The project's own cited paths come from insights
// so a fetch can be correlated with whether any answer cited that page.
export async function handleCrawlerApi(input: {
  method: string;
  route: string[];
  send: CrawlerJsonSender;
  crawlerLog: CrawlerLogIngestService;
  insights: ProductInsightsService;
}): Promise<boolean> {
  const { method, route, send } = input;
  if (method !== "GET" || route.length !== 4) return false;
  if (route[0] !== "api" || route[1] !== "projects" || route[3] !== "crawlers") return false;

  try {
    const built = await input.insights.build(route[2] || "");
    send(200, await input.crawlerLog.ingest({ citedPaths: built.citedPaths }));
  } catch (error) {
    send(404, { error: error instanceof Error ? error.message : String(error) });
  }
  return true;
}
