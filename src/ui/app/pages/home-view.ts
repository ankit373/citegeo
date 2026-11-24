import { html } from "../dom.js";
import { sparkline } from "../components/chart.js";
import { button } from "../components/button.js";
import { emptyState, notice } from "../components/primitives.js";
import { hasPanelOrder } from "../components/reorder.js";
import { loading, skeletonText } from "../components/skeleton.js";
import { score as scoreText } from "../format.js";
import { alertPill } from "../labels.js";
import { deltaPill } from "../components/badges.js";
import { boardStatus, dashboardBody, headline, heroStats, type AssistantLink, type DashboardData, type MatrixData } from "./dashboard-view.js";
import { renderLiveRun } from "./run-pane.js";
import { renderTasks } from "./task-views.js";
import type { InsightsShape, LoadState, ProjectRow, RunRow } from "../types.js";
import type { HomeSummary } from "../../../product/alerts/home-summary.js";
import type { RankingPlan } from "../../../product/topics/ranking-plan.js";
import type { OutreachPlan } from "../../../product/citations/outreach.js";
import type { SearchConsoleService, SearchConsoleStatus } from "../../../product/search-console/search-console-service.js";
import type { CitationAnalysis } from "../../../product/topics/citation-analysis.js";
import type { CitationStanding } from "../../../product/topics/position-metrics.js";
import type { MeasurementTask } from "../../../product/topics/next-task.js";
import type { PromptStanding } from "../../../product/topics/topic-insights.js";

/** What moved since the previous run, in sentences. Only built when
 * something did: a digest that usually says nothing stops being read. */
export interface AnswerDigest {
  headline: string;
  newsworthy: boolean;
  lines: string[];
  builtAt: string;
}

/** The assistant referrals route: the status plus the link it computes on the server. */
export type ReferralsPayload = Awaited<ReturnType<SearchConsoleService["referrals"]>> & { link?: { rows: AssistantLink[]; caveat: string } };

/** The cited-pages route: the analysis plus the standing it computes beside it. */
export type CitedPages = CitationAnalysis & { standing: CitationStanding };

/** The part of the app state the dashboard is drawn from, so the state itself fits. */
export interface DashboardState {
  home: HomeSummary | null;
  homeState: LoadState;
  answerEngine: InsightsShape | null;
  answerEngineState: LoadState;
  outreach: OutreachPlan | null;
  rankPlan: RankingPlan | null;
  rankPlanState: LoadState;
  referrals: ReferralsPayload | null;
  searchDemand: SearchConsoleStatus | null;
  cited: CitedPages | null;
  brandIcons: Record<string, string | null>;
  matrixOpen: string[];
  matrixHidden: string[];
}

export interface HomeState extends DashboardState {
  outreachState: LoadState;
  digest: AnswerDigest | null;
  digestState: LoadState;
  searchDemandState: LoadState;
  referralsState: LoadState;
  editingBoard: boolean;
  panelViews: Record<string, "chart" | "table">;
  liveRun: RunRow | null;
}

/** The loaders Home fires while each read is idle. Each must be a hoisted function declaration that reads live state. */
export interface HomeActions {
  loadHome(): void;
  loadAnswerEngine(): void;
  loadOutreach(): void;
  loadRankingPlan(): void;
  loadDigest(): void;
  loadSearchDemand(): void;
  loadReferrals(): void;
}

/** The button that starts a run, or watches the one in progress. Passed in because several pages draw it. */
export type RunAction = (label: string, enabled?: boolean) => string;

/** Built from the same figures the answer engine reports, so two screens cannot
 * disagree, and outside the renderer so the side pane can redraw one panel. */
