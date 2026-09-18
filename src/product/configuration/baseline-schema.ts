import type { ProductProviderId } from "./provider-id.js";
import type { ProductWebSearchMode } from "./model-selection-schema.js";
import type { RecognitionProtocolSnapshot } from "./recognition-protocol.js";

export interface ProductModelSnapshot {
  selectionId: string;
  providerId: ProductProviderId;
  modelId: string;
  displayName: string;
  webSearchMode: ProductWebSearchMode;
  nativeWebSearchSupported: boolean;
  capabilityCheckedAt: string;
}

export interface ProductBaseline {
  id: string;
  projectId: string;
  version: number;
  normalizedDomain: string;
  recognitionProtocol: RecognitionProtocolSnapshot;
  modelSnapshots: ProductModelSnapshot[];
  language: "en";
  analysisVersion: string;
  configHash: string;
  createdAt: string;
}
