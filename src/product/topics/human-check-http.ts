import { CHECK_FIELDS, type CheckField } from "./human-check.js";
import type { HumanCheckService } from "./human-check-service.js";
import type { PromptAnswer } from "./prompt-run-schema.js";

type Sender = (status: number, body: unknown) => void;

function isField(value: unknown): value is CheckField {
  return typeof value === "string" && (CHECK_FIELDS as string[]).includes(value);
}

export async function handleHumanCheckApi(input: {
  method: string;
  route: string[];
  send: Sender;
  service: HumanCheckService;
  answers: (projectId: string) => Promise<PromptAnswer[]>;
  readJson?: (() => Promise<Record<string, unknown>>) | undefined;
}): Promise<boolean> {
  const { method, route, send, service } = input;
  if (route[0] !== "api" || route[1] !== "projects" || route.length !== 4) return false;
  const projectId = route[2] || "";
  if (route[3] !== "human-check") return false;

  if (method === "GET") {
    try {
      const answers = await input.answers(projectId);
      const queue = await service.queue(projectId, answers);
      send(200, { ...queue, agreement: await service.agreement(projectId, answers) });
    } catch (error) {
      send(404, { error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  if (method === "POST" && input.readJson) {
    try {
      const body = await input.readJson();
      if (!isField(body.field)) {
        send(400, { error: "A verdict is about one of: " + CHECK_FIELDS.join(", ") + "." });
        return true;
      }
      await service.record(projectId, {
        id: typeof body.id === "string" ? body.id : "",
        field: body.field,
        agreed: body.agreed === true,
        correction: typeof body.correction === "string" ? body.correction : undefined,
      });
      const answers = await input.answers(projectId);
      send(200, { ...(await service.queue(projectId, answers)), agreement: await service.agreement(projectId, answers) });
    } catch (error) {
      send(400, { error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  return false;
}
