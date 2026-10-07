import type { PromptStanding, TopicInsights } from "../topics/topic-insights.js";
import type { DraftSource } from "./agent-schema.js";

/** A page an answer cited, as far as it has been read back. Null title means
 * the page is known to have been cited and has not been read. */
export interface CitedPage {
  url: string;
  host: string;
  title: string | null;
  headings: string[];
  namesYou: boolean;
}

/** Null for a page nothing has read, which is reported rather than guessed at. */
export type PageLookup = (url: string) => CitedPage | null;

const NO_PAGES: PageLookup = () => null;

/** What the pages that won a question cover. Ground to answer, never fact to
 * copy: the brand's own pages stay the only source for a claim about it. */
function groundFrom(prompt: PromptStanding, page: PageLookup): { lines: string[]; sources: DraftSource[] } {
  const lines: string[] = [];
  const sources: DraftSource[] = [];
  let unread = 0;
  for (const cited of prompt.cited.slice(0, 8)) {
    const read = page(cited.url);
    if (!read) {
      unread += 1;
      continue;
    }
    const covers = read.headings.slice(0, 6).join(" / ");
    lines.push(`- ${read.host}${read.title ? `, "${read.title}"` : ""}${covers ? `: ${covers}` : ""}`);
    sources.push({
      kind: "citation",
      reference: cited.url,
      detail: `cited by ${cited.answers} answer(s) to this question${read.namesYou ? ", and names the brand" : ""}`,
    });
  }
  if (unread) {
    lines.push(`- ${unread} more page(s) were cited and have not been read, so what they cover is not known here.`);
  }
  return { lines, sources };
}

export type TemplateId = "missing_answer" | "faq" | "competitor_brief" | "refresh";

export interface AgentTemplate {
  id: TemplateId;
  label: string;
  /** What the draft is for, in the reader's terms rather than the product's. */
  purpose: string;
  needs: string;
}

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: "missing_answer",
    label: "Answer a question you are never named in",
    purpose: "A page that answers one tracked question the models never name the brand in.",
    needs: "A question with a completed answer where the brand was not named.",
  },
  {
    id: "faq",
    label: "Questions and answers for one topic",
    purpose: "A question and answer set covering the questions already tracked under a topic.",
    needs: "A topic carrying at least two tracked questions.",
  },
  {
    id: "competitor_brief",
    label: "Brief on a rival the answers prefer",
    purpose: "What a rival is named for, and on which questions it is named instead of the brand.",
    needs: "A rival named in more answers than the brand.",
  },
  {
    id: "refresh",
    label: "Refresh a page that stopped being cited",
    purpose: "What changed on a page the answers used to cite and no longer do.",
    needs: "Citation history for a page across two or more runs.",
  },
];

export function templateById(id: string): AgentTemplate | null {
  return AGENT_TEMPLATES.find((row) => row.id === id) || null;
}

export interface TemplateBrief {
  /** Null when the evidence this template needs does not exist yet. */
  instruction: string | null;
  blocked: string | null;
  sources: DraftSource[];
  rationale: string;
}

function namedInstead(ahead: TopicInsights["leaderboard"]): string {
  const names = ahead.slice(0, 5).map((row) => row.name);
  return names.length ? names.join(", ") : "nobody";
}

function missingAnswer(insights: TopicInsights, page: PageLookup): TemplateBrief {
  const prompt = insights.absentFrom.find((row) => row.measuresVisibility && row.score.answers > 0);
  if (!prompt) {
    return {
      instruction: null,
      blocked: "No tracked question has a completed answer that left the brand unnamed, so there is no gap to write against.",
      sources: [],
      rationale: "",
    };
  }
  const rivals = namedInstead(prompt.ahead);
  const ground = groundFrom(prompt, page);
  return {
    instruction: [
      `Write a page that answers this question directly: "${prompt.text}"`,
      `Across ${prompt.score.answers} answer(s) to it, the brand was never named. Named instead: ${rivals}.`,
      ...(ground.lines.length
        ? [
          "These pages were cited in those answers. Cover the ground they cover, so the question is answered as fully. Take no fact from them: they are what was asked for, not a source.",
          ...ground.lines,
        ]
        : []),
      "Answer the question first and completely, before mentioning the brand at all.",
      "Only claim what the brand's own pages support. Leave out anything they do not.",
    ].join("\n"),
    blocked: null,
    sources: [
      { kind: "prompt", reference: prompt.promptId, detail: `${prompt.score.answers} answer(s), brand never named` },
      ...prompt.ahead.slice(0, 5).map((row): DraftSource => ({
        kind: "entity",
        reference: row.domain || row.name,
        detail: `named in ${row.appearances} answer(s) on this question`,
      })),
      ...ground.sources,
    ],
    rationale: `${prompt.score.answers} answer(s) to this question named ${rivals} and never the brand.`,
  };
}

