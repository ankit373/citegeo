import { randomUUID } from "node:crypto";
import { mkdir, open, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { sha256 } from "../../utils/hash.js";
import type { ProductProjectFileStore } from "../projects/project-store.js";
import { getJson, listJson, putJson } from "../storage/object-store.js";
import type { BudgetLedgerEntry, MonitoringTask, ScheduledOccurrence } from "./schedule-schema.js";

export class ProductScheduleFileStore {
  constructor(private readonly projects: ProductProjectFileStore, private readonly localRoot: string) {}

  private prefix(projectId: string, ...parts: string[]): string {
    return this.projects.keyFor(projectId, "schedules", ...parts);
  }

  private occurrenceKey(projectId: string, taskId: string, scheduledFor: string): string {
    return `${this.prefix(projectId, "occurrences")}/${sha256(`${taskId}:${scheduledFor}`)}.json`;
  }

  /** Guards stay on local disk whatever the backend is: they need an atomic
   * create-if-absent, which object storage does not offer portably. */
  private guardPath(projectId: string, name: string): string {
    return join(resolve(this.localRoot, "guards", projectId), `${sha256(name)}.lock`);
  }

  async saveTask(value: MonitoringTask): Promise<void> {
    await putJson(this.projects.objects, `${this.prefix(value.projectId, "tasks")}/${value.id}.json`, value);
  }

  async readTask(projectId: string, taskId: string): Promise<MonitoringTask | null> {
    const row = await getJson<MonitoringTask>(this.projects.objects, `${this.prefix(projectId, "tasks")}/${taskId}.json`);
    return row && row.projectId === projectId && row.id === taskId ? row : null;
  }

  async listTasks(projectId: string): Promise<MonitoringTask[]> {
    const rows = await listJson<MonitoringTask>(this.projects.objects, this.prefix(projectId, "tasks"));
    return rows.filter((row) => row.projectId === projectId).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  /** Once-only per scheduled time. The guard decides who creates it; the
   * occurrence itself is stored with everything else. */
  async getOrCreateOccurrence(input: Omit<ScheduledOccurrence, "id" | "createdAt">): Promise<{ occurrence: ScheduledOccurrence; created: boolean }> {
    const key = this.occurrenceKey(input.projectId, input.taskId, input.scheduledFor);
    const guard = this.guardPath(input.projectId, `occurrence:${input.taskId}:${input.scheduledFor}`);
    await mkdir(join(resolve(this.localRoot, "guards", input.projectId)), { recursive: true });
    let handle;
    try {
      handle = await open(guard, "wx");
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
        const existing = await getJson<ScheduledOccurrence>(this.projects.objects, key);
        if (existing) return { occurrence: existing, created: false };
        // The guard exists but the document does not, so the previous attempt
        // died between the two. Taking it over is better than never running.
        await unlink(guard).catch(() => undefined);
        return this.getOrCreateOccurrence(input);
      }
      throw error;
    }
    try {
      const existing = await getJson<ScheduledOccurrence>(this.projects.objects, key);
      if (existing) return { occurrence: existing, created: false };
      const value: ScheduledOccurrence = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
      await putJson(this.projects.objects, key, value);
      return { occurrence: value, created: true };
    } finally {
      await handle.close();
    }
  }

  async saveOccurrence(value: ScheduledOccurrence): Promise<void> {
    await putJson(this.projects.objects, this.occurrenceKey(value.projectId, value.taskId, value.scheduledFor), value);
  }

  async readOccurrence(projectId: string, taskId: string, scheduledFor: string): Promise<ScheduledOccurrence | null> {
    const row = await getJson<ScheduledOccurrence>(this.projects.objects, this.occurrenceKey(projectId, taskId, scheduledFor));
    return row && row.projectId === projectId && row.taskId === taskId && row.scheduledFor === scheduledFor ? row : null;
  }

  async listOccurrences(projectId: string, taskId?: string): Promise<ScheduledOccurrence[]> {
    const rows = await listJson<ScheduledOccurrence>(this.projects.objects, this.prefix(projectId, "occurrences"));
    return rows
      .filter((row) => row.projectId === projectId && (!taskId || row.taskId === taskId))
      .sort((left, right) => left.scheduledFor.localeCompare(right.scheduledFor));
  }

  async saveLedger(value: BudgetLedgerEntry): Promise<void> {
    await putJson(this.projects.objects, `${this.prefix(value.projectId, "ledger")}/${value.id}.json`, value);
  }

  async listLedger(projectId: string, taskId?: string): Promise<BudgetLedgerEntry[]> {
    const rows = await listJson<BudgetLedgerEntry>(this.projects.objects, this.prefix(projectId, "ledger"));
    return rows
      .filter((row) => row.projectId === projectId && (!taskId || row.taskId === taskId))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async withTaskLock<T>(projectId: string, taskId: string, operation: () => Promise<T>): Promise<{ acquired: boolean; value?: T }> {
    await mkdir(join(resolve(this.localRoot, "guards", projectId)), { recursive: true });
    const path = this.guardPath(projectId, `task:${taskId}`);
    let handle;
    try {
      handle = await open(path, "wx");
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") return { acquired: false };
      throw error;
    }
    try {
      return { acquired: true, value: await operation() };
    } finally {
      await handle.close();
      await unlink(path).catch(() => undefined);
    }
  }
}
