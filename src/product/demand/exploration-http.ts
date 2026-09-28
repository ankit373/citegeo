import type { ExplorationFileStore } from "./exploration-store.js";

type JsonSender = (status: number, body: unknown) => void;

// Reading only. Exploring means indexing a corpus of millions of questions,
// which takes minutes, so it is a command rather than a request. See
// docs/prompt-demand.md.
export async function handleExplorationApi(input: {
  method: string;
  route: string[];
  send: JsonSender;
  store: ExplorationFileStore;
}): Promise<boolean> {
  const { method, route, send, store } = input;
  if (route.length < 4 || route[0] !== "api" || route[1] !== "projects" || route[3] !== "conversations") return false;
  const projectId = route[2] || "";
  if (method !== "GET") {
    send(405, { error: "method_not_allowed" });
    return true;
  }
  if (route.length === 4) {
    const rows = await store.list(projectId);
    // Absent rather than empty: nothing explored is not nothing being asked.
    if (!rows.length) {
      send(200, { explorations: [], note: "No conversation has been explored for this project yet. Run npm run demand:explore." });
      return true;
    }
    send(200, { explorations: rows });
    return true;
  }
  if (route.length === 5) {
    const row = await store.read(projectId, route[4] || "");
    if (!row) {
      send(404, { error: "That exploration does not exist." });
      return true;
    }
    send(200, { exploration: row });
    return true;
  }
  return false;
}
