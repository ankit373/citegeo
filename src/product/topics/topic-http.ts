import { buildTopicInsights, type TopicInsights } from "./topic-insights.js";
import { isPromptIntent } from "./topic-schema.js";
import { REGIONS, REGION_CAVEAT } from "./region.js";
import { LANGUAGES } from "./language.js";
import { promptExportNames, promptExportTable } from "./topic-export.js";
import type { PromptAnswer } from "./prompt-run-schema.js";
import type { PromptRunService } from "./prompt-run-service.js";
import type { PromptScheduleService } from "./prompt-schedule.js";
import type { BrandProfileService } from "../discovery/brand-profile-service.js";
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

/** Server-side slicing, so a filtered view is the same computation as the
 * whole one rather than a second, divergent one in the browser. */
function sliced(answers: PromptAnswer[], url: URL | undefined): PromptAnswer[] {
  if (!url) return answers;
  const want = (key: string) => url.searchParams.get(key) || "";
  const modelId = want("modelId");
  const regionId = want("regionId");
  const languageId = want("languageId");
  const topicId = want("topicId");
  return answers.filter((answer) =>
    (!modelId || answer.modelId === modelId)
    && (!regionId || answer.regionId === regionId)
    && (!languageId || answer.languageId === languageId)
    && (!topicId || answer.topicId === topicId));
}

export async function handleTopicApi(input: {
  method: string;
  route: string[];
  url?: URL | undefined;
  send: TopicJsonSender;
  topics: TopicService;
  runs: PromptRunService;
  schedule: PromptScheduleService;
  demand: DemandReportFileStore;
  profiles: BrandProfileService;
  ask: StructuredAsk;
  readJson: () => Promise<Record<string, unknown>>;
}): Promise<boolean> {
  const { method, route, url, send, topics, runs, schedule, demand, profiles, ask, readJson } = input;
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

  if (method === "GET" && tail.length === 1 && tail[0] === "profile") {
    const profile = await profiles.get(projectId);
    // Absent rather than empty: no profile means none was built.
    if (!profile) send(404, { error: "No profile has been built for this project yet." });
    else send(200, profile);
    return true;
  }

  if (method === "POST" && tail.length === 1 && tail[0] === "profile") {
    await guard(() => profiles.build(projectId, ask));
    return true;
  }

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
      competitors: Array.isArray(body.competitors)
        ? body.competitors.flatMap((row) => {
            const item = row && typeof row === "object" ? (row as Record<string, unknown>) : null;
            const name = typeof item?.name === "string" ? item.name.trim() : "";
            return name ? [{ name, domain: typeof item?.domain === "string" ? item.domain : null }] : [];
          })
        : undefined,
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

  if (method === "POST" && tail.length === 3 && tail[0] === "prompt-runs" && tail[2] === "cancel") {
    await guard(() => runs.cancel(projectId, tail[1] || ""));
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

  if (method === "GET" && tail.length === 1 && tail[0] === "prompt-answers") {
    try {
      const answers = sliced(await runs.listAnswers(projectId), url);
      const promptId = url?.searchParams.get("promptId") || "";
      const mine = promptId ? answers.filter((answer) => answer.promptId === promptId) : answers;
      send(200, { answers: mine.slice(0, 60) });
    } catch (error) {
      send(404, { error: message(error) });
    }
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
      const [set, answers, runList, identity] = await Promise.all([
        topics.get(projectId),
        runs.listAnswers(projectId),
        runs.listRuns(projectId),
        topics.targetIdentity(projectId).catch(() => null),
      ]);
      return buildTopicInsights({
        projectId,
        set,
        answers: sliced(answers, url),
        runs: runList,
        identityCaveat: identity?.caveat || null,
      });
    }, 404);
    return true;
  }

  return false;
}
