import { bedrockAccessKeyId, bedrockRegion, bedrockSessionToken, resolveProviderKey } from "../config/env.js";
import { signRequest } from "../product/storage/sigv4.js";

// Bedrock authenticates with the same signature the object store already signs
// by hand, and that signer is checked against the vector AWS publishes.

export type BedrockService = "bedrock" | "bedrock-runtime";

export interface BedrockCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string | undefined;
  region: string;
}

/** Every part, or the name of the missing one. Nothing here is defaulted. */
export function bedrockCredentials(explicitSecret?: string): BedrockCredentials {
  const region = bedrockRegion();
  if (!region) throw new Error('Missing AWS_BEDROCK_REGION for provider "bedrock".');
  const accessKeyId = bedrockAccessKeyId();
  if (!accessKeyId) throw new Error('Missing AWS_BEDROCK_ACCESS_KEY_ID for provider "bedrock".');
  const secretAccessKey = explicitSecret?.trim() || resolveProviderKey("bedrock");
  return { region, accessKeyId, secretAccessKey, sessionToken: bedrockSessionToken() };
}

export function signBedrockRequest(input: {
  method: string;
  url: URL;
  body: string;
  service: BedrockService;
  credentials: BedrockCredentials;
}, now = new Date()): Record<string, string> {
  return signRequest(
    {
      method: input.method,
      url: input.url,
      headers: { "content-type": "application/json", accept: "application/json" },
      body: input.body,
    },
    {
      accessKeyId: input.credentials.accessKeyId,
      secretAccessKey: input.credentials.secretAccessKey,
      sessionToken: input.credentials.sessionToken,
      region: input.credentials.region,
      service: input.service,
    },
    now,
  );
}
