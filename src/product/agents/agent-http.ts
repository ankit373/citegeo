import type { StructuredAsk } from "../topics/topic-service.js";
import { countDrafts, parsePublication, type AgentDraft } from "./agent-schema.js";
import { AgentUnavailableError, type ProductAgentService } from "./agent-service.js";

type JsonSender = (status: number, body: unknown) => void;

function reviewFrom(body: Record<string, unknown>): { status: "approved" | "rejected"; note: string | null } | null {
  const asked = typeof body.status === "string" ? body.status : "";
  if (asked !== "approved" && asked !== "rejected") return null;
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
  return { status: asked, note };
}

// Nothing here publishes anything anywhere. Publishing records that a person
// did, which is the date every later measurement is read against.
export async function handleAgentApi(input: {
  method: string;
  route: string[];
  send: JsonSender;
  service: ProductAgentService;
  ask: StructuredAsk;
  readJson?: () => Promise<Record<string, unknown>>;
  /** What to do once a draft is recorded as live. Injected so this domain
   * never has to know that the thing measuring it is an experiment. */
  onPublished?: (projectId: string, draft: AgentDraft) => Promise<{ id: string; name: string }>;
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
      // batch: one draft per gap the template can act on, rather than the first.
      if (body.batch === true) {
        const asked = typeof body.limit === "number" ? body.limit : Number(body.limit);
        const limit = Number.isFinite(asked) && asked > 0 ? Math.min(Math.floor(asked), 50) : 5;
        send(201, await service.draftBatch(projectId, templateId, input.ask, limit));
        return true;
      }
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
    if (route.length === 6 && route[5] === "publish" && method === "POST") {
      const publication = parsePublication(body);
      if (!publication) {
        send(400, { code: "invalid_publication", error: "Recording a draft as live needs the http address it went live at." });
        return true;
      }
      const draft = await service.publish(projectId, route[4] || "", publication);
      // A draft that went live and cannot be measured is still live. The
      // reason the measurement did not start is reported beside it, not thrown.
      let measuring: { id: string; name: string } | null = null;
      let notMeasured: string | null = null;
      if (input.onPublished) {
        try {
          measuring = await input.onPublished(projectId, draft);
        } catch (error) {
          notMeasured = error instanceof Error ? error.message : String(error);
        }
      }
      send(200, { draft, measuring, notMeasured });
      return true;
    }
  } catch (error) {
    if (error instanceof AgentUnavailableError) {
      send(409, { code: "agent_unavailable", error: error.message });
      return true;
    }
    throw error;
  }

  if (route.length === 4 || (route.length === 6 && (route[5] === "review" || route[5] === "publish"))) {
    send(405, { error: "method_not_allowed" });
    return true;
  }
  return false;
}
