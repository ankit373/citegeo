import test from "node:test";
import assert from "node:assert/strict";
import { productAppSource } from "../src/ui/app-source.js";
import { renderProductPhase2AppHtml } from "../src/ui/product-phase2-app.js";
import { movesList, moveEffectLabel } from "../src/ui/app/pages/dashboard-view.js";

// The plan writes a why for every action. The view rendered title, evidence
// and fix and dropped it, so the list read as chores with no reason to do any.

test("an action says why it matters, not only what was observed", () => {
  const source = productAppSource();
  assert.ok(source.includes("html(action.why)"), "the action plan never shows why an action matters");
  assert.ok(source.includes("html(action.evidence)"), "the observation behind the action is still shown");
  assert.ok(source.includes("html(action.fix)"), "the fix is still shown");
});

test("the why is styled so it does not read as another note", () => {
  assert.ok(renderProductPhase2AppHtml().includes(".step-why {"), "step-why has no styling of its own");
});

test("a dashboard move says what it changes, not only what was seen", () => {
  // Move carries title, evidence and effect. The list rendered the first two,
  // so a reader saw the finding and never the reason to act on it.
  const moves = [{ title: "Publish a comparison page", evidence: "No answer cited one.", effect: "raises_visibility" }];
  const rendered = movesList(moves);
  assert.ok(rendered.includes("Raises the score"), "a move never says what taking it changes");
  assert.ok(rendered.includes("Publish a comparison page") && rendered.includes("No answer cited one."));
});

test("a move with no stated effect renders without an empty line", () => {
  const rendered = movesList([{ title: "T", evidence: "E", effect: "" }]);
  assert.ok(!rendered.includes("move-effect"), "an absent effect should leave no element behind");
});

test("an effect is worded for a reader, not left as its enum", () => {
  assert.equal(moveEffectLabel("raises_visibility"), "Raises the score");
  assert.equal(moveEffectLabel("unblocks_measurement"), "Unblocks measurement");
  // An effect with no wording here is shown as it came rather than mislabelled.
  assert.equal(moveEffectLabel("something_new"), "something_new");
});
