import { CdpSession, listTargets, type CdpTarget } from "./cdp-client.js";

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

export interface BrowserEngine {
  id: EngineId;
  label: string;
  /** What this surface is, and what reading it this way cannot promise. */
  caveat: string;
  ask(session: CdpSession, question: string): Promise<EngineOutcome>;
}

export interface EngineRunOptions {
  /** Where Chrome is listening. */
  endpoint?: string | undefined;
  timeoutMs?: number | undefined;
}

export const DEFAULT_DEBUG_ENDPOINT = "http://127.0.0.1:9222";

/** Picks a page target, preferring one already open on the engine's own site. */
export function chooseTarget(targets: CdpTarget[]): CdpTarget | null {
  const pages = targets.filter((target) => target.type === "page" && target.webSocketDebuggerUrl);
  return pages[0] || null;
}

export async function askEngine(
  engine: BrowserEngine,
  question: string,
  options: EngineRunOptions = {},
): Promise<EngineOutcome> {
  const endpoint = options.endpoint || DEFAULT_DEBUG_ENDPOINT;
  let session: CdpSession | null = null;
  try {
    const target = chooseTarget(await listTargets(endpoint));
    if (!target) {
      return { state: "unavailable", detail: `The browser at ${endpoint} has no open tab to drive.` };
    }
    session = await CdpSession.attach(target);
    await session.send("Page.enable");
    await session.send("Runtime.enable");
    return await engine.ask(session, question);
  } catch (error) {
    // Every failure shape lands here as "unavailable" rather than as an empty
    // answer, because an empty answer is a measurement and this is not one.
    return { state: "unavailable", detail: error instanceof Error ? error.message : String(error) };
  } finally {
    session?.close();
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
