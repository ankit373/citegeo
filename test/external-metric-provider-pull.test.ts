import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ExternalMetricProviderPullService } from "../src/product/external-metrics/provider-pull-service.js";
import { ExternalMetricSnapshotStore } from "../src/product/external-metrics/snapshot-store.js";
import { ProductProjectService } from "../src/product/projects/project-service.js";
import { ProductProjectFileStore } from "../src/product/projects/project-store.js";

async function withProject(callback: (input: {
  projectId: string;
  projects: ProductProjectService;
  snapshots: ExternalMetricSnapshotStore;
}) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "citegeo-external-metrics-"));
  try {
    const store = new ProductProjectFileStore(root);
    const projects = new ProductProjectService(store);
    const project = await projects.createDraft({ primaryDomain: "https://example.com" });
    await callback({ projectId: project.id, projects, snapshots: new ExternalMetricSnapshotStore(store) });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function withEnv<T>(values: Record<string, string>, callback: () => Promise<T>): Promise<T> {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  try {
    return await callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("Ahrefs pull preserves provider scope and stores an immutable estimate snapshot", async () => {
  await withEnv({ AHREFS_COUNTRY: "us" }, async () => withProject(async ({ projectId, projects, snapshots }) => {
    let requested = "";
    const service = new ExternalMetricProviderPullService(
      projects,
      snapshots,
      async () => "secret",
      async (input) => {
        requested = String(input);
        return new Response(JSON.stringify({ metrics: { org_traffic: 120, org_keywords: 50, org_keywords_1_3: 12, org_cost: 42.5 } }));
      },
    );
    const snapshot = await service.pull(projectId, "ahrefs");
    const requestUrl = new URL(requested);
    assert.equal(requestUrl.origin, "https://api.ahrefs.com");
    assert.equal(requestUrl.searchParams.get("target"), "example.com");
    assert.equal(requestUrl.searchParams.get("country"), "us");
    assert.equal(snapshot.values.estimated_organic_traffic, 120);
    assert.equal(snapshot.values.estimated_organic_traffic_value_usd, 42.5);
    assert.deepEqual(snapshot.sourceScope, { target: "example.com", country: "us", mode: "domain", trafficMode: "adaptive" });
    assert.equal((await snapshots.list(projectId))[0]?.id, snapshot.id);
  }));
});

test("Semrush pull parses the requested Domain Overview columns without treating estimates as analytics", async () => {
  await withEnv({ SEMRUSH_DATABASE: "us" }, async () => withProject(async ({ projectId, projects, snapshots }) => {
    const service = new ExternalMetricProviderPullService(
      projects,
      snapshots,
      async () => "secret",
      async () => new Response("Domain;Rank;Organic Keywords;Organic Traffic;Organic Cost\nexample.com;100;30;40;50\n"),
    );
    const snapshot = await service.pull(projectId, "semrush");
    assert.equal(snapshot.values.domain_rank, 100);
    assert.equal(snapshot.values.organic_keywords, 30);
    assert.equal(snapshot.values.estimated_organic_traffic, 40);
    assert.equal(snapshot.values.estimated_organic_traffic_cost, 50);
    assert.deepEqual(snapshot.sourceScope, { target: "example.com", database: "us" });
  }));
});
