import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Digest, DigestBaseline } from "./digest.js";

// Sends a digest somewhere and remembers what was sent, so the next one can
// describe movement rather than repeating the current state. Nothing is sent
// when there is no news, and the baseline only advances on a delivery that
// actually succeeded: recording it after a failed send would silently swallow
// the change it was meant to report.

export type DeliveryOutcome = "sent" | "no_news" | "not_configured" | "failed";

export interface DeliveryResult {
  outcome: DeliveryOutcome;
  detail: string;
  status?: number | undefined;
}

export type DigestSender = (input: { url: string; body: string }) => Promise<{ ok: boolean; status: number }>;

export function reportWebhookUrl(): string | undefined {
  return process.env.REPORT_WEBHOOK_URL?.trim() || undefined;
}

function notFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

export class DigestBaselineStore {
  constructor(private readonly dataDir: string) {}

  private path(projectId: string): string {
    return join(this.dataDir, `digest-baseline-${projectId}.json`);
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
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  return { ok: response.ok, status: response.status };
};

export async function deliverDigest(input: {
  digest: Digest;
  store: DigestBaselineStore;
  url?: string | undefined;
  send?: DigestSender | undefined;
}): Promise<DeliveryResult> {
  if (!input.digest.newsworthy) {
    return { outcome: "no_news", detail: "Nothing moved since the last digest." };
  }
  const url = input.url || reportWebhookUrl();
  if (!url) {
    return { outcome: "not_configured", detail: "Set REPORT_WEBHOOK_URL to deliver digests." };
  }

  const send = input.send || defaultSender;
  let result: { ok: boolean; status: number };
  try {
    result = await send({ url, body: JSON.stringify(input.digest) });
  } catch (error) {
    return { outcome: "failed", detail: error instanceof Error ? error.message : String(error) };
  }
  if (!result.ok) {
    // The baseline stays put, so the same news is offered again next pass.
    return { outcome: "failed", detail: `The endpoint answered HTTP ${result.status}.`, status: result.status };
  }

  await input.store.write(input.digest.projectId, input.digest.baseline);
  return { outcome: "sent", detail: `Delivered ${input.digest.reasons.length} change(s).`, status: result.status };
}
