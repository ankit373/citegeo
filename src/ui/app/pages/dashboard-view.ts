import { html, join } from "../dom.js";
import { percent, rank as rankText, score as scoreText } from "../format.js";
import { bar, cell, nameCell, pill, row, section, table, tiles, type TileInput } from "../components/primitives.js";
import { loading, skeletonCard, skeletonTiles } from "../components/skeleton.js";
import { match, type Loadable } from "../loadable.js";
import { panelOrder } from "../components/reorder.js";

// The dashboard answers four questions in order: where do I stand, what moved,
// what would move it, and who is taking the ground. Everything here comes from
// the same figures the answer engine reports, so two screens cannot disagree.

export interface Standing {
  score: number | null;
  presenceRate: number | null;
  prominence: number | null;
  sentiment: number | null;
  answers: number;
  appearances: number;
}

export interface NamedEntity {
  name: string;
  isTarget: boolean;
  appearances: number;
  shareOfAnswers: number | null;
  /** How early in the answer, 0 to 1. Null when no answer gave a readable order. */
  prominence?: number | null;
  /** Answers that recommended or listed this brand, and that did not. */
  positive?: number;
  negative?: number;
}

export interface Split {
  label: string;
  score: number | null;
  answers: number;
  rank: number | null;
}

export interface Move {
  title: string;
  evidence: string;
  effect: string;
}

export interface DashboardData {
  /** Empty until two runs exist, which the chart reports rather than hides. */
  rivalTrend?: RivalSeries[];
  asked?: AskedSplit | undefined;
  domain: string;
  score: number | null;
  change: number | null;
  rank: number | null;
  overall: Standing;
  leaderboard: NamedEntity[];
  byModel: Split[];
  byRegion: Split[];
  byPersona: Split[];
  questions: number;
  measurable: number;
  absent: number;
  assistants: number;
  assistantsNaming: number;
  moves: Move[];
  citationsUnavailable: boolean;
  citedPages: number | null;
  missingFrom: number | null;
  spark: string;
  alerts: number;
}

/** The four figures the score is built from, never the composite alone. */
export function heroStats(standing: Standing): string {
  const stat = (label: string, value: string, note: string): string =>
    `<div class="hero-stat"><span>${html(label)}</span><strong>${html(value)}</strong><small>${html(note)}</small></div>`;
  return join([
    '<div class="hero-stats">',
    stat("Presence", percent(standing.presenceRate), `${standing.appearances} of ${standing.answers} named you`),
    stat("Prominence", percent(standing.prominence), "how early you appear"),
    stat("Sentiment", percent(standing.sentiment), "recommended or listed"),
    "</div>",
  ]);
}

export function summaryTiles(data: DashboardData): string {
  const rows: TileInput[] = [
    {
      label: "Questions tracked",
      value: String(data.questions),
      note: `${data.measurable} can measure visibility`,
      fraction: data.questions ? data.measurable / data.questions : null,
    },
    {
      label: "Never named in",
      value: String(data.absent),
      note: data.absent ? "answered, and you were not named once" : "every answered question named you",
      fraction: data.questions ? data.absent / data.questions : null,
      tone: data.absent ? "state-bad" : "state-ok",
    },
    {
      label: "Assistants asked",
      value: String(data.assistants),
      note: `${data.assistantsNaming} named you at least once`,
      fraction: data.assistants ? data.assistantsNaming / data.assistants : null,
    },
    {
      label: "Needs attention",
      value: String(data.alerts),
      note: data.alerts ? "see below" : "nothing right now",
      tone: data.alerts ? "state-flag" : "",
    },
  ];
  return tiles(rows);
}

/** Share of the answers, drawn against the strongest so the gap is the length
 * of the bar rather than a number to be compared by eye. */
