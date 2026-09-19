import type { ProductProjectService } from "../projects/project-service.js";
import type { ProductRecognitionRunService } from "../recognition/recognition-service.js";
import type { RecognitionArchive } from "../recognition/recognition-schema.js";
import { buildBrandInsights, buildCitationGap } from "./brand-insights.js";
import { buildClaimAudit } from "./claim-audit.js";
import type { AnswerClaims, ClaimAudit, ClaimField } from "./claim-audit.js";
import type { BrandInsights, CitationGapEntry, InsightAnswer } from "./brand-insights.js";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
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
}

export class ProductInsightsService {
  constructor(
    private readonly projects: ProductProjectService,
    private readonly recognition: ProductRecognitionRunService,
  ) {}

  /**
   * Reads every archived answer for a project. Runs are independent evidence,
   * so they are pooled rather than only reporting the newest one.
   */
  async build(projectId: string, options: { runLimit?: number } = {}): Promise<ProjectInsights> {
    const project = await this.projects.get(projectId);
    const runs = await this.recognition.list(projectId);
    const considered = options.runLimit ? runs.slice(0, options.runLimit) : runs;
    const answers: InsightAnswer[] = [];
    const claims: AnswerClaims[] = [];

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
      }
    }

    return {
      projectId,
      domain: project.normalizedDomain,
      runsConsidered: considered.length,
      insights: buildBrandInsights({ target: project.normalizedDomain, brandNames: [project.name], answers }),
      citationGap: buildCitationGap({ target: project.normalizedDomain, answers }),
      claimAudit: buildClaimAudit({ answers: claims }),
    };
  }
}
