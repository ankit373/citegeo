import test from "node:test";
import assert from "node:assert/strict";
import { declaredIcons } from "../src/product/discovery/site-icon.js";

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
