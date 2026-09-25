import { html, join } from "../dom.js";
import { percent, rank as rankText, score as scoreText } from "../format.js";
import { bar, brandIcon, cell, nameCell, pill, row, section, table, tiles, type TileInput } from "../components/primitives.js";
import { loading, skeletonCard, skeletonTiles } from "../components/skeleton.js";
import { match, type Loadable } from "../loadable.js";
import { panelLayout } from "../components/reorder.js";
import { regionMap, type RegionCell } from "./region-map.js";
/** Mirrors the server shapes. A type import is erased, but keeping the view's
 * types local keeps every import inside the tree the app route serves. */
export interface PositionReport { averagePosition: number | null; ranked: number; unranked: number; best: number | null; worst: number | null }
export interface CitationStanding { rank: number | null; share: number | null; ahead: Array<{ domain: string; answers: number }>; leader: { domain: string; answers: number } | null }

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
  domain?: string | null;
  /** The mark the site declares, read by the crawl. Null when it declares none. */
  icon?: string | null;
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
  /** Set for markets, so one can be placed on the grid. */
  id?: string | undefined;
}

export interface Move {
  title: string;
  evidence: string;
  effect: string;
}

export interface DashboardData {
  /** Empty until two runs exist, which the chart reports rather than hides. */
  rivalTrend?: RivalSeries[];
  matrix?: MatrixData | undefined;
  /** Rows the reader has opened, so an expansion survives a re-render. */
  matrixOpen?: string[] | undefined;
  /** Rival columns the reader switched off. The target is never among them. */
  matrixHidden?: string[] | undefined;
  /** What the UI must say beside any regional figure. */
  regionCaveat?: string | undefined;
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
  /** Where the brand sits when it is named, which presence cannot say. */
  position?: PositionReport | undefined;
  /** Where the brand's own domain sits among the domains being cited. */
  citation?: CitationStanding | undefined;
}

