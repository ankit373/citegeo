import { html, join } from "../dom.js";
import { percent, score as scoreText } from "../format.js";
import { section } from "../components/primitives.js";
import { loading, skeletonCard, skeletonText } from "../components/skeleton.js";
import { match, type Loadable } from "../loadable.js";
import { chartHost } from "./overview-charts.js";
import { dayLabel } from "./time-chart.js";
import { headline, heroStats, type Headline, type PositionReport, type ReadingPoint, type RivalSeries, type Standing } from "./dashboard-view.js";

// The overview, in one fixed order: is the data sound, where do I stand, who
// is ahead, which questions do I lose, and which pages decide them.

/** More than this share of a run's answers failing leaves its scores out. */
export const MOSTLY_FAILED = 0.4;

export interface RunRecord {
  id: string;
  startedAt: string;
  status: string;
  answersRequested: number;
  answersCompleted: number;
  answersFailed: number;
  modelIds?: string[] | undefined;
}

export type HealthState = "none" | "healthy" | "partly" | "mostly";

export interface RunHealth {
  state: HealthState;
  /** Finished runs that asked anything, oldest first. */
  runs: RunRecord[];
  latest: RunRecord | null;
  /** Runs whose scores every chart and the headline leave out. */
  left: RunRecord[];
}

function attempted(run: RunRecord): number {
  return run.answersCompleted + run.answersFailed;
}

export function mostlyFailed(run: RunRecord): boolean {
  const asked = attempted(run);
  return asked > 0 && run.answersFailed / asked > MOSTLY_FAILED;
}

export function runHealth(runs: RunRecord[]): RunHealth {
  const done = runs
    .filter((run) => run.status !== "running" && run.status !== "cancelling" && run.status !== "queued" && attempted(run) > 0)
    .sort((left, right) => left.startedAt.localeCompare(right.startedAt));
  const latest = done[done.length - 1] || null;
  const left = done.filter(mostlyFailed);
  const state: HealthState = !latest ? "none"
    : mostlyFailed(latest) ? "mostly"
      : latest.answersFailed > 0 ? "partly" : "healthy";
  return { state, runs: done, latest, left };
}

export function leftOutIds(health: RunHealth): Set<string> {
  return new Set(health.left.map((run) => run.id));
}

/** One plain sentence about the latest run, which is what a reader acts on. */
export function healthSentence(health: RunHealth, readFrom: string | null): string {
  const run = health.latest;
  if (!run) return "No run has finished yet. Run the questions to get a first reading.";
  const when = dayLabel(run.startedAt);
  const asked = attempted(run);
  if (health.state === "healthy") return `All ${asked} answers came back in the run of ${when}.`;
  if (health.state === "partly") {
    return `${run.answersCompleted} of ${asked} answers came back in the run of ${when}. `
      + `${run.answersFailed} failed and are not counted as answers that left you out.`;
  }
  const earlier = readFrom ? ` The figures below are from the run of ${dayLabel(readFrom)}.` : " No earlier run can stand in for it.";
  return `The run of ${when} mostly failed: ${run.answersCompleted} of ${asked} answers came back. `
    + `Its scores are left out of every chart below.${earlier}`;
}

/** The runs left out before the latest one, said once rather than per chart. */
function earlierLeftOut(health: RunHealth): string {
  const earlier = health.left.filter((run) => run !== health.latest);
  if (!earlier.length) return "";
  const first = earlier[0] as RunRecord;
  const said = earlier.length === 1
    ? `The run of ${dayLabel(first.startedAt)} mostly failed: ${first.answersCompleted} of ${attempted(first)} answers came back. Its scores are left out of every chart below.`
    : `${earlier.length} runs mostly failed (${earlier.map((run) => dayLabel(run.startedAt)).join(", ")}). Their scores are left out of every chart below.`;
  return `<p class="ov-callout"><b>Check</b> ${html(said)}</p>`;
}

export function runHealthPanel(health: RunHealth, readFrom: string | null): string {
  const strip = health.runs.length
    ? chartHost("health", {
      runs: health.runs.map((run) => ({ at: run.startedAt, back: run.answersCompleted, asked: attempted(run), left: mostlyFailed(run) })),
    })
    : "";
  return section({
    id: "health",
    title: "Run health",
    wide: true,
    body: join([
      `<div class="ov-health" data-health="${health.state}">`,
      `<p class="ov-sentence${health.state === "mostly" ? " is-failed" : ""}">${html(healthSentence(health, readFrom))}</p>`,
      strip,
      "</div>",
      earlierLeftOut(health),
    ]),
  });
}

/** The score's likely range. Only presence is sampled, so the range scales
 * the score by the presence interval and holds prominence and sentiment. */
export function scoreRange(standing: Standing): { low: number; high: number } | null {
  const interval = standing.presenceInterval;
  const rate = standing.presenceRate;
  if (standing.score === null || !interval || interval.low === null || interval.high === null || !rate) return null;
  return { low: Math.round((standing.score * interval.low) / rate), high: Math.round((standing.score * interval.high) / rate) };
}

