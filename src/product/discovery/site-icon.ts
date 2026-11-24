import { load } from "cheerio";

// The mark a site publishes for itself, read from the page rather than guessed
// at a conventional path. A site that declares none has none.

/** Every icon a page declares, strongest first. Absolute, resolved against the
 * page it was declared on. */
export function declaredIcons(html: string, pageUrl: string): string[] {
  const document = load(html);
  const found: Array<{ href: string; weight: number; size: number }> = [];
  document("link[rel]").each((_unused, node) => {
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

const PRIVATE_SUFFIXES = [".local", ".internal", ".localhost", ".home.arpa", ".lan"];

/** A rival's domain comes out of a model's answer, not out of the user, so the
 * server refuses to fetch anything that is not a public name. */
export function isPublicHost(domain: string): boolean {
  const host = domain.trim().toLocaleLowerCase();
  if (!host || !host.includes(".") || host.includes("/") || host.includes(":") || host.includes(" ")) return false;
  if (host === "localhost") return false;
  for (const suffix of PRIVATE_SUFFIXES) if (host.endsWith(suffix)) return false;
  // An address literal is never a brand's site, and it is how a fetch reaches
  // something on this machine or in this network.
  const labels = host.split(".");
  const numeric = labels.every((label) => label.length > 0 && [...label].every((char) => char >= "0" && char <= "9"));
  return !numeric;
}

/** A mark is a few kilobytes. Anything larger is a hero image behind a wrong
 * rel, and it is not worth carrying in every answer. */
export const MAX_ICON_BYTES = 32 * 1024;

// The mark itself rather than its address, so drawing a table never sends the
// reader's browser to a rival's server.
export async function readMark(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal, headers: { "user-agent": "citegeo-site-read" } });
    if (!response.ok) return null;
    const type = ((response.headers.get("content-type") || "").split(";")[0] || "").trim().toLocaleLowerCase();
    if (!type.startsWith("image/")) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_ICON_BYTES) return null;
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** A mark this server has already read and kept, told apart from an address
 * left by an older build that the browser would have to go and fetch. */
export function isStoredMark(value: string | null): boolean {
  return value === null || value.startsWith("data:");
}

/** The icon a domain declares, or null. Null is a real answer: it means the
 * site publishes no mark, not that the read failed silently. */
export async function readSiteIcon(domain: string, options: { timeoutMs?: number } = {}): Promise<string | null> {
  if (!isPublicHost(domain)) return null;
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
    const mark = await readMark(candidate, timeoutMs);
    if (mark) return mark;
  }
  return null;
}
