import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normaliseFilters, segmentId, segmentQuery, SegmentError, SegmentFileStore, SegmentService } from "../src/product/topics/segment-set.js";
import { ProductProjectFileStore } from "../src/product/projects/project-store.js";
import { ProductProjectService } from "../src/product/projects/project-service.js";

async function harness() {
  const dir = await mkdtemp(join(tmpdir(), "citegeo-seg-"));
  const store = new ProductProjectFileStore(dir);
  const project = await new ProductProjectService(store).createDraft({ name: "N", primaryDomain: "n.test", brandName: "N" });
  return { service: new SegmentService(new SegmentFileStore(store)), projectId: project.id, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test("a blank filter is dropped, so two views differing by one are the same view", () => {
  assert.deepEqual(normaliseFilters({ topicId: "t", modelId: "  ", regionId: undefined }), { topicId: "t" });
  assert.equal(segmentId("p", { topicId: "t" }), segmentId("p", { topicId: "t", modelId: "" }));
  assert.notEqual(segmentId("p", { topicId: "t" }), segmentId("p", { topicId: "u" }));
});

test("the query is what the page already sends, so a saved view is just a link", () => {
  assert.equal(segmentQuery({ topicId: "t", regionId: "in" }), "?topicId=t&regionId=in");
  assert.equal(segmentQuery({}), "");
  assert.ok(segmentQuery({ modelId: "a b/c" }).includes("a%20b%2Fc"));
});

test("saving the unfiltered view is refused, because it is a button that does nothing", async () => {
  const { service, projectId, cleanup } = await harness();
  try {
    await assert.rejects(() => service.save(projectId, { name: "Everything", filters: {} }), SegmentError);
    await assert.rejects(() => service.save(projectId, { name: "  ", filters: { topicId: "t" } }), SegmentError);
  } finally {
    await cleanup();
  }
});

test("saving the same filters again renames rather than duplicating", async () => {
  const { service, projectId, cleanup } = await harness();
  try {
    await service.save(projectId, { name: "India", filters: { regionId: "in" } });
    const set = await service.save(projectId, { name: "India, all models", filters: { regionId: "in" } });
    assert.equal(set.segments.length, 1);
    assert.equal(set.segments[0]?.name, "India, all models");
  } finally {
    await cleanup();
  }
});

test("a removed view is gone and the others stay", async () => {
  const { service, projectId, cleanup } = await harness();
  try {
    await service.save(projectId, { name: "A", filters: { regionId: "in" } });
    await service.save(projectId, { name: "B", filters: { regionId: "us" } });
    const before = await service.get(projectId);
    const after = await service.remove(projectId, [before.segments[0]!.id]);
    assert.deepEqual(after.segments.map((row) => row.name), ["B"]);
  } finally {
    await cleanup();
  }
});
