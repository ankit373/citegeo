import { domainLabel, tokenize } from "./prompt-identity.js";
import type { AnswerMention, PromptAnswer } from "./prompt-run-schema.js";
import { emptyScore, scoreAnswers, SCORE_WEIGHTS, type ScoreWeights, type VisibilityScore } from "./visibility-score.js";
import type { PromptIntent, TopicSet } from "./topic-schema.js";

// Everything a dashboard needs, sliced the way a person actually asks the
// question: how am I doing overall, which topics am I losing, which prompt is
// losing them, and which model is responsible.

export interface EntityStanding {
  name: string;
  domain: string | null;
  isTarget: boolean;
  /** Answers naming this entity. */
  appearances: number;
  /** appearances / answers considered. */
  shareOfAnswers: number | null;
  /** Mean position weight, 1 when always named first. Null when never resolvable. */
  prominence: number | null;
  positive: number;
  negative: number;
}

export interface ModelStanding {
  providerId: string;
  modelId: string;
  displayName: string;
  score: VisibilityScore;
}

export interface PromptStanding {
  promptId: string;
  topicId: string;
  text: string;
  intent: PromptIntent;
  /** False when the prompt names the brand, so its presence is not earned. */
  measuresVisibility: boolean;
  score: VisibilityScore;
  /** Where the brand sits against everyone named. Null when nothing was named. */
  rank: number | null;
  entitiesNamed: number;
  byModel: ModelStanding[];
  /** Who outranks the brand here, strongest first. The actionable list. */
  ahead: EntityStanding[];
}

export interface TopicStanding {
  topicId: string;
  name: string;
  description: string;
  score: VisibilityScore;
  rank: number | null;
  prompts: PromptStanding[];
}

export interface TopicInsights {
  projectId: string;
  /** Completed answers behind everything below. */
  answers: number;
  answersFailed: number;
  overall: VisibilityScore;
  rank: number | null;
  weights: ScoreWeights;
  leaderboard: EntityStanding[];
  topics: TopicStanding[];
  byModel: ModelStanding[];
  /** Prompts where the brand was never named, worst first. Where the work is. */
  absentFrom: PromptStanding[];
  /** True when no answer carried a citation, so source analysis is unavailable. */
  citationsUnavailable: boolean;
}

/**
 * What makes two mentions the same organisation. The name, because a model
 * gives ChatGPT as openai.com in one answer and chatgpt.com in the next, and
 * keying on the domain ranked one product as two rivals. A mention always
 * carries a name; the domain is optional, so it cannot be the identity.
 */
function entityKey(mention: AnswerMention): string {
  const name = tokenize(mention.name).join(" ");
  return name || (mention.domain ? domainLabel(mention.domain) : "");
}

function standings(answers: PromptAnswer[]): EntityStanding[] {
  const completed = answers.filter((answer) => answer.status === "completed");
  const rows = new Map<string, EntityStanding & { positions: number[] }>();

  for (const answer of completed) {
    const ordered = answer.mentions
      .filter((mention) => mention.firstMentionOffset !== null)
      .sort((left, right) => (left.firstMentionOffset || 0) - (right.firstMentionOffset || 0));
    // One appearance per answer per entity: a model naming a brand three times
    // in one answer has still produced one observation, not three.
    const seen = new Set<string>();
    for (const mention of answer.mentions) {
      const key = entityKey(mention);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const existing = rows.get(key) || {
        name: mention.name,
        domain: mention.domain,
        isTarget: mention.isTarget,
        appearances: 0,
        shareOfAnswers: null,
        prominence: null,
        positive: 0,
        negative: 0,
        positions: [],
      };
      existing.appearances += 1;
      if (mention.isTarget) existing.isTarget = true;
      if (!existing.domain && mention.domain) existing.domain = mention.domain;
      if (mention.recommendation === "positive") existing.positive += 1;
      if (mention.recommendation === "negative") existing.negative += 1;
      const index = ordered.findIndex((row) => row === mention);
      if (ordered.length && index >= 0) existing.positions.push(1 - index / ordered.length);
      else if (mention.firstMentionState === "unique") existing.positions.push(1);
      rows.set(key, existing);
    }
  }

  return [...rows.values()]
    .map((row) => {
      const { positions, ...rest } = row;
      return {
        ...rest,
        shareOfAnswers: completed.length ? row.appearances / completed.length : null,
        prominence: positions.length ? positions.reduce((total, value) => total + value, 0) / positions.length : null,
      };
    })
    .sort((left, right) => right.appearances - left.appearances || (right.prominence || 0) - (left.prominence || 0));
}

