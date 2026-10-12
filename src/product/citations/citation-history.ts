import { canonicalUrl } from "./canonical-url.js";
import type { PromptAnswer } from "../topics/prompt-run-schema.js";

// A citation is recorded against an answer, and an answer belongs to a run, so
// what a page did over time was always derivable and never derived.
//
// The trap is the run where nothing was cited at all. Every page is absent from
// it, and reading that as every page having been dropped would turn one run
// with web search switched off into a sitewide collapse.

/** Runs a page has to be missing from before it is called dropped. One absence
 * is inside the variation this product measures everywhere else. */
export const RUNS_TO_CALL_IT_DROPPED = 2;

/** Runs a page has to have been cited in before losing it means anything. A
 * page cited once was never established, so it has no pattern to lose. */
export const RUNS_TO_CALL_IT_A_PATTERN = 2;

export const HISTORY_CAVEAT = "Counted only over runs where something was cited. A run where no answer carried a citation says nothing about any page, so it is left out rather than read as every page losing its citation at once.";

export interface PageRun {
  runId: string;
  at: string;
  /** Answers in this run that cited this page. */
  cited: number;
}

/** Null where nothing can be said: one measurable run, or a page cited in only
 * one of them. */
export type PageVerdict = "cited" | "slipping" | "dropped" | "cited_once" | null;

export interface PageHistory {
  /** What two citations have to share to be the same page. */
  key: string;
  url: string;
  host: string;
  /** Only runs that carried a citation from anywhere, oldest first. */
  runs: PageRun[];
  answers: number;
  firstCitedAt: string | null;
  lastCitedAt: string | null;
  /** Citation-carrying runs since it was last cited. */
  runsSince: number;
  /** Measurable runs it was cited in. One is not a pattern. */
  runsCited: number;
  /** Questions whose answers cited it, so a drop can be read against them. */
  promptIds: string[];
  verdict: PageVerdict;
}

export interface CitationHistory {
  pages: PageHistory[];
  measurableRuns: number;
  /** Runs where no answer cited anything. They are not evidence of a drop. */
  silentRuns: number;
  caveat: string;
}

interface RunTally {
  runId: string;
  at: string;
  carried: number;
  byPage: Map<string, number>;
}

function tallyRuns(answers: PromptAnswer[]): RunTally[] {
  const runs = new Map<string, RunTally>();
  for (const answer of answers) {
    if (answer.status !== "completed") continue;
    const run = runs.get(answer.runId) || { runId: answer.runId, at: answer.createdAt, carried: 0, byPage: new Map() };
    // The run's date is its earliest answer, so a slow model does not move it.
    if (answer.createdAt < run.at) run.at = answer.createdAt;
    const seen = new Set<string>();
    for (const raw of answer.citationUrls) {
      const key = canonicalUrl(raw)?.key;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      run.byPage.set(key, (run.byPage.get(key) || 0) + 1);
    }
    if (seen.size) run.carried += 1;
    runs.set(answer.runId, run);
  }
  return [...runs.values()].sort((left, right) => left.at.localeCompare(right.at) || left.runId.localeCompare(right.runId));
}

function verdictFor(runs: PageRun[], runsSince: number, runsCited: number): PageVerdict {
  if (runs.length < 2) return null;
  if (!runsSince) return "cited";
  // Absent now, and only ever there once. Reporting that as a page that
  // stopped would send somebody to fix a page that never held anything.
  if (runsCited < RUNS_TO_CALL_IT_A_PATTERN) return "cited_once";
  return runsSince >= RUNS_TO_CALL_IT_DROPPED ? "dropped" : "slipping";
}

export function buildCitationHistory(answers: PromptAnswer[]): CitationHistory {
  const tallies = tallyRuns(answers);
  const measurable = tallies.filter((run) => run.carried > 0);
  const seen = new Map<string, { url: string; host: string; promptIds: Set<string> }>();
  for (const answer of answers) {
    if (answer.status !== "completed") continue;
    for (const raw of answer.citationUrls) {
      const cited = canonicalUrl(raw);
      if (!cited) continue;
      const held = seen.get(cited.key) || { url: raw, host: cited.host, promptIds: new Set<string>() };
      held.promptIds.add(answer.promptId);
      seen.set(cited.key, held);
    }
  }

  const pages: PageHistory[] = [];
  for (const [key, held] of seen) {
    const runs = measurable.map((run): PageRun => ({ runId: run.runId, at: run.at, cited: run.byPage.get(key) || 0 }));
    const cited = runs.filter((run) => run.cited > 0);
    let runsSince = 0;
    for (let at = runs.length - 1; at >= 0 && !runs[at]?.cited; at -= 1) runsSince += 1;
    pages.push({
      key,
      url: held.url,
      host: held.host,
      runs,
      answers: runs.reduce((sum, run) => sum + run.cited, 0),
      firstCitedAt: cited[0]?.at || null,
      lastCitedAt: cited[cited.length - 1]?.at || null,
      runsSince,
      promptIds: [...held.promptIds].sort(),
      runsCited: cited.length,
      verdict: verdictFor(runs, runsSince, cited.length),
    });
  }

  // Worst first: dropped before slipping, then by how long it has been gone.
  const rank = { dropped: 0, slipping: 1, cited_once: 2, cited: 3 };
  pages.sort((left, right) => {
    const order = (left.verdict ? rank[left.verdict] : 4) - (right.verdict ? rank[right.verdict] : 4);
    return order || right.runsSince - left.runsSince || right.answers - left.answers;
  });

  return {
    pages,
    measurableRuns: measurable.length,
    silentRuns: tallies.length - measurable.length,
    caveat: HISTORY_CAVEAT,
  };
}

/** Pages on one domain that have stopped being cited. Somebody else's page is
 * a finding; your own is the only one you can act on. */
export function droppedOn(history: CitationHistory, domain: string): PageHistory[] {
  const host = domain.trim().toLocaleLowerCase();
  if (!host) return [];
  return history.pages.filter((page) => {
    if (page.verdict !== "dropped") return false;
    const theirs = page.host.toLocaleLowerCase();
    return theirs === host || theirs.endsWith(`.${host}`);
  });
}
