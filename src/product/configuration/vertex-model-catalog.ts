import { hasProviderKey, vertexEndpoint } from "../../config/env.js";
import { vertexAccessToken } from "../../providers/vertex-auth.js";
import { ProductModelCatalogUnavailableError } from "./configuration-errors.js";
import type { ProductModelCatalog, ProviderModelCatalogItem } from "./model-selection-schema.js";

// Vertex lists per publisher, so the models offered are the ones the region
// actually publishes rather than a list compiled here.
const PUBLISHERS = ["google", "anthropic", "meta", "mistralai"];
const MAX_PAGES = 20;

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** A listing names a model "publishers/google/models/gemini-2.5-pro", and the
 * id this product runs keeps the publisher so the request can address it. */
export function vertexModelId(name: string): string | null {
  const parts = name.split("/").filter(Boolean);
  const at = parts.indexOf("models");
  if (at < 1 || at === parts.length - 1) return null;
  return `${parts[at - 1]}/${parts.slice(at + 1).join("/")}`;
}

interface Reachability {
  available: boolean;
  unavailableReason: string | null;
}

// supportedActions is a CallToAction, whose fields are deploy, viewRestApi,
// requestAccess and the rest. It never carries the name of an inference call.
function reachability(row: Record<string, unknown>): Reachability {
  const actions = asObject(row.supportedActions);
  if (!actions) return { available: true, unavailableReason: null };
  // requestAccess describes the model's card rather than this project's
  // entitlement, and marking unavailable disables the checkbox, so a model
  // already enabled here would be unselectable. A run says 403 honestly.
  // A model offered only as a deployment answers through an endpoint you stand
  // up yourself, so a publisher request cannot reach it.
  const deployOnly = !actions.viewRestApi
    && Boolean(actions.deploy || actions.multiDeployVertex || actions.deployGke);
  if (deployOnly) {
    return {
      available: false,
      unavailableReason: "Served by deploying it to an endpoint of your own, so a publisher request cannot reach it.",
    };
  }
  return { available: true, unavailableReason: null };
}

// PublisherModel carries no human label, so the id is the only name there is.
function collect(
  into: ProviderModelCatalogItem[],
  rows: unknown[],
  publisher: string,
  checkedAt: string,
): void {
  for (const value of rows) {
    const row = asObject(value);
    const name = typeof row?.name === "string" ? row.name : "";
    const modelId = name ? vertexModelId(name) : null;
    if (!row || !modelId) continue;
    const { available, unavailableReason } = reachability(row);
    into.push({
      providerId: "vertex-ai" as const,
      modelId,
      displayName: modelId,
      vendor: publisher,
      releasedAt: null,
      available,
      unavailableReason,
      // Grounding is a request-time tool rather than a model property, and the
      // listing does not say which models accept it.
      nativeWebSearchSupported: publisher === "google",
      checkedAt,
      source: "provider_catalog" as const,
    });
  }
}

export class VertexProductModelCatalog implements ProductModelCatalog {
  async list(): Promise<ProviderModelCatalogItem[]> {
    if (!hasProviderKey("vertex-ai")) return [];
    const endpoint = vertexEndpoint();
    if (!endpoint) throw new ProductModelCatalogUnavailableError('Missing GOOGLE_VERTEX_LOCATION for provider "vertex-ai".');
    const token = await vertexAccessToken();
    const checkedAt = new Date().toISOString();

    const items: ProviderModelCatalogItem[] = [];
    let reached = false;
    let lastFailure = "";
    for (const publisher of PUBLISHERS) {
      const base = `${endpoint}/v1beta1/publishers/${encodeURIComponent(publisher)}/models`;
      let pageToken = "";
      let pages = 0;
      let failed = false;
      // The listing is paged, so reading only the first page quietly hides
      // every model past it.
      do {
        const url = pageToken ? `${base}?pageToken=${encodeURIComponent(pageToken)}` : base;
        let response: Response;
        try {
          response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        } catch (error) {
          lastFailure = `Vertex AI could not be reached: ${error instanceof Error ? error.message : String(error)}`;
          failed = true;
          break;
        }
        if (!response.ok) {
          // A publisher the project has not enabled answers 403, which is a
          // fact about that publisher rather than a broken listing.
          lastFailure = `Vertex AI answered ${response.status} listing ${publisher} models.`;
          failed = true;
          break;
        }
        reached = true;
        const payload = asObject(await response.json().catch(() => null));
        const rows = Array.isArray(payload?.publisherModels) ? payload.publisherModels : [];
        collect(items, rows, publisher, checkedAt);
        pageToken = typeof payload?.nextPageToken === "string" ? payload.nextPageToken : "";
        pages += 1;
      } while (!failed && pageToken && pages < MAX_PAGES);
    }
    if (!reached) {
      throw new ProductModelCatalogUnavailableError(
        lastFailure || "Vertex AI returned no readable model listing. The service account may lack aiplatform.models.list.",
      );
    }
    return items;
  }
}