function rankOfTarget(rows: EntityStanding[]): number | null {
  const index = rows.findIndex((row) => row.isTarget);
  return index >= 0 ? index + 1 : null;
}

function modelStandings(answers: PromptAnswer[]): ModelStanding[] {
  const groups = new Map<string, PromptAnswer[]>();
  for (const answer of answers) {
    const key = `${answer.providerId}:${answer.modelId}`;
    groups.set(key, [...(groups.get(key) || []), answer]);
  }
  return [...groups.values()]
    .map((group) => ({
      providerId: group[0]!.providerId,
      modelId: group[0]!.modelId,
      displayName: group[0]!.modelDisplayName,
      score: scoreAnswers(group),
    }))
    .sort((left, right) => (right.score.score || 0) - (left.score.score || 0));
}

export function buildTopicInsights(input: { projectId: string; set: TopicSet; answers: PromptAnswer[] }): TopicInsights {
  const { projectId, set, answers } = input;
  const completed = answers.filter((answer) => answer.status === "completed");
  const leaderboard = standings(answers);

  const promptRows: PromptStanding[] = [];
  for (const prompt of set.prompts) {
    const mine = answers.filter((answer) => answer.promptId === prompt.id);
    if (!mine.length) continue;
    const local = standings(mine);
    const rank = rankOfTarget(local);
    promptRows.push({
      promptId: prompt.id,
      topicId: prompt.topicId,
      text: prompt.text,
      intent: prompt.intent,
      measuresVisibility: prompt.measuresVisibility,
      score: scoreAnswers(mine),
      rank,
      entitiesNamed: local.length,
      byModel: modelStandings(mine),
      // Everyone the model reached for before it reached for this brand.
      ahead: rank === null ? local.slice(0, 5) : local.slice(0, rank - 1),
    });
  }

  const topics: TopicStanding[] = [];
  for (const topic of set.topics) {
    const mine = answers.filter((answer) => answer.topicId === topic.id);
    if (!mine.length) continue;
    topics.push({
      topicId: topic.id,
      name: topic.name,
      description: topic.description,
      score: scoreAnswers(mine),
      rank: rankOfTarget(standings(mine)),
      prompts: promptRows
        .filter((row) => row.topicId === topic.id)
        .sort((left, right) => (left.score.score || 0) - (right.score.score || 0)),
    });
  }
  topics.sort((left, right) => (left.score.score || 0) - (right.score.score || 0));

  return {
    projectId,
    answers: completed.length,
    answersFailed: answers.length - completed.length,
    overall: completed.length ? scoreAnswers(answers) : emptyScore(),
    rank: rankOfTarget(leaderboard),
    weights: SCORE_WEIGHTS,
    leaderboard,
    topics,
    byModel: modelStandings(answers),
    absentFrom: promptRows
      .filter((row) => row.score.appearances === 0 && row.score.answers > 0)
      .sort((left, right) => right.score.answers - left.score.answers),
    // Stated rather than shown as an empty table, so "no sources" is never read
    // as "no sources exist". With nothing answered this is false, not true:
    // [].every() is true, which would report citations as unavailable on a
    // project that has simply never run.
    citationsUnavailable: completed.length > 0 && completed.every((answer) => answer.citationUrls.length === 0),
  };
}
