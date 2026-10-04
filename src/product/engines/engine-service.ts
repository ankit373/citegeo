import { askBrowserEngine } from "./engine-run.js";
import { DISCOVERY_CAVEAT } from "./browser-discovery.js";
import { BROWSER_ENGINES, browserEngine } from "./engine-registry.js";
import { findBrowser, type BrowserEngine, type EngineRunOptions } from "./browser-engine.js";
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
  /** Where the browser actually is, which is not always where it was named. */
  endpoint: string;
  /** Null until it has been probed: a browser nobody looked for is not a
   * browser that is not there. */
  reachable: boolean | null;
  detail: string;
  engines: EngineDescription[];
  /** Everywhere that was tried, so an empty result can be disagreed with. */
  looked: string[];
  caveat: string;
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
    const chosen = new Set(await this.saved(projectId));
    const engines = BROWSER_ENGINES.map((engine) => ({
      id: engine.id,
      label: engine.label,
      caveat: engine.caveat,
      selected: chosen.has(engine.id),
    }));
    const configured = this.options.endpoint || process.env.BROWSER_DEBUG_ENDPOINT || "";
    if (!probe) return { endpoint: configured, reachable: null, detail: "Not checked.", engines, looked: [], caveat: DISCOVERY_CAVEAT };
    const search = await findBrowser(this.options);
    const found = search.found;
    return {
      endpoint: found ? found.endpoint || found.browserWsUrl : configured,
      reachable: Boolean(found),
      detail: search.detail,
      engines,
      looked: search.looked,
      caveat: search.caveat,
    };
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
