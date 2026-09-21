// Every call the interface makes. A failure carries the server's own sentence
// rather than a status code, because the server wrote one for a reason.

export class RequestFailed extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!response.ok) {
    const said = parsed && typeof parsed === "object" && "error" in parsed
      ? String((parsed as { error: unknown }).error)
      : text.slice(0, 200) || `The server answered ${response.status}.`;
    throw new RequestFailed(said, response.status);
  }
  return parsed as T;
}

export function projectPath(projectId: string, suffix: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}${suffix}`;
}
