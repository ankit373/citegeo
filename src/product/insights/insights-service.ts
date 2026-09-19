import type { ProductProjectService } from "../projects/project-service.js";
import type { ProductRecognitionRunService } from "../recognition/recognition-service.js";
import type { RecognitionArchive } from "../recognition/recognition-schema.js";
import { buildBrandInsights, buildCitationGap } from "./brand-insights.js";
import { buildClaimAudit } from "./claim-audit.js";
import { buildFanoutAnalysis } from "./query-fanout.js";
import type { FanoutAnalysis } from "./query-fanout.js";
import type { AnswerClaims, ClaimAudit, ClaimField } from "./claim-audit.js";
import type { BrandInsights, CitationGapEntry, InsightAnswer } from "./brand-insights.js";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function sameDomain(host: string, domain: string): boolean {
  const left = host.toLocaleLowerCase().startsWith("www.") ? host.slice(4).toLocaleLowerCase() : host.toLocaleLowerCase();
  const right = domain.toLocaleLowerCase().startsWith("www.") ? domain.slice(4).toLocaleLowerCase() : domain.toLocaleLowerCase();
  return left === right;
}

/** Paths of cited URLs that belong to the project's own domain. */
export function citedPathsForDomain(urls: string[], domain: string): string[] {
  const paths = new Set<string>();
  for (const url of urls) {
    try {
      const parsed = new URL(url);
      if (!sameDomain(parsed.hostname, domain)) continue;
      const path = parsed.pathname || "/";
      paths.add(path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path);
    } catch {
      continue;
    }
  }
  return [...paths].sort();
}

/** Flattens one stored archive into the narrow shape the analytics read. */
export function answerFromArchive(input: {
  archive: RecognitionArchive;
  modelId: string;
  displayName: string;
}): InsightAnswer {
  const { archive } = input;
  const cited = new Set<string>();
  for (const citation of archive.providerCitations) {
    const domain = citation.domain || hostOf(citation.url);
    if (domain) cited.add(domain);
  }
  for (const mentioned of archive.answerMentionedUrls) {
    const domain = mentioned.domain || hostOf(mentioned.url);
    if (domain) cited.add(domain);
  }
  return {
    modelRunId: archive.result.modelRunId,
    modelId: input.modelId,
    displayName: input.displayName,
    answered: archive.result.analysisStatus !== "analysis_failed",
    recognized: archive.result.domainRecognition === "recognized",
    brandNamed: Boolean(archive.result.recognizedBrand.value),
    productCategory: archive.result.productCategory.value,
    competitors: archive.competitors.map((competitor) => ({ name: competitor.name, domain: competitor.domain })),
    citedDomains: [...cited],
  };
}

const CLAIM_TYPE_TO_FIELD: Record<string, ClaimField> = {
  recognized_brand: "brand",
  business_description: "businessDescription",
  product_category: "productCategory",
};

/** Which asserted fields had at least one citation linked to them. */
export function claimsFromArchive(input: {
  archive: RecognitionArchive;
  modelId: string;
  displayName: string;
}): AnswerClaims {
  const { archive } = input;
  const sourced = new Set<ClaimField>();
  for (const link of archive.claimCitationLinks) {
    const field = CLAIM_TYPE_TO_FIELD[link.claimType];
    if (field) sourced.add(field);
  }
  return {
    modelId: input.modelId,
    displayName: input.displayName,
    values: {
      brand: archive.result.recognizedBrand.value,
      businessDescription: archive.result.businessDescription.value,
      productCategory: archive.result.productCategory.value,
    },
    sourcedFields: [...sourced],
  };
}

export interface ProjectInsights {
  projectId: string;
  domain: string;
  runsConsidered: number;
  insights: BrandInsights;
  citationGap: CitationGapEntry[];
  claimAudit: ClaimAudit;
  fanout: FanoutAnalysis;
  /** Own-domain paths any answer cited, for correlating against crawler logs. */
  citedPaths: string[];
}

export class ProductInsightsService {
  // Derived entirely from stored evidence, so the result cannot change while
  // the run set does not. The Visibility page asks twice per visit, once for
  // the analytics and once for the crawler correlation, and reading every
  // archive again for the second answer is pure waste.
  private cached: { key: string; value: ProjectInsights } | null = null;

  constructor(
    private readonly projects: ProductProjectService,
    private readonly recognition: ProductRecognitionRunService,
  ) {}

  /** Changes whenever a run is added or one still in flight moves on. */
  private signature(projectId: string, runs: Array<{ id: string; status: string; successfulModelRunCount: number; failedModelRunCount: number }>): string {
    const parts = runs.map((run) => `${run.id}:${run.status}:${run.successfulModelRunCount}:${run.failedModelRunCount}`);
    return `${projectId}|${runs.length}|${parts.join(",")}`;
  }

  /**
   * Reads every archived answer for a project. Runs are independent evidence,
   * so they are pooled rather than only reporting the newest one.
   */
  async build(projectId: string, options: { runLimit?: number } = {}): Promise<ProjectInsights> {
    const project = await this.projects.get(projectId);
    const runs = await this.recognition.list(projectId);
    const key = `${this.signature(projectId, runs)}|${options.runLimit ?? "all"}`;
    if (this.cached && this.cached.key === key) return this.cached.value;
    const considered = options.runLimit ? runs.slice(0, options.runLimit) : runs;
    const answers: InsightAnswer[] = [];
    const claims: AnswerClaims[] = [];
    const rawResponses: Array<{ modelId: string; raw: unknown }> = [];
    const citedUrls: string[] = [];

    for (const run of considered) {
      const detail = await this.recognition.get(projectId, run.id);
      for (const modelRun of detail.modelRuns) {
        const modelDetail = await this.recognition.getModelRun(projectId, run.id, modelRun.id);
        if (!modelDetail.archive) continue;
        const identity = {
          modelId: modelRun.modelSnapshot.modelId,
          displayName: modelRun.modelSnapshot.displayName,
        };
        answers.push(answerFromArchive({ archive: modelDetail.archive, ...identity }));
        claims.push(claimsFromArchive({ archive: modelDetail.archive, ...identity }));
        for (const citation of modelDetail.archive.providerCitations) citedUrls.push(citation.url);
        for (const mentioned of modelDetail.archive.answerMentionedUrls) citedUrls.push(mentioned.url);
        for (const attempt of modelDetail.attempts) {
          if (attempt.rawProviderResponse !== undefined) {
            rawResponses.push({ modelId: identity.modelId, raw: attempt.rawProviderResponse });
          }
        }
      }
    }

    const value: ProjectInsights = {
      projectId,
      domain: project.normalizedDomain,
      runsConsidered: considered.length,
      insights: buildBrandInsights({ target: project.normalizedDomain, brandNames: [project.name], answers }),
      citationGap: buildCitationGap({ target: project.normalizedDomain, answers }),
      claimAudit: buildClaimAudit({ answers: claims }),
      fanout: buildFanoutAnalysis({ answers: rawResponses }),
      citedPaths: citedPathsForDomain(citedUrls, project.normalizedDomain),
    };
    this.cached = { key, value };
    return value;
  }
}
