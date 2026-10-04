import { ExperimentInputError } from "./experiment-schema.js";
import type { ExperimentService } from "./experiment-service.js";
import type { PromptAnswer } from "../topics/prompt-run-schema.js";

type Sender = (status: number, body: unknown) => void;

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((row): row is string => typeof row === "string") : [];
}

export async function handleExperimentApi(input: {
  method: string;
  route: string[];
  send: Sender;
  service: ExperimentService;
  answers: (projectId: string) => Promise<PromptAnswer[]>;
  readJson?: (() => Promise<Record<string, unknown>>) | undefined;
}): Promise<boolean> {
  const { method, route, send, service } = input;
  if (route[0] !== "api" || route[1] !== "projects") return false;
  const projectId = route[2] || "";
  const tail = route.slice(3);
  if (!projectId || tail[0] !== "experiments") return false;

  if (method === "GET" && tail.length === 1) {
    try {
      send(200, { experiments: await service.list(projectId, await input.answers(projectId)) });
    } catch (error) {
      send(404, { error: message(error) });
    }
    return true;
  }

  if (method === "POST" && tail.length === 1 && input.readJson) {
    try {
      const body = await input.readJson();
      await service.start(projectId, {
        name: typeof body.name === "string" ? body.name : "",
        hypothesis: typeof body.hypothesis === "string" ? body.hypothesis : "",
        changed: typeof body.changed === "string" ? body.changed : "",
        treatedPromptIds: stringList(body.treatedPromptIds),
        controlPromptIds: stringList(body.controlPromptIds),
        changedAt: typeof body.changedAt === "string" ? body.changedAt : undefined,
      });
      send(201, { experiments: await service.list(projectId, await input.answers(projectId)) });
    } catch (error) {
      send(error instanceof ExperimentInputError ? 400 : 500, { error: message(error) });
    }
    return true;
  }

  if (method === "POST" && tail.length === 3 && tail[2] === "stop") {
    try {
      await service.stop(projectId, tail[1] || "");
      send(200, { experiments: await service.list(projectId, await input.answers(projectId)) });
    } catch (error) {
      send(error instanceof ExperimentInputError ? 404 : 500, { error: message(error) });
    }
    return true;
  }

  return false;
}
