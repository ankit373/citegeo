import { effectOf, isActionState, type ActionEffect, type ActionLogService, type TakenAction } from "./action-log.js";
import type { TopicInsights } from "./topic-insights.js";

type ActionJsonSender = (status: number, body: unknown) => void;

export interface TakenActionView extends TakenAction {
  /** Null while the move has not been taken up. */
  effect: ActionEffect | null;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function handleRankingActionApi(input: {
  method: string;
  route: string[];
  send: ActionJsonSender;
  actions: ActionLogService;
  insights: (projectId: string) => Promise<TopicInsights>;
  readJson: () => Promise<Record<string, unknown>>;
}): Promise<boolean> {
  const { method, route, send, actions, insights, readJson } = input;
  if (route[0] !== "api" || route[1] !== "projects") return false;
  const projectId = route[2];
  const tail = route.slice(3);
  if (!projectId || tail.length !== 1 || tail[0] !== "actions") return false;

  const view = async (rows: TakenAction[]): Promise<TakenActionView[]> => {
    const standing = await insights(projectId);
    return rows.map((row) => ({ ...row, effect: effectOf(row, standing) }));
  };

  if (method === "GET") {
    try {
      send(200, { actions: await view(await actions.list(projectId)) });
    } catch (error) {
      send(404, { error: message(error) });
    }
    return true;
  }

  if (method === "PUT") {
    const body = await readJson();
    const state = body.state;
    if (!isActionState(state)) {
      send(400, { error: "A move is open, doing, done or dismissed." });
      return true;
    }
    const moveId = typeof body.moveId === "string" ? body.moveId.trim() : "";
    if (!moveId) {
      send(400, { error: "Which move this is has to be stated." });
      return true;
    }
    try {
      const standing = await insights(projectId);
      const saved = await actions.set({
        projectId,
        moveId,
        promptId: typeof body.promptId === "string" && body.promptId ? body.promptId : null,
        state,
        note: typeof body.note === "string" ? body.note : undefined,
        insights: standing,
      });
      send(200, { action: { ...saved, effect: effectOf(saved, standing) } });
    } catch (error) {
      send(400, { error: message(error) });
    }
    return true;
  }

  return false;
}
