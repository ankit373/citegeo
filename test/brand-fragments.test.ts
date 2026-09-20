import test from "node:test";
import assert from "node:assert/strict";
import { renderCiteGeoLockup, renderCiteGeoLockupInline, renderCiteGeoMarkSvg } from "../src/ui/brand.js";

// A fragment with a newline in it terminates any single-quoted host string it
// is interpolated into. One shell escaped it with JSON.stringify and the other
// did not, so the measurements view shipped a SyntaxError.
test("every emitted brand fragment is a single line", () => {
  for (const [name, value] of [
    ["mark", renderCiteGeoMarkSvg()],
    ["inline lockup", renderCiteGeoLockupInline()],
    ["asset lockup", renderCiteGeoLockup()],
  ] as const) {
    assert.equal(value.includes("\n"), false, `${name} contains a newline`);
    assert.equal(value.includes("\r"), false, `${name} contains a carriage return`);
  }
});

test("the inline lockup takes currentColor, so it survives a theme change", () => {
  const lockup = renderCiteGeoLockupInline();
  assert.ok(lockup.includes("currentColor"));
  assert.ok(lockup.includes("citegeo"));
});

test("a caller's class name reaches the element it is meant for", () => {
  assert.ok(renderCiteGeoLockupInline("p5-brandlockup").startsWith('<span class="p5-brandlockup"'));
  assert.ok(renderCiteGeoMarkSvg("x").includes('class="x"'));
});
