import { INTEGRATIONS, integrationIds } from "./integrations.js";
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

  // What this product can connect to, with no credential state in it. It is
  // the same list the source carries, so a closed server can still say what
  // Setup would ask for rather than showing an empty page.
  if (method === "GET" && route[0] === "api" && route[1] === "integrations" && route.length === 2) {
    send(200, {
      integrations: INTEGRATIONS.map((row) => ({
        providerId: row.id,
        label: row.label,
        kind: row.kind,
        purpose: row.purpose,
        help: row.help,
        envKeys: row.envKeys,
        settings: (row.settings || []).map((setting) => ({ key: setting.key, label: setting.label, envKey: setting.envKey })),
      })),
    });
    return true;
  }

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
