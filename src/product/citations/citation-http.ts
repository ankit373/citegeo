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
  /** The project's domain and the domains the answers named, so a page nobody
   * can be added to is not offered as somewhere to get listed. */
  scope: (projectId: string) => Promise<{ domain?: string | undefined; rivalDomains?: string[] | undefined }>;
}): Promise<boolean> {
  const { method, route, send, pages } = input;
  if (route[0] !== "api" || route[1] !== "projects") return false;
  const projectId = route[2];
  const tail = route.slice(3);
  if (!projectId || tail.length !== 1) return false;

  // What each answer took from the pages cited for it, which is a different
  // question from which pages were cited and lives on its own route.
  if (method === "GET" && tail[0] === "source-uptake") {
    try {
      send(200, await pages.uptake(projectId, await input.answers(projectId)));
    } catch (error) {
      send(404, { error: message(error) });
    }
    return true;
  }

  if (tail[0] !== "source-pages") return false;

  if (method === "GET") {
    try {
      send(200, await pages.plan(projectId, await input.answers(projectId), await input.scope(projectId)));
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
        scope: await input.scope(projectId),
      }));
    } catch (error) {
      send(400, { error: message(error) });
    }
    return true;
  }

  return false;
}
