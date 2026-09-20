import type { ProductProjectFileStore } from "../projects/project-store.js";
import { getJson, putJson } from "../storage/object-store.js";
import type { ProductProjectService } from "../projects/project-service.js";
import type { StructuredAsk } from "../topics/topic-service.js";
import { readStructuredValue } from "../topics/structured-value.js";
import {
  brandProfilePrompt,
  brandProfileResponseSchema,
  parseBrandProfile,
  BRAND_PROFILE_SCHEMA_NAME,
  BRAND_PROFILE_TOOL_DESCRIPTION,
  type BrandProfile,
} from "./brand-profile-protocol.js";
import { readSite, siteDigest, type SiteRead } from "./site-read.js";

export class BrandProfileUnavailableError extends Error {}

export interface StoredBrandProfile extends BrandProfile {
  projectId: string;
  domain: string;
  /** Which pages it was read from, so a wrong profile can be traced to them. */
  sources: string[];
  builtAt: string;
}

export class BrandProfileFileStore {
  constructor(private readonly projects: ProductProjectFileStore) {}

  private key(projectId: string): string {
    return this.projects.keyFor(projectId, "brand-profile.json");
  }

  async load(projectId: string): Promise<StoredBrandProfile | null> {
    return getJson<StoredBrandProfile>(this.projects.objects, this.key(projectId));
  }

  async save(profile: StoredBrandProfile): Promise<void> {
    await putJson(this.projects.objects, this.key(profile.projectId), profile);
  }
}

/** Reads the site and asks a model what the company is, so a prompt set can be
 * generated for any domain without anyone typing a description. */
export class BrandProfileService {
  constructor(
    private readonly store: BrandProfileFileStore,
    private readonly projects: ProductProjectService,
    private readonly read: (domain: string) => Promise<SiteRead> = (domain) => readSite(domain),
  ) {}

  async get(projectId: string): Promise<StoredBrandProfile | null> {
    return this.store.load(projectId);
  }

  async build(projectId: string, ask: StructuredAsk): Promise<StoredBrandProfile> {
    const project = await this.projects.get(projectId);
    if (!project) throw new BrandProfileUnavailableError(`Project ${projectId} does not exist.`);

    const site = await this.read(project.normalizedDomain);
    if (!site.reachable) throw new BrandProfileUnavailableError(site.detail || "The site could not be read.");

    const raw = await ask({
      projectId,
      prompt: brandProfilePrompt({
        brandName: project.brandName,
        domain: project.normalizedDomain,
        digest: siteDigest(site),
      }),
      schemaName: BRAND_PROFILE_SCHEMA_NAME,
      schemaDescription: BRAND_PROFILE_TOOL_DESCRIPTION,
      schema: brandProfileResponseSchema,
    });

    const profile = parseBrandProfile(readStructuredValue(raw));
    if (profile.analysisStatus !== "completed") {
      const reasons = profile.unknowns.length ? ` It could not establish: ${profile.unknowns.join(" ")}` : "";
      throw new BrandProfileUnavailableError(
        `The pages at ${site.domain} did not say clearly enough what this company does.${reasons}`,
      );
    }

    const stored: StoredBrandProfile = {
      ...profile,
      projectId,
      domain: site.domain,
      sources: site.pages.map((page) => page.url),
      builtAt: new Date().toISOString(),
    };
    await this.store.save(stored);
    return stored;
  }
}
