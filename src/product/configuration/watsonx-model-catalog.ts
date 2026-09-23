import { hasProviderKey, resolveProviderKey, watsonxApiVersion, watsonxEndpoint } from "../../config/env.js";
import { watsonxAccessToken } from "../../providers/watsonx-auth.js";
import { ProductModelCatalogUnavailableError } from "./configuration-errors.js";
import type { ProductModelCatalog, ProviderModelCatalogItem } from "./model-selection-schema.js";

// The specs endpoint is the region's own inventory, so what it omits is not
// available to this account no matter what the documentation lists.

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

// functions is the capability list: text_chat, text_generation, embedding,
// rerank and the rest. task_ids is null on many rows, so it decides nothing.
function answersChat(row: Record<string, unknown>): boolean {
  const functions = Array.isArray(row.functions) ? row.functions : null;
  if (functions) {
    return functions.some((entry) => {
      const id = asObject(entry)?.id;
      return id === "text_chat" || id === "text_generation";
    });
  }
  const tasks = Array.isArray(row.task_ids) ? row.task_ids : [];
  if (tasks.length === 0) return true;
  return tasks.some((task) => typeof task === "string" && (task.includes("generation") || task.includes("chat")));
}

interface Reachability {
  available: boolean;
  unavailableReason: string | null;
}

/** Lifecycle carries the retirement, and a withdrawn model still appears in
 * the listing long after it stops answering. */
function reachability(row: Record<string, unknown>): Reachability {
  const lifecycle = Array.isArray(row.lifecycle) ? row.lifecycle : [];
  const stages = lifecycle
    .map((entry) => asObject(entry)?.id)
    .filter((id): id is string => typeof id === "string");
  if (stages.includes("withdrawn")) {
    return { available: false, unavailableReason: "Withdrawn in this region, so a request would not be answered." };
  }
  if (stages.includes("deprecated")) {
    return { available: false, unavailableReason: "Marked deprecated in this region, so it may stop answering without notice." };
  }
  return { available: true, unavailableReason: null };
}

export class WatsonxProductModelCatalog implements ProductModelCatalog {
  async list(): Promise<ProviderModelCatalogItem[]> {
    if (!hasProviderKey("watsonx")) return [];
    const endpoint = watsonxEndpoint();
    if (!endpoint) throw new ProductModelCatalogUnavailableError('Missing WATSONX_REGION for provider "watsonx".');
    const token = await watsonxAccessToken(resolveProviderKey("watsonx"));
    const url = `${endpoint}/ml/v1/foundation_model_specs?version=${encodeURIComponent(watsonxApiVersion())}&limit=200`;

    let response: Response;
    try {
      response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    } catch (error) {
      throw new ProductModelCatalogUnavailableError(
        `watsonx could not be reached: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!response.ok) {
      throw new ProductModelCatalogUnavailableError(
        `watsonx answered ${response.status} listing foundation model specs. The key may lack access to this region.`,
      );
    }

    const payload = asObject(await response.json().catch(() => null));
    if (!payload) throw new ProductModelCatalogUnavailableError("watsonx returned no readable model listing.");
    const rows = Array.isArray(payload.resources) ? payload.resources : [];
    const checkedAt = new Date().toISOString();
    return rows.flatMap((value) => {
      const row = asObject(value);
      if (!row || typeof row.model_id !== "string" || !answersChat(row)) return [];
      const { available, unavailableReason } = reachability(row);
      return [{
        providerId: "watsonx" as const,
        modelId: row.model_id,
        displayName: typeof row.label === "string" && row.label.trim() ? row.label : row.model_id,
        vendor: typeof row.provider === "string" ? row.provider : "watsonx",
        releasedAt: null,
        available,
        unavailableReason,
        nativeWebSearchSupported: false,
        checkedAt,
        source: "provider_catalog" as const,
      }];
    });
  }
}
