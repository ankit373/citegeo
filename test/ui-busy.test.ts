import test from "node:test";
import assert from "node:assert/strict";
import { ProjectBusy } from "../src/ui/app/busy.js";

test("a project's busy kinds belong to it alone", () => {
  const busy = new ProjectBusy();
  busy.start("a", "harvest");
  assert.equal(busy.has("a", "harvest"), true);
  assert.equal(busy.has("b", "harvest"), false);
  assert.deepEqual(busy.kinds("b"), []);
});

test("ending one kind leaves another on the same project in place", () => {
  const busy = new ProjectBusy();
  busy.start("a", "prompt:generating");
  busy.start("a", "prompt:saving");
  busy.end("a", "prompt:saving");
  assert.deepEqual(busy.kinds("a"), ["prompt:generating"]);
  busy.end("a", "prompt:generating");
  assert.deepEqual(busy.kinds("a"), []);
});

test("ending a kind that is not held changes nothing, and two of a kind end one at a time", () => {
  const busy = new ProjectBusy();
  busy.end("a", "harvest");
  busy.start("a", "harvest");
  busy.start("a", "harvest");
  busy.end("a", "harvest");
  assert.equal(busy.has("a", "harvest"), true);
  busy.end("a", "harvest");
  assert.equal(busy.has("a", "harvest"), false);
});