export function dashboardView(state: DashboardState, selected: ProjectRow | null): DashboardData | null {
  const home = state.home;
  const data = state.answerEngine;
  if (!selected || !home || !data || boardStatus(state.homeState, state.answerEngineState) !== "ready") return null;
  const reading = headline(data);
  const outreach = state.outreach;
  const plan = state.rankPlan;
  const questions = data ? data.topics.reduce((total, topic) => total + topic.prompts.length, 0) : 0;
  const measurable = data ? data.topics.reduce((total, topic) => total + topic.prompts.filter((p) => p.measuresVisibility).length, 0) : 0;

  const view: DashboardData = {
    matrix: buildMatrix(data, String(home.domain || selected.normalizedDomain), state.brandIcons),
    matrixOpen: state.matrixOpen,
    matrixHidden: state.matrixHidden,
    regionCaveat: data ? data.regionCaveat : "",
    // Computed on the server, where both halves live. The view reads it.
    link: (() => {
      const held = state.referrals;
      const link = held ? held.link : null;
      return link && Array.isArray(link.rows) && link.rows.length ? link : undefined;
    })(),
    demand: (() => {
      const held = state.searchDemand;
      if (!held) return undefined;
      const report = held.report;
      const rows = report ? report.prompts || [] : [];
      return {
        configured: Boolean(held.configured && held.siteUrl),
        pulled: Boolean(report),
        impressions: rows.reduce((total, row) => total + (Number(row.impressions) || 0), 0),
        clicks: rows.reduce((total, row) => total + (Number(row.clicks) || 0), 0),
        gaps: rows.filter((row) => row.earnedInSearchAbsentInAnswers).length,
        top: [...rows].sort((a, b) => (Number(b.impressions) || 0) - (Number(a.impressions) || 0))
          .filter((row) => (Number(row.impressions) || 0) > 0)
          .map((row) => ({ text: String(row.text), impressions: Number(row.impressions) || 0, position: row.position ?? null })),
      };
    })(),
    arrivals: (() => {
      const held = state.referrals;
      if (!held) return undefined;
      const report = held.report;
      const rows = report ? report.assistants || [] : [];
      return {
        configured: Boolean(held.configured && held.propertyId),
        pulled: Boolean(report),
        sessions: rows.reduce((total, row) => total + (Number(row.sessions) || 0), 0),
        assistants: rows.map((row) => ({ source: String(row.source), sessions: Number(row.sessions) || 0, engaged: Number(row.engaged) || 0 })),
      };
    })(),
    domain: String(home.domain || selected.normalizedDomain),
    score: reading.standing.score,
    change: reading.change,
    rank: reading.rank,
    overall: data ? data.overall : { score: null, presenceRate: null, prominence: null, sentiment: null, answers: 0, appearances: 0, namedIn: 0, tooFewAppearances: true },
    leaderboard: data ? data.leaderboard.map((row) => ({
      name: row.name,
      domain: row.domain ?? null,
      icon: row.domain ? state.brandIcons[row.domain] ?? null : null,
      isTarget: row.isTarget,
      appearances: row.appearances,
      shareOfAnswers: row.shareOfAnswers,
      prominence: row.prominence ?? null,
      positive: row.positive ?? 0,
      negative: row.negative ?? 0,
    })) : [],
    byModel: data ? data.byModel.map((row) => ({ label: row.displayName, score: row.score.score, answers: row.score.answers, rank: null })) : [],
    byRegion: data ? data.byRegion.map((row) => ({ id: row.regionId, label: row.label, score: row.score.score, answers: row.score.answers, rank: row.rank })) : [],
    byPersona: data ? data.byPersona.map((row) => ({ label: row.label, score: row.score.score, answers: row.score.answers, rank: row.rank })) : [],
    questions,
    measurable,
    absent: data ? data.absentFrom.length : 0,
    // The models that actually answered. byModel carries every model the
    // archive has ever seen, and fourteen of this project's twenty four
    // have never produced an answer, so "3 of 24" was over a denominator
    // more than twice the number that were asked.
    assistants: data ? data.byModel.filter((row) => row.score.answers > 0).length : 0,
    assistantsConfigured: data ? data.byModel.length : 0,
    assistantsNaming: data ? data.byModel.filter((row) => row.score.appearances > 0).length : 0,
    moves: plan && state.rankPlanState === "ready" ? plan.moves.filter((m) => m.effect === "raises_visibility")
      : state.rankPlanState === "error" ? [] : null,
    citationsUnavailable: data ? data.citationsUnavailable : false,
    citedPages: outreach ? outreach.cited : null,
    missingFrom: outreach ? outreach.targets.filter((t) => !t.namesYou).length : null,
    spark: data ? sparkline(data.trend.points, 170, 30) : "",
    position: data ? data.position : undefined,
    citation: state.cited ? state.cited.standing : undefined,
    asked: (() => {
      if (!data) return undefined;
      const prompts = data.topics.flatMap((topic) => topic.prompts);
      const earned = prompts.filter((row) => row.measuresVisibility);
      const byName = prompts.filter((row) => !row.measuresVisibility);
      const sum = <T>(rows: T[], pick: (row: T) => number) => rows.reduce((total, row) => total + pick(row), 0);
      const judged = byName.filter((row): row is PromptStanding & { score: { sentiment: number } } => row.score.sentiment !== null);
      return {
        unbranded: {
          prompts: earned.length,
          answers: sum(earned, (row) => row.score.answers),
          appearances: sum(earned, (row) => row.score.appearances),
          score: earned.length ? Math.round(sum(earned, (row) => row.score.score || 0) / earned.length) : null,
        },
        branded: {
          prompts: byName.length,
          answers: sum(byName, (row) => row.score.answers),
          // Averaging over the judged ones only: an unjudged answer is not a zero.
          sentiment: judged.length ? sum(judged, (row) => row.score.sentiment) / judged.length : null,
        },
      };
    })(),
    rivalTrend: data && data.trend && data.trend.rivals ? data.trend.rivals.map((row) => ({
      name: row.name, isTarget: row.isTarget,
      domain: (data.leaderboard || []).find((entry) => entry.name === row.name)?.domain ?? null,
      icon: state.brandIcons[(data.leaderboard || []).find((entry) => entry.name === row.name)?.domain || ""] ?? null,
      points: row.points.map((point) => ({ at: point.at, share: point.share, answers: point.answers, readable: point.readable })),
    })) : [],
    alerts: home.alerts.length,
  };

  return view;
}

