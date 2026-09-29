import test from "node:test";
import assert from "node:assert/strict";
import { AhrefsUnavailableError, brandRadarUrl, readBrandRadar } from "../src/product/ahrefs/ahrefs-client.js";
import {
  PROVENANCE, REACHABLE_SURFACES, UNREACHABLE_SURFACES,
  buildAhrefsReport, normaliseCitedDomains, normaliseCitedPages, surfacesFor,
} from "../src/product/ahrefs/brand-radar.js";

const KEY = "ahrefs-key";
const ENV = ["AHREFS_API_KEY", "AHREFS_API_ENDPOINT", "AHREFS_BRAND_RADAR_REPORT"];

function withEnv<T>(values: Record<string, string>, run: () => Promise<T> | T): Promise<T> {
  const previous = new Map(ENV.map((name) => [name, process.env[name]]));
  for (const name of ENV) delete process.env[name];
  for (const [name, value] of Object.entries(values)) process.env[name] = value;
  return Promise.resolve().then(run).finally(() => {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
}

function withFetch<T>(stub: typeof fetch, run: () => Promise<T>): Promise<T> {
  const previous = globalThis.fetch;
  globalThis.fetch = stub;
  return run().finally(() => { globalThis.fetch = previous; });
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("a read defaults to the surfaces nothing here can ask", () => {
  // Reading chatgpt through someone else's panel would be a second opinion on
  // a surface already in the archive. Reading AI Overviews adds reach.
  assert.deepEqual(surfacesFor(undefined), UNREACHABLE_SURFACES);
  assert.deepEqual(surfacesFor([]), UNREACHABLE_SURFACES);
  assert.deepEqual(surfacesFor(["copilot"]), ["copilot"]);
  for (const surface of REACHABLE_SURFACES) {
    assert.equal(UNREACHABLE_SURFACES.includes(surface), false, `${surface} is asked directly, so it is not unreachable`);
  }
});

test("the request names its columns, because a response body is billed by the unit", async () => {
  await withEnv({ AHREFS_API_ENDPOINT: "https://example.test/v3" }, () => {
    const url = new URL(brandRadarUrl("cited-pages", {
      dataSource: "copilot,grok", select: "url,responses", brand: "screener.in", limit: 50,
    }));
    assert.equal(url.pathname, "/v3/brand-radar/cited-pages");
    assert.equal(url.searchParams.get("select"), "url,responses");
    assert.equal(url.searchParams.get("data_source"), "copilot,grok");
    assert.equal(url.searchParams.get("brand"), "screener.in");
    assert.equal(url.searchParams.get("limit"), "50");
    // An absent parameter is absent, not an empty string the API has to read.
    assert.equal(url.searchParams.has("report_id"), false);
    assert.equal(url.searchParams.has("country"), false);
  });
});

test("a saved report is carried when there is one", async () => {
  await withEnv({ AHREFS_API_ENDPOINT: "https://example.test/v3" }, () => {
    const url = new URL(brandRadarUrl("cited-domains", {
      dataSource: "copilot", select: "domain,responses", reportId: "abc123",
    }));
    assert.equal(url.searchParams.get("report_id"), "abc123");
  });
});

test("a rejected key, a spent balance and a dead host are told apart", async () => {
  await withEnv({ AHREFS_API_ENDPOINT: "https://example.test/v3" }, async () => {
    await withFetch(async () => json({ error: "invalid token" }, 401), async () => {
      await assert.rejects(
        () => readBrandRadar("cited-pages", KEY, { dataSource: "copilot", select: "url" }),
        (error: unknown) => error instanceof AhrefsUnavailableError && error.message.includes("rejected the API key"),
      );
    });
    await withFetch(async () => json({ error: "too many" }, 429), async () => {
      await assert.rejects(
        () => readBrandRadar("cited-pages", KEY, { dataSource: "copilot", select: "url" }),
        (error: unknown) => error instanceof AhrefsUnavailableError && error.message.includes("rate limiting"),
      );
    });
    await withFetch(async () => { throw new Error("ENOTFOUND"); }, async () => {
      await assert.rejects(
        () => readBrandRadar("cited-pages", KEY, { dataSource: "copilot", select: "url" }),
        (error: unknown) => error instanceof AhrefsUnavailableError && error.message.includes("could not be reached"),
      );
    });
  });
});

test("the key travels as a bearer token and nowhere else", async () => {
  await withEnv({ AHREFS_API_ENDPOINT: "https://example.test/v3" }, async () => {
    const seen: string[] = [];
    await withFetch(async (input, init) => {
      seen.push(String(new Headers(init?.headers).get("authorization")));
      seen.push(String(input));
      return json({ pages: [] });
    }, () => readBrandRadar("cited-pages", KEY, { dataSource: "copilot", select: "url" }));
    assert.equal(seen[0], `Bearer ${KEY}`);
    assert.equal(seen[1]!.includes(KEY), false, "the key must not reach the query string");
  });
});

test("a row with no url is not a page, and a missing count is nought rather than a guess", () => {
  const pages = normaliseCitedPages({ pages: [
    { url: "https://b.test/x", responses: 3 },
    { url: "", responses: 9 },
    { url: "https://a.test/y" },
    { responses: 4 },
  ] });
  assert.deepEqual(pages, [
    { url: "https://b.test/x", responses: 3 },
    { url: "https://a.test/y", responses: 0 },
  ]);
});

test("domains come back lowercased and strongest first", () => {
  const domains = normaliseCitedDomains({ domains: [
    { domain: "Low.test", responses: 1 },
    { domain: "HIGH.test", responses: 8 },
  ] });
  assert.deepEqual(domains.map((row) => row.domain), ["high.test", "low.test"]);
});

test("a payload of the wrong shape reads as nothing, not as a crash", () => {
  assert.deepEqual(normaliseCitedPages(null), []);
  assert.deepEqual(normaliseCitedPages({ pages: "no" }), []);
  assert.deepEqual(normaliseCitedDomains({}), []);
});

test("a report says where its figures came from, every time", async () => {
  await withEnv({ AHREFS_API_ENDPOINT: "https://example.test/v3" }, async () => {
    await withFetch(async (input) => {
      return String(input).includes("cited-pages")
        ? json({ pages: [{ url: "https://x.test/a", responses: 2 }] })
        : json({ domains: [{ domain: "x.test", responses: 2 }] });
    }, async () => {
      const report = await buildAhrefsReport({ apiKey: KEY, brand: "x", now: new Date("2026-09-25T00:00:00.000Z") });
      assert.deepEqual(report.surfaces, UNREACHABLE_SURFACES);
      assert.equal(report.citedPages.length, 1);
      assert.equal(report.citedDomains.length, 1);
      assert.equal(report.readAt, "2026-09-25T00:00:00.000Z");
      // The provenance is not optional. A figure measured elsewhere that does
      // not say so is the one thing this must never produce.
      assert.equal(report.provenance, PROVENANCE);
      assert.ok(report.provenance.includes("not by asking a model from here"));
    });
  });
});
