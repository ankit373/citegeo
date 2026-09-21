import { log } from "./logger.js";

// Kubernetes sends SIGTERM and keeps routing for a moment. The order that
// loses no request is: fail readiness first, let the load balancer take this
// instance out, then drain what is already in flight, then close what is open.

export type Closer = () => Promise<void> | void;

export interface LifecycleOptions {
  /** Longest to wait for in-flight work. Must be under the orchestrator's
   * grace period, or the process is killed mid-drain. */
  drainMs?: number;
  /** Time between failing readiness and refusing new work, so a load balancer
   * has a chance to notice before the door shuts. */
  noticeMs?: number;
}

export class Lifecycle {
  private inFlight = 0;
  private draining = false;
  private ready = false;
  private readonly closers: Closer[] = [];
  private idle: (() => void) | null = null;

  constructor(private readonly options: LifecycleOptions = {}) {}

  /** Live means the process is running. It stays true while draining, because
   * a draining process must not be killed and restarted mid-drain. */
  get isLive(): boolean {
    return true;
  }

  /** Ready means send work here. False the moment a shutdown begins. */
  get isReady(): boolean {
    return this.ready && !this.draining;
  }

  get isDraining(): boolean {
    return this.draining;
  }

  get active(): number {
    return this.inFlight;
  }

  markReady(): void {
    this.ready = true;
  }

  onClose(closer: Closer): void {
    this.closers.push(closer);
  }

  enter(): void {
    this.inFlight += 1;
  }

  leave(): void {
    this.inFlight -= 1;
    if (this.inFlight <= 0 && this.idle) {
      const done = this.idle;
      this.idle = null;
      done();
    }
  }

  private async drained(timeoutMs: number): Promise<boolean> {
    if (this.inFlight <= 0) return true;
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => { this.idle = null; resolve(false); }, timeoutMs);
      this.idle = () => { clearTimeout(timer); resolve(true); };
    });
  }

  async shutdown(reason: string): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    const drainMs = this.options.drainMs || 15000;
    log.info("shutting down", { reason, inFlight: this.inFlight, drainMs });
    // Readiness is already false. This pause is the load balancer noticing.
    await new Promise((resolve) => setTimeout(resolve, this.options.noticeMs || 0));
    const clean = await this.drained(drainMs);
    if (!clean) log.warn("drain timed out, closing anyway", { inFlight: this.inFlight });
    for (const closer of this.closers) {
      try {
        await closer();
      } catch (error) {
        log.error("a closer threw during shutdown", { error });
      }
    }
    log.info("shutdown complete", { reason, drained: clean });
  }

  /** Installed once. A second signal while draining is a request to stop
   * waiting, which is what an operator pressing it twice means. */
  install(exit: (code: number) => void = (code) => process.exit(code)): void {
    let hurried = false;
    for (const signal of ["SIGTERM", "SIGINT"] as const) {
      process.on(signal, () => {
        if (this.draining && !hurried) {
          hurried = true;
          log.warn("second signal, exiting now", { signal });
          exit(1);
          return;
        }
        void this.shutdown(signal).then(() => exit(0));
      });
    }
  }
}
