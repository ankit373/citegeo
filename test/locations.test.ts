import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocationService, LocationUnavailableError, asRegion, locationFrom, trackedLocations } from "../src/product/topics/location.js";
import { ProductProjectFileStore } from "../src/product/projects/project-store.js";
import { region } from "../src/product/topics/region.js";

async function service(): Promise<LocationService> {
  return new LocationService(new ProductProjectFileStore(await mkdtemp(join(tmpdir(), "citegeo-locations-"))));
}

test("a location reaches the model the same way a market does", () => {
  const row = { id: "location-1", label: "Leeds", audience: "someone in Leeds", locale: "en-GB", tracked: true, addedAt: "" };
  const asked = asRegion(row);
  assert.equal(asked.id, "location-1");
  assert.equal(asked.audience, "someone in Leeds");
  assert.equal(asked.locale, "en-GB");
  // The fixed list knows nothing about it, which is the whole point.
  assert.equal(region("location-1"), undefined);
});

test("a location with no name is refused", async () => {
  const rows = await service();
  await assert.rejects(() => rows.add("p", { label: "  " }), (error: unknown) => error instanceof LocationUnavailableError);
});

test("a location says who is asking, defaulting to being in that place", async () => {
  const rows = await service();
  const set = await rows.add("p", { label: "Bristol" });
  assert.equal(set.locations[0]?.audience, "someone in Bristol");
  assert.equal(set.locations[0]?.locale, "en", "no locale stated means no language is forced");
});

test("an audience given in your own words is kept", async () => {
  const rows = await service();
  const set = await rows.add("p", { label: "Leeds", audience: "a patient in Leeds city centre", locale: "en-GB" });
  assert.equal(set.locations[0]?.audience, "a patient in Leeds city centre");
  assert.equal(set.locations[0]?.locale, "en-GB");
});

test("adding the same place twice updates it rather than duplicating it", async () => {
  const rows = await service();
  await rows.add("p", { label: "Leeds", audience: "first" });
  const set = await rows.add("p", { label: "leeds", audience: "second" });
  assert.equal(set.locations.length, 1, "case is not a different place");
  assert.equal(set.locations[0]?.audience, "second");
});

test("a retired location is kept, so a past answer still reads as its name", async () => {
  const rows = await service();
  const added = await rows.add("p", { label: "Leeds" });
  const id = added.locations[0]?.id || "";
  const set = await rows.retire("p", [id]);
  assert.equal(set.locations.length, 1, "deleting would leave old answers showing a bare id");
  assert.equal(set.locations[0]?.tracked, false);
  assert.equal(trackedLocations(set).length, 0);
  assert.equal(locationFrom(set, id)?.label, "Leeds", "it still resolves to a label");
});

test("retiring a place and adding it again tracks it once more", async () => {
  const rows = await service();
  const added = await rows.add("p", { label: "Leeds" });
  await rows.retire("p", [added.locations[0]?.id || ""]);
  const back = await rows.add("p", { label: "Leeds" });
  assert.equal(back.locations.length, 1);
  assert.equal(back.locations[0]?.tracked, true);
});

test("a project with no locations reads as none rather than failing", async () => {
  const rows = await service();
  const set = await rows.get("never-seen");
  assert.deepEqual(set.locations, []);
  assert.equal(locationFrom(set, "anything"), undefined);
});

test("locations belong to one project", async () => {
  const rows = await service();
  await rows.add("a", { label: "Leeds" });
  assert.deepEqual((await rows.get("b")).locations, [], "another project sees none of them");
});

test("a retired location keeps its label but cannot start a new run", async () => {
  const { trackedLocationFrom } = await import("../src/product/topics/location.js");
  const rows = await service();
  const added = await rows.add("p", { label: "Leeds" });
  const id = added.locations[0]?.id || "";
  const set = await rows.retire("p", [id]);
  // Past answers still resolve to "Leeds".
  assert.equal(locationFrom(set, id)?.label, "Leeds");
  // A new run must not quietly resume a place that was stopped.
  assert.equal(trackedLocationFrom(set, id), undefined);
  assert.equal(trackedLocationFrom(set, "never-existed"), undefined);
});

test("a tracked location can start a run", async () => {
  const { trackedLocationFrom } = await import("../src/product/topics/location.js");
  const rows = await service();
  const added = await rows.add("p", { label: "Bristol" });
  assert.equal(trackedLocationFrom(added, added.locations[0]?.id || "")?.label, "Bristol");
});
