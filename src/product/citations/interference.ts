import { canonicalUrl } from "./canonical-url.js";
import type { PromptAnswer, PromptRun } from "../topics/prompt-run-schema.js";
import type { SourcePage } from "./source-page.js";

// Documents rewritten to match what an engine likes to cite push themselves
// into answers, and published work puts that at roughly half of attempts. The
// rewrites stay factually consistent with the originals, so nothing that checks
// facts will catch one.
//
// What is left is shape. A source that arrives everywhere at once did not grow
// there, and a page that changed under a URL an answer already cites is a page
// somebody worked on. Neither proves intent, and this reports them as flags.

/** Questions a host has to arrive across before arriving at all is notable.
 * One question is a citation; most of them at once is a pattern. */
export const BROAD_ARRIVAL = 0.5;

/** How much of a page has to be new before a re-read counts as a change
 * rather than a date in a footer moving. */
export const PAGE_SHIFT = 0.35;

export const INTERFERENCE_CAVEAT = "These are shapes, not findings. A source can arrive across many questions at once because somebody published something good, and a page can change because it was edited. Published work puts rewrites aimed at being cited at around half of attempts and notes they stay factually consistent with the original, which is why nothing here checks facts and nothing here claims intent.";

export interface SourceArrival {
  host: string;
  /** When the run it first appeared in started. */
  arrivedAt: string;
  /** Questions it was cited for in that run, over questions that run cited
   * anything for. A host that arrives across most of them did not grow there. */
  breadth: number;
  questionsAtArrival: number;
  questionsInRun: number;
  /** False where this was the first run, which everything arrived in. */
  sudden: boolean;
}

export interface PageShift {
  url: string;
  host: string;
  /** Share of the page's words that are new since the previous read. */
  changed: number;
  readAt: string;
  previousAt: string;
}

export interface InterferenceReport {
  /** Runs with a citation in them, which is what an arrival is measured against. */
  runs: number;
  /** Hosts cited in exactly one run. They did not grow in over several; they
   * turned up once, which is a different thing from either of the shapes here. */
  arrivedOnce: number;
  arrivals: SourceArrival[];
  shifts: PageShift[];
  caveat: string;
}

function words(value: string): Set<string> {
  return new Set(value.toLocaleLowerCase().split(" ").map((word) => word.trim()).filter((word) => word.length > 3));
}

/** Share of the later text that was not in the earlier one, over the same
 * region of the page. Null where either side is too short to compare, which is
 * unknown and not unchanged.
 *
 * The two reads can have been capped at different lengths, and comparing all of
 * a long read against a truncated one reports a page that merely got read
 * further as a page that was rewritten. */
export function textShift(before: string, after: string): number | null {
  const region = Math.min(before.length, after.length);
  const was = words(before.slice(0, region));
  const now = words(after.slice(0, region));
  if (was.size < 20 || now.size < 20) return null;
  let fresh = 0;
  for (const word of now) if (!was.has(word)) fresh += 1;
  return fresh / now.size;
}

export function buildInterferenceReport(input: {
  answers: PromptAnswer[];
  runs: PromptRun[];
  pages: SourcePage[];
}): InterferenceReport {
  const completed = input.answers.filter((answer) => answer.status === "completed");
  const runOrder = [...input.runs].sort((left, right) => left.startedAt.localeCompare(right.startedAt));
  const position = new Map(runOrder.map((run, index) => [run.id, index]));

  // Host to the earliest run it was cited in, and the questions it reached there.
  const firstSeen = new Map<string, number>();
  const perRun = new Map<number, { questions: Set<string>; byHost: Map<string, Set<string>>; startedAt: string }>();

  for (const answer of completed) {
    const index = position.get(answer.runId);
    if (index === undefined) continue;
    const hosts = new Set<string>();
    for (const raw of answer.citationUrls) {
      const cited = canonicalUrl(raw);
      if (cited) hosts.add(cited.host);
    }
    // A run that cited nothing is not a run a host failed to arrive in, so it
    // is not recorded at all rather than recorded as empty.
    if (!hosts.size) continue;
    const run = perRun.get(index) || { questions: new Set<string>(), byHost: new Map<string, Set<string>>(), startedAt: runOrder[index]?.startedAt || answer.createdAt };
    run.questions.add(answer.promptId);
    for (const host of hosts) {
      const seen = run.byHost.get(host) || new Set<string>();
      seen.add(answer.promptId);
      run.byHost.set(host, seen);
      const earliest = firstSeen.get(host);
      if (earliest === undefined || index < earliest) firstSeen.set(host, index);
    }
    perRun.set(index, run);
  }

  const withCitations = [...perRun.keys()].sort((left, right) => left - right);
  const firstWithCitations = withCitations[0];

  const arrivals: SourceArrival[] = [];
  for (const [host, index] of firstSeen) {
    const run = perRun.get(index);
    if (!run) continue;
    const reached = run.byHost.get(host)?.size || 0;
    const total = run.questions.size;
    const breadth = total ? reached / total : 0;
    arrivals.push({
      host,
      arrivedAt: run.startedAt,
      breadth,
      questionsAtArrival: reached,
      questionsInRun: total,
      // Everything arrived in the first run that cited anything, so nothing in
      // it is sudden. Calling them all suspicious would be the same as none.
      sudden: index !== firstWithCitations && breadth >= BROAD_ARRIVAL && total > 1,
    });
  }
  // The host breaks ties, so two arrivals alike do not swap places between two
  // requests for the same data.
  arrivals.sort((left, right) => Number(right.sudden) - Number(left.sudden) || right.breadth - left.breadth || left.host.localeCompare(right.host));

  const shifts: PageShift[] = [];
  for (const page of input.pages) {
    const before = page.previousText;
    if (!before || !page.text || !page.previousFetchedAt) continue;
    const changed = textShift(before, page.text);
    if (changed === null || changed < PAGE_SHIFT) continue;
    shifts.push({
      url: page.url,
      host: page.host,
      changed: Math.round(changed * 1000) / 1000,
      readAt: page.fetchedAt,
      previousAt: page.previousFetchedAt,
    });
  }
  shifts.sort((left, right) => right.changed - left.changed);

  const runsPerHost = new Map<string, Set<number>>();
  for (const [index, run] of perRun) {
    for (const host of run.byHost.keys()) {
      const seen = runsPerHost.get(host) || new Set<number>();
      seen.add(index);
      runsPerHost.set(host, seen);
    }
  }
  const arrivedOnce = [...runsPerHost.values()].filter((runs) => runs.size === 1).length;

  return { runs: withCitations.length, arrivedOnce, arrivals, shifts, caveat: INTERFERENCE_CAVEAT };
}
