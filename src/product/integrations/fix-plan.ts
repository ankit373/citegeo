import type { SiteSignals } from "../actions/site-signals.js";
import type { GeoAction } from "../actions/action-plan.js";

// Turns findings into a change a human can review. It patches only what it can
// generate correctly from evidence, and says plainly what it cannot.
//
// The line is whether the file's whole contents are knowable. robots.txt and
// llms.txt are. A sameAs list lives inside whatever template emits the JSON-LD,
// which differs per site, so guessing at a patch there would produce a diff
// that looks authoritative and is wrong.

export interface FilePatch {
  path: string;
  contents: string;
  summary: string;
}

export interface ManualItem {
  title: string;
  evidence: string;
  fix: string;
  /** Why this is not a patch, so the omission does not read as an oversight. */
  reason: string;
}

export interface FixPlan {
  patches: FilePatch[];
  manual: ManualItem[];
  /** False when there is nothing to open a pull request for. */
  worthOpening: boolean;
}

/**
 * Rewrites robots.txt so the named crawlers are no longer disallowed, keeping
 * every other line. Editing rather than replacing matters: a site's robots.txt
 * carries rules this tool knows nothing about.
 */
export function unblockCrawlers(existing: string, blocked: string[]): string {
  if (!blocked.length) return existing;
  const lower = blocked.map((name) => name.toLocaleLowerCase());
  const lines = existing.split("\n").join("\r").split("\r");
  const output: string[] = [];
  let droppingGroup = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const separator = trimmed.indexOf(":");
    const field = separator === -1 ? "" : trimmed.slice(0, separator).trim().toLocaleLowerCase();
    const value = separator === -1 ? "" : trimmed.slice(separator + 1).trim().toLocaleLowerCase();

    if (field === "user-agent") {
      droppingGroup = lower.includes(value);
      if (droppingGroup) continue;
    } else if (droppingGroup) {
      // Keep skipping this group's directives until the next blank line.
      if (!trimmed) droppingGroup = false;
      continue;
    }
    output.push(line);
  }

  const cleaned = output.join("\n");
  const note = `\n# ${blocked.join(", ")} unblocked so answer engines can cite this site.\n`;
  return `${cleaned.trimEnd()}\n${note}`;
}

export function starterLlmsTxt(input: { domain: string; brand: string; categories: string[] }): string {
  const lines = [
    `# ${input.brand}`,
    "",
    `> Replace this line with one paragraph saying what ${input.brand} is, who it is for, and what it covers. An answer engine quotes this, so write it as a statement of fact rather than marketing copy.`,
    "",
    "## Core pages",
    `- [Homepage](https://${input.domain}/)`,
    `- [About](https://${input.domain}/about/): who runs this and where`,
    `- [Pricing](https://${input.domain}/pricing/): plans and what each includes`,
    "",
  ];
  if (input.categories.length) {
    lines.push("## How models currently describe this site", "");
    for (const category of input.categories) lines.push(`- ${category}`);
    lines.push("");
  }
  lines.push(
    "## Notes",
    "- Keep this current when sections, pricing or coverage change.",
    "- Link only pages that exist and that you want quoted.",
    "",
  );
  return lines.join("\n");
}

export function buildFixPlan(input: {
  signals: SiteSignals;
  actions: GeoAction[];
  brand: string;
  categories?: string[] | undefined;
  /** Current robots.txt, so it is edited rather than replaced. */
  robotsTxt?: string | undefined;
}): FixPlan {
  const patches: FilePatch[] = [];
  const manual: ManualItem[] = [];
  const open = input.actions.filter((action) => action.severity !== "done");

  if (input.signals.robots.blocked.length) {
    const blocked = input.signals.robots.blocked;
    patches.push({
      path: "robots.txt",
      contents: unblockCrawlers(input.robotsTxt || `User-agent: *\nAllow: /\n`, blocked),
      summary: `Stop disallowing ${blocked.join(", ")}, which cannot cite the site while blocked.`,
    });
  }

  if (!input.signals.llmsTxt.present) {
    patches.push({
      path: "llms.txt",
      contents: starterLlmsTxt({
        domain: input.signals.domain,
        brand: input.brand,
        categories: input.categories || [],
      }),
      summary: "Add an llms.txt describing the site for answer engines. The description is left for a human to write.",
    });
  }

  for (const action of open) {
    if (action.id === "crawlers-blocked" || action.id === "llms-txt-missing") continue;
    manual.push({
      title: action.title,
      evidence: action.evidence,
      fix: action.fix,
      reason: action.id === "wikidata-missing"
        ? "Wikidata lives outside this repository, so no change here can create it."
        : action.id === "sameas-all-owned" || action.id === "sameas-missing" || action.id === "organization-schema-missing"
          ? "The JSON-LD is emitted by a template this tool cannot locate reliably, and a wrong patch there would look authoritative."
          : "This is not a file in this repository.",
    });
  }

  return { patches, manual, worthOpening: patches.length > 0 || manual.length > 0 };
}
