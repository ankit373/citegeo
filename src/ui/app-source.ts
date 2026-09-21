import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderProductPhase2AppHtml } from "./product-phase2-app.js";

// The application moved out of the HTML string into a module, and the tokens
// into a stylesheet, so a test asking "does the app carry this" reads all three.

let cached: string | null = null;

/** The shell, the module and the stylesheet: what the browser actually gets. */
export function productAppSource(): string {
  if (cached !== null) return cached;
  // From the repository root, because this runs from the build output and a
  // relative walk up from there is one refactor away from being wrong.
  const root = process.cwd();
  const module = readFileSync(join(root, "src", "ui", "app", "main.ts"), "utf8");
  const styles = readFileSync(join(root, "src", "ui", "theme.css"), "utf8");
  cached = `${renderProductPhase2AppHtml()}\n${module}\n${styles}`;
  return cached;
}
