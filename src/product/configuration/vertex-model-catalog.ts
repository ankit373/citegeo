import { hasProviderKey, vertexEndpoint } from "../../config/env.js";
import { vertexAccessToken } from "../../providers/vertex-auth.js";
import { ProductModelCatalogUnavailableError } from "./configuration-errors.js";
import type { ProductModelCatalog, ProviderModelCatalogItem } from "./model-selection-schema.js";

// Vertex lists per publisher, so the models offered are the ones the region
// actually publishes rather than a list compiled here.
const PUBLISHERS = ["google", "anthropic", "meta", "mistralai"];

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

function reachability(row: Record<string, unknown>): Reachability {
  const stage = typeof row.launchStage === "string" ? row.launchStage : "";
  if (stage === "DEPRECATED") {
    return { available: false, unavailableReason: "Marked deprecated in this region, so it may stop answering without notice." };
  }
  const actions = asObject(row.supportedActions);
  // Absent actions is the common shape for a generally available model, so it
  // is only unavailable when the listing says the call is not offered.
  if (actions && !("predict" in actions) && !("rawPredict" in actions) && !("generateContent" in actions)) {
    return { available: false, unavailableReason: "The listing does not offer generateContent for this model in this region." };
  }
  return { available: true, unavailableReason: null };
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
      const url = `${endpoint}/v1beta1/publishers/${encodeURIComponent(publisher)}/models`;
      let response: Response;
      try {
        response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      } catch (error) {
        lastFailure = `Vertex AI could not be reached: ${error instanceof Error ? error.message : String(error)}`;
        continue;
      }
      if (!response.ok) {
        // A publisher the project has not enabled answers 403, which is a fact
        // about that publisher rather than a broken listing.
        lastFailure = `Vertex AI answered ${response.status} listing ${publisher} models.`;
        continue;
      }
      reached = true;
      const payload = asObject(await response.json().catch(() => null));
      const rows = Array.isArray(payload?.publisherModels) ? payload.publisherModels : [];
      for (const value of rows) {
        const row = asObject(value);
        const name = typeof row?.name === "string" ? row.name : "";
        const modelId = name ? vertexModelId(name) : null;
        if (!row || !modelId) continue;
        const { available, unavailableReason } = reachability(row);
        items.push({
          providerId: "vertex-ai" as const,
          modelId,
          displayName: typeof row.displayName === "string" && row.displayName.trim() ? row.displayName : modelId,
          vendor: publisher,
          releasedAt: null,
          available,
          unavailableReason,
          // Grounding is a request-time tool rather than a model property, and
          // the listing does not say which models accept it.
          nativeWebSearchSupported: publisher === "google",
          checkedAt,
          source: "provider_catalog" as const,
        });
      }
    }

    if (!reached) {
      throw new ProductModelCatalogUnavailableError(
        lastFailure || "Vertex AI returned no readable model listing. The service account may lack aiplatform.models.list.",
      );
    }
    return items;
  }
}