export function deltaText(reading: Headline): string {
  if (reading.change === null) return '<span class="ov-delta">Nothing earlier to compare with</span>';
  const since = reading.since ? ` since ${dayLabel(reading.since)}` : "";
  if (reading.change === 0) return `<span class="ov-delta">No change${html(since)}</span>`;
  const up = reading.change > 0;
  return `<span class="ov-delta ${up ? "is-up" : "is-down"}">${up ? "▲" : "▼"} ${Math.abs(reading.change)}${html(since)}</span>`;
}

export interface ScoreInput {
  reading: Headline;
  points: ReadingPoint[];
  left: Set<string>;
  failedAt: string[];
  models: number | null;
  position?: PositionReport | undefined;
  parts: string;
}

export function scorePanel(input: ScoreInput): string {
  const { reading } = input;
  const range = scoreRange(reading.standing);
  const answers = reading.standing.answers;
  const across = input.models ? ` across ${input.models} model${input.models === 1 ? "" : "s"}` : "";
  const note = reading.standing.score === null
    ? "No run has a readable score yet."
    : range
      ? `Likely between ${range.low} and ${range.high}, from ${answers} answers${across}.`
      : `From ${answers} answers${across}.`;
  const points = input.points
    .filter((point) => point.score.score !== null && !point.score.tooFewAnswers && !(point.runId && input.left.has(point.runId)))
    .map((point) => {
      const band = scoreRange(point.score);
      return { at: point.at, score: point.score.score as number, low: band ? band.low : null, high: band ? band.high : null };
    });
  return section({
    id: "score",
    title: "Visibility score",
    body: join([
      `<p class="ov-figure"><strong>${html(scoreText(reading.standing.score))}</strong>${deltaText(reading)}</p>`,
      `<p class="ov-note">${html(note)}</p>`,
      points.length > 1 ? chartHost("score", { points, failed: input.failedAt }) : "",
      input.parts,
    ]),
  });
}

