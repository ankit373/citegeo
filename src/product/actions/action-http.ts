import { buildActionPlan } from "./action-plan.js";
import type { SiteSignalProbeService } from "./signal-probe.js";
import type { ProductInsightsService } from "../insights/insights-service.js";

export type ActionJsonSender = (status: number, body: unknown) => void;

// The plan is built from the stored probe rather than a live fetch, so a page
// load does not reach outside. With no probe yet it says so, because a site
// with no signals read is not a site with nothing wrong.
export async function handleActionApi(input: {
  method: string;
  route: string[];
  send: ActionJsonSender;
  signals: SiteSignalProbeService;
  insights: ProductInsightsService;
}): Promise<boolean> {
  const { method, route, send } = input;
  if (route[0] !== "api" || route[1] !== "projects" || route.length !== 4) return false;
  const projectId = route[2] || "";

  if (route[3] === "signals") {
    try {
      if (method === "GET") { send(200, { snapshots: await input.signals.history(projectId) }); return true; }
      if (method === "POST") { send(201, { snapshot: await input.signals.capture(projectId) }); return true; }
    } catch (error) {
      send(404, { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
    return false;
  }

  if (method === "GET" && route[3] === "action-plan") {
    try {
      const snapshot = (await input.signals.history(projectId))[0];
      if (!snapshot) {
        send(200, { probed: false, detail: "No site probe yet. POST to /signals or let the worker run one.", actions: [] });
        return true;
      }
      const built = await input.insights.build(projectId);
      send(200, {
        probed: true,
        capturedAt: snapshot.capturedAt,
        changes: snapshot.changes,
        actions: buildActionPlan({
          signals: snapshot.signals,
          recognition: {
            answered: built.insights.visibility.answered,
            recognized: built.insights.visibility.recognized,
            competitors: built.insights.shareOfVoice.competitors.map((row) => row.name),
          },
        }),
      });
    } catch (error) {
      send(404, { error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  return false;
}
