import { listTargets } from "./cdp-client.js";
import { askBrowserEngine } from "./engine-run.js";
import { BROWSER_ENGINES, browserEngine } from "./engine-registry.js";
import { DEFAULT_DEBUG_ENDPOINT, type BrowserEngine, type EngineRunOptions } from "./browser-engine.js";
import { getJson, putJson } from "../storage/object-store.js";
import type { ProductProjectFileStore } from "../projects/project-store.js";
import type { BrandIdentity } from "../topics/brand-identity.js";
import type { PromptAnswer, PromptRun } from "../topics/prompt-run-schema.js";
import type { Prompt } from "../topics/topic-schema.js";
import type { StructuredAsk } from "../topics/topic-service.js";

export class EngineUnavailableError extends Error {}

export interface EngineSelection {
  projectId: string;
  engineIds: string[];
  updatedAt: string;
}

export interface EngineDescription {
  id: string;
  label: string;
  caveat: string;
  selected: boolean;
}

export interface EngineStatus {
  endpoint: string;
  /** Null until it has been probed: a browser nobody looked for is not a
   * browser that is not there. */
  reachable: boolean | null;
  detail: string;
  engines: EngineDescription[];
}

export class EngineService {
  constructor(
    private readonly projects: ProductProjectFileStore,
    private readonly ask: StructuredAsk,
    private readonly options: EngineRunOptions = {},
  ) {}

  private key(projectId: string): string {
    return this.projects.keyFor(projectId, "engines", "selection.json");
  }

  lookup(engineId: string): BrowserEngine | undefined {
    return browserEngine(engineId);
  }

  async saved(projectId: string): Promise<string[]> {
    const row = await getJson<EngineSelection>(this.projects.objects, this.key(projectId));
    return row && row.projectId === projectId ? row.engineIds.filter((id) => Boolean(browserEngine(id))) : [];
  }

  async select(projectId: string, engineIds: string[]): Promise<EngineStatus> {
    for (const id of engineIds) {
      if (!browserEngine(id)) throw new EngineUnavailableError(`Unknown engine "${id}".`);
    }
    const value: EngineSelection = { projectId, engineIds: [...new Set(engineIds)], updatedAt: new Date().toISOString() };
    await putJson(this.projects.objects, this.key(projectId), value);
    return this.status(projectId);
  }

  /** Probes the browser rather than assuming it. Nothing here signs anybody
   * in; the answer is whatever the already signed-in browser shows. */
  async status(projectId: string, probe = true): Promise<EngineStatus> {
    const endpoint = this.options.endpoint || DEFAULT_DEBUG_ENDPOINT;
    const chosen = new Set(await this.saved(projectId));
    const engines = BROWSER_ENGINES.map((engine) => ({
      id: engine.id,
      label: engine.label,
      caveat: engine.caveat,
      selected: chosen.has(engine.id),
    }));
    if (!probe) return { endpoint, reachable: null, detail: "Not checked.", engines };
    try {
      const targets = await listTargets(endpoint);
      const pages = targets.filter((target) => target.type === "page").length;
      return {
        endpoint,
        reachable: true,
        detail: `${pages} open tab(s) to drive.`,
        engines,
      };
    } catch (error) {
      return {
        endpoint,
        reachable: false,
        detail: error instanceof Error ? error.message : String(error),
        engines,
      };
    }
  }

  async askOne(input: { run: PromptRun; prompt: Prompt; engine: BrowserEngine; identity: BrandIdentity }): Promise<PromptAnswer> {
    return askBrowserEngine({
      projectId: input.run.projectId,
      runId: input.run.id,
      prompt: { id: input.prompt.id, topicId: input.prompt.topicId, text: input.prompt.text, intent: input.prompt.intent },
      engine: input.engine,
      identity: input.identity,
      // The surface decides both from the signed-in browser, so claiming a
      // market or a language per answer would be a fiction.
      regionId: "global",
      languageId: "en",
      ask: this.ask,
      options: this.options,
    });
  }
}
