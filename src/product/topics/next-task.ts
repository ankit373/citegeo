import type { StabilityReport } from "./answer-stability.js";
import type { CorroborationSummary } from "./mention-corroboration.js";
import type { ActivationSplit } from "./search-activation.js";
import type { VisibilityScore } from "./visibility-score.js";

// Every panel in this product ends in a figure, and a figure leaves the reader
// to work out what to do. These are the tasks that answer it, each derived from
// something measured rather than from an opinion about the brand.

export type TaskUrgency = "blocking" | "limiting" | "work";

export interface MeasurementTask {
  id: string;
  urgency: TaskUrgency;
  /** Phrased as the thing to do, not as the state it came from. */
  title: string;
  /** What doing it unblocks, in measurement terms. */
  why: string;
  /** The observation behind it, so a reader can disagree and still check. */
  evidence: string;
  /** The page that does it, so the listing can send them straight there. */
  page: string;
  action: string;
}

export interface TaskInput {
  answers: number;
  answersFailed: number;
  overall: VisibilityScore;
  activation: ActivationSplit;
  stability: StabilityReport;
  corroboration: CorroborationSummary;
  citationsUnavailable: boolean;
  /** Questions answered where the brand was never named. */
  absentFrom: number;
  /** Cited pages, and how many have been read back. Absent where nobody has
   * looked, which is not the same as nothing having been cited. */
  citedPages?: { cited: number; read: number } | undefined;
  /** Why the failed answers failed, largest group first. The product knows,
   * so telling somebody to go and find out would be withholding it. */
  failureReasons?: Array<{ code: string; count: number }> | undefined;
}

/** The words for a failure code. An unmapped code is printed as itself rather
 * than folded into "other", which would hide a code nobody has seen yet. */
const FAILURE_WORDS: Record<string, string> = {
  unavailable: "a browser surface that could not be reached or was asking to sign in",
  no_answer: "a surface that returned nothing to read",
  unreadable: "an answer that could not be read back",
  provider_error: "the provider returning an error",
  empty_answer: "the model returning an empty answer",
};

/** Where a failure of that kind is actually cleared. Sending somebody to the
 * page they are already reading is a button that does nothing. */
const FAILURE_FIX: Record<string, { page: string; action: string }> = {
  provider_error: { page: "setup", action: "Check the keys" },
  unavailable: { page: "models", action: "Check the surfaces" },
  empty_answer: { page: "models", action: "Check the models" },
};

const URGENCY_ORDER: Record<TaskUrgency, number> = { blocking: 0, limiting: 1, work: 2 };

/** What published work puts the day to day overlap of cited sources at. Below
 * it, a source list from one pass is worse than the figure that set the bar. */
export const PUBLISHED_OVERLAP = 0.34;

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function pct(value: number | null): string {
  return value === null ? "not measurable" : Math.round(value * 1000) / 10 + "%";
}

/** Nothing to unblock and nothing to write: said out loud, because an empty
 * list reads as a page that failed to load. */
export const NOTHING_OUTSTANDING: MeasurementTask = {
  id: "measurement-sound",
  urgency: "work",
  title: "Nothing is holding the measurement back",
  why: "Every figure on this page was taken over answers that could produce it, so the numbers are the finding rather than an artefact of how they were gathered.",
  evidence: "No blocking or limiting condition was observed.",
  page: "answer-engine",
  action: "Read the report",
};

