import { exportNames, exportTable } from "./insights-export.js";
import type { ProductInsightsService } from "./insights-service.js";

export type InsightsJsonSender = (status: number, body: unknown, contentType?: string) => void;

// Derived analytics are a pure function of stored evidence, so a request that
// cannot find the project is a 404 rather than a 500: nothing failed, the
// question was about something that does not exist.
export async function handleInsightsApi(input: {
  method: string;
  route: string[];
  send: InsightsJsonSender;
  service: ProductInsightsService;
}): Promise<boolean> {
  const { method, route, send, service } = input;
  if (route[0] !== "api" || route[1] !== "projects") return false;
  const projectId = route[2];
  if (!projectId) return false;

  if (method === "GET" && route.length === 4 && route[3] === "insights") {
    try {
      send(200, await service.build(projectId));
    } catch (error) {
      send(404, { error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  if (method === "GET" && route.length === 5 && route[3] === "export") {
    try {
      const csv = exportTable(await service.build(projectId), route[4] || "");
      if (csv === null) {
        send(404, { error: `Unknown export "${route[4]}". Available: ${exportNames().join(", ")}.` });
      } else {
        send(200, csv, "text/csv; charset=utf-8");
      }
    } catch (error) {
      send(404, { error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  return false;
}
