import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProductProjectFileStore } from "../projects/project-store.js";
import type { PromptAnswer, PromptRun } from "./prompt-run-schema.js";

function notFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

async function writeJson(path: string, value: unknown): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, path);
}

async function readJsonDir<T>(directory: string): Promise<T[]> {
  try {
    const names = await readdir(directory);
    const rows: T[] = [];
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      try {
        rows.push(JSON.parse(await readFile(join(directory, name), "utf8")) as T);
      } catch {
        // A file being renamed into place is not a corrupt store.
      }
    }
    return rows;
  } catch (error) {
    if (notFound(error)) return [];
    throw error;
  }
}

/** Runs and their answers, one directory per project. */
export class PromptRunFileStore {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private runsDir(projectId: string): string {
    return join(this.projects.projectDir(projectId), "prompt-runs");
  }

  private answersDir(projectId: string): string {
    return join(this.projects.projectDir(projectId), "prompt-answers");
  }

  async saveRun(run: PromptRun): Promise<void> {
    await mkdir(this.runsDir(run.projectId), { recursive: true });
    await writeJson(join(this.runsDir(run.projectId), `${run.id}.json`), run);
  }

  async saveAnswer(answer: PromptAnswer): Promise<void> {
    await mkdir(this.answersDir(answer.projectId), { recursive: true });
    await writeJson(join(this.answersDir(answer.projectId), `${answer.id}.json`), answer);
  }

  /** Newest first. */
  async listRuns(projectId: string): Promise<PromptRun[]> {
    const rows = await readJsonDir<PromptRun>(this.runsDir(projectId));
    return rows.sort((left, right) => right.startedAt.localeCompare(left.startedAt));
  }

  async listAnswers(projectId: string, runId?: string): Promise<PromptAnswer[]> {
    const rows = await readJsonDir<PromptAnswer>(this.answersDir(projectId));
    const scoped = runId ? rows.filter((row) => row.runId === runId) : rows;
    return scoped.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }
}
