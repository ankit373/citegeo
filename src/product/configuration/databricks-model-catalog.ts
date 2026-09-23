import { databricksHost, hasProviderKey, resolveProviderKey } from "../../config/env.js";
import { ProductModelCatalogUnavailableError } from "./configuration-errors.js";
import type { ProductModelCatalog, ProviderModelCatalogItem } from "./model-selection-schema.js";

// A workspace serves whatever it has been given, so the listing is the only
// authority on what this token can actually call.

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function answersChat(row: Record<string, unknown>): boolean {
  const task = typeof row.task === "string" ? row.task : "";
  // An absent task is a custom endpoint, which may still answer a chat body.
  if (task === "") return true;
  // An embedding endpoint is served under the same llm prefix and answers
  // vectors, so matching that prefix alone would offer it as a model.
  if (task.includes("embedding")) return false;
  return task.includes("chat") || task.includes("completions");
}

interface Reachability {
  available: boolean;
  unavailableReason: string | null;
}

function reachability(row: Record<string, unknown>): Reachability {
  const state = asObject(row.state);
  const ready = typeof state?.ready === "string" ? state.ready : "";
  if (ready === "READY" || ready === "") return { available: true, unavailableReason: null };
  return {
    available: false,
    unavailableReason: `The serving endpoint reports ${ready.toLowerCase().split("_").join(" ")}, so a request would not be answered yet.`,
  };
}

export class DatabricksProductModelCatalog implements ProductModelCatalog {
  async list(): Promise<ProviderModelCatalogItem[]> {
    if (!hasProviderKey("databricks")) return [];
    const host = databricksHost();
    if (!host) throw new ProductModelCatalogUnavailableError('Missing DATABRICKS_HOST for provider "databricks".');
    const url = `${host}/api/2.0/serving-endpoints`;

    let response: Response;
    try {
      response = await fetch(url, { headers: { Authorization: `Bearer ${resolveProviderKey("databricks")}` } });
    } catch (error) {
      throw new ProductModelCatalogUnavailableError(
        `Databricks could not be reached: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!response.ok) {
      throw new ProductModelCatalogUnavailableError(
        `Databricks answered ${response.status} listing serving endpoints. The token may lack access to this workspace.`,
      );
    }

    const payload = asObject(await response.json().catch(() => null));
    if (!payload) throw new ProductModelCatalogUnavailableError("Databricks returned no readable endpoint listing.");
    const rows = Array.isArray(payload.endpoints) ? payload.endpoints : [];
    const checkedAt = new Date().toISOString();
    return rows.flatMap((value) => {
      const row = asObject(value);
      if (!row || typeof row.name !== "string" || !answersChat(row)) return [];
      const { available, unavailableReason } = reachability(row);
      return [{
        providerId: "databricks" as const,
        modelId: row.name,
        displayName: row.name,
        vendor: "databricks",
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
