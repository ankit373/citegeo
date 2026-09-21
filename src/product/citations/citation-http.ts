import type { SourcePageService } from "./source-service.js";
import type { BrandIdentity } from "../topics/brand-identity.js";
import type { PromptAnswer } from "../topics/prompt-run-schema.js";

type CitationJsonSender = (status: number, body: unknown) => void;

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function handleCitationApi(input: {
  method: string;
  route: string[];
  send: CitationJsonSender;
  pages: SourcePageService;
  answers: (projectId: string) => Promise<PromptAnswer[]>;
  identity: (projectId: string) => Promise<BrandIdentity>;
  /** Everyone the answers named, so a page can be checked for each of them. */
  names: (projectId: string) => Promise<string[]>;
}): Promise<boolean> {
  const { method, route, send, pages } = input;
  if (route[0] !== "api" || route[1] !== "projects") return false;
  const projectId = route[2];
  const tail = route.slice(3);
  if (!projectId || tail.length !== 1 || tail[0] !== "source-pages") return false;

  if (method === "GET") {
    try {
      send(200, await pages.plan(projectId, await input.answers(projectId)));
    } catch (error) {
      send(404, { error: message(error) });
    }
    return true;
  }

  if (method === "POST") {
    try {
      const answers = await input.answers(projectId);
      send(200, await pages.harvest({
        projectId,
        answers,
        identity: await input.identity(projectId),
        names: await input.names(projectId),
      }));
    } catch (error) {
      send(400, { error: message(error) });
    }
    return true;
  }

  return false;
}