function faq(insights: TopicInsights): TemplateBrief {
  const topic = insights.topics.find((row) => row.prompts.length >= 2);
  if (!topic) {
    return {
      instruction: null,
      blocked: "No topic carries two or more tracked questions yet, so there is nothing to collect into a set.",
      sources: [],
      rationale: "",
    };
  }
  const questions = topic.prompts.slice(0, 10);
  return {
    instruction: [
      `Write a question and answer set for the topic "${topic.name}".`,
      "Use exactly these questions, in this order, each answered on its own in a few sentences:",
      ...questions.map((row) => `- ${row.text}`),
      "Answer from the brand's own pages. Where they do not settle a question, say what is known and stop.",
    ].join("\n"),
    blocked: null,
    sources: questions.map((row): DraftSource => ({
      kind: "prompt",
      reference: row.promptId,
      detail: row.text,
    })),
    rationale: `${questions.length} tracked question(s) sit under "${topic.name}" and are already being asked.`,
  };
}

function competitorBrief(insights: TopicInsights): TemplateBrief {
  const target = insights.leaderboard.find((row) => row.isTarget);
  const rival = insights.leaderboard.find((row) => !row.isTarget && row.appearances > (target?.appearances || 0));
  if (!rival) {
    return {
      instruction: null,
      blocked: "No rival is named in more answers than the brand, so there is no one to brief against.",
      sources: [],
      rationale: "",
    };
  }
  const contested = insights.absentFrom
    .filter((row) => row.ahead.some((entry) => entry.name === rival.name))
    .slice(0, 6);
  return {
    instruction: [
      `Write an internal brief on ${rival.name}${rival.domain ? ` (${rival.domain})` : ""}.`,
      `It was named in ${rival.appearances} answer(s) against the brand's ${target?.appearances || 0}.`,
      contested.length
        ? `Cover the questions it is named on and the brand is not:\n${contested.map((row) => `- ${row.text}`).join("\n")}`
        : "No single question was isolated where it is named and the brand is not, so cover its overall standing instead.",
      "This is a brief for the team, not a page to publish. Do not write marketing copy.",
    ].join("\n"),
    blocked: null,
    sources: [
      { kind: "entity", reference: rival.domain || rival.name, detail: `named in ${rival.appearances} answer(s)` },
      ...contested.map((row): DraftSource => ({ kind: "prompt", reference: row.promptId, detail: row.text })),
    ],
    rationale: `${rival.name} was named in ${rival.appearances} answer(s) against the brand's ${target?.appearances || 0}.`,
  };
}

// Citation history per page is not stored, so this template reports what it
// would need rather than drafting from a single run and calling it a decline.
function refresh(insights: TopicInsights): TemplateBrief {
  return {
    instruction: null,
    blocked: insights.citationsUnavailable
      ? "No answer carried a citation, so no page can be shown to have been cited at all."
      : "Citations are recorded per run and not yet tracked per page over time, so a page cannot be shown to have stopped being cited.",
    sources: [],
    rationale: "",
  };
}

/** Every brief a template can build right now, not only the first. Each one is
 * built by narrowing the insights to one gap and reusing the single-gap
 * builder, so a batch and a single draft cannot disagree about a brief. */
export function briefsFor(templateId: TemplateId, insights: TopicInsights, limit: number, page: PageLookup = NO_PAGES): TemplateBrief[] {
  const take = Math.max(1, Math.min(limit, 50));
  if (templateId === "missing_answer") {
    return insights.absentFrom
      .filter((row) => row.measuresVisibility && row.score.answers > 0)
      .slice(0, take)
      .map((row) => missingAnswer({ ...insights, absentFrom: [row] }, page));
  }
  if (templateId === "faq") {
    return insights.topics
      .filter((row) => row.prompts.length >= 2)
      .slice(0, take)
      .map((row) => faq({ ...insights, topics: [row] }));
  }
  if (templateId === "competitor_brief") {
    const target = insights.leaderboard.find((row) => row.isTarget);
    return insights.leaderboard
      .filter((row) => !row.isTarget && row.appearances > (target?.appearances || 0))
      .slice(0, take)
      .map((row) => competitorBrief({ ...insights, leaderboard: target ? [target, row] : [row] }));
  }
  const only = refresh(insights);
  return only.instruction ? [only] : [];
}

export function briefFor(templateId: TemplateId, insights: TopicInsights, page: PageLookup = NO_PAGES): TemplateBrief {
  if (templateId === "missing_answer") return missingAnswer(insights, page);
  if (templateId === "faq") return faq(insights);
  if (templateId === "competitor_brief") return competitorBrief(insights);
  return refresh(insights);
}