export function renderHome(state: HomeState, selected: ProjectRow | null, tasks: MeasurementTask[], runAction: RunAction, actions: HomeActions): string {
  if (!selected) return '<section class="view">' + emptyState("Create a project first", "Everything here reports on one domain.") + '</section>';
  if (state.homeState === "idle") { actions.loadHome(); }
  if (state.answerEngineState === "idle") { actions.loadAnswerEngine(); }
  if (state.outreachState === "idle") { actions.loadOutreach(); }
  if (state.rankPlanState === "idle") { actions.loadRankingPlan(); }
  if (state.digestState === "idle") { actions.loadDigest(); }
  if (state.searchDemandState === "idle") { actions.loadSearchDemand(); }
  if (state.referralsState === "idle") { actions.loadReferrals(); }

  const heading = (body: string): string => '<section class="view"><div class="heading"><div class="headmain"><h1>'
    + html(selected.name) + '</h1><p class="subtle">' + html(String((state.home && state.home.domain) || selected.normalizedDomain)) + '</p></div>'
    + '<div class="inline-actions">'
    + button({ label: state.editingBoard ? "Done arranging" : "Arrange board", kind: state.editingBoard ? "secondary" : "quiet", on: { "data-edit-board": true } })
    + (hasPanelOrder() ? button({ label: "Reset layout", kind: "quiet", on: { "data-reset-panels": true } }) : '')
    + button({ label: "Full report", on: { "data-page": "answer-engine" } }) + ''
    + runAction("Run prompts") + '</div></div>' + renderLiveRun(state.liveRun) + body + '</section>';

  if (state.homeState === "error") return heading(notice("Could not read this project.", "error"));
  if (state.homeState !== "ready" || !state.home) return heading(dashboardBody({ status: "loading" }));

  const home = state.home;
  if (home.showSetupOnly) {
    const steps = home.setup.map((step, index) => '<div class="mrow mcols-step" data-state="' + (step.done ? "done" : "todo") + '">'
      + '<span class="mcell mono">' + (step.done ? "\u2713" : String(index + 1)) + '</span>'
      + '<div class="mname"><strong>' + html(step.label) + '</strong><span class="subtle">' + html(step.detail) + '</span></div>'
      + '<span class="mcell">' + (step.done ? '<span class="state-ok">Done</span>' : button({ label: "Open", kind: "link", on: { "data-page": (step.id === "models" ? "models" : "prompts") } })) + '</span></div>').join("");
    return heading('<section class="section-card"><div class="mtable"><div class="mhead mcols-step"><span></span><span>Step</span><span></span></div>' + steps + '</div></section>');
  }

  if (state.answerEngineState === "error") return heading(notice("Could not read this project.", "error"));
  const view = dashboardView(state, selected);
  if (!view || !state.answerEngine) return heading(dashboardBody({ status: "loading" }));
  const reading = headline(state.answerEngine);
  const rankText = reading.rank === null ? "Not named" : "#" + reading.rank + (reading.at ? "" : " of " + ((home.rivals || 0) + 1));
  const hero = '<div class="hero"><div class="hero-figure"><span class="scorebig">' + scoreText(reading.standing.score) + '</span>'
    + '<span class="hero-sub">' + deltaPill({ change: reading.change }) + '<span>' + html(rankText) + '</span>'
    + (reading.at ? '<span>run of ' + html(reading.at.slice(0, 10)) + '</span>' : '') + '</span>'
    + '<span class="hero-spark">' + view.spark + '</span></div>' + heroStats(reading.standing, view.position) + '</div>';

  const alerts = home.alerts.length
    ? '<div class="alertlist">' + home.alerts.map((alert) => '<div class="alertrow"><span class="pill ' + alertPill(alert.severity) + '">' + html(alert.severity) + '</span><div><strong>' + html(alert.headline) + '</strong><p class="subtle">' + html(alert.detail) + '</p></div></div>').join("") + '</div>'
    : '<p class="subtle">Nothing moved since the previous run.</p>';

  const digest = state.digest;
  const changed = state.digestState === "loading"
    ? loading("what changed", skeletonText(3))
    : digest && digest.lines.length
      ? '<p class="changed-headline">' + html(digest.headline) + '</p><ul class="protocol-list">'
        + digest.lines.map((line: string) => '<li>' + html(line) + '</li>').join("") + '</ul>'
      : '<p class="subtle">Nothing has moved since the previous run.</p>';

  return heading(hero
    + renderTasks(tasks, 3)
    + dashboardBody({ status: "ready", value: view }, state.editingBoard, state.panelViews)
    + '<section class="section-card"><div class="section-head"><div class="headmain"><h2>What changed</h2><p class="subtle">Read off the archived answers, in the words the evidence supports.</p></div></div>' + changed + '</section>'
    + '<section class="section-card"><div class="section-head"><div class="headmain"><h2>Needs attention</h2><p class="subtle">Only what moved, and only where both runs could be measured.</p></div></div>' + alerts + '</section>');
}

