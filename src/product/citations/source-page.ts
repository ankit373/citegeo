import { readPage } from "../discovery/site-read.js";
import { namesIdentity, tokenize } from "../topics/prompt-identity.js";

// The page a model read, read back. A citation says a source was used; only
// the page says what it claims, who is on it and whether you are.

export interface NamedOnPage {
  name: string;
  /** Character offset of the first mention, so a listicle's order is readable. */
  firstAt: number;
  /** The nearest heading above it, when there is one. */
  underHeading: string | null;
}

export interface SourcePage {
  url: string;
  host: string;
  fetchedAt: string;
  /** Null when the page could not be read. The reason is in detail. */
  title: string | null;
  description: string;
  headings: string[];
  words: number;
  namesYou: boolean;
  /** Everyone the answers named who also appears here, in page order. */
  named: NamedOnPage[];
  detail: string | null;
}

/** Identifies the tool and where to complain about it. Reading somebody
 * else's page is a request to their server, made under a name they can see. */
const USER_AGENT = "citegeo/0.2 (+github.com/ankit373/citegeo)";

/** Gone, blocked and slow need different responses, so the reason travels
 * instead of collapsing into "did not load". */
async function fetchPage(url: string, timeoutMs: number): Promise<{ html: string } | { detail: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
    });
    if (!response.ok) {
      return { detail: response.status === 404
        ? "The page is gone (404), so whatever the model read is no longer there."
        : response.status === 403 || response.status === 401
          ? `The site refused the request (${response.status}). It can be read in a browser but not by this.`
          : `The site answered ${response.status}.` };
    }
    const type = response.headers.get("content-type") || "";
    if (!type.includes("html")) return { detail: `Not a page: the server sent ${type.split(";")[0] || "no content type"}.` };
    return { html: await response.text() };
  } catch (error) {
    return { detail: controller.signal.aborted
      ? `No answer within ${Math.round(timeoutMs / 1000)}s.`
      : `Could not be reached: ${error instanceof Error ? error.message : String(error)}` };
  } finally {
    clearTimeout(timer);
  }
}

export function hostOf(url: string): string {
  try {
    const host = new URL(url).hostname.toLocaleLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return "";
  }
}

/** Whole-token search, the same rule the answers use: a brand called Ten is
 * not on a page because the word "often" is. */
function findWhole(hay: string, needle: string): number {
  if (!needle) return -1;
  // Markup with no whitespace between tags runs words together, so a partial
  // hit has to be stepped over rather than ending the search.
  for (let from = 0; from <= hay.length; ) {
    const at = hay.indexOf(needle, from);
    if (at < 0) return -1;
    const startsWhole = at === 0 || hay[at - 1] === " ";
    const end = at + needle.length;
    const endsWhole = end === hay.length || hay[end] === " ";
    if (startsWhole && endsWhole) return at;
    from = at + 1;
  }
  return -1;
}

function firstMention(text: string, name: string): number {
  return findWhole(tokenize(text).join(" "), tokenize(name).join(" "));
}

/** Both offsets are into the tokenised text, because that is the only space
 * the mention offset exists in. */
function headingAbove(headings: string[], text: string, at: number): string | null {
  const hay = tokenize(text).join(" ");
  let found: string | null = null;
  for (const heading of headings) {
    const index = findWhole(hay, tokenize(heading).join(" "));
    if (index >= 0 && index <= at) found = heading;
  }
  return found;
}

export async function readSourcePage(input: {
  url: string;
  /** Names to look for, from the answers that cited this page. */
  names: string[];
  brandNames: string[];
  brandHost: string;
  timeoutMs?: number | undefined;
}): Promise<SourcePage> {
  const shell = {
    url: input.url,
    host: hostOf(input.url),
    fetchedAt: new Date().toISOString(),
    description: "",
    headings: [] as string[],
    words: 0,
    namesYou: false,
    named: [] as NamedOnPage[],
  };
  const fetched = await fetchPage(input.url, input.timeoutMs || 12000);
  // A page that would not load is unread, not a page nobody is named on.
  if ("detail" in fetched) return { ...shell, title: null, detail: fetched.detail };

  const html = fetched.html;
  const page = readPage(input.url, html);
  const text = page.text;
  const named: NamedOnPage[] = [];
  for (const name of [...new Set(input.names)]) {
    const at = firstMention(text, name);
    if (at < 0) continue;
    named.push({ name, firstAt: at, underHeading: headingAbove(page.headings, text, at) });
  }
  named.sort((left, right) => left.firstAt - right.firstAt);

  const namesYou = input.brandNames.some((name) => firstMention(text, name) >= 0)
    || namesIdentity(text, input.brandNames)
    || (Boolean(input.brandHost) && html.toLocaleLowerCase().includes(input.brandHost));

  return {
    ...shell,
    title: page.title || null,
    description: page.description,
    headings: page.headings.slice(0, 12),
    words: text.split(" ").filter(Boolean).length,
    namesYou,
    named,
    detail: null,
  };
}
