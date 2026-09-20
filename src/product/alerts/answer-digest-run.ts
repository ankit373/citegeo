import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildAnswerDigest, type AnswerDigest, type DigestBaseline } from "./answer-digest.js";
import { buildHomeSummary } from "./home-summary.js";
import { buildTopicInsights } from "../topics/topic-insights.js";
import type { ProductProjectService } from "../projects/project-service.js";
import type { PromptRunService } from "../topics/prompt-run-service.js";
import type { TopicService } from "../topics/topic-service.js";

export type DeliveryOutcome = "sent" | "no_news" | "not_configured" | "failed";

export interface AnswerDigestOutcome {
  projectId: string;
  domain: string;
  outcome: DeliveryOutcome;
  detail: string;
  headline: string;
}

export type DigestSender = (input: { url: string; body: string }) => Promise<{ ok: boolean; status: number }>;

function notFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

/** On local disk, not in the object store: it records what was delivered from
 * this deployment, which is a property of the deployment rather than the data. */
export class AnswerDigestBaselineStore {
  constructor(private readonly dataDir: string) {}

  private path(projectId: string): string {
    return join(this.dataDir, `answer-digest-${projectId}.json`);
  }

  async read(projectId: string): Promise<DigestBaseline | null> {
    try {
      return JSON.parse(await readFile(this.path(projectId), "utf8")) as DigestBaseline;
    } catch (error) {
      if (notFound(error)) return null;
      return null;
    }
  }

  async write(projectId: string, baseline: DigestBaseline): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    const path = this.path(projectId);
    const temporary = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
    await rename(temporary, path);
  }
}

const defaultSender: DigestSender = async ({ url, body }) => {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
  return { ok: response.ok, status: response.status };
};

export async function deliverAnswerDigest(input: {
  digest: AnswerDigest;
  store: AnswerDigestBaselineStore;
  url?: string | undefined;
  send?: DigestSender | undefined;
}): Promise<{ outcome: DeliveryOutcome; detail: string }> {
  if (!input.digest.newsworthy) return { outcome: "no_news", detail: "Nothing moved since the last digest." };
  if (!input.url) return { outcome: "not_configured", detail: "Set REPORT_WEBHOOK_URL to deliver digests." };

  const send = input.send || defaultSender;
  let result: { ok: boolean; status: number };
  try {
    result = await send({ url: input.url, body: JSON.stringify(input.digest) });
  } catch (error) {
    return { outcome: "failed", detail: error instanceof Error ? error.message : String(error) };
  }
  // The baseline only advances on a successful send, so news that failed to
  // leave is offered again rather than lost.
  if (!result.ok) return { outcome: "failed", detail: `The endpoint answered HTTP ${result.status}.` };
  await input.store.write(input.digest.projectId, input.digest.baseline);
  return { outcome: "sent", detail: `Delivered ${input.digest.lines.length} line(s).` };
}

/** One digest per project. Kept out of the worker loop so it can be exercised
 * without a scheduler, and so one project cannot take the others down. */
export async function runAnswerDigests(input: {
  projects: ProductProjectService;
  topics: TopicService;
  runs: PromptRunService;
  store: AnswerDigestBaselineStore;
  modelCount: (projectId: string) => Promise<number>;
  url?: string | undefined;
  send?: DigestSender | undefined;
  at?: Date;
}): Promise<AnswerDigestOutcome[]> {
  const outcomes: AnswerDigestOutcome[] = [];
  for (const project of await input.projects.list({ includeArchived: false })) {
    try {
      const [set, answers, runList, identity, models] = await Promise.all([
        input.topics.get(project.id),
        input.runs.listAnswers(project.id),
        input.runs.listRuns(project.id),
        input.topics.targetIdentity(project.id).catch(() => null),
        input.modelCount(project.id).catch(() => 0),
      ]);
      const insights = buildTopicInsights({ projectId: project.id, set, answers, runs: runList, identityCaveat: identity?.caveat || null });
      const home = buildHomeSummary({
        projectId: project.id,
        domain: project.normalizedDomain,
        set,
        insights,
        runs: runList,
        modelCount: models,
      });
      const previous = await input.store.read(project.id);
      const digest = buildAnswerDigest({ home, ...(previous ? { previous } : {}) }, input.at);
      const result = await deliverAnswerDigest({ digest, store: input.store, url: input.url, send: input.send });
      outcomes.push({ projectId: project.id, domain: project.normalizedDomain, headline: digest.headline, ...result });
    } catch (error) {
      outcomes.push({
        projectId: project.id,
        domain: project.normalizedDomain,
        outcome: "failed",
        detail: error instanceof Error ? error.message : String(error),
        headline: "",
      });
    }
  }
  return outcomes;
}
