import { PROMPT_INTENTS, type PromptIntent, type TopicSet } from "./topic-schema.js";
import type { CitationAnalysis } from "./citation-analysis.js";
import type { EntityStanding, TopicInsights } from "./topic-insights.js";

// The plan is derived from answers already archived, never from a model's
// opinion. Every move carries the observation it came from.

/** What a move actually changes. The three are not interchangeable, and
 * conflating them is how a tracker starts promising rank for busywork. */
export type RankingEffect = "raises_visibility" | "unblocks_measurement" | "widens_measurement";

export interface RankingMove {
  id: string;
  effect: RankingEffect;
  title: string;
  why: string;
  /** The observation behind the title, so the conclusion can be checked. */
  evidence: string;
  /** Answers this move bears on. Null when it cannot be counted. */
  answers: number | null;
}

export interface RankingPlan {
  answers: number;
  score: number | null;
  rank: number | null;
  /** One sentence answering "where do I stand", from the evidence only. */
  verdict: string;
  /** The honest answer to "do more prompts make me rank higher". */
  promptsNote: string;
  moves: RankingMove[];
}

const EFFECT_ORDER: Record<RankingEffect, number> = {
  raises_visibility: 0,
  unblocks_measurement: 1,
  widens_measurement: 2,
};

const INTENT_LABELS: Record<PromptIntent, string> = {
  discovery: "Discovery",
  comparison: "Comparison",
  alternatives: "Alternatives",
  brand: "Brand",
  problem: "Problem",
};

function names(rows: Array<{ name: string }>, limit: number): string {
  const head = rows.slice(0, limit).map((row) => row.name);
  return rows.length > limit ? `${head.join(", ")} and ${rows.length - limit} more` : head.join(", ");
}

function rivalsAhead(leaderboard: EntityStanding[]): EntityStanding[] {
  const index = leaderboard.findIndex((row) => row.isTarget);
  return index < 0 ? leaderboard : leaderboard.slice(0, index);
}