/** Topics, their subtopics and their prompts against every brand named,
 * with the columns fixed by the overall order so rows stay comparable. */
export function buildMatrix(data: InsightsShape | null, own: string, brandIcons: Record<string, string | null>): MatrixData | undefined {
  if (!data || !data.topics || !data.topics.length) return undefined;
  // The reader's own column is never cut. Taking the top eight outright
  // drops a brand ranked ninth, and every row then reads as never named.
  const board = (data.leaderboard || []);
  // Never being named keeps a brand off the leaderboard entirely, and a
  // grid with no column for the reader cannot show them anything.
  const found = board.filter((row) => row.isTarget);
  const mine = found.length ? found : [{ name: own, domain: null, isTarget: true }];
  const rivals = board.filter((row) => !row.isTarget).slice(0, 7);
  const columns = [...mine, ...rivals].map((row) => ({ name: String(row.name), domain: row.domain ?? null, icon: row.domain ? brandIcons[row.domain] ?? null : null, isTarget: !!row.isTarget }));
  if (!columns.length) return undefined;
  const shareIn = (standing: any[]) => columns.map((column) => {
    const found = (standing || []).find((row) => row.name === column.name);
    return found ? (found.shareOfAnswers ?? null) : null;
  });
  const rows: any[] = [];
  for (const topic of data.topics) {
    const subs = topic.subtopics || [];
    const key = "t:" + topic.topicId;
    rows.push({ key, parent: "", depth: 0, label: topic.name, shares: shareIn(topic.standing), children: subs.length || (topic.prompts || []).length });
    for (const sub of subs) {
      const subKey = key + "/s:" + sub.name;
      rows.push({ key: subKey, parent: key, depth: 1, label: sub.name, shares: shareIn(sub.standing), children: (sub.prompts || []).length });
      for (const prompt of sub.prompts || []) {
        rows.push({ key: subKey + "/p:" + prompt.promptId, parent: subKey, depth: 2, label: prompt.text, shares: shareIn(prompt.standing), children: 0 });
      }
    }
    // A set nobody grouped opens straight onto its questions, rather than
    // onto one subtopic invented to fill the level.
    if (!subs.length) {
      for (const prompt of topic.prompts || []) {
        rows.push({ key: key + "/p:" + prompt.promptId, parent: key, depth: 1, label: prompt.text, shares: shareIn(prompt.standing), children: 0 });
      }
    }
  }
  return { columns, rows };
}