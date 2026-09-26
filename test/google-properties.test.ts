import test from "node:test";
import assert from "node:assert/strict";
import { GoogleAuthError } from "../src/product/search-console/google-auth.js";
import {
  analyticsProperties, propertyIdFrom, readablePermission, searchConsoleProperties,
} from "../src/product/search-console/google-properties.js";

function withFetch<T>(stub: typeof fetch, run: () => Promise<T>): Promise<T> {
  const previous = globalThis.fetch;
  globalThis.fetch = stub;
  return run().finally(() => { globalThis.fetch = previous; });
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("a property the account cannot read is listed and marked, not hidden", () => {
  // Hiding it makes a missing permission look like a missing property, and
  // those need different things done about them.
  assert.equal(readablePermission("siteOwner"), true);
  assert.equal(readablePermission("siteFullUser"), true);
  assert.equal(readablePermission("siteUnverifiedUser"), false);
});

test("search console properties come back sorted, with their permission", async () => {
  await withFetch(async (input, init) => {
    assert.equal(String(input), "https://searchconsole.googleapis.com/webmasters/v3/sites");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer ya29.x");
    return json({ siteEntry: [
      { siteUrl: "sc-domain:z.example", permissionLevel: "siteOwner" },
      { siteUrl: "https://a.example/", permissionLevel: "siteUnverifiedUser" },
      { permissionLevel: "siteOwner" },
    ] });
  }, async () => {
    const rows = await searchConsoleProperties("ya29.x");
    assert.deepEqual(rows.map((row) => row.siteUrl), ["https://a.example/", "sc-domain:z.example"]);
    assert.equal(rows[0]!.readable, false);
    assert.equal(rows[1]!.readable, true);
  });
});

test("a disabled api is named as one, because enabling it is the fix", async () => {
  await withFetch(async () => json({ error: { message: "Search Console API has not been used in project 1 before" } }, 403), async () => {
    await assert.rejects(
      () => searchConsoleProperties("t"),
      (error: unknown) => error instanceof GoogleAuthError && error.message.includes("may not be enabled"),
    );
  });
});

test("the analytics id the data api takes is read off the resource name", () => {
  assert.equal(propertyIdFrom("properties/123456"), "123456");
  assert.equal(propertyIdFrom("123456"), "123456");
});

test("analytics properties are flattened across accounts, keeping the account name", async () => {
  await withFetch(async (input) => {
    assert.equal(String(input), "https://analyticsadmin.googleapis.com/v1beta/accountSummaries");
    return json({ accountSummaries: [
      { displayName: "Second account", propertySummaries: [{ property: "properties/222", displayName: "Zeta site" }] },
      { displayName: "First account", propertySummaries: [{ property: "properties/111", displayName: "Alpha site" }, { displayName: "no property" }] },
    ] });
  }, async () => {
    const rows = await analyticsProperties("ya29.x");
    assert.deepEqual(rows.map((row) => row.displayName), ["Alpha site", "Zeta site"]);
    assert.equal(rows[0]!.propertyId, "111");
    assert.equal(rows[0]!.account, "First account");
  });
});

test("an account with nothing in it is empty, not an error", async () => {
  await withFetch(async () => json({}), async () => {
    assert.deepEqual(await searchConsoleProperties("t"), []);
    assert.deepEqual(await analyticsProperties("t"), []);
  });
});
