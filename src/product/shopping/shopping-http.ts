import type { StructuredAsk } from "../topics/topic-service.js";
import { ShoppingUnavailableError, type ProductShoppingService } from "./shopping-service.js";

type JsonSender = (status: number, body: unknown) => void;

function limitFrom(value: unknown): number | undefined {
  const asked = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(asked) || asked < 1) return undefined;
  return Math.min(Math.floor(asked), 100);
}

// GET reads the stored report, POST reads the answers again. Reading spends a
// model call per answer, so it never happens on a GET.
export async function handleShoppingApi(input: {
  method: string;
  route: string[];
  send: JsonSender;
  service: ProductShoppingService;
  ask: StructuredAsk;
  readJson?: () => Promise<Record<string, unknown>>;
}): Promise<boolean> {
  const { method, route, send, service } = input;
  if (route.length !== 4 || route[0] !== "api" || route[1] !== "projects" || route[3] !== "shopping") return false;
  const projectId = route[2] || "";

  if (method === "GET") {
    const report = await service.get(projectId);
    send(200, report ? { report } : { report: null, note: "No buying answer has been read for this project yet." });
    return true;
  }
  if (method !== "POST") {
    send(405, { error: "method_not_allowed" });
    return true;
  }

  const body = input.readJson ? await input.readJson() : {};
  try {
    send(201, {
      report: await service.run(projectId, input.ask, {
        limit: limitFrom(body.limit),
        runId: typeof body.runId === "string" && body.runId ? body.runId : undefined,
      }),
    });
  } catch (error) {
    if (error instanceof ShoppingUnavailableError) {
      send(409, { code: "shopping_unavailable", error: error.message });
      return true;
    }
    throw error;
  }
  return true;
}
