// The analytics Profound sells, computed from evidence this product already
// stores: visibility, share of voice, citation sources and the categories the
// models actually use. Nothing here calls a model or estimates a missing value.
// A metric with no evidence behind it stays null rather than becoming zero.

/** One parsed model answer, flattened from a recognition archive. */
export interface InsightAnswer {
  modelRunId: string;
  modelId: string;
  displayName: string;
  /** The answer parsed, so it can count towards a denominator. */
  answered: boolean;
  /** The model said it recognised the domain. */
  recognized: boolean;
  /** The model named the brand, whether or not it claimed recognition. */
  brandNamed: boolean;
  productCategory: string | null;
  competitors: Array<{ name: string; domain: string | null }>;
  /** Domains from provider citations and URLs written into the answer body. */
  citedDomains: string[];
}

export interface ModelVisibility {
  modelId: string;
  displayName: string;
  answered: number;
  recognized: number;
  /** null when the model never produced a parsable answer. */
  score: number | null;
}

export interface VoiceShare {
  name: string;
  domain: string | null;
  /** Answers that named this brand. */
  mentions: number;
  /** Share of all brand mentions, 0 to 1, or null when no competitor was named. */
  share: number | null;
}

export interface CitedDomain {
  domain: string;
  /** Distinct answers that cited this domain. */
  answers: number;
  /** True when the domain is the project's own. */
  isTarget: boolean;
  models: string[];
}

export interface CategoryTheme {
  value: string;
  count: number;
}

export interface BrandInsights {
  target: string;
  answered: number;
  visibility: {
    recognized: number;
    answered: number;
    /** null when nothing answered, so an empty run never reads as 0% visibility. */
    score: number | null;
    byModel: ModelVisibility[];
  };
  shareOfVoice: {
    target: VoiceShare;
    competitors: VoiceShare[];
  };
  citations: {
    answersWithCitations: number;
    targetCitedIn: number;
    domains: CitedDomain[];
  };
  categories: CategoryTheme[];
}

function normaliseDomain(value: string): string {
  let host = value.trim().toLocaleLowerCase();
  if (host.startsWith("www.")) host = host.slice(4);
  while (host.endsWith("/")) host = host.slice(0, -1);
  return host;
}

function normaliseName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function rank<T extends { answers?: number; mentions?: number }>(left: T, right: T): number {
  const leftValue = left.answers ?? left.mentions ?? 0;
  const rightValue = right.answers ?? right.mentions ?? 0;
  return rightValue - leftValue;
}

