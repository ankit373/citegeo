import { bedrockControlEndpoint, hasProviderKey } from "../../config/env.js";
import { bedrockCredentials, signBedrockRequest } from "../../providers/bedrock-signing.js";
import { ProductModelCatalogUnavailableError } from "./configuration-errors.js";
import type { ProductModelCatalog, ProviderModelCatalogItem } from "./model-selection-schema.js";

// Bedrock does publish a listing, so the models offered are the ones this
// account can reach in this region rather than a list compiled here.

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function answersText(row: Record<string, unknown>): boolean {
  return strings(row.inputModalities).includes("TEXT") && strings(row.outputModalities).includes("TEXT");
}

interface Reachability {
  available: boolean;
  unavailableReason: string | null;
}

// On-demand is the only way a single request reaches a model. Anything else
// needs throughput bought in advance, and an absent list says neither.
function reachability(row: Record<string, unknown>): Reachability {
  const inferenceTypes = strings(row.inferenceTypesSupported);
  if (inferenceTypes.includes("ON_DEMAND")) return { available: true, unavailableReason: null };
  if (inferenceTypes.length === 0) {
    return {
      available: false,
      unavailableReason: "The listing did not say how this model is served, so whether one request reaches it is unknown.",
    };
  }
  return {
    available: false,
    unavailableReason: `Served only through ${inferenceTypes.join(" and ").toLowerCase()}, so a single on-demand request cannot reach it.`,
  };
}

export class BedrockProductModelCatalog implements ProductModelCatalog {
  async list(): Promise<ProviderModelCatalogItem[]> {
    if (!hasProviderKey("bedrock")) return [];
    const control = bedrockControlEndpoint();
    if (!control) throw new ProductModelCatalogUnavailableError('Missing AWS_BEDROCK_REGION for provider "bedrock".');
    const url = new URL(`${control}/foundation-models`);
    const headers = signBedrockRequest({
      method: "GET",
      url,
      body: "",
      service: "bedrock",
      credentials: bedrockCredentials(),
    });

    let response: Response;
    try {
      response = await fetch(url, { method: "GET", headers });
    } catch (error) {
      // An unreachable region is not an account with no models, and reporting
      // it as one would read as a provider that answered and had nothing.
      throw new ProductModelCatalogUnavailableError(
        `Amazon Bedrock could not be reached: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!response.ok) {
      throw new ProductModelCatalogUnavailableError(
        `Amazon Bedrock answered ${response.status} to ListFoundationModels. The credentials may lack bedrock:ListFoundationModels in this region.`,
      );
    }

    const payload = asObject(await response.json().catch(() => null));
    if (!payload) throw new ProductModelCatalogUnavailableError("Amazon Bedrock returned no readable model listing.");
    const summaries = Array.isArray(payload.modelSummaries) ? payload.modelSummaries : [];
    const checkedAt = new Date().toISOString();
    return summaries.flatMap((value) => {
      const row = asObject(value);
      if (!row || typeof row.modelId !== "string" || !answersText(row)) return [];
      const { available, unavailableReason } = reachability(row);
      return [{
        providerId: "bedrock" as const,
        modelId: row.modelId,
        displayName: typeof row.modelName === "string" && row.modelName.trim() ? row.modelName : row.modelId,
        vendor: typeof row.providerName === "string" ? row.providerName : "bedrock",
        // Bedrock publishes no release date, and inventing one would date a
        // model by when this product first saw it.
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
