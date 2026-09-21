import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { THEME_BASE, THEME_FONT_LINKS, THEME_TOKENS } from "../src/ui/theme.js";

// The theme is CSS inside a string, so nothing type-checks it. A token defined
// in one mode and forgotten in the other is invisible until the page is dark.

const LIGHT = ":root {";
const SYSTEM_DARK = ':root:not([data-theme="light"])';
const FORCED_DARK = ':root[data-theme="dark"]';

/** The declarations of one rule, brace matched so a nested block cannot leak in. */
function blockBody(css: string, selector: string): string {
  const start = css.indexOf(selector);
  assert.notEqual(start, -1, `selector missing: ${selector}`);
  const open = css.indexOf("{", start);
  assert.notEqual(open, -1, `unopened block: ${selector}`);
  let depth = 0;
  for (let cursor = open; cursor < css.length; cursor += 1) {
    const character = css[cursor];
    if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, cursor);
    }
  }
  throw new Error(`unclosed block: ${selector}`);
}

function declarations(body: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const part of body.split(";")) {
    const text = part.trim();
    if (!text.startsWith("--")) continue;
    const split = text.indexOf(":");
    if (split === -1) continue;
    found.set(text.slice(0, split).trim(), text.slice(split + 1).trim());
  }
  return found;
}

const light = declarations(blockBody(THEME_TOKENS, LIGHT));
const systemDark = declarations(blockBody(THEME_TOKENS, SYSTEM_DARK));
const forcedDark = declarations(blockBody(THEME_TOKENS, FORCED_DARK));

/** A value carrying a literal colour is mode dependent and has to be restated in dark. */
function isColour(value: string): boolean {
  return value.includes("#") || value.includes("rgba(") || value.includes("rgb(");
}

test("every colour token in the light root is restated in both dark blocks", () => {
  const missing: string[] = [];
  for (const [name, value] of light) {
    if (!isColour(value)) continue;
    if (!systemDark.has(name)) missing.push(`${name} (system dark)`);
    if (!forcedDark.has(name)) missing.push(`${name} (data-theme dark)`);
  }
  assert.deepEqual(missing, []);
});

test("the system dark block and the data-theme override define the same tokens", () => {
  assert.deepEqual([...systemDark.keys()].sort(), [...forcedDark.keys()].sort());
});

test("no dark block introduces a token the light root never defines", () => {
  const orphans = [...systemDark.keys()].filter((name) => !light.has(name));
  assert.deepEqual(orphans, []);
});

test("the tokens other surfaces reference by name still exist", () => {
  const referenced = [
    "--paper", "--surface", "--raised", "--sunken", "--line", "--line-strong",
    "--text", "--muted", "--weak",
    "--accent", "--accent-hover", "--accent-ink", "--accent-wash",
    "--confirmed", "--confirmed-text", "--confirmed-wash",
    "--unknown", "--unknown-text", "--unknown-wash",
    "--failed", "--failed-text", "--failed-wash",
    "--font-display", "--font-ui", "--font-mono",
    "--radius", "--radius-sm", "--radius-xs", "--gutter",
    "--shadow", "--shadow-sm",
    "--motion-fast", "--motion-normal", "--ease-standard", "--ease-press",
  ];
  const absent = referenced.filter((name) => !light.has(name));
  assert.deepEqual(absent, []);
});

test("a skeleton loader has a base and a sheen in both modes", () => {
  for (const name of ["--skeleton", "--skeleton-sheen"]) {
    assert.equal(light.has(name), true, name);
    assert.equal(systemDark.has(name), true, name);
    assert.equal(forcedDark.has(name), true, name);
  }
  assert.equal(light.has("--motion-shimmer"), true);
});

/** The first quoted name in a font stack, which is the family to load. */
function firstFamily(stack: string): string {
  const open = stack.indexOf('"');
  assert.notEqual(open, -1, `no quoted family in: ${stack}`);
  const close = stack.indexOf('"', open + 1);
  assert.notEqual(close, -1, `unterminated family in: ${stack}`);
  return stack.slice(open + 1, close);
}

function requestedFamilies(link: string): string[] {
  const names: string[] = [];
  const parts = link.split("family=");
  for (const part of parts.slice(1)) {
    const cut = [part.indexOf(":"), part.indexOf("&"), part.length]
      .filter((index) => index !== -1)
      .sort((left, right) => left - right)[0] as number;
    names.push(part.slice(0, cut));
  }
  return names;
}

test("the font link requests every family the font tokens name, and no other", () => {
  const wanted = ["--font-display", "--font-ui", "--font-mono"]
    .map((name) => firstFamily(light.get(name) ?? ""))
    .map((family) => family.split(" ").join("+"));
  const requested = requestedFamilies(THEME_FONT_LINKS);
  assert.deepEqual([...wanted].sort(), [...requested].sort());
});

