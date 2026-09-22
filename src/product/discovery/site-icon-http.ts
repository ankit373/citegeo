import type { SiteIconService } from "./site-icon-service.js";

type JsonSender = (status: number, body: unknown) => void;

// The marks for a set of domains. A POST because the domain list is the
// request body, and because reading a site is work rather than a lookup.

export async function handleSiteIconApi(input: {
  method: string;
  route: string[];
  send: JsonSender;
  service: SiteIconService;
  readJson: () => Promise<Record<string, unknown>>;
}): Promise<boolean> {
  const { method, route, send, service } = input;
  if (route[0] !== "api" || route[1] !== "brand-icons" || route.length !== 2) return false;
  if (method !== "POST") {
    send(405, { error: "method_not_allowed" });
    return true;
  }
  const body = await input.readJson();
  const asked = Array.isArray(body.domains) ? body.domains : [];
  const domains: string[] = [];
  for (const entry of asked) {
    if (typeof entry !== "string") continue;
    const clean = entry.trim().toLocaleLowerCase();
    // A host, not a URL and not a path. Anything else is not asked about.
    if (!clean || clean.includes("/") || clean.includes(" ") || !clean.includes(".")) continue;
    if (!domains.includes(clean)) domains.push(clean);
  }
  if (!domains.length) {
    send(200, { icons: {} });
    return true;
  }
  send(200, { icons: await service.refresh(domains.slice(0, 24)) });
  return true;
}
