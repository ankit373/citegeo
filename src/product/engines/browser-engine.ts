import { BrowserConnection, CdpSession, type CdpTarget } from "./cdp-client.js";
import { browserSocketUrl, discoverBrowser, installedProfileDirectories, liveDiscoveryIo, type BrowserSearch } from "./browser-discovery.js";

// The surfaces buyers use, not the APIs behind them. It drives your own
// signed-in browser, breaks when a page changes, and is off by default.

export type EngineId = "google-ai-overview" | "chatgpt" | "copilot" | "perplexity-web";

export interface EngineAnswer {
  engineId: EngineId;
  /** The answer as the surface rendered it. */
  text: string;
  /** Links the surface showed as its sources. */
  citationUrls: string[];
  /** What the page looked like when this was read, for the archive. */
  capturedAt: string;
}

export type EngineOutcome =
  | { state: "answered"; answer: EngineAnswer }
  /** The surface was reached but produced no answer for this question. */
  | { state: "no_answer"; detail: string }
  /** The page changed shape, so nothing could be read. Never an empty answer. */
  | { state: "unreadable"; detail: string }
  /** The browser, the network or a sign-in wall stopped it before an answer. */
  | { state: "unavailable"; detail: string };

/** A surface built out of a search result is grounded whatever came back.
 * One that decides per question is not, and saying which is which is the
 * difference between a measured nought and an unknown. */
export type EngineGrounding = "always" | "per_question";

export interface BrowserEngine {
  id: EngineId;
  label: string;
  /** Where the surface lives, so it can be checked without asking it anything. */
  home: string;
  /** What this surface is, and what reading it this way cannot promise. */
  caveat: string;
  grounding: EngineGrounding;
  ask(session: CdpSession, question: string): Promise<EngineOutcome>;
}

export interface EngineRunOptions {
  /** Where Chrome is listening. Looked for when this is not given. */
  endpoint?: string | undefined;
  timeoutMs?: number | undefined;
  /** A connection already open, so a run of many questions opens one. */
  driver?: BrowserDriver | undefined;
}

export async function findBrowser(options: EngineRunOptions = {}): Promise<BrowserSearch> {
  return discoverBrowser({
    configured: options.endpoint || process.env.BROWSER_DEBUG_ENDPOINT,
    directories: installedProfileDirectories(),
    io: liveDiscoveryIo,
  });
}

/** Holds one connection and hands out a fresh tab per question, so a run never
 * navigates a tab somebody is reading or posts into an open conversation. */
export class BrowserDriver {
  private constructor(readonly connection: BrowserConnection, readonly search: BrowserSearch) {}

  static async open(options: EngineRunOptions = {}): Promise<BrowserDriver> {
    const search = await findBrowser(options);
    if (!search.found) throw new Error(search.detail);
    const connection = await BrowserConnection.open(await browserSocketUrl(search.found));
    return new BrowserDriver(connection, search);
  }

  async withTab<T>(run: (session: CdpSession) => Promise<T>): Promise<T> {
    const targetId = await this.connection.openTab();
    try {
      const session = await this.connection.attach(targetId);
      await session.send("Page.enable");
      await session.send("Runtime.enable");
      return await run(session);
    } finally {
      await this.connection.closeTab(targetId);
    }
  }

  close(): void {
    this.connection.close();
  }
}

export async function askEngine(
  engine: BrowserEngine,
  question: string,
  options: EngineRunOptions = {},
): Promise<EngineOutcome> {
  let driver: BrowserDriver | null = null;
  try {
    driver = options.driver || await BrowserDriver.open(options);
    return await driver.withTab((session) => engine.ask(session, question));
  } catch (error) {
    // Every failure shape lands here as "unavailable" rather than as an empty
    // answer, because an empty answer is a measurement and this is not one.
    return { state: "unavailable", detail: error instanceof Error ? error.message : String(error) };
  } finally {
    if (!options.driver) driver?.close();
  }
}

/** Waits for a condition in the page, polling rather than guessing at a delay. */
export async function waitFor(
  session: CdpSession,
  expression: string,
  timeoutMs: number,
  intervalMs = 500,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await session.evaluate<boolean>(expression)) return true;
    } catch {
      // A page mid-navigation throws; that is not a failure to wait.
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}
