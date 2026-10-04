import { buildActionPlan } from "./action-plan.js";
import { readyToPaste } from "./paste-fix.js";
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
  /** What the site says it is, so a generated file carries its own words. */
  profile: (projectId: string) => Promise<{ brandName: string; description: string | null; category: string | null; audience: string | null; features: string[]; sources: string[] } | null>;
  /** How many were asked for, from the query string. */
  wanted?: number | undefined;
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

  // Generated from the stored probe, so asking for more a day never reaches out
  // and never invents one. Fewer than asked for says so instead of padding.
  if (method === "GET" && route[3] === "paste-fixes") {
    try {
      const snapshot = (await input.signals.history(projectId))[0];
      if (!snapshot) {
        send(200, { wanted: input.wanted || 2, fixes: [], described: [], shortfall: "No site probe yet, so nothing has been observed to generate from.", caveat: "" });
        return true;
      }
      const profile = await input.profile(projectId);
      send(200, readyToPaste({
        signals: snapshot.signals,
        brandName: profile?.brandName || snapshot.signals.domain,
        profile: profile ? { description: profile.description, category: profile.category, audience: profile.audience, features: profile.features } : undefined,
        sources: profile?.sources,
        wanted: input.wanted,
      }));
    } catch (error) {
      send(404, { error: error instanceof Error ? error.message : String(error) });
    }
    return true;
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
