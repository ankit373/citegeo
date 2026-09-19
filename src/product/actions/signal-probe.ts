import { randomUUID } from "node:crypto";
import type { ProductProjectService } from "../projects/project-service.js";
import { readSiteSignals } from "./site-signals.js";
import type { SiteSignals } from "./site-signals.js";
import { diffSignals } from "./signal-diff.js";
import { SiteSignalFileStore } from "./signal-store.js";
import type { SiteSignalSnapshot } from "./signal-store.js";

// Probing reaches outside, so it belongs on a cadence in the worker rather than
// on a page load: a request-time fetch is slow, hammers third parties and keeps
// no history, and the history is what turns a state into a finding.

export type SignalProbeReader = (domain: string, options: { brandName?: string | undefined }) => Promise<SiteSignals>;

export function probeIntervalHours(): number {
  const raw = Number(process.env.SIGNAL_PROBE_INTERVAL_HOURS);
  return Number.isFinite(raw) && raw > 0 ? raw : 24;
}

export interface ProbeOutcome {
  projectId: string;
  snapshot: SiteSignalSnapshot;
  /** False when a stored snapshot was still current. */
  captured: boolean;
}

export class SiteSignalProbeService {
  constructor(
    private readonly projects: ProductProjectService,
    private readonly store: SiteSignalFileStore,
    private readonly read: SignalProbeReader = (domain, options) => readSiteSignals(domain, options),
  ) {}

  async history(projectId: string): Promise<SiteSignalSnapshot[]> {
    await this.projects.get(projectId);
    return this.store.list(projectId);
  }

  /** Captures now, whatever the cadence says. */
  async capture(projectId: string, at = new Date()): Promise<SiteSignalSnapshot> {
    const project = await this.projects.get(projectId);
    const previous = await this.store.latest(projectId);
    const signals = await this.read(project.normalizedDomain, { brandName: project.name });
    const snapshot: SiteSignalSnapshot = {
      id: randomUUID(),
      projectId,
      capturedAt: at.toISOString(),
      signals,
      changes: previous ? diffSignals(previous.signals, signals) : [],
    };
    await this.store.save(snapshot);
    return snapshot;
  }

  private due(snapshot: SiteSignalSnapshot | null, at: Date, intervalHours: number): boolean {
    if (!snapshot) return true;
    const last = Date.parse(snapshot.capturedAt);
    if (!Number.isFinite(last)) return true;
    return at.getTime() - last >= intervalHours * 60 * 60 * 1000;
  }

  /**
   * Probes every project whose newest snapshot has aged out. Runs alongside
   * runDue in the worker, so it shares the single writer that file storage
   * requires.
   */
  async probeDue(at = new Date(), intervalHours = probeIntervalHours()): Promise<ProbeOutcome[]> {
    const outcomes: ProbeOutcome[] = [];
    for (const project of await this.projects.list({ includeArchived: false })) {
      const latest = await this.store.latest(project.id);
      if (!this.due(latest, at, intervalHours)) {
        if (latest) outcomes.push({ projectId: project.id, snapshot: latest, captured: false });
        continue;
      }
      try {
        outcomes.push({ projectId: project.id, snapshot: await this.capture(project.id, at), captured: true });
      } catch {
        // One unreachable project must not stop the others being probed.
        continue;
      }
    }
    return outcomes;
  }
}
