import { buildTopicInsights, type TopicInsights } from "./topic-insights.js";
import type { CompetitorService } from "./competitor-set.js";
import type { PromptAnswer } from "./prompt-run-schema.js";
import type { PromptRunService } from "./prompt-run-service.js";
import type { TopicService } from "./topic-service.js";
import type { PersonaService } from "./persona.js";

// One composition of the standing, so a route that needs it does not assemble
// its own and drift from the one the dashboard shows.

export async function projectInsights(input: {
  projectId: string;
  topics: TopicService;
  runs: PromptRunService;
  competitors: CompetitorService;
  personas?: PersonaService | undefined;
  /** Narrows the answers to a slice of the archive. Everything when omitted. */
  slice?: ((answers: PromptAnswer[]) => PromptAnswer[]) | undefined;
}): Promise<TopicInsights> {
  const [set, answers, runList, identity] = await Promise.all([
    input.topics.get(input.projectId),
    input.runs.listAnswers(input.projectId),
    input.runs.listRuns(input.projectId),
    input.topics.targetIdentity(input.projectId).catch(() => null),
  ]);
  const rivals = await input.competitors.get(input.projectId).catch(() => null);
  const personas = input.personas ? await input.personas.get(input.projectId).catch(() => null) : null;
  return buildTopicInsights({
    projectId: input.projectId,
    set,
    answers: input.slice ? input.slice(answers) : answers,
    runs: runList,
    identityCaveat: identity?.caveat || null,
    competitors: rivals?.competitors,
    personaLabels: new Map((personas?.personas || []).map((row) => [row.id, row.label])),
  });
}
