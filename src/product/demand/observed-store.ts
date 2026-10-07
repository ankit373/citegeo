import type { ProductProjectFileStore } from "../projects/project-store.js";
import { getJson, putJson } from "../storage/object-store.js";
import type { CorpusDigest } from "./corpus-digest.js";

/** The digest, not the index. A few dozen lines a proposal can be grounded in,
 * written by the command that read the corpus and read by the server. */
export class ObservedDemandFileStore {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private key(projectId: string): string {
    return this.projects.keyFor(projectId, "observed-demand.json");
  }

  async load(projectId: string): Promise<CorpusDigest | null> {
    return getJson<CorpusDigest>(this.projects.objects, this.key(projectId));
  }

  async save(projectId: string, digest: CorpusDigest): Promise<void> {
    await putJson(this.projects.objects, this.key(projectId), digest);
  }
}
