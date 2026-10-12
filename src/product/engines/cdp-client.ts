// A minimal CDP client. Node has had a global WebSocket since 22 and this needs
// six commands, so no automation framework and no supply chain.

export interface CdpTarget {
  id: string;
  type: string;
  url: string;
  webSocketDebuggerUrl: string;
}

export class BrowserUnavailableError extends Error {}

/** Listening, and refusing to list its tabs. The browser socket named in the
 * profile's DevToolsActivePort still answers, so this is recoverable. */
export class JsonApiClosedError extends BrowserUnavailableError {}

/** Chrome must already be running with remote debugging on, started by you.
 * Nothing here signs in on your behalf or works around a sign-in. */
export async function listTargets(endpoint: string): Promise<CdpTarget[]> {
  let response: Response;
  try {
    response = await fetch(new URL("/json/list", endpoint));
  } catch {
    throw new BrowserUnavailableError(
      `No browser is listening on ${endpoint}. Start Chrome with --remote-debugging-port and try again.`,
    );
  }
  // A browser whose debugging was switched on from chrome://inspect serves the
  // browser socket and refuses this listing, which is a different state.
  if (response.status === 404) {
    throw new JsonApiClosedError(
      `The browser at ${endpoint} is listening but will not list its tabs, which is what debugging switched on from chrome://inspect does. Its own socket still answers.`,
    );
  }
  if (!response.ok) throw new BrowserUnavailableError(`The browser at ${endpoint} answered ${response.status}.`);
  return (await response.json()) as CdpTarget[];
}

interface PendingCall {
  resolve: (value: Record<string, unknown>) => void;
  reject: (error: Error) => void;
}

// One socket can carry the browser and every tab attached through it, so the
// call ids are owned here rather than by each session sharing it.
class CdpTransport {
  private nextId = 0;
  private readonly pending = new Map<number, PendingCall>();
  constructor(private readonly socket: WebSocket) {
    socket.addEventListener("message", (event) => this.receive(String((event as MessageEvent).data)));
    socket.addEventListener("close", () => this.failAll(new BrowserUnavailableError("The browser connection closed during the run.")));
  }

  static async open(url: string, timeoutMs: number, what: string): Promise<CdpTransport> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new BrowserUnavailableError(`Timed out attaching to the ${what}.`)), timeoutMs);
      socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener("error", () => { clearTimeout(timer); reject(new BrowserUnavailableError(`Could not attach to the ${what}.`)); }, { once: true });
    });
    return new CdpTransport(socket);
  }

  private receive(raw: string): void {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }
    const id = typeof message.id === "number" ? message.id : null;
    if (id === null) return;
    const call = this.pending.get(id);
    if (!call) return;
    this.pending.delete(id);
    const error = message.error as { message?: string } | undefined;
    if (error) call.reject(new Error(error.message || "The browser rejected the command."));
    else call.resolve((message.result as Record<string, unknown>) || {});
  }

  private failAll(error: Error): void {
    for (const call of this.pending.values()) call.reject(error);
    this.pending.clear();
  }

  send(method: string, params: Record<string, unknown>, sessionId: string | undefined, timeoutMs: number): Promise<Record<string, unknown>> {
    const id = (this.nextId += 1);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`The browser did not answer ${method} within ${timeoutMs}ms.`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); },
      });
      this.socket.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    });
  }

  close(): void {
    try {
      this.socket.close();
    } catch {
      // Already gone, which is the state we wanted.
    }
  }
}

export class CdpSession {
  private constructor(
    private readonly transport: CdpTransport,
    private readonly sessionId: string | undefined,
    /** False where the socket belongs to a browser connection that outlives it. */
    private readonly ownsTransport: boolean,
  ) {}

  static async attach(target: CdpTarget, timeoutMs = 15000): Promise<CdpSession> {
    const transport = await CdpTransport.open(target.webSocketDebuggerUrl, timeoutMs, "browser tab");
    return new CdpSession(transport, undefined, true);
  }

  /** A tab reached through the browser's own socket, which is the only route
   * when the browser will not list its tabs over HTTP. */
  static overBrowser(transport: CdpTransport, sessionId: string): CdpSession {
    return new CdpSession(transport, sessionId, false);
  }

  send(method: string, params: Record<string, unknown> = {}, timeoutMs = 30000): Promise<Record<string, unknown>> {
    return this.transport.send(method, params, this.sessionId, timeoutMs);
  }

  /** Runs an expression in the page and returns whatever it evaluates to. */
  async evaluate<T>(expression: string, timeoutMs = 30000): Promise<T> {
    const result = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    }, timeoutMs);
    const details = result.exceptionDetails as { text?: string } | undefined;
    if (details) throw new Error(details.text || "The page threw while being read.");
    return ((result.result as { value?: T } | undefined)?.value) as T;
  }

  close(): void {
    if (this.ownsTransport) this.transport.close();
  }
}

export interface TargetInfo {
  targetId: string;
  type: string;
  url: string;
}

// Driving a tab somebody is reading navigates it away and posts into whatever
// conversation was already open there, so this opens its own and closes it.
export class BrowserConnection {
  private constructor(private readonly transport: CdpTransport) {}

  static async open(browserWsUrl: string, timeoutMs = 15000): Promise<BrowserConnection> {
    return new BrowserConnection(await CdpTransport.open(browserWsUrl, timeoutMs, "browser"));
  }

  async targets(): Promise<TargetInfo[]> {
    const result = await this.transport.send("Target.getTargets", {}, undefined, 15000);
    return ((result.targetInfos as TargetInfo[] | undefined) || []).map((row) => ({
      targetId: row.targetId, type: row.type, url: row.url,
    }));
  }

  async openTab(url = "about:blank"): Promise<string> {
    const result = await this.transport.send("Target.createTarget", { url }, undefined, 30000);
    const targetId = result.targetId as string | undefined;
    if (!targetId) throw new BrowserUnavailableError("The browser opened no tab to drive.");
    return targetId;
  }

  async attach(targetId: string): Promise<CdpSession> {
    const result = await this.transport.send("Target.attachToTarget", { targetId, flatten: true }, undefined, 15000);
    const sessionId = result.sessionId as string | undefined;
    if (!sessionId) throw new BrowserUnavailableError("The browser attached no session to that tab.");
    return CdpSession.overBrowser(this.transport, sessionId);
  }

  async closeTab(targetId: string): Promise<void> {
    try {
      await this.transport.send("Target.closeTarget", { targetId }, undefined, 15000);
    } catch {
      // A tab that is already gone is the state this wanted.
    }
  }

  close(): void {
    this.transport.close();
  }
}
