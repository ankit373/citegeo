// The smallest slice of the GitHub API needed to open a reviewable pull
// request: read a file, branch, commit, open. No SDK, because an SDK here
// would be a dependency and a supply-chain surface for four endpoints.
//
// Every call is scoped to one repository, given explicitly. Nothing here
// discovers repositories or widens its own scope.

export interface GitHubRequest {
  method: string;
  path: string;
  body?: unknown;
}

export type GitHubFetch = (input: GitHubRequest & { token: string }) => Promise<{
  ok: boolean;
  status: number;
  json: unknown;
}>;

const API = "https://api.github.com";

const liveFetch: GitHubFetch = async ({ method, path, body, token }) => {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  return { ok: response.ok, status: response.status, json };
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export class GitHubClient {
  constructor(
    private readonly token: string,
    /** "owner/name". Passed in, never discovered. */
    private readonly repository: string,
    private readonly request: GitHubFetch = liveFetch,
  ) {}

  private async call(method: string, path: string, body?: unknown): Promise<Record<string, unknown>> {
    const result = await this.request({ method, path, token: this.token, ...(body ? { body } : {}) });
    if (!result.ok) {
      const message = String(asObject(result.json).message || "");
      throw new Error(`GitHub ${method} ${path} failed with HTTP ${result.status}${message ? `: ${message}` : ""}`);
    }
    return asObject(result.json);
  }

  async defaultBranch(): Promise<string> {
    const repo = await this.call("GET", `/repos/${this.repository}`);
    const branch = repo.default_branch;
    if (typeof branch !== "string") throw new Error("The repository did not report a default branch.");
    return branch;
  }

  /** Null when the file is absent, which is a normal case, not a failure. */
  async readFile(path: string, ref: string): Promise<{ contents: string; sha: string } | null> {
    const result = await this.request({
      method: "GET",
      path: `/repos/${this.repository}/contents/${encodeURI(path)}?ref=${encodeURIComponent(ref)}`,
      token: this.token,
    });
    if (result.status === 404) return null;
    if (!result.ok) throw new Error(`GitHub could not read ${path}: HTTP ${result.status}`);
    const body = asObject(result.json);
    if (typeof body.content !== "string" || typeof body.sha !== "string") return null;
    return { contents: Buffer.from(body.content, "base64").toString("utf8"), sha: body.sha };
  }

  async createBranch(name: string, fromBranch: string): Promise<void> {
    const ref = await this.call("GET", `/repos/${this.repository}/git/ref/heads/${encodeURIComponent(fromBranch)}`);
    const sha = asObject(ref.object).sha;
    if (typeof sha !== "string") throw new Error(`Could not resolve ${fromBranch}.`);
    await this.call("POST", `/repos/${this.repository}/git/refs`, { ref: `refs/heads/${name}`, sha });
  }

  async putFile(input: { path: string; contents: string; branch: string; message: string; sha?: string | undefined }): Promise<void> {
    await this.call("PUT", `/repos/${this.repository}/contents/${encodeURI(input.path)}`, {
      message: input.message,
      content: Buffer.from(input.contents, "utf8").toString("base64"),
      branch: input.branch,
      ...(input.sha ? { sha: input.sha } : {}),
    });
  }

  async openPullRequest(input: { head: string; base: string; title: string; body: string }): Promise<string> {
    const pr = await this.call("POST", `/repos/${this.repository}/pulls`, input);
    const url = pr.html_url;
    if (typeof url !== "string") throw new Error("GitHub did not return a pull request URL.");
    return url;
  }
}
