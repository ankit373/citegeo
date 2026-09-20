// A minimal CDP client. Node has had a global WebSocket since 22 and this needs
// six commands, so no automation framework and no supply chain.

export interface CdpTarget {
  id: string;
  type: string;
  url: string;
  webSocketDebuggerUrl: string;
}

export class BrowserUnavailableError extends Error {}

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
  if (!response.ok) throw new BrowserUnavailableError(`The browser at ${endpoint} answered ${response.status}.`);
  return (await response.json()) as CdpTarget[];
}

interface PendingCall {
  resolve: (value: Record<string, unknown>) => void;
  reject: (error: Error) => void;
}

export class CdpSession {
  private nextId = 0;
  private readonly pending = new Map<number, PendingCall>();
  private constructor(private readonly socket: WebSocket) {}

  static async attach(target: CdpTarget, timeoutMs = 15000): Promise<CdpSession> {
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    const session = new CdpSession(socket);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new BrowserUnavailableError("Timed out attaching to the browser tab.")), timeoutMs);
      socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener("error", () => { clearTimeout(timer); reject(new BrowserUnavailableError("Could not attach to the browser tab.")); }, { once: true });
    });
    socket.addEventListener("message", (event) => session.receive(String((event as MessageEvent).data)));
    // A socket that closes mid-run must fail every waiting call, or the run hangs.
    socket.addEventListener("close", () => session.failAll(new BrowserUnavailableError("The browser tab closed during the run.")));
    return session;
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

  send(method: string, params: Record<string, unknown> = {}, timeoutMs = 30000): Promise<Record<string, unknown>> {
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
      this.socket.send(JSON.stringify({ id, method, params }));
    });
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
    try {
      this.socket.close();
    } catch {
      // Already gone, which is the state we wanted.
    }
  }
}
