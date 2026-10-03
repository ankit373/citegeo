import test from "node:test";
import assert from "node:assert/strict";
import { proposeWordings, readWordings, wordingPrompt } from "../src/product/topics/wording-protocol.js";

test("only wordings the model vouched for are kept", () => {
  // Its own doubt is the one signal available about whether it drifted.
  const kept = readWordings({ wordings: [
    { text: "which screener is best in india", sameIntent: true },
    { text: "what is a stock exchange", sameIntent: false },
  ] }, "best stock screener for indian markets");
  assert.deepEqual(kept, ["which screener is best in india"]);
});

test("the original is never returned as a rewording of itself", () => {
  const kept = readWordings({ wordings: [
    { text: "  Best Stock Screener For Indian Markets  ", sameIntent: true },
    { text: "top indian screeners", sameIntent: true },
  ] }, "best stock screener for indian markets");
  assert.deepEqual(kept, ["top indian screeners"]);
});

test("the same rewording twice is one rewording", () => {
  const kept = readWordings({ wordings: [
    { text: "top indian screeners", sameIntent: true },
    { text: "Top Indian Screeners", sameIntent: true },
  ] }, "x");
  assert.equal(kept.length, 1);
});

test("a blank or malformed row is dropped rather than saved empty", () => {
  const kept = readWordings({ wordings: [
    { text: "   ", sameIntent: true },
    { text: "fine one", sameIntent: true },
    { sameIntent: true },
    "nonsense",
  ] }, "x");
  assert.deepEqual(kept, ["fine one"]);
});

test("nothing usable back is no wordings, never an invented one", () => {
  assert.deepEqual(readWordings(null, "x"), []);
  assert.deepEqual(readWordings({}, "x"), []);
  assert.deepEqual(readWordings({ wordings: [] }, "x"), []);
});

test("the instruction forbids naming a brand the question does not", () => {
  const prompt = wordingPrompt({ question: "best screener", count: 4 });
  assert.ok(prompt.includes("Never name a brand"));
  assert.ok(prompt.includes("Write 4 rewordings"));
  assert.ok(prompt.includes("narrower or broader"));
});

test("it asks once and passes the question through", async () => {
  let seen = "";
  const kept = await proposeWordings({
    projectId: "p",
    question: "best screener",
    count: 3,
    ask: async (input) => { seen = input.prompt; return { wordings: [{ text: "which screener", sameIntent: true }] }; },
  });
  assert.ok(seen.includes("best screener"));
  assert.deepEqual(kept, ["which screener"]);
});
