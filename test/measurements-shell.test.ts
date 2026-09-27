import test from "node:test";
import assert from "node:assert/strict";
import { renderMeasurementWorkbenchHtml } from "../src/ui/measurement-workbench-app.js";

// The shell is HTML inside a string, so nothing type-checks it. A nav button
// pointing at a section that does not exist is invisible until you click it.

const html = renderMeasurementWorkbenchHtml();

function navTargets(source: string): string[] {
  const found: string[] = [];
  for (const piece of source.split('navButton("').slice(1)) {
    const parts = piece.split('"');
    if (parts.length > 2) found.push(parts[2] || "");
  }
  return found;
}

function sectionKeys(source: string): string[] {
  const at = source.indexOf("const sections = () => ({");
  assert.notEqual(at, -1, "the measurements shell no longer declares its sections");
  const body = source.slice(at, source.indexOf("\n  });", at));
  const found: string[] = [];
  for (const line of body.split("\n").slice(1)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('"')) found.push(trimmed.split('"')[1] || "");
  }
  return found;
}

test("the measurements view offers a way back to the app", () => {
  assert.ok(html.includes('class="p5-back" href="/"'), "the measurements view is a dead end");
});

test("every nav button names a section the shell can render", () => {
  const targets = navTargets(html);
  const sections = sectionKeys(html);
  assert.ok(targets.length >= 5, "the nav lost its buttons");
  for (const target of targets) {
    assert.ok(sections.includes(target), `nav button "${target}" has no section to render`);
  }
});

test("the nav starts on a section that exists", () => {
  const initial = html.split('activeNav: "')[1]?.split('"')[0] || "";
  assert.ok(navTargets(html).includes(initial), `nothing is selected on load: activeNav is "${initial}"`);
});

test("the shell hides the project drawer it renders over", () => {
  assert.ok(html.includes("body>.drawer,body>.drawer-backdrop{display:none}"), "the phase 4 drawer shows through this view");
});

test("the back link is styled rather than bare text", () => {
  // The markup survived a stylesheet rewrite once while these rules did not,
  // leaving the link running into the title with no gap.
  assert.ok(html.includes(".p5-back{"), "the back link has no styling of its own");
  assert.ok(html.includes(".p5-headline{"), "nothing separates the back link from the title");
});