export function leaderboardBars(rows: NamedEntity[]): string {
  if (!rows.length) return '<p class="subtle">No organisation has been named yet.</p>';
  const top = rows.slice(0, 6);
  const most = Math.max(1, ...top.map((entry) => entry.appearances));
  return `<div class="dbars">${top.map((entry) => join([
    `<div class="dbar${entry.isTarget ? " is-you" : ""}">`,
    `<span class="dbar-name">${html(entry.name)}${entry.isTarget ? ` ${pill("You", "good")}` : ""}</span>`,
    `<span class="dbar-track"><i style="width:${Math.round(entry.appearances / most * 100)}%"></i></span>`,
    `<span class="dbar-value">${entry.appearances} · ${percent(entry.shareOfAnswers)}</span>`,
    "</div>",
  ])).join("")}</div>`;
}

/** The same brands as the bars, with the three things a bar cannot carry:
 * how early each one appears, and how it is spoken about. */
export function brandsTable(rows: NamedEntity[]): string {
  return table({
    layout: "mcols-brand",
    columns: ["Brand", "Named in", "Share", "Prominence", "Described"],
    empty: "No organisation has been named yet.",
    rows: rows.slice(0, 8).map((entry) => {
      const judged = (entry.positive || 0) + (entry.negative || 0);
      // Every count opens the answers it counted, because a number nobody can
      // check is the thing this tool exists not to print.
      const open = (label: string, tone: string, klass = "") =>
        `<button type="button" class="mcell countlink ${klass}" data-brand-evidence="${html(entry.name)}" data-brand-tone="${tone}"`
        + ` title="Open the archived answers behind this">${label}</button>`;
      const described = judged === 0
        ? cell("not judged", "state-flag")
        : entry.negative
          ? open(`${entry.positive || 0} positive · ${entry.negative} negative`, "")
          : open(`${entry.positive || 0} positive`, "positive", "state-ok");
      return row("mcols-brand", [
        nameCell(html(entry.name), entry.isTarget ? "You" : ""),
        open(String(entry.appearances), ""),
        cell(percent(entry.shareOfAnswers)),
        cell(entry.prominence === null || entry.prominence === undefined ? "not readable" : percent(entry.prominence)),
        described,
      ]);
    }),
  });
}

export interface RivalSeries {
  name: string;
  isTarget: boolean;
  points: Array<{ at: string; share: number }>;
}

const SERIES_INK = ["var(--accent)", "#6B8CAE", "#8B7FBF", "#6FA88A", "#B98A5E", "#A6748F"];

/** Pushes labels apart so two lines ending at the same height do not print
 * on top of each other. */
function spread(values: number[], gap: number): number[] {
  const order = values.map((y, index) => ({ y, index })).sort((left, right) => left.y - right.y);
  let last = -Infinity;
  for (const item of order) {
    if (item.y - last < gap) item.y = last + gap;
    last = item.y;
  }
  const out = values.slice();
  for (const item of order) out[item.index] = item.y;
  return out;
}

