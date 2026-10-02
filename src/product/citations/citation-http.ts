import type { SourcePageService } from "./source-service.js";
import type { BrandIdentity } from "../topics/brand-identity.js";
import type { PromptAnswer, PromptRun } from "../topics/prompt-run-schema.js";

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
  /** Re-reads pages already stored, so a page that changed can be seen. */
  refresh?: boolean | undefined;
  /** What each answer took from the pages cited for it, over time. */
  runs?: ((projectId: string) => Promise<PromptRun[]>) | undefined;
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

  // Shapes that a source was pushed rather than grew. Read only, and built
  // from what is already stored, so asking never reaches outside.
  if (method === "GET" && tail[0] === "source-interference") {
    try {
      send(200, await pages.interference(projectId, await input.answers(projectId), input.runs ? await input.runs(projectId) : []));
    } catch (error) {
      send(404, { error: message(error) });
    }
    return true;
  }

  if (method === "GET" && tail[0] === "source-concentration") {
    try {
      const scope = await input.scope(projectId);
      send(200, pages.concentration(await input.answers(projectId), scope.domain));
    } catch (error) {
      send(404, { error: message(error) });
    }
    return true;
  }

  if (method === "GET" && tail[0] === "source-shape") {
    try {
      const scope = await input.scope(projectId);
      send(200, await pages.shape(projectId, scope.domain));
    } catch (error) {
      send(404, { error: message(error) });
    }
    return true;
  }

  if (method === "GET" && tail[0] === "source-credit") {
    try {
      send(200, await pages.credit(projectId, await input.answers(projectId)));
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
        refresh: input.refresh,
      }));
    } catch (error) {
      send(400, { error: message(error) });
    }
    return true;
  }

  return false;
}
