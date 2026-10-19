import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { declaredIcons, isPublicHost, isStoredMark, readMark, MAX_ICON_BYTES } from "../src/product/discovery/site-icon.js";

test("the mark is the one the site declares, resolved against the page", () => {
  const found = declaredIcons('<link rel="icon" href="/static/mark.png">', "https://example.com/");
  assert.deepEqual(found, ["https://example.com/static/mark.png"]);
});

test("a site that declares nothing has nothing, rather than a guessed path", () => {
  // Assuming /favicon.ico is how a broken image ends up drawn over the name.
  assert.deepEqual(declaredIcons("<html><head></head></html>", "https://example.com/"), []);
});

test("the larger and better declared mark is preferred", () => {
  const found = declaredIcons(
    '<link rel="icon" sizes="16x16" href="/small.png">'
    + '<link rel="apple-touch-icon" href="/touch.png">'
    + '<link rel="icon" sizes="64x64" href="/big.png">',
    "https://example.com/",
  );
  assert.equal(found[0], "https://example.com/touch.png");
  assert.equal(found[1], "https://example.com/big.png");
});

test("a mask icon is skipped, because it is a silhouette and reads as a square", () => {
  const found = declaredIcons('<link rel="mask-icon" href="/mask.svg" color="#000">', "https://example.com/");
  assert.deepEqual(found, []);
});

test("a scheme nobody should follow is refused", () => {
  assert.deepEqual(declaredIcons('<link rel="icon" href="javascript:alert(1)">', "https://example.com/"), []);
  assert.deepEqual(declaredIcons('<link rel="icon" href="data:image/png;base64,AA">', "https://example.com/"), []);
});

test("a host that is not a public name is never fetched", () => {
  // A rival's domain arrives from a model's answer, not from the user, so it
  // is not trusted enough to point a server request at.
  for (const host of ["localhost", "127.0.0.1", "10.0.0.5", "box.internal", "printer.local", "nas.lan", "", "no-dot"]) {
    assert.equal(isPublicHost(host), false, `${host} should be refused`);
  }
  for (const host of ["example.com", "sub.example.co.uk", "screener.in"]) {
    assert.equal(isPublicHost(host), true, `${host} should be allowed`);
  }
});

test("the mark is kept, not the address it was kept at", async () => {
  // Measured live: one dashboard load fetched marks from nseindia.com,
  // zerodha.com, tickertape.in and three more, from the reader's own browser.
  const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
  const server = createServer((request, response) => {
    if (request.url === "/mark.png") {
      response.writeHead(200, { "content-type": "image/png" });
      response.end(png);
      return;
    }
    if (request.url === "/huge.png") {
      response.writeHead(200, { "content-type": "image/png" });
      response.end(Buffer.alloc(MAX_ICON_BYTES + 1));
      return;
    }
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<html></html>");
  });
  await new Promise<void>((ready) => server.listen(0, "127.0.0.1", () => ready()));
  const port = (server.address() as AddressInfo).port;
  const at = (path: string) => `http://127.0.0.1:${port}${path}`;
  try {
    const mark = await readMark(at("/mark.png"), 4000);
    assert.ok(mark, "the mark was not read");
    assert.ok(mark.startsWith("data:image/png;base64,"), mark.slice(0, 40));
    assert.equal(mark.includes("127.0.0.1"), false, "the address leaked into the answer");
    assert.equal(Buffer.from(mark.split(",")[1] || "", "base64").equals(png), true);
    assert.equal(await readMark(at("/huge.png"), 4000), null, "a hero image is not a mark");
    assert.equal(await readMark(at("/page.html"), 4000), null, "a page is not a mark");
  } finally {
    await new Promise<void>((closed) => server.close(() => closed()));
  }
});

test("an address left by an older build is not drawn, it is read again", () => {
  assert.equal(isStoredMark("https://rival.example/favicon.ico"), false);
  assert.equal(isStoredMark("data:image/png;base64,AA"), true);
  // No mark is an answer and is kept, so it must not look like a stale record.
  assert.equal(isStoredMark(null), true);
});
