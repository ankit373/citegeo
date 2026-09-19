import { integrationIds } from "./integrations.js";
import type { CredentialService } from "./credential-service.js";

export type CredentialJsonSender = (status: number, body: unknown) => void;

// Closed unless the server has a password. That guard is separate from the
// session check on purpose: the session only protects when authentication is
// on at all, so an open server needs its own refusal here rather than relying
// on nobody finding the port.
export async function handleCredentialApi(input: {
  method: string;
  route: string[];
  send: CredentialJsonSender;
  service: CredentialService;
  authEnabled: boolean;
  readJson: () => Promise<Record<string, unknown>>;
}): Promise<boolean> {
  const { method, route, send, service } = input;
  if (route[0] !== "api" || route[1] !== "credentials") return false;

  if (!input.authEnabled) {
    send(403, {
      error: "Set AUTH_PASSWORD before managing keys here. Without a password this endpoint would be open to anyone who reaches the port.",
    });
    return true;
  }

  if (method === "GET" && route.length === 2) {
    send(200, { storageEnabled: service.storageEnabled(), credentials: await service.status(integrationIds()) });
    return true;
  }

  const providerId = route[2] || "";
  if (route.length === 3 && (method === "PUT" || method === "DELETE")) {
    if (!integrationIds().includes(providerId)) {
      send(404, { error: `Unknown provider "${providerId}".` });
      return true;
    }
    if (method === "PUT") {
      const body = await input.readJson() as { secret?: unknown };
      const result = await service.save(providerId, body.secret);
      // The key never comes back, whatever happened to it.
      send(result.outcome === "saved" ? 200 : 400, result);
      return true;
    }
    send(200, await service.clear(providerId));
    return true;
  }

  return false;
}