test("the font link asks for weights, not a whole family", () => {
  for (const part of THEME_FONT_LINKS.split("family=").slice(1)) {
    assert.equal(part.includes("wght@"), true, part);
  }
  assert.equal(THEME_FONT_LINKS.includes("display=swap"), true);
});

test("figures are tabular in the shared base", () => {
  assert.equal(light.get("--figures"), "tabular-nums");
  assert.equal(THEME_BASE.includes("font-variant-numeric:var(--figures)"), true);
  const body = blockBody(THEME_BASE, "body {");
  assert.equal(body.includes("font-variant-numeric:var(--figures)"), true);
  for (const selector of ["th,td,.num,time", ".mono,.domain,code"]) {
    assert.equal(blockBody(THEME_BASE, selector).includes("var(--figures)"), true, selector);
  }
});

test("the base sets no colour, radius or font literal of its own", () => {
  const offenders: string[] = [];
  for (const part of THEME_BASE.split(";")) {
    const text = part.trim();
    if (text.includes("#") || text.includes("rgba(")) offenders.push(text);
    if (text.startsWith("font-family:") && !text.includes("var(--font-")) offenders.push(text);
  }
  assert.deepEqual(offenders, []);
});

test("a Tailwind utility and the token behind it are one declaration, not two", () => {
  const css = readFileSync(join(process.cwd(), "src", "ui", "theme.css"), "utf8");
  const theme = css.slice(css.indexOf("@theme {"), css.indexOf("}", css.indexOf("@theme {")));
  // Tailwind reads --color-x to build bg-x and text-x. The short name every
  // existing surface uses has to point at the same declaration.
  for (const name of ["paper", "surface", "line", "text", "accent", "weak", "muted"]) {
    assert.ok(theme.includes(`--color-${name}:`), `--color-${name} missing from @theme`);
    assert.ok(css.includes(`--${name}: var(--color-${name});`), `--${name} is not aliased to the scale`);
  }
});

test("dark overrides both spellings, or a utility keeps its light value", () => {
  const css = readFileSync(join(process.cwd(), "src", "ui", "theme.css"), "utf8");
  const dark = css.slice(css.indexOf("prefers-color-scheme"));
  for (const name of ["paper", "surface", "line", "text", "accent"]) {
    assert.ok(dark.includes(`--color-${name}:`), `dark does not set --color-${name}, so bg-${name} stays light`);
    assert.ok(dark.includes(`--${name}:`), `dark does not set --${name}, so var(--${name}) stays light`);
  }
});

test("the generated stylesheet lands where the container image copies from", () => {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { scripts: Record<string, string> };
  // The image copies dist/src only. A stylesheet written anywhere else is a
  // 404 in production and nowhere else.
  assert.ok(pkg.scripts["build:css"]?.includes("dist/src/ui/app/app.css"));
  assert.ok(pkg.scripts["build"]?.includes("build:css"), "the stylesheet has to be built by the build");
  const dockerfile = readFileSync(join(process.cwd(), "Dockerfile"), "utf8");
  assert.ok(dockerfile.includes("/app/dist/src"));
});

test("the vocabulary is Tailwind utilities, not a stylesheet the markup depends on", () => {
  const css = readFileSync(join(process.cwd(), "src", "ui", "theme.css"), "utf8");
  const shell = readFileSync(join(process.cwd(), "src", "ui", "product-phase2-app.ts"), "utf8");
  const sheet = shell.slice(shell.indexOf("<style>"), shell.indexOf("</style>"));

  for (const name of ["subtle", "section-card", "mrow", "mcell", "mname", "pill", "tag", "warning-box", "statgrid", "bar"]) {
    assert.ok(css.includes(`@utility ${name} {`), `${name} is not a utility`);
    // The bare rule has to be gone, or two definitions race and the loser is
    // whichever the bundler happened to order last.
    const bare = `\n    .${name} {`;
    assert.equal(sheet.includes(bare), false, `.${name} still has a hand-written rule`);
  }
});

test("a utility never carries a colour of its own, only a token", () => {
  const css = readFileSync(join(process.cwd(), "src", "ui", "theme.css"), "utf8");
  const utilities = css.slice(css.indexOf("@utility subtle"));
  // A hex inside a utility is the drift this file exists to prevent.
  assert.equal(utilities.includes("#"), false, "a utility declares a literal colour");
  for (const raw of ["rgb(", "rgba("]) {
    assert.equal(utilities.includes(raw), false, `a utility declares a literal ${raw}`);
  }
});
