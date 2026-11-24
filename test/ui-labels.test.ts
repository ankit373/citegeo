import test from "node:test";
import assert from "node:assert/strict";
import { sharePct, uptakePct } from "../src/ui/app/format.js";
import {
  alertPill, effectLabel, historyWord, intentLabel, kindWords, reachInk, reachWords,
  recognitionCountLabels, recognitionModelStatusText, recognitionRunStatusText, recognitionUrlLabel,
  urgencyInk, urgencyLabel,
} from "../src/ui/app/labels.js";
import { deltaPill, demandBadge, evidenceJump, fieldBadge } from "../src/ui/app/components/badges.js";

function has(text: string, ...parts: string[]): void {
  for (const part of parts) assert.ok(text.includes(part), `${JSON.stringify(text)} lacks ${part}`);
}

test("an absent share stays null and a present one keeps its rounding", () => {
  assert.equal(sharePct(null), null);
  assert.equal(sharePct(undefined), null);
  assert.equal(sharePct(0), "0%");
  assert.equal(sharePct(0.1234), "12.3%");
  assert.equal(uptakePct(null), null);
  assert.equal(uptakePct(0.126), "13%");
});

test("states map to their words, and an unknown one falls to the last", () => {
  assert.equal(intentLabel("alternatives"), "Alternatives");
  assert.equal(intentLabel("anything"), "Problem");
  assert.equal(kindWords("forum"), "Forum or community");
  assert.equal(kindWords("unlisted"), "unlisted");
  assert.equal(urgencyLabel("blocking"), "blocking");
  assert.equal(urgencyLabel("x"), "to do");
  assert.equal(urgencyInk("limiting"), "state-flag");
  assert.equal(urgencyInk("x"), "state-ok");
  assert.equal(reachInk("drivable"), "state-ok");
  assert.equal(reachInk("blocked"), "state-bad");
  assert.equal(reachWords("sign_in"), "Asking to sign in");
  assert.equal(reachWords("none"), "Nothing to drive");
  assert.equal(effectLabel("raises_visibility"), "Raises the score");
  assert.equal(effectLabel("other"), "Widens what is measured");
  assert.equal(alertPill("critical"), "bad");
  assert.equal(alertPill("warning"), "flat");
});

test("a citation history verdict reads in words, one tone each", () => {
  has(historyWord("cited"), "state-ok", "still cited");
  has(historyWord("dropped"), "state-bad", "stopped");
  has(historyWord("slipping"), "missed one run");
  has(historyWord("cited_once"), "never again");
  has(historyWord(null), "one run only");
});

test("recognition status words cover every status and name a failure as one", () => {
  assert.equal(recognitionRunStatusText("partial"), "Partly complete");
  assert.equal(recognitionRunStatusText("failed"), "Execution failed");
  assert.equal(recognitionModelStatusText("response_saved"), "Answer received");
  assert.equal(recognitionModelStatusText("unsupported"), "Model does not support it");
  assert.equal(recognitionModelStatusText("anything"), "Provider Call failed");
  assert.equal(recognitionUrlLabel("https://example.com/a?b=1"), "example.com/a?b=1");
  assert.equal(recognitionUrlLabel("not a url"), "not a url");
  const counts = { received: 1, complete: 2, partial: 3, analysisFailed: 4, requestLimited: 5, running: 6 };
  assert.deepEqual(recognitionCountLabels(counts).map((entry) => entry[1]), [1, 2, 3, 4, 5, 6]);
});

test("badges say nothing when there is nothing to say, and escape what they print", () => {
  has(deltaPill(null), "No movement yet");
  has(deltaPill({ change: null }), "No movement yet");
  has(deltaPill({ change: 3 }), "pill good", "↑ 3");
  has(deltaPill({ change: -2 }), "pill bad", "↓ 2");
  has(deltaPill({ change: 0 }), "pill flat", "→ 0");
  assert.equal(fieldBadge(null), "");
  assert.equal(fieldBadge({ contest: { state: "unknown", reason: "" } }), "");
  has(fieldBadge({ contest: { state: "open", reason: "a<b" } }), "ready", "a&lt;b", "Open field");
  assert.equal(demandBadge({ demand: null }), "");
  has(demandBadge({ demand: { match: { exactTerms: 0, relatedTerms: 0 } } }), "Nobody asked");
  has(demandBadge({ demand: { match: { exactTerms: 2, relatedTerms: 5 } } }), "Asked 2 · 5 loosely");
  has(evidenceJump('a"b'), "data-evidence-target=\"a&quot;b\"");
});
