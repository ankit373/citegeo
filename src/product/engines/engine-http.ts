import { EngineUnavailableError, type EngineService } from "./engine-service.js";

type EngineJsonSender = (status: number, body: unknown) => void;

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((row): row is string => typeof row === "string") : [];
}

export async function handleEngineApi(input: {
  method: string;
  route: string[];
  send: EngineJsonSender;
  engines: EngineService;
  readJson: () => Promise<Record<string, unknown>>;
}): Promise<boolean> {
  const { method, route, send, engines, readJson } = input;
  if (route[0] !== "api" || route[1] !== "projects") return false;
  const projectId = route[2];
  const tail = route.slice(3);
  if (!projectId || tail.length !== 1 || tail[0] !== "engines") return false;

  if (method === "GET") {
    send(200, await engines.status(projectId));
    return true;
  }

  if (method === "PUT") {
    const body = await readJson();
    try {
      send(200, await engines.select(projectId, stringList(body.engineIds)));
    } catch (error) {
      send(error instanceof EngineUnavailableError ? 400 : 500, { error: message(error) });
    }
    return true;
  }

  return false;
}
