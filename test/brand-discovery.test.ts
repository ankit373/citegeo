import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { siteDigest } from "../src/product/discovery/site-read.js";
import { brandProfilePrompt, parseBrandProfile } from "../src/product/discovery/brand-profile-protocol.js";
import { BrandProfileFileStore, BrandProfileService, BrandProfileUnavailableError } from "../src/product/discovery/brand-profile-service.js";
import { ProductProjectFileStore } from "../src/product/projects/project-store.js";
import { ProductProjectService } from "../src/product/projects/project-service.js";
import type { SiteRead } from "../src/product/discovery/site-read.js";

const GOOD_READ: SiteRead = {
  domain: "example.com", reachable: true, detail: null,
  pages: [{ url: "https://example.com", title: "Example", description: "A screener", headings: ["Screen stocks"], text: "We screen stocks." }],
};

async function harness(read: (domain: string) => Promise<SiteRead>) {
  const dir = await mkdtemp(join(tmpdir(), "citegeo-profile-"));
  const store = new ProductProjectFileStore(dir);
  const projects = new ProductProjectService(store);
  const project = await projects.createDraft({ name: "Example", primaryDomain: "example.com", brandName: "Example" });
  const service = new BrandProfileService(new BrandProfileFileStore(store), projects, read);
  return { service, projectId: project.id, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

const COMPLETE = {
  analysisStatus: "completed",
  businessDescription: "A stock screener for Indian equities.",
  productCategory: "Stock screener",
  audience: "Retail investors",
  markets: ["India"],
  features: ["Screening"],
  competitors: [{ name: "Rival", domain: "rival.com" }],
  unknowns: [],
};

test("a site that cannot be read is said so, not profiled anyway", async () => {
  const { service, projectId, cleanup } = await harness(async () => ({
    domain: "example.com", reachable: false, pages: [], detail: "Nothing readable was served.",
  }));
  try {
    await assert.rejects(() => service.build(projectId, async () => COMPLETE), BrandProfileUnavailableError);
    assert.equal(await service.get(projectId), null, "a failed read must not leave a profile behind");
  } finally {
    await cleanup();
  }
});

test("a profile with no description describes nothing, whatever it claims", () => {
  const parsed = parseBrandProfile({ ...COMPLETE, businessDescription: "" });
  assert.equal(parsed.analysisStatus, "unknown");
  assert.equal(parsed.businessDescription, null);
});

test("a model that cannot tell what the company does saves nothing and says why", async () => {
  const { service, projectId, cleanup } = await harness(async () => GOOD_READ);
  try {
    await assert.rejects(
      () => service.build(projectId, async () => ({ ...COMPLETE, analysisStatus: "unknown", businessDescription: null, unknowns: ["The pages are a login wall."] })),
      (error: Error) => error.message.includes("login wall"),
    );
    assert.equal(await service.get(projectId), null);
  } finally {
    await cleanup();
  }
});

test("a built profile records which pages it came from, so a wrong one is traceable", async () => {
  const { service, projectId, cleanup } = await harness(async () => GOOD_READ);
  try {
    const profile = await service.build(projectId, async () => COMPLETE);
    assert.deepEqual(profile.sources, ["https://example.com"]);
    assert.equal(profile.productCategory, "Stock screener");
    assert.deepEqual(profile.markets, ["India"]);
    assert.equal((await service.get(projectId))?.businessDescription, profile.businessDescription);
  } finally {
    await cleanup();
  }
});

test("a competitor with no name is dropped rather than stored as blank", () => {
  const parsed = parseBrandProfile({ ...COMPLETE, competitors: [{ name: "", domain: "x.com" }, { name: "Real", domain: null }] });
  assert.deepEqual(parsed.competitors, [{ name: "Real", domain: null }]);
});

test("the digest carries the pages and is capped so it cannot crowd out the instructions", () => {
  const long: SiteRead = {
    ...GOOD_READ,
    pages: [{ url: "https://example.com", title: "T", description: "D", headings: ["H"], text: "x".repeat(20000) }],
  };
  const digest = siteDigest(long, 500);
  assert.equal(digest.length, 500);
  assert.ok(siteDigest(GOOD_READ).includes("https://example.com"));
  assert.ok(siteDigest(GOOD_READ).includes("Screen stocks"));
});

test("the prompt tells the model to use the pages and not what it already knows", () => {
  const prompt = brandProfilePrompt({ brandName: "Example", domain: "example.com", digest: "Pages here" });
  assert.ok(prompt.includes("Do not use anything you already know"));
  assert.ok(prompt.includes("An absent competitor list is a correct answer"));
  assert.ok(prompt.includes("Pages here"));
});
