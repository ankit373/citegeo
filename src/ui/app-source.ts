import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderProductPhase2AppHtml } from "./product-phase2-app.js";

// The application moved out of the HTML string into modules, and the tokens
// into a stylesheet, so a test asking "does the app carry this" reads them all.

let cached: string | null = null;

/** Every .ts under a directory, so a page split out of main.ts does not
 * silently drop out of the tests that assert the app carries a control. */
function modulesUnder(root: string, parts: string[]): string[] {
  const directory = join(root, ...parts);
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      found.push(...modulesUnder(root, [...parts, entry.name]));
      continue;
    }
    if (entry.name.endsWith(".ts")) found.push(readFileSync(join(directory, entry.name), "utf8"));
  }
  return found;
}

/** The shell, every module and the stylesheet: what the browser actually gets. */
export function productAppSource(): string {
  if (cached !== null) return cached;
  // From the repository root, because this runs from the build output and a
  // relative walk up from there is one refactor away from being wrong.
  const root = process.cwd();
  const modules = modulesUnder(root, ["src", "ui", "app"]);
  const styles = readFileSync(join(root, "src", "ui", "theme.css"), "utf8");
  cached = `${renderProductPhase2AppHtml()}\n${modules.join("\n")}\n${styles}`;
  return cached;
}
