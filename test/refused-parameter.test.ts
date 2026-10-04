import test from "node:test";
import assert from "node:assert/strict";
import { DROPPABLE_PARAMETERS, refusedParameter } from "../src/providers/provider-error.js";

test("the field a provider reports the parameter in is believed first", () => {
  assert.equal(refusedParameter({ param: "temperature", message: "something else entirely" }), "temperature");
});

test("a refusal that only says it in words is still read", () => {
  // Seen live: a reasoning model refusing the sampling parameter every other
  // model in the same run accepted.
  assert.equal(
    refusedParameter({ message: "Unsupported parameter: 'temperature' is not supported with this model." }),
    "temperature",
  );
  assert.equal(refusedParameter({ message: "Unsupported value: 'top_p' cannot be set here." }), "top_p");
});

test("an error about anything else names no parameter", () => {
  assert.equal(refusedParameter({ message: "Insufficient credits." }), null);
  assert.equal(refusedParameter({ message: "" }), null);
  assert.equal(refusedParameter(null), null);
  assert.equal(refusedParameter(undefined), null);
});

test("only parameters that change sampling are droppable", () => {
  // Dropping the question, the model or the token budget would change what is
  // being measured, so a refusal of one of those stays a failure.
  assert.ok(DROPPABLE_PARAMETERS.has("temperature"));
  assert.ok(DROPPABLE_PARAMETERS.has("top_p"));
  for (const kept of ["model", "input", "messages", "max_tokens", "max_output_tokens", "tools"]) {
    assert.equal(DROPPABLE_PARAMETERS.has(kept), false, `${kept} must never be dropped silently`);
  }
});
