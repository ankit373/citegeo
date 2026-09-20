import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProductProjectFileStore } from "../projects/project-store.js";
import { nextRunAt } from "../scheduling/schedule-rule.js";
import type { MonitoringScheduleRule } from "../scheduling/schedule-schema.js";
import type { PromptRunService } from "./prompt-run-service.js";

// One schedule per project. The measurement scheduler's task carries a watch
// set and a budget ledger, so only its rule evaluator is reused.

export interface PromptSchedule {
  projectId: string;
  enabled: boolean;
  rule: MonitoringScheduleRule;
  /** Markets to ask in on every run. */
  regionIds: string[];
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunId: string | null;
  /** Why the last run did not happen, when it did not. */
  lastError: string | null;
  updatedAt: string;
}

const DEFAULT_RULE: MonitoringScheduleRule = { frequency: "weekly", timezone: "UTC", hour: 9, minute: 0, weekday: 1 };

export function emptyPromptSchedule(projectId: string): PromptSchedule {
  return {
    projectId,
    enabled: false,
    rule: DEFAULT_RULE,
    regionIds: ["global"],
    nextRunAt: null,
    lastRunAt: null,
    lastRunId: null,
    lastError: null,
    updatedAt: new Date().toISOString(),
  };
}

function notFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

async function writeJson(path: string, value: unknown): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

export class PromptScheduleFileStore {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private path(projectId: string): string {
    return join(this.projects.projectDir(projectId), "prompt-schedule.json");
  }

  async load(projectId: string): Promise<PromptSchedule> {
    try {
      const parsed = JSON.parse(await readFile(this.path(projectId), "utf8")) as PromptSchedule;
      return { ...emptyPromptSchedule(projectId), ...parsed, projectId };
    } catch (error) {
      if (notFound(error)) return emptyPromptSchedule(projectId);
      throw error;
    }
  }

  async save(schedule: PromptSchedule): Promise<void> {
    await mkdir(this.projects.projectDir(schedule.projectId), { recursive: true });
    await writeJson(this.path(schedule.projectId), { ...schedule, updatedAt: new Date().toISOString() });
  }
}

export class PromptScheduleService {
  constructor(
    private readonly store: PromptScheduleFileStore,
    private readonly runs: PromptRunService,
  ) {}

  async get(projectId: string): Promise<PromptSchedule> {
    return this.store.load(projectId);
  }

  async set(projectId: string, input: { enabled: boolean; rule?: MonitoringScheduleRule; regionIds?: string[] }): Promise<PromptSchedule> {
    const current = await this.store.load(projectId);
    const rule = input.rule || current.rule;
    // Validated by computing the next occurrence, so a bad rule is refused here
    // rather than silently never firing.
    const next = input.enabled ? nextRunAt(rule) : null;
    const schedule: PromptSchedule = {
      ...current,
      enabled: input.enabled,
      rule,
      regionIds: input.regionIds && input.regionIds.length ? input.regionIds : current.regionIds,
      nextRunAt: next,
      updatedAt: new Date().toISOString(),
    };
    await this.store.save(schedule);
    return this.store.load(projectId);
  }

  /** The next occurrence is advanced before the run starts, so a slow run
   * cannot queue a second copy of itself behind the first. */
  async runDue(projectIds: string[], at: Date = new Date()): Promise<PromptSchedule[]> {
    const fired: PromptSchedule[] = [];
    for (const projectId of projectIds) {
      const schedule = await this.store.load(projectId);
      if (!schedule.enabled || !schedule.nextRunAt) continue;
      if (Date.parse(schedule.nextRunAt) > at.getTime()) continue;
      await this.store.save({ ...schedule, nextRunAt: nextRunAt(schedule.rule, at), lastRunAt: at.toISOString() });
      try {
        const run = await this.runs.start({ projectId, regionIds: schedule.regionIds });
        await this.store.save({ ...(await this.store.load(projectId)), lastRunId: run.id, lastError: null });
      } catch (error) {
        // A failure is recorded rather than thrown: one project must not stop
        // the others, and a silent failure is how a tracker stops tracking.
        await this.store.save({
          ...(await this.store.load(projectId)),
          lastError: error instanceof Error ? error.message : String(error),
        });
      }
      fired.push(await this.store.load(projectId));
    }
    return fired;
  }
}
