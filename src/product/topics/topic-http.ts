import { buildTopicInsights, type TopicInsights } from "./topic-insights.js";
import { isPromptIntent } from "./topic-schema.js";
import { REGIONS, REGION_CAVEAT } from "./region.js";
import { LANGUAGES } from "./language.js";
import { promptExportNames, promptExportTable } from "./topic-export.js";
import type { PromptRunService } from "./prompt-run-service.js";
import type { PromptScheduleService } from "./prompt-schedule.js";
import type { DemandReportFileStore } from "../demand/demand-store.js";
import { CORPUS_SOURCES } from "../demand/corpus-schema.js";
import type { StructuredAsk, TopicService } from "./topic-service.js";

export type TopicJsonSender = (status: number, body: unknown, contentType?: string) => void;

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function handleTopicApi(input: {
  method: string;
  route: string[];
  send: TopicJsonSender;
  topics: TopicService;
  runs: PromptRunService;
  schedule: PromptScheduleService;
  demand: DemandReportFileStore;
  ask: StructuredAsk;
  readJson: () => Promise<Record<string, unknown>>;
}): Promise<boolean> {
  const { method, route, send, topics, runs, schedule, demand, ask, readJson } = input;
  if (route[0] !== "api" || route[1] !== "projects") return false;
  const projectId = route[2];
  if (!projectId) return false;
  const tail = route.slice(3);

  // A project that does not exist is a 404: nothing failed, the question was
  // about something that is not there.
  const guard = async (run: () => Promise<unknown>, status = 400) => {
    try {
      send(200, await run());
    } catch (error) {
      send(status, { error: message(error) });
    }
  };

  if (method === "GET" && tail.length === 1 && tail[0] === "topics") {
    await guard(() => topics.get(projectId), 404);
    return true;
  }

  if (method === "POST" && tail.length === 2 && tail[0] === "topics" && tail[1] === "generate") {
    const body = await readJson();
    await guard(() => topics.generate(projectId, ask, {
      topicCount: typeof body.topicCount === "number" ? body.topicCount : undefined,
      promptsPerTopic: typeof body.promptsPerTopic === "number" ? body.promptsPerTopic : undefined,
      businessDescription: typeof body.businessDescription === "string" ? body.businessDescription : undefined,
      productCategory: typeof body.productCategory === "string" ? body.productCategory : undefined,
    }));
    return true;
  }

  if (method === "POST" && tail.length === 1 && tail[0] === "topics") {
    const body = await readJson();
    await guard(() => topics.addTopic(projectId, {
      name: typeof body.name === "string" ? body.name : "",
      description: typeof body.description === "string" ? body.description : "",
    }));
    return true;
  }

  if (method === "POST" && tail.length === 1 && tail[0] === "prompts") {
    const body = await readJson();
    const intent = body.intent;
    if (!isPromptIntent(intent)) {
      send(400, { error: "A prompt needs an intent: discovery, comparison, alternatives, brand or problem." });
      return true;
    }
    await guard(() => topics.addPrompt(projectId, {
      topicId: typeof body.topicId === "string" ? body.topicId : "",
      text: typeof body.text === "string" ? body.text : "",
      intent,
    }));
    return true;
  }

  if (method === "POST" && tail.length === 2 && tail[0] === "prompts" && tail[1] === "bulk") {
    const body = await readJson();
    const intent = body.intent;
    if (!isPromptIntent(intent)) {
      send(400, { error: "A prompt needs an intent: discovery, comparison, alternatives, brand or problem." });
      return true;
    }
    await guard(() => topics.addPrompts(projectId, {
      topicId: typeof body.topicId === "string" ? body.topicId : "",
      text: typeof body.text === "string" ? body.text : "",
      intent,
    }));
    return true;
  }

  if (method === "POST" && tail.length === 2 && tail[0] === "prompts" && tail[1] === "activate") {
    const body = await readJson();
    await guard(() => topics.activate(projectId, stringList(body.promptIds)));
    return true;
  }

  if (method === "POST" && tail.length === 2 && tail[0] === "prompts" && tail[1] === "retire") {
    const body = await readJson();
    await guard(() => topics.retire(projectId, stringList(body.promptIds)));
    return true;
  }

  if (method === "GET" && tail.length === 1 && tail[0] === "regions") {
    send(200, { regions: REGIONS, languages: LANGUAGES, caveat: REGION_CAVEAT });
    return true;
  }

  if (method === "GET" && tail.length === 1 && tail[0] === "prompt-runs") {
    await guard(() => runs.listRuns(projectId), 404);
    return true;
  }

  if (method === "POST" && tail.length === 1 && tail[0] === "prompt-runs") {
    const body = await readJson();
    const promptIds = stringList(body.promptIds);
    const regionIds = stringList(body.regionIds);
    const languageIds = stringList(body.languageIds);
    await guard(() => runs.start({
      projectId,
      promptIds: promptIds.length ? promptIds : undefined,
      regionIds: regionIds.length ? regionIds : undefined,
      languageIds: languageIds.length ? languageIds : undefined,
    }));
    return true;
  }

  if (method === "GET" && tail.length === 1 && tail[0] === "prompt-schedule") {
    await guard(() => schedule.get(projectId), 404);
    return true;
  }

  if (method === "PUT" && tail.length === 1 && tail[0] === "prompt-schedule") {
    const body = await readJson();
    const rule = body.rule && typeof body.rule === "object" ? (body.rule as Record<string, unknown>) : undefined;
    await guard(() => schedule.set(projectId, {
      enabled: body.enabled === true,
      ...(rule ? { rule: rule as never } : {}),
      regionIds: stringList(body.regionIds),
    }));
    return true;
  }

  if (method === "GET" && tail.length === 2 && tail[0] === "prompt-export") {
    try {
      const [set, answers, runList] = await Promise.all([
        topics.get(projectId),
        runs.listAnswers(projectId),
        runs.listRuns(projectId),
      ]);
      const csv = promptExportTable(buildTopicInsights({ projectId, set, answers, runs: runList }), tail[1] || "");
      // A typo is a 404 naming the tables, not an empty file that looks like no data.
      if (csv === null) send(404, { error: `Unknown export "${tail[1]}". Available: ${promptExportNames().join(", ")}.` });
      else send(200, csv, "text/csv; charset=utf-8");
    } catch (error) {
      send(404, { error: message(error) });
    }
    return true;
  }

  if (method === "GET" && tail.length === 1 && tail[0] === "prompt-demand") {
    const report = await demand.load(projectId);
    // Absent rather than empty: no report means none was built, not no demand.
    if (!report) {
      send(404, { error: "No demand report has been built for this project. See docs/prompt-demand.md.", corpora: CORPUS_SOURCES });
      return true;
    }
    send(200, report);
    return true;
  }

  if (method === "GET" && tail.length === 1 && tail[0] === "prompt-insights") {
    await guard(async (): Promise<TopicInsights> => {
      const [set, answers, runList] = await Promise.all([
        topics.get(projectId),
        runs.listAnswers(projectId),
        runs.listRuns(projectId),
      ]);
      return buildTopicInsights({ projectId, set, answers, runs: runList });
    }, 404);
    return true;
  }

  return false;
}