export function nextTasks(input: TaskInput): MeasurementTask[] {
  const tasks: MeasurementTask[] = [];

  if (input.answers === 0) {
    return [{
      id: "no-answers",
      urgency: "blocking",
      title: "Run the questions once",
      why: "Nothing here is measured until an answer exists. Every figure on this page is taken over archived answers, so with none there is no absence to report either.",
      evidence: "No completed answer has been archived for this project.",
      page: "prompts",
      action: "Open questions",
    }];
  }

  const act = input.activation;

  // Naming the cause beats naming the symptom. Telling somebody to get a
  // provider with web search is wrong when they have one, switched off.
  if (act.notRequested > 0 && act.activated === 0) {
    tasks.push({
      id: "search-switched-off",
      urgency: "blocking",
      title: "Turn web search on for the models you ask",
      why: "Every model that ran can search and was told not to, so no run could have produced a citation. The whole source half of this product is dark until this changes, and none of it is evidence that nobody cites you.",
      evidence: `${act.notRequested} of ${act.considered} ${plural(act.considered, "answer", "answers")} came from a model that can search the web and was not asked to.`,
      page: "models",
      action: "Turn on web search",
    });
  } else if (act.considered > 0 && act.unavailable === act.considered) {
    tasks.push({
      id: "no-model-can-search",
      urgency: "blocking",
      title: "Add a model that can search the web",
      why: "None of the models that ran can search at all, so no citation was ever possible. What they said about you came from what they already held, which is worth knowing and is not the same measurement.",
      evidence: `All ${act.considered} ${plural(act.considered, "answer", "answers")} came from models with no web search.`,
      page: "models",
      action: "Choose models",
    });
  } else if (input.citationsUnavailable) {
    tasks.push({
      id: "no-sources-returned",
      urgency: "limiting",
      title: "Ask questions that invite a source",
      why: "Models that could search returned no citation at all. A question answered from memory cites nobody, so the source panels stay empty however visible you are.",
      evidence: `${act.activated} ${plural(act.activated, "answer", "answers")} searched the web and none carried a source.`,
      page: "prompts",
      action: "Open questions",
    });
  }

  if (act.unknown > 0 && act.low !== null && act.high !== null) {
    tasks.push({
      id: "activation-unknown",
      urgency: "limiting",
      title: "Narrow how many answers actually searched",
      why: "Those providers never say whether they searched, so the share that did is a band rather than a figure, and every rate conditioned on it inherits the width.",
      evidence: `Between ${pct(act.low)} and ${pct(act.high)} of answers searched, because ${act.unknown} ${plural(act.unknown, "answer says", "answers say")} nothing either way.`,
      page: "models",
      action: "Choose models",
    });
  }

  // Fires on the majority, not only on all of them: a project where six
  // questions were asked once and five twice has six single draws in it.
  const { askedOnce, measured, namingUnstable, sourceOverlap } = input.stability;
  if (askedOnce > measured) {
    tasks.push({
      id: "asked-once",
      urgency: "limiting",
      title: "Ask each question more than once",
      why: "One pass cannot tell a finding from the day it was taken. Published work puts the day to day overlap of cited sources near a third, which makes a single pass close to a coin.",
      evidence: measured === 0
        ? `${askedOnce} ${plural(askedOnce, "question was", "questions were")} asked once and none more than once, so nothing here says how much of the answer is the question.`
        : `${askedOnce} of ${askedOnce + measured} questions were asked once, so most of what is below is a single draw.`,
      page: "prompts",
      action: "Run them again",
    });
  }

  // A citation is a URL until the page behind it is read. Four panels are
  // taken over read pages and every one of them sits empty until somebody does.
  const cited = input.citedPages;
  if (cited && cited.cited > 0 && cited.read < cited.cited) {
    const unread = cited.cited - cited.read;
    tasks.push({
      id: "sources-unread",
      urgency: "limiting",
      title: `Read the ${unread} cited ${plural(unread, "page", "pages")} nobody has opened`,
      why: "Whether a cited page was used or only listed, who gets the credit, how the pages that beat you are built and what kind of page wins are all taken over the pages themselves. A citation on its own is an address.",
      evidence: `${cited.read} of ${cited.cited} cited ${plural(cited.cited, "page has", "pages have")} been read back.`,
      page: "answer-engine",
      action: "Read the pages",
    });
  }

  if (sourceOverlap !== null && sourceOverlap < PUBLISHED_OVERLAP) {
    tasks.push({
      id: "sources-turn-over",
      urgency: "limiting",
      title: "Read the source list as one draw, not as the sources",
      why: "The pages cited for a question barely survive being asked again, so a page absent from this run is not a page the models will not cite. Anything built off a single run's sources is built on a sample.",
      evidence: `${pct(sourceOverlap)} of cited sources survived from one pass to the next, against the ${pct(PUBLISHED_OVERLAP)} published work reports.`,
      page: "answer-engine",
      action: "Read the passes",
    });
  }

  if (namingUnstable > 0) {
    tasks.push({
      id: "naming-unstable",
      urgency: "limiting",
      title: `Treat ${namingUnstable} ${plural(namingUnstable, "question", "questions")} as undecided`,
      why: "They named you on one pass and not on another under identical conditions, so a single pass would have reported either answer and neither would have been wrong.",
      evidence: `${namingUnstable} of ${measured} ${plural(measured, "question", "questions")} asked more than once disagreed with itself about whether you appear.`,
      page: "answer-engine",
      action: "Read the passes",
    });
  }

  if (input.overall.tooFewAnswers) {
    const interval = input.overall.presenceInterval;
    tasks.push({
      id: "too-few-answers",
      urgency: "limiting",
      title: "Track more questions, or ask the ones you have again",
      why: "The presence figure is one draw off a handful of answers. The range it is consistent with is too wide to decide anything, so a move inside it is not a move.",
      evidence: `${input.overall.appearances} of ${input.overall.answers} answers named you, consistent with ${pct(interval.low)} to ${pct(interval.high)}.`,
      page: "prompts",
      action: "Open questions",
    });
  }

  if (input.answersFailed > 0) {
    const worst = (input.failureReasons || [])[0];
    const words = worst ? FAILURE_WORDS[worst.code] || worst.code : "";
    const fix = worst ? FAILURE_FIX[worst.code] : undefined;
    tasks.push({
      id: "answers-failed",
      urgency: "limiting",
      title: worst
        ? `Clear ${worst.count} ${plural(worst.count, "answer", "answers")} lost to ${words}`
        : `Find out why ${input.answersFailed} ${plural(input.answersFailed, "answer", "answers")} failed`,
      why: "A failed answer is excluded rather than counted as one that did not name you, which is right, and it also means the score is taken over fewer answers than you asked for.",
      evidence: `${input.answersFailed} of ${input.answers + input.answersFailed} requested answers did not complete.${worst ? ` The largest group is ${worst.count} from ${words}.` : ""}`,
      page: fix ? fix.page : "answer-engine",
      action: fix ? fix.action : "Open the run",
    });
  }

  const corr = input.corroboration;
  if (corr.quotesChecked > corr.quotesFound) {
    const missing = corr.quotesChecked - corr.quotesFound;
    tasks.push({
      id: "quotes-not-found",
      urgency: "limiting",
      title: `Read the ${missing} ${plural(missing, "quote", "quotes")} the model could not back up`,
      why: "The model offered those lines as the evidence for naming a brand, and they are not in the answer it wrote. Where it invented its own citation, its report of who it named is worth less.",
      evidence: `${corr.quotesFound} of ${corr.quotesChecked} quoted lines were found in the answer they came from.`,
      page: "answer-engine",
      action: "Read the answers",
    });
  }
  if (corr.absentFromAnswer > 0) {
    tasks.push({
      id: "mentions-absent",
      urgency: "limiting",
      title: `Discount ${corr.absentFromAnswer} reported ${plural(corr.absentFromAnswer, "mention", "mentions")}`,
      why: "The model listed those brands as named and the answer does not contain them, so their position could not be measured from anything.",
      evidence: `${corr.absentFromAnswer} of ${corr.reported} reported mentions were not found in the answer text.`,
      page: "answer-engine",
      action: "Read the answers",
    });
  }

  if (input.absentFrom > 0) {
    tasks.push({
      id: "absent-questions",
      urgency: "work",
      title: `Write for the ${input.absentFrom} ${plural(input.absentFrom, "question", "questions")} you never appear in`,
      why: "Those were answered and you were not named once. The answers name who was credited instead, which is the standard that question is answered against.",
      evidence: `${input.absentFrom} tracked ${plural(input.absentFrom, "question", "questions")} returned answers that never named you.`,
      page: "answer-engine",
      action: "See the questions",
    });
  }

  if (!tasks.length) tasks.push(NOTHING_OUTSTANDING);
  return tasks.sort((left, right) => URGENCY_ORDER[left.urgency] - URGENCY_ORDER[right.urgency]);
}