/** The chart's numbers as a table: one row per brand, one column per run. */
export function shareTable(series: RivalSeries[], failedAt: string[]): string {
  const runs = series[0] ? series[0].points : [];
  if (!runs.length) return "";
  const left = new Set(failedAt);
  const heads = runs.map((point) => `<th class="num">${html(dayLabel(point.at))}</th>`).join("");
  const rows = series.map((line) => join([
    "<tr>",
    `<td>${line.isTarget ? `<mark class="you">${html(line.name)}</mark>` : html(line.name)}</td>`,
    line.points.map((point) => `<td class="num">${left.has(point.at) ? "left out" : point.readable === false ? "too few" : html(percent(point.share))}</td>`).join(""),
    "</tr>",
  ])).join("");
  return `<div class="ov-scroll"><table class="ov-table"><thead><tr><th>Brand</th>${heads}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

export function sharePanel(series: RivalSeries[], failedAt: string[], domain: string, view: "chart" | "table"): string {
  const runs = series[0] ? series[0].points.filter((point) => point.readable !== false).length : 0;
  const table = shareTable(series, failedAt);
  const body = view === "table" && table
    ? table
    : runs < 2
      ? '<p class="ov-note">One readable run so far. Run again to see who is moving.</p>'
      : chartHost("share", {
        series: series.length && !series.some((line) => line.isTarget)
          ? [{ name: domain, isTarget: true, points: (series[0]?.points || []).map((point) => ({ ...point, share: 0 })) }, ...series]
          : series,
        failed: failedAt,
        labels: true,
      });
  const toggle = table
    ? `<button type="button" class="ov-link" data-panel-view="trend" data-panel-view-mode="${view === "table" ? "chart" : "table"}">`
      + `${view === "table" ? "Show as chart" : "Show as table"}</button>`
    : "";
  return section({ id: "share", title: "Share of voice against rivals", aside: toggle, body });
}

export interface PromptRow {
  text: string;
  measuresVisibility: boolean;
  score: { answers: number; appearances: number };
  standing?: Array<{ name: string; isTarget: boolean; appearances: number }> | undefined;
}

export interface LostQuestion {
  text: string;
  answers: number;
  named: number;
  winner: { name: string; appearances: number };
}

/** Questions where a rival is named more often than you, widest gap first. */
export function questionsYouLose(prompts: PromptRow[], limit = 5): LostQuestion[] {
  const lost: LostQuestion[] = [];
  for (const prompt of prompts) {
    if (!prompt.measuresVisibility || prompt.score.answers === 0) continue;
    const rivals = (prompt.standing || []).filter((row) => !row.isTarget).sort((a, b) => b.appearances - a.appearances);
    const winner = rivals[0];
    if (!winner || winner.appearances <= prompt.score.appearances) continue;
    lost.push({ text: prompt.text, answers: prompt.score.answers, named: prompt.score.appearances, winner });
  }
  return lost
    .sort((a, b) => (b.winner.appearances - b.named) / b.answers - (a.winner.appearances - a.named) / a.answers || a.named - b.named)
    .slice(0, limit);
}

export function losePanel(prompts: PromptRow[]): string {
  const rows = questionsYouLose(prompts);
  const body = !rows.length
    ? '<p class="ov-note">No question has a rival named more often than you.</p>'
    : join([
      '<table class="ov-table"><thead><tr><th>Question</th><th class="num">You named</th><th>Named most</th></tr></thead><tbody>',
      rows.map((row) => join([
        "<tr>",
        `<td>${html(row.text)}</td>`,
        `<td class="num${row.named === 0 ? " is-down" : ""}">${row.named} of ${row.answers}</td>`,
        `<td>${html(row.winner.name)} <span class="ov-of">${row.winner.appearances} of ${row.answers}</span></td>`,
        "</tr>",
      ])).join(""),
      "</tbody></table>",
    ]);
  return section({
    id: "lose",
    title: "Questions you lose",
    aside: '<button type="button" class="ov-link" data-page="prompts">All questions</button>',
    body,
  });
}

export interface CitedPage { url: string; owner: string; citedBy: number; namesYou: boolean }

function bareUrl(url: string): string {
  const cut = url.indexOf("://");
  const rest = cut < 0 ? url : url.slice(cut + 3);
  const tail = rest.startsWith("www.") ? rest.slice(4) : rest;
  return tail.endsWith("/") ? tail.slice(0, -1) : tail;
}

export function pagesPanel(pages: CitedPage[] | null, unavailable: boolean, failed = false, limit = 5): string {
  const body = failed
    ? '<p class="ov-note">Could not read the cited pages. Reload the page to try again.</p>'
    : unavailable
    ? '<p class="ov-note">No answer carried a source, so there is no cited page to show. Turn on a model that searches the web.</p>'
    : pages === null
      ? loading("the cited pages", skeletonCard({ rows: 5, columns: "minmax(0,1fr) 48px 64px" }))
      : !pages.length
        ? '<p class="ov-note">No answer has cited a page yet.</p>'
        : join([
          '<table class="ov-table"><thead><tr><th>Page</th><th class="num">Cited</th><th>Names you</th></tr></thead><tbody>',
          [...pages].sort((a, b) => b.citedBy - a.citedBy).slice(0, limit).map((page) => {
            const yours = page.owner === "yours";
            const label = html(bareUrl(page.url));
            return join([
              "<tr>",
              `<td class="ov-url"><a href="${html(page.url)}" target="_blank" rel="noopener noreferrer">${yours ? `<mark class="you">${label}</mark>` : label}</a></td>`,
              `<td class="num">${page.citedBy}</td>`,
              `<td>${yours ? "Yes, your page" : page.namesYou ? "Yes" : "No"}</td>`,
              "</tr>",
            ]);
          }).join(""),
          "</tbody></table>",
        ]);
  return section({
    id: "pages",
    title: "Pages the models cite",
    aside: '<button type="button" class="ov-link" data-page="answer-engine">All sources</button>',
    body,
  });
}

export interface OverviewData {
  domain: string;
  runs: RunRecord[];
  insights: { overall: Standing; rank: number | null; trend: { change: number | null; since?: string | null | undefined; points: ReadingPoint[] } };
  position?: PositionReport | undefined;
  rivalTrend: RivalSeries[];
  shareView: "chart" | "table";
  prompts: PromptRow[];
  pages: CitedPage[] | null;
  pagesFailed?: boolean | undefined;
  citationsUnavailable: boolean;
}

/** The panel order is the product's argument, so it is fixed. */
export const OVERVIEW_ORDER = ["health", "score", "share", "lose", "pages"];

export function overviewSkeleton(): string {
  return loading("the overview", join([
    '<div class="ov-grid">',
    `<section class="section-card ov-health-slot">${skeletonText(2)}</section>`,
    `<section class="section-card">${skeletonCard({ rows: 3, columns: "minmax(0,1fr)" })}</section>`,
    `<section class="section-card">${skeletonCard({ rows: 4, columns: "minmax(0,1fr)" })}</section>`,
    "</div>",
  ]));
}

export function overviewBody(held: Loadable<OverviewData>): string {
  return match(held, {
    loading: () => overviewSkeleton(),
    error: (error) => `<div class="warning-box">${html(error)}</div>`,
    ready: (data) => {
      const health = runHealth(data.runs);
      const left = leftOutIds(health);
      const failedAt = health.left.map((run) => run.startedAt);
      const reading = headline(data.insights, left);
      const run = health.runs.find((item) => item.startedAt === reading.at);
      return join([
        '<div class="ov-grid">',
        runHealthPanel(health, reading.at),
        scorePanel({
          reading,
          points: data.insights.trend.points,
          left,
          failedAt,
          models: run && run.modelIds ? run.modelIds.length : null,
          parts: heroStats(reading.standing, data.position),
        }),
        sharePanel(data.rivalTrend, failedAt, data.domain, data.shareView),
        losePanel(data.prompts),
        pagesPanel(data.pages, data.citationsUnavailable, data.pagesFailed === true),
        "</div>",
      ]);
    },
  });
}

