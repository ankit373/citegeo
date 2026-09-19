import type { ProductProjectService } from "../projects/project-service.js";
import type { ProductInsightsService } from "../insights/insights-service.js";
import type { SiteSignalProbeService } from "../actions/signal-probe.js";
import { buildActionPlan } from "../actions/action-plan.js";
import { buildDigest } from "./digest.js";
import { deliverDigest } from "./delivery.js";
import type { DigestBaselineStore, DeliveryResult, DigestSender } from "./delivery.js";

// Builds and delivers one digest per project. Kept separate from the worker
// loop so it can be exercised without a scheduler, and so a project that fails
// cannot take the others down with it.

export interface DigestRunOutcome {
  projectId: string;
  domain: string;
  result: DeliveryResult;
  reasons: string[];
}

export async function runDigests(input: {
  projects: ProductProjectService;
  insights: ProductInsightsService;
  signals: SiteSignalProbeService;
  store: DigestBaselineStore;
  url?: string | undefined;
  send?: DigestSender | undefined;
  at?: Date;
}): Promise<DigestRunOutcome[]> {
  const outcomes: DigestRunOutcome[] = [];

  for (const project of await input.projects.list({ includeArchived: false })) {
    try {
      const built = await input.insights.build(project.id);
      const history = await input.signals.history(project.id);
      const latest = history[0];
      const previous = await input.store.read(project.id);

      const digest = buildDigest({
        projectId: project.id,
        domain: project.normalizedDomain,
        insights: built.insights,
        citationGap: built.citationGap,
        // Without a probe there are no site findings, which is not the same as
        // a site with nothing wrong, so the plan stays empty rather than clean.
        actions: latest
          ? buildActionPlan({
            signals: latest.signals,
            recognition: {
              answered: built.insights.visibility.answered,
              recognized: built.insights.visibility.recognized,
              competitors: built.insights.shareOfVoice.competitors.map((row) => row.name),
            },
          })
          : [],
        signalChanges: latest?.changes || [],
        ...(previous ? { previous } : {}),
      }, input.at);

      outcomes.push({
        projectId: project.id,
        domain: project.normalizedDomain,
        reasons: digest.reasons,
        result: await deliverDigest({
          digest,
          store: input.store,
          ...(input.url ? { url: input.url } : {}),
          ...(input.send ? { send: input.send } : {}),
        }),
      });
    } catch (error) {
      // One project's evidence being unreadable must not stop the rest.
      outcomes.push({
        projectId: project.id,
        domain: project.normalizedDomain,
        reasons: [],
        result: { outcome: "failed", detail: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  return outcomes;
}
