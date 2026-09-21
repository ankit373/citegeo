import test from "node:test";
import assert from "node:assert/strict";
import { failed, isReady, match, needsLoad, ready, valueOf, type Loadable } from "../src/ui/app/loadable.js";

test("not loaded and loaded-and-empty are different states, not one falsy value", () => {
  const notYet: Loadable<string[]> = { status: "idle" };
  const empty = ready<string[]>([]);
  assert.equal(valueOf(notYet), null);
  assert.deepEqual(valueOf(empty), []);
  assert.equal(isReady(notYet), false);
  assert.equal(isReady(empty), true, "an empty list has loaded, and that is a finding");
});

test("a failure carries the server's sentence rather than a flag", () => {
  const broken = failed<number>(new Error("Search Console refused the property (403)."));
  assert.equal(broken.status, "error");
  assert.equal(broken.status === "error" ? broken.error : "", "Search Console refused the property (403).");
});

test("every state has a branch, so a page cannot render a fifth one by accident", () => {
  const handlers = {
    loading: () => "loading",
    error: (error: string) => `error:${error}`,
    ready: (value: number) => `ready:${value}`,
  };
  assert.equal(match<number>({ status: "idle" }, handlers), "loading");
  assert.equal(match<number>({ status: "loading" }, handlers), "loading");
  assert.equal(match(failed<number>("no"), handlers), "error:no");
  assert.equal(match(ready(7), handlers), "ready:7");
  assert.equal(match<number>({ status: "idle" }, { ...handlers, idle: () => "idle" }), "idle");
});

test("only idle asks to be loaded, so a failure does not retry on every render", () => {
  assert.equal(needsLoad({ status: "idle" }), true);
  assert.equal(needsLoad({ status: "loading" }), false);
  assert.equal(needsLoad(ready(1)), false);
  assert.equal(needsLoad(failed<number>("x")), false, "a render loop that retried a failure would hammer the server");
});
