import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderProductPhase2AppHtml } from "./product-phase2-app.js";

// The application moved out of the HTML string and into a module, so a test
// that asks "does the app contain this control" has to read both halves.

let cached: string | null = null;

/** The shell and the module together, which is what the browser runs. */
export function productAppSource(): string {
  if (cached !== null) return cached;
  // From the repository root, because this runs from the build output and a
  // relative walk up from there is one refactor away from being wrong.
  const module = readFileSync(join(process.cwd(), "src", "ui", "app", "main.ts"), "utf8");
  cached = `${renderProductPhase2AppHtml()}\n${module}`;
  return cached;
}
