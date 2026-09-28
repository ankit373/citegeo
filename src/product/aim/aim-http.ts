import type { TopicInsights } from "../topics/topic-insights.js";
import type { SiteSignalSnapshot } from "../actions/signal-store.js";
import { writeMemo } from "./aim-watch.js";

type JsonSender = (status: number, body: unknown) => void;

// Read-only. The memo is derived from measurements already stored, so asking
// for it calls no model and costs nothing.
export async function handleAimApi(input: {
  method: string;
  route: string[];
  send: JsonSender;
  insights: (projectId: string) => Promise<TopicInsights>;
  history: (projectId: string) => Promise<SiteSignalSnapshot[]>;
}): Promise<boolean> {
  const { method, route, send } = input;
  if (route.length !== 4 || route[0] !== "api" || route[1] !== "projects" || route[3] !== "aim") return false;
  const projectId = route[2] || "";
  if (method !== "GET") {
    send(405, { error: "method_not_allowed" });
    return true;
  }
  const [insights, snapshots] = await Promise.all([input.insights(projectId), input.history(projectId).catch(() => [])]);
  // The newest snapshot carries what moved since the one before it.
  send(200, { memo: writeMemo({ projectId, insights, signals: snapshots[0]?.changes || [] }) });
  return true;
}