/** The four figures the score is built from, never the composite alone. */
export function heroStats(standing: Standing, position?: PositionReport | undefined): string {
  const stat = (label: string, value: string, note: string): string =>
    `<div class="hero-stat"><span>${html(label)}</span><strong>${html(value)}</strong><small>${html(note)}</small></div>`;
  // Presence counts the answers naming you. Position says where in them, and a
  // brand named last in every answer looks the same as a leader without it.
  const place = !position || position.averagePosition === null
    ? stat("Average position", "Not named", position && position.unranked > 0
        ? `${position.unranked} questions named someone else`
        : "no question resolved a place")
    : stat(
        "Average position",
        String(position.averagePosition),
        `best ${position.best}, worst ${position.worst}, over ${position.ranked} questions`,
      );
  return join([
    '<div class="hero-stats">',
    stat("Presence", percent(standing.presenceRate), `${standing.appearances} of ${standing.answers} named you`),
    place,
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
export function leaderboardBars(rows: NamedEntity[], limit = 6): string {
  if (!rows.length) return '<p class="subtle">No organisation has been named yet.</p>';
  const top = rows.slice(0, limit);
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
export function brandsTable(rows: NamedEntity[], limit = 8): string {
  return table({
    layout: "mcols-brand",
    columns: ["Brand", "Named in", "Share", "Prominence", "Described"],
    empty: "No organisation has been named yet.",
    rows: rows.slice(0, limit).map((entry) => {
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
        nameCell(`${brandIcon(entry.name, entry.icon)}<span>${html(entry.name)}</span>`, entry.isTarget ? "You" : ""),
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
  domain?: string | null;
  icon?: string | null;
  isTarget: boolean;
  points: Array<{ at: string; share: number }>;
}

/** One rule for a line's colour, so the list beside the chart can key to it. */
export function seriesInk(isTarget: boolean, index: number): string {
  return isTarget ? (SERIES_INK[0] as string) : (SERIES_INK[(index % (SERIES_INK.length - 1)) + 1] as string);
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

/** A brand nobody named has no series at all, and that absence is the whole
 * finding, so it is carried at zero rather than left out of the picture. */
export function withTarget(series: RivalSeries[], domain: string): RivalSeries[] {
  if (series.some((line) => line.isTarget)) return series;
  const first = series[0];
  if (!first) return series;
  return [{ name: domain, isTarget: true, points: first.points.map((point) => ({ at: point.at, share: 0 })) }, ...series];
}

export interface ChartOptions {
  /** Off when a ranked list beside the chart already names every line, which
   * gives the plot back the width the labels were using. */
  labels?: boolean;
}

export function rivalChart(series: RivalSeries[], domain: string, options: ChartOptions = {}): string {
  const named = options.labels !== false;
  const runs = series[0] ? series[0].points.length : 0;
  if (runs < 2) return '<p class="subtle">One run so far. Run again to see movement.</p>';

  const first = series[0];
  if (!first) return '<p class="subtle">Nothing has been named yet.</p>';
  const drawn = withTarget(series, domain);

  const width = 760;
  const height = 230;
  const pad = { left: 38, right: named ? 168 : 16, top: 14, bottom: 30 };
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

  const inkFor = (row: RivalSeries, index: number) => seriesInk(row.isTarget, index);
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

  const labels = !named ? "" : drawn.map((row, index) => {
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

export interface RivalStanding {
  name: string;
  domain?: string | null;
  icon?: string | null;
  isTarget: boolean;
  share: number;
  /** Percentage points moved since the run before, or null on a first run. */
  moved: number | null;
  /** Ties share a place, so two brands level on share are both second. */
  place: number;
  ink: string;
}

/** Where every brand stands at the latest run, in order. Ranked rather than
 * charted, because a reader wants the order before they want the shape. */
export function rivalStandings(series: RivalSeries[]): RivalStanding[] {
  const scored = series
    .map((line, index) => {
      const points = line.points;
      const last = points[points.length - 1];
      const prior = points.length > 1 ? points[points.length - 2] : undefined;
      return {
        name: line.name,
        domain: line.domain ?? null,
        icon: line.icon ?? null,
        isTarget: line.isTarget,
        share: last ? last.share : 0,
        moved: last && prior ? last.share - prior.share : null,
        ink: seriesInk(line.isTarget, index),
      };
    })
    .sort((left, right) => right.share - left.share);
  // Competition ranking: equal shares take the same place, and the next
  // brand skips the places they used up.
  let place = 0;
  let seen = 0;
  let previous = Number.NaN;
  return scored.map((entry) => {
    seen += 1;
    if (entry.share !== previous) { place = seen; previous = entry.share; }
    return { ...entry, place };
  });
}

/** The ranked list that sits beside the chart. It doubles as the legend, so
 * no reader has to match a colour to a name. */
export function rivalRanks(standings: RivalStanding[]): string {
  if (!standings.length) return '<p class="subtle">Nothing has been named yet.</p>';
  return `<ol class="ranklist">${standings.map((entry) => join([
    `<li class="rankrow${entry.isTarget ? " is-you" : ""}">`,
    `<span class="rankplace">${entry.place}</span>`,
    brandIcon(entry.name, entry.icon, entry.ink),
    `<span class="rankname">${html(entry.name)}${entry.isTarget ? ` ${pill("You", "good")}` : ""}</span>`,
    `<span class="rankvalue">${percent(entry.share)}</span>`,
    entry.moved === null
      ? '<span class="rankmove is-flat" title="No earlier run to compare with">&middot;</span>'
      : `<span class="rankmove ${entry.moved > 0 ? "is-up" : entry.moved < 0 ? "is-down" : "is-flat"}">`
        + `${entry.moved > 0 ? "+" : ""}${Math.round(entry.moved * 1000) / 10}pp</span>`,
    "</li>",
  ])).join("")}</ol>`;
}

/** Chart on the left, standings on the right, in one card. The number a reader
 * came for is printed above the chart rather than left to be read off it. */
export function rivalPanel(series: RivalSeries[], domain: string): string {
  const standings = rivalStandings(withTarget(series, domain));
  const mine = standings.find((entry) => entry.isTarget);
  const headline = mine
    ? `<p class="figure-lead"><strong>${percent(mine.share)}</strong>`
      + `<span>${rankText(mine.place)} of ${standings.length}</span></p>`
    : "";
  return join([
    '<div class="split">',
    `<div class="split-main">${headline}${rivalChart(series, domain, { labels: false })}</div>`,
    `<div class="split-side"><h3 class="split-head">Share of voice rank</h3>${rivalRanks(standings)}</div>`,
    "</div>",
  ]);
}

/** Every run's share for every brand. The card has room for a shape and an
 * order; this is the arithmetic under both. */
export function rivalRuns(series: RivalSeries[], domain: string): string {
  const drawn = withTarget(series, domain);
  const first = drawn[0];
  if (!first || first.points.length < 2) return "";
  const ordered = rivalStandings(drawn);
  const columns = `grid-template-columns:minmax(0,1.5fr) repeat(${first.points.length},minmax(58px,1fr))`;
  const heads = first.points.map((point) => `<span>${html(runLabel(point.at) || "Run")}</span>`).join("");
  const body = ordered.map((entry) => {
    const line = drawn.find((row) => row.name === entry.name);
    const cells = (line ? line.points : []).map((point) => `<span class="mcell">${percent(point.share)}</span>`).join("");
    return `<div class="mrow" style="${columns}">`
      + `<div class="mname"><strong>${html(entry.name)}</strong>${entry.isTarget ? " " + pill("You", "good") : ""}</div>`
      + `${cells}</div>`;
  }).join("");
  return join([
    '<h3 class="panel-section">Every run, in figures</h3>',
    `<div class="mtable"><div class="mhead" style="${columns}"><span>Brand</span>${heads}</div>${body}</div>`,
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

export function splitRows(rows: Split[], empty: string, limit = 6): string {
  return table({
    layout: "mcols-rank",
    columns: ["", "Score", "Rank"],
    empty,
    rows: rows.slice(0, limit).map((entry) => row("mcols-rank", [
      nameCell(html(entry.label), `${entry.answers} answer(s)`),
      cell(scoreText(entry.score), entry.score === null ? "" : entry.score > 0 ? "state-ok" : "state-bad"),
      cell(rankText(entry.rank)),
    ])),
  });
}

export function movesList(moves: Move[], limit = 3): string {
  if (!moves.length) return '<p class="subtle">Nothing in the archived answers points at a move that would raise the score.</p>';
  return join([
    '<ol class="dmoves">',
    moves.slice(0, limit).map((move) => `<li><strong>${html(move.title)}</strong><span class="subtle">${html(move.evidence)}</span></li>`).join(""),
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
  const cite = data.citation;
  // Being cited at all and being cited more than the rivals are two different
  // findings, and a page count alone reports only the first.
  const standing: TileInput[] = !cite ? [] : [
    {
      label: "Citation rank",
      value: rankText(cite.rank),
      note: cite.rank === null
        ? cite.leader ? `${cite.leader.domain} is cited most` : "no domain was cited"
        : `among ${cite.ahead.length + 1} cited domains`,
      tone: cite.rank === null ? "state-bad" : cite.rank === 1 ? "state-ok" : "",
    },
    {
      label: "Citation share",
      value: percent(cite.share),
      note: cite.ahead.length === 0 ? "nobody is cited more" : `${cite.ahead[0]?.domain} is ahead`,
      fraction: cite.share,
    },
  ];
  return tiles([
    ...standing,
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

export interface MatrixRow {
  key: string;
  parent: string;
  /** 0 topic, 1 subtopic, 2 prompt. Drawn as an indent, not as a separate table. */
  depth: number;
  label: string;
  /** One cell per column, aligned by index. Null means never named there. */
  shares: Array<number | null>;
  children: number;
}

export interface MatrixData {
  columns: Array<{ name: string; domain?: string | null; icon?: string | null; isTarget: boolean }>;
  rows: MatrixRow[];
}

// Columns and shares are aligned by index, so dropping a column has to drop
// the same index from every row or the grid quietly reports another brand.
export function narrowMatrix(data: MatrixData, hidden: string[]): MatrixData {
  const keep = data.columns
    .map((column, index) => ({ column, index }))
    // Cutting the reader's own column made every row read "Never named" once
    // already, so it is not something a picker is allowed to do.
    .filter(({ column }) => column.isTarget || !hidden.includes(column.name));
  return {
    columns: keep.map(({ column }) => column),
    rows: data.rows.map((row) => ({ ...row, shares: keep.map(({ index }) => row.shares[index] ?? null) })),
  };
}

/** The brands a reader may switch off, which is everyone but themselves. */
export function matrixColumnPicker(data: MatrixData, hidden: string[]): string {
  const options = data.columns.filter((column) => !column.isTarget);
  if (options.length < 2) return "";
  return `<div class="colpick">${options.map((column) => {
    const off = hidden.includes(column.name);
    return `<button type="button" class="filter${off ? "" : " active"}"`
      + ` data-matrix-column="${html(column.name)}" aria-pressed="${off ? "false" : "true"}">${html(column.name)}</button>`;
  }).join("")}</div>`;
}

/** Where a row stands against the best brand on that row. The verdict is the
 * gap, so a reader is told what to do rather than left to compare cells. */
export function rowVerdict(shares: Array<number | null>, columns: Array<{ isTarget: boolean }>): { text: string; tone: string } {
  const at = columns.findIndex((column) => column.isTarget);
  const mine = at < 0 ? null : shares[at] ?? null;
  const best = shares.reduce((top: number, share) => (share !== null && share > top ? share : top), 0);
  if (mine === null || mine === 0) return { text: "Never named", tone: "state-bad" };
  if (best <= mine) return { text: "Leading", tone: "state-ok" };
  return mine * 2 < best ? { text: "Far behind", tone: "state-bad" } : { text: "Behind", tone: "state-flag" };
}

/** Every topic against every brand the answers named, one row per topic and
 * one more for each subtopic and prompt a reader opens. */
export function topicMatrix(data: MatrixData, open: string[] = []): string {
  if (!data.rows.length || !data.columns.length) {
    return '<p class="subtle">No answer has been scored against a topic yet.</p>';
  }
  const shown = new Set(open);
  const columns = `grid-template-columns:minmax(150px,1.4fr) 92px repeat(${data.columns.length},minmax(52px,1fr))`;
  const heads = data.columns.map((column) =>
    `<span class="mxhead ${column.isTarget ? "is-you" : ""}" title="${html(column.name)}">${brandIcon(column.name, column.icon)}<b>${html(column.name.length > 11 ? column.name.slice(0, 10) + "…" : column.name)}</b></span>`).join("");
  const visible = data.rows.filter((row) => !row.parent || shown.has(row.parent));
  const body = visible.map((row) => {
    const verdict = rowVerdict(row.shares, data.columns);
    const cells = row.shares.map((share, index) => {
      const target = data.columns[index]?.isTarget;
      // Mixed in oklab so the steps are even to the eye, and started at 10 so a
      // small share still reads as a value rather than as an empty cell.
      const mix = share === null || share === 0 ? 0 : Math.round(10 + share * 62);
      const fill = mix === 0 ? "" : ` style="background:color-mix(in oklab, var(--accent) ${mix}%, transparent)"`;
      const dark = mix >= 52 ? " is-strong" : "";
      return `<span class="mxcell${target ? " is-you" : ""}${dark}"${fill}>`
        + (share === null ? '<span class="mxnone" title="Never named under this topic">&middot;</span>' : percent(share))
        + "</span>";
    }).join("");
    const opens = row.children > 0;
    return `<div class="mrow mxrow d${row.depth}" style="${columns}">`
      + `<div class="mxname">`
      + (opens
        ? `<button type="button" class="mxopen" data-matrix-open="${html(row.key)}" aria-expanded="${shown.has(row.key) ? "true" : "false"}" title="${html(row.label)}">`
          + `<span class="mxchev">${shown.has(row.key) ? "−" : "+"}</span><span class="mxlabel">${html(row.label)}</span>`
          + `<small>${row.children}</small></button>`
        : `<span class="mxflat" title="${html(row.label)}">${html(row.label)}</span>`)
      + "</div>"
      + `<span class="mcell ${verdict.tone}">${verdict.text}</span>${cells}</div>`;
  }).join("");
  return `<div class="mtable mxtable"><div class="mhead" style="${columns}"><span>Topic</span><span>Standing</span>${heads}</div>${body}</div>`;
}

export interface Panel {
  id: string;
  title: string;
  blurb: string;
  body: string;
  /** What the card had to leave out. Opening a panel is a deep dive, so it
   * carries the whole set and the figures under it, not the same view larger. */
  detail: string;
  /** The same figures as a table, for panels drawn as a chart. */
  table?: string | undefined;
  wide?: boolean;
}

export type PanelView = "chart" | "table";

/** A panel with no table stays as it is, so asking for one never blanks it. */
export function panelBody(panel: Panel, view: PanelView): string {
  return view === "table" && panel.table ? panel.table : panel.body;
}

export function panelToggle(panel: Panel, view: PanelView): string {
  if (!panel.table) return "";
  const button = (value: PanelView, label: string): string =>
    `<button type="button" class="filter${view === value ? " active" : ""}"`
    + ` data-panel-view="${html(panel.id)}" data-panel-view-mode="${value}"`
    + ` aria-pressed="${view === value ? "true" : "false"}">${label}</button>`;
  return `<div class="panel-views">${button("chart", "Chart")}${button("table", "Table")}</div>`;
}

/** Every dashboard panel, once. The grid draws them in the reader's order and
 * the side pane draws one of them at full width, from the same list. */
function regionCells(rows: Split[]): RegionCell[] {
  return rows.map((row) => ({
    regionId: row.id || "",
    label: row.label,
    score: row.score,
    rank: row.rank,
    answers: row.answers,
  }));
}

export function dashboardPanels(data: DashboardData): Panel[] {
  const every = Number.MAX_SAFE_INTEGER;
  const matrix = data.matrix || { columns: [], rows: [] };
  const narrowed = narrowMatrix(matrix, data.matrixHidden || []);
  const rivals = data.rivalTrend || [];
  return [
    { id: "moves", title: "Recommendations", blurb: "The strongest levers, read off the answers.", body: movesList(data.moves), detail: movesList(data.moves, every) },
    { id: "trend", title: "Share of voice", blurb: "Every brand on one axis, so a gap that is closing looks different from one that is not.", body: rivalPanel(rivals, data.domain), detail: rivalPanel(rivals, data.domain) + rivalRuns(rivals, data.domain), table: rivalRuns(rivals, data.domain), wide: true },
    { id: "topics", title: "Topics by competitor", blurb: "Every topic against every brand the answers named. Open a row for its subtopics and the questions under them.", body: matrixColumnPicker(matrix, data.matrixHidden || []) + topicMatrix(narrowed, data.matrixOpen || []), detail: matrixColumnPicker(matrix, data.matrixHidden || []) + topicMatrix(narrowed, narrowed.rows.map((row) => row.key)), wide: true },
    { id: "named", title: "Brand mentions", blurb: "You against everyone else the answers named.", body: leaderboardBars(data.leaderboard), detail: leaderboardBars(data.leaderboard, every), table: brandsTable(data.leaderboard) },
    { id: "described", title: "Sentiment by brand", blurb: "Where each brand appears in the answer, and how it is spoken about.", body: brandsTable(data.leaderboard), detail: brandsTable(data.leaderboard, every), wide: true },
    { id: "asked", title: "Branded and unbranded", blurb: "A question that names you cannot show whether you are found. The two are counted apart.", body: data.asked ? askedSplit(data.asked) : '<p class="subtle">Nothing asked yet.</p>', detail: data.asked ? askedSplit(data.asked) : '<p class="subtle">Nothing asked yet.</p>' },
    { id: "models", title: "By AI platform", blurb: "Who was asked, and how each one answered.", body: splitRows(data.byModel, "No assistant has answered yet."), detail: splitRows(data.byModel, "No assistant has answered yet.", every) },
    { id: "regions", title: "By market", blurb: "Fills in once a run states more than one.", body: regionMap(regionCells(data.byRegion), data.regionCaveat || ""), detail: regionMap(regionCells(data.byRegion), data.regionCaveat || "") + splitRows(data.byRegion, "Every answer was asked without a market stated.", every), table: splitRows(data.byRegion, "Every answer was asked without a market stated."), wide: true },
    { id: "personas", title: "By persona", blurb: "Fills in once a run asks on behalf of more than one.", body: splitRows(data.byPersona, "Every answer was asked on nobody\u2019s behalf."), detail: splitRows(data.byPersona, "Every answer was asked on nobody\u2019s behalf.", every) },
    { id: "sources", title: "Cited sources", blurb: "The pages the answers actually read.", body: sourcesPanel(data), detail: sourcesPanel(data) },
  ];
}

/** The width controls and the remove, shown only while the board is being
 * arranged, so a card a reader is only looking at carries nothing extra. */
function panelTools(id: string, span: number): string {
  const width = (value: number, label: string) =>
    `<button type="button" class="ptool${span === value ? " is-on" : ""}" data-panel-span="${html(id)}:${value}"`
    + ` title="${html(label)}" aria-pressed="${span === value ? "true" : "false"}">${html(label)}</button>`;
  return `<div class="ptools">${width(1, "1")}${width(2, "2")}${width(0, "Full")}`
    + `<button type="button" class="ptool is-drop" data-panel-hide="${html(id)}" title="Take this off the board">Remove</button></div>`;
}

export function dashboardBody(held: Loadable<DashboardData>, editing = false, views: Record<string, PanelView> = {}): string {
  return match(held, {
    loading: () => dashboardSkeleton(),
    error: (error) => `<div class="warning-box">${html(error)}</div>`,
    ready: (data) => {
      const panels = dashboardPanels(data);
      const byId = new Map(panels.map((panel) => [panel.id, panel]));
      const layout = panelLayout(panels.map((panel) => panel.id));
      const drawn = layout.order.map((id) => {
        const panel = byId.get(id);
        if (!panel) return "";
        if (!editing && layout.hidden.includes(id)) return "";
        // A panel that declared itself wide keeps that as its default width,
        // and a width the reader chose overrides it.
        const span = layout.spans[id] ?? (panel.wide ? 0 : 1);
        const view: PanelView = views[id] === "table" ? "table" : "chart";
        const toggle = panelToggle(panel, view);
        return section({
          id: panel.id,
          title: panel.title,
          blurb: panel.blurb,
          body: panelBody(panel, view),
          span,
          off: layout.hidden.includes(id),
          ...(editing
            ? { aside: panelTools(id, span) }
            : { open: panel.id, ...(toggle ? { aside: toggle } : {}) }),
        });
      }).join("");
      return join([
        summaryTiles(data),
        editing ? '<p class="subtle boardnote">Drag a card to move it, set its width, or take it off the board. The arrangement is yours and stays in this browser.</p>' : "",
        '<div class="dgrid">', drawn, "</div>",
      ]);
    },
  });
}

export { bar };
