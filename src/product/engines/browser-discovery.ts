import { homedir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { BrowserConnection, JsonApiClosedError, listTargets, type CdpTarget } from "./cdp-client.js";

// Switching debugging on from chrome://inspect leaves the browser serving its
// own socket and refusing to list its tabs over HTTP, which is the most common
// way this is set up and the one that used to read as no browser at all.
//
// Nothing here scans for a port. A port that answers is not necessarily a
// browser you meant: desktop applications built on the same engine answer the
// same way, and driving one of those would be worse than finding nothing.

export const DISCOVERY_CAVEAT = "A browser is looked for where you said it was and in the profile each installed browser writes its port into. Ports are never scanned, because an application built on the same engine answers a scan identically and driving one of those is worse than finding nothing.";

export type BrowserSource = "configured" | "profile";

export interface BrowserFound {
  /** Empty where only the socket is known, which is what a closed listing leaves. */
  endpoint: string;
  browserWsUrl: string;
  browser: string;
  /** Null where the browser will not say, never nought. */
  pages: number | null;
  source: BrowserSource;
  /** Which profile directory named it, for a browser found that way. */
  profile: string;
  detail: string;
}

export interface BrowserSearch {
  found: BrowserFound | null;
  /** Everywhere that was tried, so an empty result can be disagreed with. */
  looked: string[];
  detail: string;
  caveat: string;
}

/** Chrome writes the port on the first line and the browser's own socket path
 * on the second. A file left behind by a browser that has exited still parses. */
export function parsePortFile(text: string): { port: number; path: string } | null {
  const lines = text.split("\n");
  const port = Number.parseInt((lines[0] || "").trim(), 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) return null;
  const path = (lines[1] || "").trim();
  return { port, path: path.startsWith("/") ? path : "" };
}

export function profileDirectories(home: string, platform: string, localAppData?: string | undefined): string[] {
  if (platform === "darwin") {
    const base = join(home, "Library", "Application Support");
    return [
      join(base, "Google", "Chrome"),
      join(base, "Google", "Chrome Beta"),
      join(base, "Google", "Chrome Canary"),
      join(base, "Chromium"),
      join(base, "Microsoft Edge"),
      join(base, "BraveSoftware", "Brave-Browser"),
    ];
  }
  if (platform === "win32") {
    const base = localAppData || join(home, "AppData", "Local");
    return [
      join(base, "Google", "Chrome", "User Data"),
      join(base, "Chromium", "User Data"),
      join(base, "Microsoft", "Edge", "User Data"),
      join(base, "BraveSoftware", "Brave-Browser", "User Data"),
    ];
  }
  const config = join(home, ".config");
  return [
    join(config, "google-chrome"),
    join(config, "chromium"),
    join(config, "microsoft-edge"),
    join(config, "BraveSoftware", "Brave-Browser"),
  ];
}

export interface DiscoveryIo {
  /** Resolves the browser's advertised version, or null when nothing answers. */
  version: (endpoint: string) => Promise<{ browser: string; webSocketDebuggerUrl: string } | null>;
  /** Resolves the open tabs, or null where the browser refuses to list them. */
  tabs: (endpoint: string) => Promise<CdpTarget[] | null>;
  /** Resolves a port file's contents, or null where there is none. */
  portFile: (directory: string) => Promise<string | null>;
  /** Answers whether the browser's own socket is alive, which is the one route
   * left when the listing is closed. */
  socketAlive: (url: string) => Promise<number | null>;
}

function pagesOf(targets: CdpTarget[]): number {
  return targets.filter((target) => target.type === "page").length;
}

async function look(endpoint: string, source: BrowserSource, profile: string, io: DiscoveryIo): Promise<BrowserFound | null> {
  const version = await io.version(endpoint);
  const tabs = version ? await io.tabs(endpoint) : null;
  if (version && tabs) {
    return {
      endpoint, browserWsUrl: version.webSocketDebuggerUrl, browser: version.browser,
      pages: pagesOf(tabs), source, profile,
      detail: `${version.browser} with ${pagesOf(tabs)} open tab(s).`,
    };
  }
  return null;
}

function portOf(endpoint: string): number | null {
  try {
    const port = Number.parseInt(new URL(endpoint).port, 10);
    return Number.isInteger(port) && port > 0 ? port : null;
  } catch {
    return null;
  }
}

/** The socket a profile recorded for this exact port, which is the one route
 * left when the browser is listening and refuses to list its tabs. */
async function socketForPort(port: number, directories: string[], io: DiscoveryIo): Promise<BrowserFound | null> {
  for (const directory of directories) {
    const text = await io.portFile(directory);
    if (!text) continue;
    const parsed = parsePortFile(text);
    if (!parsed || parsed.port !== port || !parsed.path) continue;
    const url = `ws://127.0.0.1:${parsed.port}${parsed.path}`;
    const pages = await io.socketAlive(url);
    if (pages === null) continue;
    return {
      endpoint: "", browserWsUrl: url, browser: "", pages, source: "configured", profile: directory,
      detail: `Listening on ${port} with ${pages} open tab(s), reached through its own socket.`,
    };
  }
  return null;
}

/** Looks where it was told and then where each installed browser records its
 * own port, and says which of those it tried. */
export async function discoverBrowser(input: {
  configured?: string | undefined;
  directories: string[];
  io: DiscoveryIo;
}): Promise<BrowserSearch> {
  const looked: string[] = [];
  const io = input.io;

  // An endpoint you named is the only one that will be driven. Wandering off
  // to another browser because that one did not answer drives the wrong one.
  if (input.configured) {
    looked.push(input.configured);
    const direct = await look(input.configured, "configured", "", io);
    if (direct) return { found: direct, looked, detail: `Found where you said it was: ${direct.detail}`, caveat: DISCOVERY_CAVEAT };
    const port = portOf(input.configured);
    const samePort = port === null ? null : await socketForPort(port, input.directories, io);
    if (samePort) {
      return {
        found: samePort, looked,
        detail: `Listening where you said it was, reached through its own socket because it will not list its tabs over HTTP.`,
        caveat: DISCOVERY_CAVEAT,
      };
    }
    return {
      found: null, looked,
      detail: `Nothing usable at ${input.configured}. Either no browser is listening there, or one is and it will not list its tabs and no installed profile records that port.`,
      caveat: DISCOVERY_CAVEAT,
    };
  }

  for (const directory of input.directories) {
    const text = await io.portFile(directory);
    if (!text) continue;
    const parsed = parsePortFile(text);
    if (!parsed) continue;
    const endpoint = `http://127.0.0.1:${parsed.port}`;
    looked.push(`${endpoint} (${directory})`);
    const listed = await look(endpoint, "profile", directory, io);
    if (listed) return { found: listed, looked, detail: `Found from the profile that recorded it: ${listed.detail}`, caveat: DISCOVERY_CAVEAT };
    if (!parsed.path) continue;
    // The listing is closed but the socket in the same file still answers, and
    // that is the browser debugging was switched on in from the browser itself.
    const url = `ws://127.0.0.1:${parsed.port}${parsed.path}`;
    const pages = await io.socketAlive(url);
    if (pages === null) continue;
    return {
      found: {
        endpoint: "", browserWsUrl: url, browser: "", pages, source: "profile", profile: directory,
        detail: `Listening on ${parsed.port} with ${pages} open tab(s), reached through its own socket because it will not list them over HTTP.`,
      },
      looked,
      detail: "Found through the socket the profile recorded, because the browser refuses to list its tabs.",
      caveat: DISCOVERY_CAVEAT,
    };
  }

  return {
    found: null,
    looked,
    detail: looked.length
      ? "Nothing answered anywhere that was tried. Start the browser with remote debugging on, or switch it on from the browser's own inspect page."
      : "Nowhere to look: no endpoint is configured and no installed browser has recorded a port.",
    caveat: DISCOVERY_CAVEAT,
  };
}

export const liveDiscoveryIo: DiscoveryIo = {
  version: async (endpoint) => {
    try {
      const response = await fetch(new URL("/json/version", endpoint), { signal: AbortSignal.timeout(2500) });
      if (!response.ok) return null;
      const body = (await response.json()) as Record<string, string>;
      return { browser: body.Browser || "", webSocketDebuggerUrl: body.webSocketDebuggerUrl || "" };
    } catch {
      return null;
    }
  },
  tabs: async (endpoint) => {
    try {
      return await listTargets(endpoint);
    } catch {
      return null;
    }
  },
  portFile: async (directory) => {
    try {
      return await readFile(join(directory, "DevToolsActivePort"), "utf8");
    } catch {
      return null;
    }
  },
  socketAlive: async (url) => {
    let connection: BrowserConnection | null = null;
    try {
      connection = await BrowserConnection.open(url, 4000);
      const targets = await connection.targets();
      return targets.filter((target) => target.type === "page").length;
    } catch {
      return null;
    } finally {
      connection?.close();
    }
  },
};

export function installedProfileDirectories(): string[] {
  return profileDirectories(homedir(), process.platform, process.env.LOCALAPPDATA);
}

/** The browser socket to drive, whatever route found it. */
export async function browserSocketUrl(found: BrowserFound, io: DiscoveryIo = liveDiscoveryIo): Promise<string> {
  if (found.browserWsUrl) return found.browserWsUrl;
  const version = await io.version(found.endpoint);
  if (!version || !version.webSocketDebuggerUrl) {
    throw new JsonApiClosedError(`The browser at ${found.endpoint} gave no socket to attach to.`);
  }
  return version.webSocketDebuggerUrl;
}