export function buildBrandInsights(input: {
  target: string;
  brandNames?: string[] | undefined;
  answers: InsightAnswer[];
}): BrandInsights {
  const target = normaliseDomain(input.target);
  const answers = input.answers.filter((answer) => answer.answered);

  // Visibility, overall and per model.
  const perModel = new Map<string, ModelVisibility>();
  for (const answer of answers) {
    const existing = perModel.get(answer.modelId) || {
      modelId: answer.modelId,
      displayName: answer.displayName,
      answered: 0,
      recognized: 0,
      score: null,
    };
    existing.answered += 1;
    if (answer.recognized) existing.recognized += 1;
    perModel.set(answer.modelId, existing);
  }
  const byModel = [...perModel.values()].map((row) => ({
    ...row,
    score: row.answered ? row.recognized / row.answered : null,
  })).sort((left, right) => (right.score ?? -1) - (left.score ?? -1));
  const recognized = answers.filter((answer) => answer.recognized).length;

  // Share of voice. Each answer counts a brand once, however often it is named.
  const targetMentions = answers.filter((answer) => answer.brandNamed || answer.recognized).length;
  const competitorCounts = new Map<string, { name: string; domain: string | null; mentions: number }>();
  for (const answer of answers) {
    const seen = new Set<string>();
    for (const competitor of answer.competitors) {
      const key = normaliseName(competitor.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const existing = competitorCounts.get(key) || { name: competitor.name, domain: competitor.domain, mentions: 0 };
      existing.mentions += 1;
      if (!existing.domain && competitor.domain) existing.domain = competitor.domain;
      competitorCounts.set(key, existing);
    }
  }
  const totalMentions = targetMentions + [...competitorCounts.values()].reduce((sum, row) => sum + row.mentions, 0);
  // A share needs something to share with. With no competitor named, reporting
  // 100% would say the brand dominates a conversation nobody had.
  const comparable = competitorCounts.size > 0 && totalMentions > 0;
  const shareOf = (mentions: number) => (comparable ? mentions / totalMentions : null);

  // Citation sources, counted once per answer so a repeated citation in one
  // answer cannot inflate a domain's apparent reach.
  const citedDomains = new Map<string, { domain: string; answers: number; models: Set<string> }>();
  let answersWithCitations = 0;
  let targetCitedIn = 0;
  for (const answer of answers) {
    const unique = new Set(answer.citedDomains.map(normaliseDomain).filter((domain) => domain.length > 0));
    if (unique.size) answersWithCitations += 1;
    if (unique.has(target)) targetCitedIn += 1;
    for (const domain of unique) {
      const existing = citedDomains.get(domain) || { domain, answers: 0, models: new Set<string>() };
      existing.answers += 1;
      existing.models.add(answer.modelId);
      citedDomains.set(domain, existing);
    }
  }

  // Categories the models actually used, which is how they describe the space.
  const categories = new Map<string, CategoryTheme>();
  for (const answer of answers) {
    const value = answer.productCategory?.trim();
    if (!value) continue;
    const key = normaliseName(value);
    const existing = categories.get(key) || { value, count: 0 };
    existing.count += 1;
    categories.set(key, existing);
  }

  return {
    target,
    answered: answers.length,
    visibility: {
      recognized,
      answered: answers.length,
      score: answers.length ? recognized / answers.length : null,
      byModel,
    },
    shareOfVoice: {
      target: {
        name: input.brandNames?.[0] || input.target,
        domain: target,
        mentions: targetMentions,
        share: shareOf(targetMentions),
      },
      competitors: [...competitorCounts.values()]
        .map((row) => ({ name: row.name, domain: row.domain, mentions: row.mentions, share: shareOf(row.mentions) }))
        .sort(rank),
    },
    citations: {
      answersWithCitations,
      targetCitedIn,
      domains: [...citedDomains.values()]
        .map((row) => ({ domain: row.domain, answers: row.answers, isTarget: row.domain === target, models: [...row.models].sort() }))
        .sort(rank),
    },
    categories: [...categories.values()].sort((left, right) => right.count - left.count),
  };
}

export interface CitationGapEntry {
  domain: string;
  /** Answers citing this domain that also named a competitor. */
  answers: number;
  competitors: string[];
  models: string[];
}

/**
 * Domains the models cite while naming a competitor, that never appear in an
 * answer naming the target. These are the places the brand is absent from,
 * which is the shortest actionable list this evidence can produce.
 */
export function buildCitationGap(input: { target: string; answers: InsightAnswer[] }): CitationGapEntry[] {
  const target = normaliseDomain(input.target);
  const answers = input.answers.filter((answer) => answer.answered);
  const citedWithTarget = new Set<string>();
  const gap = new Map<string, { domain: string; answers: number; competitors: Set<string>; models: Set<string> }>();

  for (const answer of answers) {
    const domains = new Set(answer.citedDomains.map(normaliseDomain).filter((domain) => domain.length > 0 && domain !== target));
    if (answer.brandNamed || answer.recognized) {
      for (const domain of domains) citedWithTarget.add(domain);
    }
  }

  for (const answer of answers) {
    if (!answer.competitors.length) continue;
    const domains = new Set(answer.citedDomains.map(normaliseDomain).filter((domain) => domain.length > 0 && domain !== target));
    for (const domain of domains) {
      if (citedWithTarget.has(domain)) continue;
      const existing = gap.get(domain) || { domain, answers: 0, competitors: new Set<string>(), models: new Set<string>() };
      existing.answers += 1;
      existing.models.add(answer.modelId);
      for (const competitor of answer.competitors) existing.competitors.add(competitor.name);
      gap.set(domain, existing);
    }
  }

  return [...gap.values()]
    .map((row) => ({ domain: row.domain, answers: row.answers, competitors: [...row.competitors].sort(), models: [...row.models].sort() }))
    .sort((left, right) => right.answers - left.answers);
}
