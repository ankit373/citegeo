import { EngineUnavailableError, type EngineService } from "./engine-service.js";
import { probeReach } from "./engine-reach.js";
import { BROWSER_ENGINES } from "./engine-registry.js";

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
  if (!projectId || tail.length !== 1) return false;

  // Asked before a run rather than discovered by spending one. It loads each
  // surface once and reads it, and asks none of them anything.
  if (method === "GET" && tail[0] === "engine-reach") {
    try {
      send(200, await probeReach({ engines: BROWSER_ENGINES, endpoint: process.env.BROWSER_DEBUG_ENDPOINT }));
    } catch (error) {
      send(503, { error: message(error) });
    }
    return true;
  }

  if (tail[0] !== "engines") return false;

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
