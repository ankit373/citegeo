import { SearchConsoleUnavailableError, type SearchConsoleService } from "./search-console-service.js";
import type { TopicInsights } from "../topics/topic-insights.js";
import { CORRELATION_CAVEAT, linkAssistants } from "../topics/assistant-correlation.js";
import type { Prompt } from "../topics/topic-schema.js";

type SearchJsonSender = (status: number, body: unknown) => void;

export async function handleSearchConsoleApi(input: {
  method: string;
  route: string[];
  send: SearchJsonSender;
  searchConsole: SearchConsoleService;
  prompts: (projectId: string) => Promise<Prompt[]>;
  insights: (projectId: string) => Promise<TopicInsights>;
  readJson: () => Promise<Record<string, unknown>>;
}): Promise<boolean> {
  const { method, route, send, searchConsole } = input;
  if (route[0] !== "api" || route[1] !== "projects") return false;
  const projectId = route[2];
  const tail = route.slice(3);
  if (!projectId || tail.length !== 1) return false;

  if (tail[0] === "assistant-referrals") {
    // The join is computed here because this is the only place that holds both
    // halves. Doing it in the browser would need the view to import a module
    // the app route cannot serve.
    const withLink = async (payload: { report: { assistants?: Array<{ source: string; sessions: number; engaged: number }> } | null }) => {
      const insights = await input.insights(projectId).catch(() => undefined);
      const visibility = (insights?.byModel || []).map((row) => ({
        providerId: row.providerId,
        displayName: row.displayName,
        score: row.score.score,
        answers: row.score.answers,
      }));
      const arrivals = payload.report?.assistants || [];
      return { ...payload, link: { rows: linkAssistants({ visibility, arrivals }), caveat: CORRELATION_CAVEAT } };
    };
    if (method === "GET") {
      send(200, await withLink(await searchConsole.referrals(projectId) as never));
      return true;
    }
    if (method === "POST") {
      try {
        send(200, await withLink({ report: await searchConsole.refreshReferrals(projectId) } as never));
      } catch (error) {
        send(error instanceof SearchConsoleUnavailableError ? 400 : 500, { error: error instanceof Error ? error.message : String(error) });
      }
      return true;
    }
    return false;
  }

  if (tail[0] !== "search-demand") return false;

  if (method === "GET") {
    send(200, await searchConsole.status(projectId));
    return true;
  }

  if (method === "POST") {
    const body = await input.readJson();
    try {
      const report = await searchConsole.refresh({
        projectId,
        prompts: await input.prompts(projectId),
        insights: await input.insights(projectId).catch(() => undefined),
        days: typeof body.days === "number" ? body.days : undefined,
      });
      send(200, { report });
    } catch (error) {
      // A missing key is a configuration answer, not a server fault.
      send(error instanceof SearchConsoleUnavailableError ? 400 : 500, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }

  return false;
}
