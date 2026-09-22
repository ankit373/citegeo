import { load } from "cheerio";

// The mark a site publishes for itself, read from the page rather than guessed
// at a conventional path. A site that declares none has none.

/** Every icon a page declares, strongest first. Absolute, resolved against the
 * page it was declared on. */
export function declaredIcons(html: string, pageUrl: string): string[] {
  const document = load(html);
  const found: Array<{ href: string; weight: number; size: number }> = [];
  document("link[rel]").each((unused, node) => {
    const rel = (document(node).attr("rel") || "").toLocaleLowerCase();
    const href = (document(node).attr("href") || "").trim();
    if (!href) return;
    // A mask icon is a monochrome silhouette and reads as a black square.
    const weight = rel.includes("apple-touch-icon") ? 3 : rel.includes("shortcut icon") ? 2 : rel.includes("icon") && !rel.includes("mask") ? 2 : 0;
    if (!weight) return;
    const sizes = document(node).attr("sizes") || "";
    const size = Number(sizes.split("x")[0]) || 0;
    found.push({ href, weight, size });
  });
  found.sort((left, right) => (right.weight - left.weight) || (right.size - left.size));
  const out: string[] = [];
  for (const entry of found) {
    const absolute = absoluteUrl(entry.href, pageUrl);
    if (absolute && !out.includes(absolute)) out.push(absolute);
  }
  return out;
}

function absoluteUrl(href: string, base: string): string | null {
  try {
    const resolved = new URL(href, base);
    return resolved.protocol === "https:" || resolved.protocol === "http:" ? resolved.toString() : null;
  } catch {
    return null;
  }
}

async function head(url: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal, headers: { "user-agent": "citegeo-site-read" } });
    if (!response.ok) return false;
    const type = response.headers.get("content-type") || "";
    return type.startsWith("image/");
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** The icon a domain declares, or null. Null is a real answer: it means the
 * site publishes no mark, not that the read failed silently. */
export async function readSiteIcon(domain: string, options: { timeoutMs?: number } = {}): Promise<string | null> {
  const timeoutMs = options.timeoutMs || 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let html = "";
  try {
    const response = await fetch(`https://${domain}/`, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "citegeo-site-read", accept: "text/html" },
    });
    if (!response.ok) return null;
    html = await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
  for (const candidate of declaredIcons(html, `https://${domain}/`).slice(0, 3)) {
    if (await head(candidate, timeoutMs)) return candidate;
  }
  return null;
}
