import type { StructuredAsk } from "../topics/topic-service.js";
import { countDrafts } from "./agent-schema.js";
import { AgentUnavailableError, type ProductAgentService } from "./agent-service.js";

type JsonSender = (status: number, body: unknown) => void;

function reviewFrom(body: Record<string, unknown>): { status: "approved" | "rejected"; note: string | null } | null {
  const asked = typeof body.status === "string" ? body.status : "";
  if (asked !== "approved" && asked !== "rejected") return null;
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
  return { status: asked, note };
}

// /agents lists what each workflow would do and the drafts already written.
// A draft is written by POST and decided by POST to its own id. Nothing here
// publishes anything anywhere.
export async function handleAgentApi(input: {
  method: string;
  route: string[];
  send: JsonSender;
  service: ProductAgentService;
  ask: StructuredAsk;
  readJson?: () => Promise<Record<string, unknown>>;
}): Promise<boolean> {
  const { method, route, send, service } = input;
  if (route.length < 4 || route[0] !== "api" || route[1] !== "projects" || route[3] !== "agents") return false;
  const projectId = route[2] || "";
  const body = input.readJson ? await input.readJson() : {};

  try {
    if (route.length === 4 && method === "GET") {
      const [offers, drafts] = await Promise.all([service.offers(projectId), service.list(projectId)]);
      send(200, { offers, drafts, counts: countDrafts(drafts) });
      return true;
    }
    if (route.length === 4 && method === "POST") {
      const templateId = typeof body.templateId === "string" ? body.templateId : "";
      send(201, { draft: await service.draft(projectId, templateId, input.ask) });
      return true;
    }
    if (route.length === 6 && route[5] === "review" && method === "POST") {
      const decision = reviewFrom(body);
      if (!decision) {
        send(400, { code: "invalid_review", error: 'A review is "approved" or "rejected".' });
        return true;
      }
      send(200, { draft: await service.review(projectId, route[4] || "", decision) });
      return true;
    }
  } catch (error) {
    if (error instanceof AgentUnavailableError) {
      send(409, { code: "agent_unavailable", error: error.message });
      return true;
    }
    throw error;
  }

  if (route.length === 4 || (route.length === 6 && route[5] === "review")) {
    send(405, { error: "method_not_allowed" });
    return true;
  }
  return false;
}
