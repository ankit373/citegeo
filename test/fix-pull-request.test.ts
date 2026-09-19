import test from "node:test";
import assert from "node:assert/strict";
import { GitHubClient } from "../src/product/integrations/github-client.js";
import { openFixPullRequest, pullRequestBody } from "../src/product/integrations/fix-pull-request.js";
import type { GitHubFetch } from "../src/product/integrations/github-client.js";
import type { SiteSignals } from "../src/product/actions/site-signals.js";
import type { GeoAction } from "../src/product/actions/action-plan.js";

function signals(overrides: Partial<SiteSignals> = {}): SiteSignals {
  return {
    domain: "example.com",
    checkedAt: "2026-01-01T00:00:00.000Z",
    reachable: true,
    robots: { present: true, blocked: [], allowed: ["GPTBot"] },
    llmsTxt: { present: true, bytes: 100 },
    structuredData: { organization: true, sameAs: [], independent: [] },
    wikidata: { present: false, id: null, searched: "Example" },
    ...overrides,
  };
}

const action = (id: string, severity: GeoAction["severity"] = "high"): GeoAction => ({
  id, severity, title: id, why: "", fix: "do the thing", evidence: "observed",
});

/** Records every call so the sequence can be asserted, not just the result. */
function recorder(overrides: Record<string, unknown> = {}) {
  const calls: Array<{ method: string; path: string; body?: unknown }> = [];
  const fetcher: GitHubFetch = async ({ method, path, body }) => {
    calls.push({ method, path, body });
    if (method === "GET" && path.endsWith("/repos/o/r")) return { ok: true, status: 200, json: { default_branch: "main" } };
    if (method === "GET" && path.includes("/git/ref/heads/")) return { ok: true, status: 200, json: { object: { sha: "basesha" } } };
    if (method === "GET" && path.includes("/contents/robots.txt")) {
      const contents = overrides.robots as string | undefined;
      return contents === undefined
        ? { ok: false, status: 404, json: { message: "Not Found" } }
        : { ok: true, status: 200, json: { content: Buffer.from(contents, "utf8").toString("base64"), sha: "robotssha" } };
    }
    if (method === "GET" && path.includes("/contents/")) return { ok: false, status: 404, json: { message: "Not Found" } };
    if (method === "POST" && path.endsWith("/pulls")) return { ok: true, status: 201, json: { html_url: "https://github.com/o/r/pull/1" } };
    return { ok: true, status: 200, json: {} };
  };
  return { calls, client: new GitHubClient("token", "o/r", fetcher) };
}

test("a blocked crawler produces a branch, a commit and a pull request", async () => {
  const { calls, client } = recorder({ robots: "User-agent: GPTBot\nDisallow: /\n" });
  const result = await openFixPullRequest({
    client,
    signals: signals({ robots: { present: true, blocked: ["GPTBot"], allowed: [] } }),
    actions: [action("crawlers-blocked", "critical")],
    brand: "Example",
  });
  assert.equal(result.outcome, "opened");
  assert.equal(result.url, "https://github.com/o/r/pull/1");
  assert.ok(calls.some((call) => call.method === "POST" && call.path.includes("/git/refs")), "branched");
  assert.ok(calls.some((call) => call.method === "PUT" && call.path.includes("robots.txt")), "committed");
  assert.ok(calls.some((call) => call.method === "POST" && call.path.endsWith("/pulls")), "opened");
});

test("an existing robots.txt is edited, carrying its unrelated rules through", async () => {
  const { calls, client } = recorder({ robots: "User-agent: *\nDisallow: /admin/\n\nUser-agent: GPTBot\nDisallow: /\n" });
  await openFixPullRequest({
    client,
    signals: signals({ robots: { present: true, blocked: ["GPTBot"], allowed: [] } }),
    actions: [action("crawlers-blocked", "critical")],
    brand: "Example",
  });
  const put = calls.find((call) => call.method === "PUT" && call.path.includes("robots.txt"));
  const body = put?.body as { content: string; sha?: string };
  const written = Buffer.from(body.content, "base64").toString("utf8");
  assert.ok(written.includes("Disallow: /admin/"), "an unrelated rule survived");
  assert.equal(body.sha, "robotssha", "the existing file's sha is sent, so this is an edit not a clobber");
});

test("nothing outstanding opens no pull request", async () => {
  const { calls, client } = recorder();
  const result = await openFixPullRequest({
    client,
    signals: signals(),
    actions: [action("crawlers-allowed", "done")],
    brand: "Example",
  });
  assert.equal(result.outcome, "nothing_to_do");
  assert.equal(calls.some((call) => call.method === "POST"), false, "nothing was created");
});

test("findings that cannot be patched do not open an empty pull request", async () => {
  const { calls, client } = recorder();
  const result = await openFixPullRequest({
    client,
    signals: signals(),
    actions: [action("wikidata-missing")],
    brand: "Example",
  });
  assert.equal(result.outcome, "nothing_to_do");
  assert.equal(result.plan?.manual.length, 1, "the finding is still returned to the caller");
  assert.equal(calls.some((call) => call.method === "POST"), false);
});

test("an API failure is reported, not thrown", async () => {
  const client = new GitHubClient("token", "o/r", async () => ({ ok: false, status: 401, json: { message: "Bad credentials" } }));
  const result = await openFixPullRequest({
    client,
    signals: signals({ robots: { present: true, blocked: ["GPTBot"], allowed: [] } }),
    actions: [action("crawlers-blocked", "critical")],
    brand: "Example",
  });
  assert.equal(result.outcome, "failed");
  assert.ok(result.detail.includes("Bad credentials"));
});

test("the description carries the evidence and says what it did not touch", () => {
  const body = pullRequestBody({
    plan: {
      patches: [{ path: "robots.txt", contents: "", summary: "Stop disallowing GPTBot." }],
      manual: [{ title: "No Wikidata entity", evidence: "search returned no match", fix: "create one", reason: "outside this repository" }],
      worthOpening: true,
    },
    domain: "example.com",
    checkedAt: "2026-01-01T00:00:00.000Z",
  });
  assert.ok(body.includes("robots.txt"));
  assert.ok(body.includes("Not changed here, and why"));
  assert.ok(body.includes("outside this repository"));
  assert.ok(body.includes("Read the diff"), "a generated change asks for scrutiny");
});

test("the token never appears in a request path", async () => {
  const { calls, client } = recorder({ robots: "User-agent: GPTBot\nDisallow: /\n" });
  await openFixPullRequest({
    client,
    signals: signals({ robots: { present: true, blocked: ["GPTBot"], allowed: [] } }),
    actions: [action("crawlers-blocked", "critical")],
    brand: "Example",
  });
  assert.equal(calls.some((call) => call.path.includes("token")), false);
});
