import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { panelCsv } from "../src/ui/app/components/panel-tools.js";
import { toCsv } from "../src/product/insights/csv.js";

// The app route serves dist/src/ui/app and nothing above it. An import that
// climbs out of that tree type checks, builds, and 404s in the browser, which
// stops the whole module graph and renders a blank page.
const ROOT = resolve("dist", "src", "ui", "app");

function emittedModules(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return emittedModules(path);
    return path.endsWith(".js") ? [path] : [];
  });
}

/** Every `from "..."` in the file, without a regular expression. */
function specifiers(source: string): string[] {
  const found: string[] = [];
  let at = source.indexOf('from "');
  while (at >= 0) {
    const start = at + 6;
    const end = source.indexOf('"', start);
    if (end < 0) break;
    found.push(source.slice(start, end));
    at = source.indexOf('from "', end);
  }
  return found;
}

test("every module the app serves imports only what the app route can serve", async () => {
  const modules = emittedModules(ROOT);
  assert.ok(modules.length > 0, "no emitted app modules found, so this guard proves nothing");
  const escaped: string[] = [];
  for (const file of modules) {
    const source = await readFile(file, "utf8");
    for (const specifier of specifiers(source)) {
      if (!specifier.startsWith(".")) continue;
      const target = resolve(dirname(file), specifier);
      if (target !== ROOT && !target.startsWith(ROOT + sep)) {
        escaped.push(`${relative(ROOT, file)} imports ${specifier}`);
        continue;
      }
      assert.ok(existsSync(target), `${relative(ROOT, file)} imports ${specifier}, which is not on disk`);
    }
  }
  assert.deepEqual(
    escaped, [],
    "these imports resolve outside the served root and will 404 in the browser, blanking the page",
  );
});

test("the view's own csv writer agrees with the one the exports use", () => {
  // It is duplicated on purpose, because the server copy cannot be imported
  // here. Duplication without this test is drift waiting to happen.
  const cases: Array<{ columns: string[]; rows: string[][] }> = [
    { columns: ["Brand", "Share"], rows: [["Screener.in", "31%"]] },
    { columns: ["A"], rows: [["has, comma"], ['has "quote"'], ["has\nnewline"], ["has\rreturn"]] },
    { columns: ["Empty"], rows: [] },
    { columns: [], rows: [[]] },
  ];
  for (const one of cases) {
    assert.equal(panelCsv(one.columns, one.rows), toCsv({ columns: one.columns, rows: one.rows }));
  }
});
