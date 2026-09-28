import { LocationUnavailableError, trackedLocations, type LocationService } from "./location.js";

type JsonSender = (status: number, body: unknown) => void;

// Places this project asks about, beside the fixed country list. A location is
// a stated audience, never a geolocated query, exactly as a market is.
export async function handleLocationApi(input: {
  method: string;
  route: string[];
  send: JsonSender;
  service: LocationService;
  readJson?: () => Promise<Record<string, unknown>>;
}): Promise<boolean> {
  const { method, route, send, service } = input;
  if (route.length !== 4 || route[0] !== "api" || route[1] !== "projects" || route[3] !== "locations") return false;
  const projectId = route[2] || "";

  try {
    if (method === "GET") {
      const set = await service.get(projectId);
      send(200, { locations: set.locations, tracked: trackedLocations(set).length, updatedAt: set.updatedAt });
      return true;
    }
    if (method === "POST") {
      const body = input.readJson ? await input.readJson() : {};
      const set = await service.add(projectId, {
        label: typeof body.label === "string" ? body.label : "",
        audience: typeof body.audience === "string" ? body.audience : undefined,
        locale: typeof body.locale === "string" ? body.locale : undefined,
      });
      send(201, { locations: set.locations });
      return true;
    }
    if (method === "DELETE") {
      const body = input.readJson ? await input.readJson() : {};
      const ids = Array.isArray(body.locationIds) ? body.locationIds.filter((row): row is string => typeof row === "string") : [];
      // Retired, never deleted, so an answer asked in this place still resolves
      // to a label rather than to a bare id.
      const set = await service.retire(projectId, ids);
      send(200, { locations: set.locations });
      return true;
    }
  } catch (error) {
    if (error instanceof LocationUnavailableError) {
      send(400, { code: "location_unavailable", error: error.message });
      return true;
    }
    throw error;
  }
  send(405, { error: "method_not_allowed" });
  return true;
}
