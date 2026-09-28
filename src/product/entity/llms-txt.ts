import type { SiteRead } from "../discovery/site-read.js";

// An llms.txt written from the pages the site actually has. It is a map, never
// a second version of the site: every line points at a real URL and describes
// it in that page's own words. Serving a crawler something the reader does not
// get is cloaking, and this product will not author it.

export interface LlmsTxtInput {
  brandName: string;
  /** One or two sentences from the brand profile, or null when none was built. */
  summary: string | null;
  site: SiteRead;
}

export interface LlmsTxtDraft {
  /** The file, ready to serve at /llms.txt. */
  text: string;
  /** Pages listed, which is how much of the site a model is pointed at. */
  listed: number;
  /** Pages left out, with the reason, so the gap is not silent. */
  skipped: Array<{ url: string; reason: string }>;
}

function oneLine(value: string): string {
  return value.split("\n").join(" ").split("\r").join(" ").split("\t").join(" ").trim();
}

function describe(page: { description: string; headings: string[]; text: string }): string {
  const described = oneLine(page.description);
  if (described) return described;
  const heading = oneLine(page.headings[0] || "");
  if (heading) return heading;
  const body = oneLine(page.text).slice(0, 160).trim();
  return body;
}

export function buildLlmsTxt(input: LlmsTxtInput): LlmsTxtDraft {
  const skipped: Array<{ url: string; reason: string }> = [];
  const lines: string[] = [`# ${input.brandName}`];
  if (input.summary) lines.push("", `> ${oneLine(input.summary)}`);

  const entries: string[] = [];
  const seen = new Set<string>();
  for (const page of input.site.pages) {
    const url = page.url.trim();
    if (!url) continue;
    if (seen.has(url)) {
      skipped.push({ url, reason: "Listed already." });
      continue;
    }
    const title = oneLine(page.title) || oneLine(page.headings[0] || "");
    if (!title) {
      // A link with no name tells a model nothing about whether to follow it.
      skipped.push({ url, reason: "The page states no title or heading to name it by." });
      continue;
    }
    seen.add(url);
    const note = describe(page);
    entries.push(note ? `- [${title}](${url}): ${note}` : `- [${title}](${url})`);
  }

  if (entries.length) {
    lines.push("", "## Pages", ...entries);
  }
  // An empty file would read as "this site has nothing", which is a claim the
  // read does not support. Saying the read failed is the honest version.
  const text = entries.length
    ? `${lines.join("\n")}\n`
    : `# ${input.brandName}\n\n> No page on this site could be read, so nothing is listed here rather than listing nothing.\n`;

  return { text, listed: entries.length, skipped };
}
