import { readSite } from "../discovery/site-read.js";
import type { ProductProjectService } from "../projects/project-service.js";
import type { SiteSignals } from "../actions/site-signals.js";
import { alignEntity } from "./entity-alignment.js";
import { buildLlmsTxt } from "./llms-txt.js";

type JsonSender = (status: number, body: unknown) => void;

export interface SignalSource {
  latest(projectId: string): Promise<SiteSignals | null>;
}

export interface SummarySource {
  (projectId: string): Promise<string | null>;
}

// /entity says what corroborates this brand from outside its own control.
// /llms-txt drafts the map a crawler should be given. Neither serves a crawler
// anything the reader does not also get.
export async function handleEntityApi(input: {
  method: string;
  route: string[];
  send: JsonSender;
  projects: ProductProjectService;
  signals: SignalSource;
  summary: SummarySource;
}): Promise<boolean> {
  const { method, route, send } = input;
  if (route.length !== 4 || route[0] !== "api" || route[1] !== "projects") return false;
  const wanted = route[3];
  if (wanted !== "entity" && wanted !== "llms-txt") return false;
  const projectId = route[2] || "";
  if (method !== "GET") {
    send(405, { error: "method_not_allowed" });
    return true;
  }

  if (wanted === "entity") {
    const signals = await input.signals.latest(projectId);
    // Absent rather than empty: no probe is not an unresolvable entity.
    if (!signals) {
      send(200, { alignment: null, note: "This project's site has not been probed yet, so nothing is known about what resolves it." });
      return true;
    }
    send(200, { alignment: alignEntity(signals) });
    return true;
  }

  const project = await input.projects.get(projectId);
  if (!project) {
    send(404, { error: "That project does not exist." });
    return true;
  }
  const site = await readSite(project.normalizedDomain);
  send(200, {
    draft: buildLlmsTxt({ brandName: project.brandName, summary: await input.summary(projectId), site }),
    note: "A map of the pages this site already serves. Serving a crawler something the reader does not get is cloaking, and this is not that.",
  });
  return true;
}