function runLabel(at: string): string {
  if (!at) return "";
  const when = new Date(at);
  if (Number.isNaN(when.getTime())) return "";
  return when.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Every brand's share across the runs, on one axis. Share rather than score,
 * because a rival has no score here, only a presence in the answers. */
export function rivalChart(series: RivalSeries[], domain: string): string {
  const runs = series[0] ? series[0].points.length : 0;
  if (runs < 2) return '<p class="subtle">One run so far. Run again to see movement.</p>';

  const first = series[0];
  if (!first) return '<p class="subtle">Nothing has been named yet.</p>';
  // A brand nobody named has no series at all, and that absence is the whole
  // finding, so it is drawn flat at zero rather than left off the chart.
  const drawn = series.some((row) => row.isTarget)
    ? series
    : [{ name: domain, isTarget: true, points: first.points.map((point) => ({ at: point.at, share: 0 })) }, ...series];

  const width = 760;
  const height = 230;
  const pad = { left: 38, right: 168, top: 14, bottom: 30 };
  const plot = { w: width - pad.left - pad.right, h: height - pad.top - pad.bottom };
  const x = (index: number) => pad.left + (runs === 1 ? plot.w : (index * plot.w) / (runs - 1));
  const y = (share: number) => pad.top + (1 - Math.max(0, Math.min(1, share))) * plot.h;

  const grid = [0, 0.25, 0.5, 0.75, 1].map((value) => {
    const labelled = value === 0 || value === 0.5 || value === 1;
    return join([
      `<line class="ch-grid" x1="${pad.left}" x2="${width - pad.right}" y1="${y(value).toFixed(1)}" y2="${y(value).toFixed(1)}"></line>`,
      labelled ? `<text class="ch-tick" x="${pad.left - 8}" y="${(y(value) + 3.5).toFixed(1)}" text-anchor="end">${Math.round(value * 100)}%</text>` : "",
    ]);
  }).join("");

  const axis = join([
    `<line class="ch-axis" x1="${pad.left}" x2="${width - pad.right}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}"></line>`,
    first.points.map((point, index) => {
      const anchor = index === 0 ? "start" : index === runs - 1 ? "end" : "middle";
      return `<text class="ch-tick" x="${x(index).toFixed(1)}" y="${(height - 10).toFixed(1)}" text-anchor="${anchor}">${html(runLabel(point.at))}</text>`;
    }).join(""),
  ]);

  const inkFor = (row: RivalSeries, index: number) => (row.isTarget ? SERIES_INK[0] : SERIES_INK[(index % (SERIES_INK.length - 1)) + 1]);
  const ends = spread(drawn.map((row) => y(row.points[row.points.length - 1]?.share || 0)), 15);

  const lines = drawn.map((row, index) => {
    const ink = inkFor(row, index);
    const path = row.points.map((point, at) => `${at ? "L" : "M"} ${x(at).toFixed(1)} ${y(point.share).toFixed(1)}`).join(" ");
    // The reader's own line is filled, so it reads as the subject rather than
    // as one of seven.
    const fill = row.isTarget
      ? `<path class="ch-fill" d="${path} L ${x(runs - 1).toFixed(1)} ${y(0).toFixed(1)} L ${x(0).toFixed(1)} ${y(0).toFixed(1)} Z" fill="${ink}"></path>`
      : "";
    const dots = row.points.map((point, at) =>
      `<circle class="ch-dot" data-run="${at}" cx="${x(at).toFixed(1)}" cy="${y(point.share).toFixed(1)}" r="${row.isTarget ? 4 : 3}" fill="${ink}"></circle>`).join("");
    return `${fill}<path class="ch-line" d="${path}" stroke="${ink}" stroke-width="${row.isTarget ? 2.5 : 1.5}"></path>${dots}`;
  }).join("");

  const labels = drawn.map((row, index) => {
    const now = row.points[row.points.length - 1];
    const ink = inkFor(row, index);
    return join([
      `<text class="ch-name${row.isTarget ? " is-you" : ""}" x="${(width - pad.right + 10).toFixed(1)}" y="${(ends[index] as number + 3.5).toFixed(1)}" fill="${ink}">`,
      html(row.name.length > 16 ? row.name.slice(0, 15) + "\u2026" : row.name),
      `<tspan class="ch-value" dx="6">${percent(now ? now.share : null)}</tspan>`,
      "</text>",
    ]);
  }).join("");

  // One target per run, the full height of the plot, so the pointer does not
  // have to find a three pixel dot.
  const step = runs > 1 ? plot.w / (runs - 1) : plot.w;
  const hits = first.points.map((point, index) => {
    const rows = drawn
      .map((row, at) => ({ name: row.name, isTarget: row.isTarget, share: row.points[index]?.share || 0, ink: inkFor(row, at) }))
      .sort((left, right) => right.share - left.share)
      .map((row) => `${row.isTarget ? "1" : "0"}|${row.ink}|${row.name}|${percent(row.share)}`)
      .join(";");
    return join([
      `<rect class="ch-hit" data-run="${index}" data-when="${html(runLabel(point.at))}" data-rows="${html(rows)}"`,
      ` x="${(x(index) - step / 2).toFixed(1)}" y="${pad.top}" width="${step.toFixed(1)}" height="${plot.h.toFixed(1)}"></rect>`,
    ]);
  }).join("");

  const crosshair = `<line class="ch-cross" x1="0" x2="0" y1="${pad.top}" y2="${(pad.top + plot.h).toFixed(1)}"></line>`;

  return join([
    '<div class="ch-wrap">',
    `<svg class="ch" viewBox="0 0 ${width} ${height}" role="img" aria-label="Share of the answers across ${runs} runs, one line per brand">`,
    grid, axis, `${crosshair}${lines}`, labels, hits,
    "</svg>",
    '<div class="ch-tip" hidden></div>',
    "</div>",
  ]);
}

export interface AskedSplit {
  /** Questions that never name the brand, so being named there is earned. */
  unbranded: { prompts: number; answers: number; score: number | null; appearances: number };
  /** Questions that name the brand. Presence is given, so only the framing counts. */
  branded: { prompts: number; answers: number; sentiment: number | null };
}

/** The two halves of a prompt set, which measure different things. Mixing
 * them into one score is how a brand looks visible because it asked about
 * itself. */
export function askedSplit(split: AskedSplit): string {
  const rows = [
    join([
      '<div class="asked-half">',
      `<span class="asked-label">Asked without naming you</span>`,
      `<strong class="asked-figure">${scoreText(split.unbranded.score)}</strong>`,
      `<span class="subtle">${split.unbranded.prompts} question(s), ${split.unbranded.answers} answer(s). `,
      split.unbranded.answers === 0
        ? "Nothing asked yet."
        : `Named in ${split.unbranded.appearances}. This is the number that is earned.`,
      "</span></div>",
    ]),
    join([
      '<div class="asked-half">',
      `<span class="asked-label">Asked by name</span>`,
      `<strong class="asked-figure">${split.branded.sentiment === null ? "Not judged" : percent(split.branded.sentiment)}</strong>`,
      `<span class="subtle">${split.branded.prompts} question(s), ${split.branded.answers} answer(s). `,
      split.branded.prompts === 0
        ? "None tracked. A question that names you measures how you are described, not whether you are found."
        : "Presence is given here, so only how you are described counts.",
      "</span></div>",
    ]),
  ];
  return `<div class="asked-split">${rows.join("")}</div>`;
}

export function splitRows(rows: Split[], empty: string): string {
  return table({
    layout: "mcols-rank",
    columns: ["", "Score", "Rank"],
    empty,
    rows: rows.slice(0, 6).map((entry) => row("mcols-rank", [
      nameCell(html(entry.label), `${entry.answers} answer(s)`),
      cell(scoreText(entry.score), entry.score === null ? "" : entry.score > 0 ? "state-ok" : "state-bad"),
      cell(rankText(entry.rank)),
    ])),
  });
}

export function movesList(moves: Move[]): string {
  if (!moves.length) return '<p class="subtle">Nothing in the archived answers points at a move that would raise the score.</p>';
  return join([
    '<ol class="dmoves">',
    moves.slice(0, 3).map((move) => `<li><strong>${html(move.title)}</strong><span class="subtle">${html(move.evidence)}</span></li>`).join(""),
    "</ol>",
    '<div class="inline-actions"><button type="button" class="button" data-page="answer-engine">The whole plan</button></div>',
  ]);
}

export function sourcesPanel(data: DashboardData): string {
  if (data.citationsUnavailable) {
    return join([
      '<p class="subtle">No answer carried a source, so none of the source work can run. That is a property of what answered, not evidence that nobody cites you.</p>',
      '<div class="inline-actions"><button type="button" class="button" data-page="models">Turn on a grounded source</button></div>',
    ]);
  }
  if (data.citedPages === null) return '<p class="subtle">Reading the cited pages.</p>';
  return tiles([
    { label: "Pages cited", value: String(data.citedPages), note: "read back from the answers" },
    {
      label: "You are missing from",
      value: String(data.missingFrom ?? 0),
      note: "of the pages the models read",
      fraction: data.citedPages ? (data.missingFrom ?? 0) / data.citedPages : null,
      tone: data.missingFrom ? "state-bad" : "",
    },
  ]);
}

/** Held while the figures arrive, in the shape they will take, so the page
 * does not jump when they land. */
export function dashboardSkeleton(): string {
  return join([
    loading("the dashboard", skeletonTiles(4)),
    '<div class="dgrid">',
    section({ title: "What would move this", body: skeletonCard({ rows: 3, columns: "minmax(0,1fr)" }) }),
    section({ title: "Who the answers name", body: skeletonCard({ rows: 5, columns: "minmax(0,1fr)" }) }),
    "</div>",
  ]);
}

export interface Panel {
  id: string;
  title: string;
  blurb: string;
  body: string;
  wide?: boolean;
}

/** Every dashboard panel, once. The grid draws them in the reader's order and
 * the side pane draws one of them at full width, from the same list. */
export function dashboardPanels(data: DashboardData): Panel[] {
  return [
    { id: "moves", title: "Recommendations", blurb: "The strongest levers, read off the answers.", body: movesList(data.moves) },
    { id: "trend", title: "Share of voice", blurb: "Every brand on one axis, so a gap that is closing looks different from one that is not.", body: rivalChart(data.rivalTrend || [], data.domain), wide: true },
    { id: "named", title: "Brand mentions", blurb: "You against everyone else the answers named.", body: leaderboardBars(data.leaderboard) },
    { id: "described", title: "Sentiment by brand", blurb: "Where each brand appears in the answer, and how it is spoken about.", body: brandsTable(data.leaderboard), wide: true },
    { id: "asked", title: "Branded and unbranded", blurb: "A question that names you cannot show whether you are found. The two are counted apart.", body: data.asked ? askedSplit(data.asked) : '<p class="subtle">Nothing asked yet.</p>' },
    { id: "models", title: "By AI platform", blurb: "Who was asked, and how each one answered.", body: splitRows(data.byModel, "No assistant has answered yet.") },
    { id: "regions", title: "By market", blurb: "Fills in once a run states more than one.", body: splitRows(data.byRegion, "Every answer was asked without a market stated.") },
    { id: "personas", title: "By persona", blurb: "Fills in once a run asks on behalf of more than one.", body: splitRows(data.byPersona, "Every answer was asked on nobody\u2019s behalf.") },
    { id: "sources", title: "Cited sources", blurb: "The pages the answers actually read.", body: sourcesPanel(data) },
  ];
}

export function dashboardBody(held: Loadable<DashboardData>): string {
  return match(held, {
    loading: () => dashboardSkeleton(),
    error: (error) => `<div class="warning-box">${html(error)}</div>`,
    ready: (data) => {
      const panels = dashboardPanels(data);
      const byId = new Map(panels.map((panel) => [panel.id, panel]));
      const drawn = panelOrder(panels.map((panel) => panel.id)).map((id) => {
        const panel = byId.get(id);
        if (!panel) return "";
        return section({
          id: panel.id,
          title: panel.title,
          blurb: panel.blurb,
          body: panel.body,
          ...(panel.wide ? { wide: true } : {}),
          aside: `<button type="button" class="panel-expand" data-expand-panel="${html(panel.id)}" title="Open this on its own">Expand</button>`,
        });
      }).join("");
      return join([summaryTiles(data), '<div class="dgrid">', drawn, "</div>"]);
    },
  });
}

export { bar };
