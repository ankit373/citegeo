// The shapes the API actually returns, written down once. They were inferred
// from empty literals before, so every array was never[] and every property
// read off one was an error the compiler could not have reported usefully.

export type LoadState = "idle" | "loading" | "ready" | "error";

export interface Notice { text: string; kind: string }

export interface ProjectRow {
  id: string;
  name: string;
  normalizedDomain: string;
  primaryDomain?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ScoreShape {
  answers: number;
  appearances: number;
  presenceRate: number | null;
  prominence: number | null;
  sentiment: number | null;
  score: number | null;
  weights?: { prominenceFloor: number; sentimentFloor: number };
}

export interface EntityRow {
  name: string;
  domain: string | null;
  isTarget: boolean;
  isTracked?: boolean;
  appearances: number;
  shareOfAnswers: number | null;
  prominence: number | null;
  positive: number;
  negative: number;
}

export interface PromptRow {
  id: string;
  topicId: string;
  text: string;
  intent: string;
  measuresVisibility: boolean;
  status: string;
}

export interface TopicRow { id: string; name: string; description: string }
export interface TopicSetShape { topics: TopicRow[]; prompts: PromptRow[] }

export interface PromptStandingRow {
  promptId: string;
  topicId: string;
  text: string;
  intent: string;
  measuresVisibility: boolean;
  score: ScoreShape;
  rank: number | null;
  ahead: EntityRow[];
}

export interface ModelStandingRow { providerId: string; modelId: string; displayName: string; score: ScoreShape }
export interface SplitRow { label: string; score: ScoreShape; rank: number | null; regionId?: string; languageId?: string; personaId?: string }
export interface TopicStandingRow { topicId: string; name: string; description: string; score: ScoreShape; rank: number | null; prompts: PromptStandingRow[] }

export interface TrendShape {
  points: Array<{ at: string; score: number | null; answers: number }>;
  change: number | null;
  since: string | null;
  /** One line per brand across the runs. Absent until the server sends it. */
  rivals?: Array<{ name: string; isTarget: boolean; points: Array<{ at: string; share: number }> }>;
}

export interface InsightsShape {
  answers: number;
  answersFailed: number;
  overall: ScoreShape;
  rank: number | null;
  weights: { prominenceFloor: number; sentimentFloor: number };
  leaderboard: EntityRow[];
  topics: TopicStandingRow[];
  byModel: ModelStandingRow[];
  absentFrom: PromptStandingRow[];
  citationsUnavailable: boolean;
  trend: TrendShape;
  byRegion: SplitRow[];
  byLanguage: SplitRow[];
  byPersona: SplitRow[];
  regionCaveat: string;
  identityCaveat: string | null;
  trackedRivals: EntityRow[];
}

export interface AnswerRow {
  id: string;
  promptId: string;
  promptText: string;
  modelId: string;
  modelDisplayName: string;
  regionId: string;
  languageId: string;
  status: string;
  text: string;
  mentions: Array<{ name: string; domain: string | null; isTarget: boolean; recommendation: string; mentionQuote: string | null; firstMentionOffset: number | null; firstMentionState: string }>;
  citationUrls: string[];
  errorCode: string | null;
  errorMessage: string | null;
  latencyMs: number | null;
  createdAt: string;
}

export interface RunRow {
  id: string;
  status: string;
  answersRequested: number;
  answersCompleted: number;
  answersFailed: number;
  startedAt: string;
  completedAt: string | null;
  currentPromptText?: string;
  currentModelId?: string;
  skippedModels?: Array<{ modelId: string; reason: string }>;
}

export interface CatalogModel {
  modelId: string;
  displayName: string;
  providerId?: string;
  available: boolean;
  unavailableReason?: string;
  nativeWebSearchSupported: boolean;
  releasedAt?: string | number | null;
  vendor?: string;
}

export interface SelectionRow {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  webSearchMode: string;
  nativeWebSearchSupported: boolean;
  available: boolean;
  enabled: boolean;
}

export interface Panel { kind?: string; promptId: string; title: string; runId?: string }

export type Payload = Record<string, unknown>;

/**
 * A server payload this module has not been given a shape for yet. Named so
 * the gap is countable: grep for it and you have the remaining work.
 */
export type Unshaped = any;