export function buildRankingPlan(input: {
  insights: TopicInsights;
  set: TopicSet;
  citations?: CitationAnalysis | undefined;
}): RankingPlan {
  const { insights, set } = input;
  const moves: RankingMove[] = [];
  const live = set.prompts.filter((prompt) => prompt.status !== "retired");
  const tracked = live.filter((prompt) => prompt.status === "active");

  // Nothing answered is not a bad standing, it is no standing. Saying "improve
  // your score" here would be advice about a number that does not exist.
  if (insights.answers === 0) {
    return {
      answers: 0,
      score: null,
      rank: null,
      verdict: "Nothing has been answered yet, so there is no standing to explain. This is not a rank of zero.",
      promptsNote: "Track the questions buyers actually type, then run them. Until a run finishes there is no evidence to act on.",
      moves: tracked.length
        ? [{
            id: "run-the-set",
            effect: "unblocks_measurement",
            title: `Run the ${tracked.length} question(s) you track`,
            why: "Every figure in this tool is an archived answer. Without one there is nothing to rank against.",
            evidence: `${tracked.length} question(s) are tracked and none has an archived answer.`,
            answers: null,
          }]
        : [{
            id: "track-questions",
            effect: "unblocks_measurement",
            title: "Track some questions",
            why: "The unit of measurement is the question a buyer types. Nothing is asked until one is tracked.",
            evidence: `${live.length} question(s) exist and none is tracked.`,
            answers: null,
          }],
    };
  }

  const ahead = rivalsAhead(insights.leaderboard);
  const absent = insights.absentFrom;
  const absentAnswers = absent.reduce((total, prompt) => total + prompt.score.answers, 0);

  // The whole point of the page: where you are not named, and who is there.
  if (absent.length) {
    const named = new Map<string, number>();
    for (const prompt of absent) {
      for (const entity of prompt.ahead) named.set(entity.name, (named.get(entity.name) || 0) + 1);
    }
    const instead = [...named.entries()].sort((left, right) => right[1] - left[1]).map(([name]) => ({ name }));
    moves.push({
      id: "absent-prompts",
      effect: "raises_visibility",
      title: `Win the ${absent.length} question(s) you are never named in`,
      why: instead.length
        ? "The models answer these questions with somebody. Being named at all here moves presence, which the whole score is scaled from."
        : "No product was named in these answers at all, so they may not be buying questions. Read them before spending anything on them.",
      evidence: instead.length
        ? `${absentAnswers} answer(s) across ${absent.length} question(s) named you zero times. Named instead: ${names(instead, 5)}.`
        : `${absentAnswers} answer(s) across ${absent.length} question(s) named no product at all.`,
      answers: absentAnswers,
    });
  }

  const target = insights.leaderboard.find((row) => row.isTarget);
  const leader = insights.leaderboard[0];
  const nearest = ahead[ahead.length - 1];

  // Chasing the weakest rival is only a goal once you are on the board. Until
  // then the gap that matters is to whoever the models actually answer with.
  if (target && nearest) {
    const gap = nearest.appearances - target.appearances;
    moves.push({
      id: "nearest-rival",
      effect: "raises_visibility",
      title: `Close the gap on ${nearest.name}`,
      why: "Rank is a position against the others named, so it moves when one of them is passed, not when the score rises alone.",
      evidence: `${nearest.name} was named in ${nearest.appearances} answer(s) against your ${target.appearances}. `
        + (gap > 0 ? `${gap} more answer(s) naming you would draw level.` : "You are level on appearances and behind on how early you are named."),
      answers: gap > 0 ? gap : null,
    });
  } else if (!target && leader) {
    moves.push({
      id: "not-on-the-board",
      effect: "raises_visibility",
      title: `No answer named you. ${leader.name} is what the models answer with`,
      why: "There is no rank to improve until you are named once. The first appearance is the whole of the gap.",
      evidence: `${leader.name} was named in ${leader.appearances} of ${insights.answers} answer(s). `
        + `${insights.leaderboard.length} organisation(s) were named and you were not one of them.`,
      answers: insights.answers,
    });
  }

  // Being named late is a different problem from not being named.
  if (target && target.prominence !== null && target.prominence < 0.5 && target.appearances > 0) {
    moves.push({
      id: "named-late",
      effect: "raises_visibility",
      title: "You are named, but late in the answer",
      why: "Prominence scales presence in the score, and a buyer reads the first two names.",
      evidence: `Across ${target.appearances} answer(s) that named you, your mean position weight is ${target.prominence.toFixed(2)}, where 1 is always first.`,
      answers: target.appearances,
    });
  }

  if (target && target.negative > 0) {
    moves.push({
      id: "named-badly",
      effect: "raises_visibility",
      title: `${target.negative} answer(s) name you and do not recommend you`,
      why: "Sentiment scales the score too, so a grudging mention is worth less than a warm one.",
      evidence: `${target.negative} of ${target.appearances} answer(s) that named you described you negatively, against ${target.positive} positive.`,
      answers: target.negative,
    });
  }

  // Sources are the only part of this that says which page to write.
  const citations = input.citations;
  if (insights.citationsUnavailable || (citations && citations.unavailable)) {
    moves.push({
      id: "no-sources",
      effect: "unblocks_measurement",
      title: "No answer carried a source, so nothing says which page to write",
      why: "Citations are the only evidence in this tool that points at a specific page. Without them the plan can name the gap but not the fix.",
      evidence: "Not one archived answer returned a citation. That is a property of the models that ran, not evidence that nobody cites you.",
      answers: null,
    });
  } else if (citations && citations.domains.length) {
    const theirs = citations.domains.filter((row) => !row.isTarget);
    if (theirs.length) {
      moves.push({
        id: "cited-domains",
        effect: "raises_visibility",
        title: `Get onto the pages the models actually read`,
        why: "A model names what its sources name. These domains are what it read while answering your questions.",
        evidence: `Most cited: ${names(theirs.map((row) => ({ name: row.domain })), 5)}. ${citations.answersWithCitations} of ${citations.answersConsidered} answer(s) carried a source.`,
        answers: citations.answersWithCitations,
      });
    }
    if (citations.openings.length) {
      moves.push({
        id: "citation-openings",
        effect: "raises_visibility",
        title: `${citations.openings.length} page(s) won a question you are absent from`,
        why: "A cited page on a question you lose is the most specific thing this tool can hand you.",
        evidence: `For example ${citations.openings[0]?.domain} was cited answering "${citations.openings[0]?.prompt}".`,
        answers: citations.openings.length,
      });
    }
  }

  // A model that never names you is a different finding from a low average.
  const blind = insights.byModel.filter((row) => row.score.answers > 0 && row.score.appearances === 0);
  const sighted = insights.byModel.filter((row) => row.score.appearances > 0);
  if (blind.length && sighted.length) {
    moves.push({
      id: "blind-models",
      effect: "raises_visibility",
      title: `${blind.length} model(s) never name you, while others do`,
      why: "One assistant not knowing you is a gap in what it read, not a verdict on the brand.",
      evidence: `Never named you: ${names(blind.map((row) => ({ name: row.displayName })), 4)}. `
        + `Named you: ${names(sighted.map((row) => ({ name: row.displayName })), 4)}.`,
      answers: blind.reduce((total, row) => total + row.score.answers, 0),
    });
  }

  // Everything below widens what is measured. It is listed last and labelled,
  // because none of it can move the score on its own.
  const cannotMeasure = tracked.filter((prompt) => !prompt.measuresVisibility);
  if (cannotMeasure.length) {
    moves.push({
      id: "brand-named-prompts",
      effect: "widens_measurement",
      title: `${cannotMeasure.length} tracked question(s) name you, so they cannot measure visibility`,
      why: "A model will discuss a brand the question names, so presence there is not earned. They still measure sentiment and framing.",
      evidence: `For example "${cannotMeasure[0]?.text}".`,
      answers: null,
    });
  }

  const emptyIntents = PROMPT_INTENTS.filter((intent) => !tracked.some((prompt) => prompt.intent === intent));
  if (emptyIntents.length) {
    moves.push({
      id: "empty-intents",
      effect: "widens_measurement",
      title: `Nothing tracked for ${emptyIntents.map((intent) => INTENT_LABELS[intent]).join(", ")}`,
      why: "A buyer arrives through all five. An untracked intent is unmeasured, which is not the same as being absent from it.",
      evidence: `${tracked.length} tracked question(s) cover ${PROMPT_INTENTS.length - emptyIntents.length} of ${PROMPT_INTENTS.length} intents.`,
      answers: null,
    });
  }

  const emptyTopics = set.topics.filter((topic) => !tracked.some((prompt) => prompt.topicId === topic.id));
  if (emptyTopics.length) {
    moves.push({
      id: "empty-topics",
      effect: "widens_measurement",
      title: `${emptyTopics.length} topic(s) have nothing tracked`,
      why: "A topic with no tracked question produces no answers, so it reports nothing rather than reporting well.",
      evidence: `Untracked: ${names(emptyTopics, 4)}.`,
      answers: null,
    });
  }

  if (insights.trend.points.length < 2) {
    moves.push({
      id: "one-run",
      effect: "widens_measurement",
      title: "Run the set again on a schedule",
      why: "One run is a snapshot. A model's answer varies, so a single reading cannot tell a change from noise.",
      evidence: `${insights.trend.points.length} run(s) have produced a score so far.`,
      answers: null,
    });
  }

  moves.sort((left, right) => EFFECT_ORDER[left.effect] - EFFECT_ORDER[right.effect] || (right.answers || 0) - (left.answers || 0));

  const rivalCount = insights.leaderboard.filter((row) => !row.isTarget).length;
  const verdict = insights.rank === null
    ? `No answer named you. ${rivalCount} other organisation(s) were named across ${insights.answers} answer(s).`
    : `You rank #${insights.rank} of ${insights.leaderboard.length} named, from ${insights.answers} archived answer(s).`;

  return {
    answers: insights.answers,
    score: insights.overall.score,
    rank: insights.rank,
    verdict,
    promptsNote: "Tracking more questions does not raise the score. It widens what is measured, and a new question is a new place to be absent from. The score moves when the models name you in answers they are already giving.",
    moves,
  };
}
