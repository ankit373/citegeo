import { evaluateAlerts, type Alert } from "./alert-rules.js";
import type { PromptRun } from "../topics/prompt-run-schema.js";
import type { TopicInsights } from "../topics/topic-insights.js";
import type { TopicSet } from "../topics/topic-schema.js";

// The landing page's one job: say what to look at. Everything here is derived
// from evidence already stored, so nothing is computed twice.

export type SetupStepId = "models" | "prompts" | "run";

export interface SetupStep {
  id: SetupStepId;
  label: string;
  done: boolean;
  /** What is true right now, rather than an instruction. */
  detail: string;
}

export interface HomeSummary {
  projectId: string;
  domain: string;
  /** Null until something has been answered. Never a zero standing in for it. */
  score: number | null;
  change: number | null;
  rank: number | null;
  rivals: number;
  answers: number;
  alerts: Alert[];
  /** Where the work is, worst first. */
  weakestTopics: Array<{ topicId: string; name: string; score: number | null; rank: number | null }>;
  absentFrom: Array<{ promptId: string; text: string; namedInstead: string[] }>;
  lastRun: { id: string; status: string; at: string; completed: number; requested: number } | null;
  setup: SetupStep[];
  /** Every step done. */
  ready: boolean;
  /** True only when there is nothing measured to show instead. */
  showSetupOnly: boolean;
}

export function buildHomeSummary(input: {
  projectId: string;
  domain: string;
  set: TopicSet;
  insights: TopicInsights;
  runs: PromptRun[];
  modelCount: number;
}): HomeSummary {
  const { insights, set } = input;
  const activePrompts = set.prompts.filter((prompt) => prompt.status === "active").length;
  const latest = input.runs[0];

  const setup: SetupStep[] = [
    {
      id: "models",
      label: "Choose models",
      done: input.modelCount > 0,
      detail: input.modelCount ? `${input.modelCount} saved` : "None saved yet",
    },
    {
      id: "prompts",
      label: "Track some questions",
      done: activePrompts > 0,
      detail: activePrompts ? `${activePrompts} tracked` : set.prompts.length ? `${set.prompts.length} proposed, none tracked` : "None yet",
    },
    {
      id: "run",
      label: "Run them",
      done: insights.answers > 0,
      detail: insights.answers ? `${insights.answers} answer(s) archived` : "No answers yet",
    },
  ];

  return {
    projectId: input.projectId,
    domain: input.domain,
    score: insights.overall.score,
    change: insights.trend.change,
    rank: insights.rank,
    rivals: insights.leaderboard.filter((row) => !row.isTarget).length,
    answers: insights.answers,
    alerts: evaluateAlerts(insights),
    weakestTopics: insights.topics.slice(0, 4).map((topic) => ({
      topicId: topic.topicId,
      name: topic.name,
      score: topic.score.score,
      rank: topic.rank,
    })),
    absentFrom: insights.absentFrom.slice(0, 5).map((row) => ({
      promptId: row.promptId,
      text: row.text,
      namedInstead: row.ahead.slice(0, 4).map((entity) => entity.name),
    })),
    lastRun: latest
      ? {
          id: latest.id,
          status: latest.status,
          at: latest.startedAt,
          completed: latest.answersCompleted,
          requested: latest.answersRequested,
        }
      : null,
    setup,
    ready: setup.every((step) => step.done),
    // A project with answers has something to say even if a step is undone,
    // and burying real findings behind a checklist helps nobody.
    showSetupOnly: insights.answers === 0,
  };
}
