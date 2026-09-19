import { providerStatuses } from "./provider-status.js";
import type { ProductModelCatalog } from "./model-selection-schema.js";

export type ProviderJsonSender = (status: number, body: unknown) => void;

export async function handleProviderStatusApi(input: {
  method: string;
  route: string[];
  send: ProviderJsonSender;
  catalog: ProductModelCatalog;
}): Promise<boolean> {
  if (input.method !== "GET" || input.route.length !== 2) return false;
  if (input.route[0] !== "api" || input.route[1] !== "providers") return false;
  input.send(200, { providers: await providerStatuses(input.catalog) });
  return true;
}
