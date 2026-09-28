import type { StructuredAsk } from "../topics/topic-service.js";
import { groupClaims, tally } from "./factcheck-schema.js";
import { FactCheckUnavailableError, type ProductFactCheckService } from "./factcheck-service.js";

type JsonSender = (status: number, body: unknown) => void;

function limitFrom(value: unknown): number | undefined {
  const asked = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(asked) || asked < 1) return undefined;
  return Math.min(Math.floor(asked), 100);
}

// GET reads the stored report, POST checks again. A check spends a model call
// per answer, so it is never done on a read.
export async function handleFactCheckApi(input: {
  method: string;
  route: string[];
  send: JsonSender;
  service: ProductFactCheckService;
  ask: StructuredAsk;
  readJson?: () => Promise<Record<string, unknown>>;
}): Promise<boolean> {
  const { method, route, send, service } = input;
  if (route.length !== 4 || route[0] !== "api" || route[1] !== "projects" || route[3] !== "factcheck") return false;
  const projectId = route[2] || "";

  if (method === "GET") {
    const report = await service.get(projectId);
    if (!report) {
      send(200, { report: null, note: "No claim check has been run for this project yet." });
      return true;
    }
    send(200, {
      report,
      tally: tally(report),
      contradicted: groupClaims(report, "contradicted"),
      unsupported: groupClaims(report, "unsupported"),
    });
    return true;
  }

  if (method !== "POST") {
    send(405, { error: "method_not_allowed" });
    return true;
  }

  const body = input.readJson ? await input.readJson() : {};
  try {
    const report = await service.run(projectId, input.ask, {
      limit: limitFrom(body.limit),
      runId: typeof body.runId === "string" && body.runId ? body.runId : undefined,
    });
    send(201, {
      report,
      tally: tally(report),
      contradicted: groupClaims(report, "contradicted"),
      unsupported: groupClaims(report, "unsupported"),
    });
  } catch (error) {
    if (error instanceof FactCheckUnavailableError) {
      send(409, { code: "factcheck_unavailable", error: error.message });
      return true;
    }
    throw error;
  }
  return true;
}
