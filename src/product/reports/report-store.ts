import type { ProductProjectFileStore } from "../projects/project-store.js";
import { getJson, listJson, putJson } from "../storage/object-store.js";
import type { RecognitionReport } from "./report-schema.js";

export class RecognitionReportFileStore {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private prefix(projectId: string, runId: string): string {
    return this.projects.keyFor(projectId, "recognition-runs", runId, "reports");
  }

  private key(projectId: string, runId: string, reportId: string): string {
    return `${this.prefix(projectId, runId)}/${reportId}.json`;
  }

  async list(projectId: string, runId: string): Promise<RecognitionReport[]> {
    const rows = await listJson<RecognitionReport>(this.projects.objects, this.prefix(projectId, runId));
    return rows
      .filter((report) => report.projectId === projectId && report.runId === runId)
      .sort((left, right) => left.reportRevision - right.reportRevision);
  }

  async read(projectId: string, runId: string, reportId: string): Promise<RecognitionReport | null> {
    const report = await getJson<RecognitionReport>(this.projects.objects, this.key(projectId, runId, reportId));
    if (!report) return null;
    return report.projectId === projectId && report.runId === runId && report.reportId === reportId ? report : null;
  }

  async save(report: RecognitionReport): Promise<void> {
    await putJson(this.projects.objects, this.key(report.projectId, report.runId, report.reportId), report);
  }
}
