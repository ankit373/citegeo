import { html, join } from "../dom.js";
import { percent } from "../format.js";
import {
  DEFAULT_WIDTH, crosshair, dayLabel, failedBands, frame, gappedPath, hoverTargets, labelWidth,
  niceMax, spread, svg, timeAxis, timeOf, yGrid, type HoverRow,
} from "./time-chart.js";

// The three overview charts. Each is a pure function of a model and a width,
// so the page can redraw one at its container's width without a re-render.

export interface SharePoint { at: string; share: number; readable?: boolean | undefined }
export interface ShareLine { name: string; isTarget: boolean; points: SharePoint[] }

export interface ShareModel {
  series: ShareLine[];
  /** Start times of runs left out because most of their answers failed. */
  failed: string[];
  labels: boolean;
}

export const RIVAL_SLOTS = 3;

/** Rivals keep one colour whatever their rank, so a slot is chosen by name. */
export function rivalSlots(series: ShareLine[]): Map<string, string> {
  const rivals = series.filter((line) => !line.isTarget).map((line) => line.name);
  const coloured = rivals.slice(0, RIVAL_SLOTS).sort((left, right) => left.localeCompare(right));
  const slots = new Map<string, string>();
  for (const name of rivals) {
    const at = coloured.indexOf(name);
    slots.set(name, at < 0 ? "other" : `r${at + 1}`);
  }
  return slots;
}

/** The swatch a line, its label and its hover row share. */
export function slotInk(slot: string): string {
  return slot === "you" ? "var(--text)" : slot === "other" ? "var(--rival-other)" : `var(--rival-${slot.slice(1)})`;
}

function shortName(name: string, room: number): string {
  return name.length > room ? `${name.slice(0, room - 1)}\u2026` : name;
}

export function shareSvg(model: ShareModel, width: number): string {
  const failed = new Set(model.failed);
  const kept = model.series.map((line) => ({
    ...line,
    points: line.points
      .filter((point) => point.readable !== false || failed.has(point.at))
      .map((point) => ({ ...point, time: timeOf(point.at) }))
      .filter((point): point is SharePoint & { time: number } => point.time !== null)
      .sort((left, right) => left.time - right.time),
  }));
  const times = [
    ...kept.flatMap((line) => line.points.map((point) => point.time)),
    ...model.failed.map(timeOf).filter((time): time is number => time !== null),
  ];
  if (!times.length) return "";
  const slots = rivalSlots(model.series);
  const small = width < 480;
  const ends = kept.map((line) => {
    const last = [...line.points].reverse().find((point) => !failed.has(point.at));
    return { line, last: last ? last.share : null, label: `${shortName(line.name, small ? 12 : 20)} ${last ? percent(last.share) : "no data"}` };
  });
  const room = model.labels ? Math.min(Math.max(...ends.map((end) => labelWidth(end.label))) + 20, Math.round(width * (small ? 0.36 : 0.42))) : 16;
  const f = frame(width, small ? 240 : 280, { l: 44, r: room, t: 12, b: 28 }, times);
  const top = Math.max(0, ...kept.flatMap((line) => line.points.map((point) => point.share)));
  const grid = yGrid(f, Math.min(100, niceMax(top * 100, 10)), small ? 20 : 10, "%");
  const y = (share: number) => grid.y(share * 100);

  // The reader's line goes on last, so no rival is drawn over it.
  const order = [...kept].sort((left, right) => Number(left.isTarget) - Number(right.isTarget));
  const failedTimes = model.failed.map(timeOf).filter((time): time is number => time !== null);
  const lines = order.map((line) => {
    // A failed run between two points breaks the line, even with no point of its own.
    const steps = [
      ...line.points.map((point) => ({ time: point.time, xy: failed.has(point.at) ? null : [f.scale.x(point.time), y(point.share)] as [number, number] })),
      ...failedTimes.map((time) => ({ time, xy: null })),
    ].sort((a, b) => a.time - b.time);
    const d = gappedPath(steps.map((step) => step.xy));
    if (line.isTarget) return `<path class="ch-you-band" d="${d}"></path><path class="ch-line s-you" d="${d}"></path>`;
    return `<path class="ch-line s-${slots.get(line.name)}" d="${d}"></path>`;
  }).join("");

  const placed = spread(ends.map((end) => (end.last === null ? f.bottom : y(end.last))), 16);
  const labels = !model.labels ? "" : ends.map((end, index) => {
    const at = (placed[index] as number) + 4;
    const mark = end.line.isTarget
      ? `<rect class="ch-you-mark" x="${(f.right + 5).toFixed(1)}" y="${(at - 12).toFixed(1)}" width="${labelWidth(end.label) + 6}" height="16" rx="3"></rect>`
      : "";
    return `${mark}<text class="ch-name${end.line.isTarget ? " is-you" : ""}" x="${(f.right + 8).toFixed(1)}" y="${at.toFixed(1)}">${html(end.label)}</text>`;
  }).join("");

  const runs = [...new Set(times)].sort((left, right) => left - right).map((time) => {
    const at = new Date(time).toISOString();
    const left = model.failed.some((value) => timeOf(value) === time);
    const rows: HoverRow[] = left
      ? [{ you: false, swatch: "var(--failed)", name: "Mostly failed", value: "left out" }]
      : kept
        .map((line) => ({ line, point: line.points.find((point) => point.time === time) }))
        .filter((row) => row.point)
        .sort((a, b) => (b.point?.share || 0) - (a.point?.share || 0))
        .map(({ line, point }) => ({
          you: line.isTarget,
          swatch: slotInk(line.isTarget ? "you" : slots.get(line.name) || "other"),
          name: line.name,
          value: percent(point ? point.share : null),
        }));
    return { time, when: `Run of ${dayLabel(at)}`, rows };
  });

  const named = kept.filter((line) => line.points.length).length;
  return svg(f, `Share of voice for ${named} brands across ${runs.length} runs, on a date axis`, join([
    grid.markup, timeAxis(f), failedBands(f, failedTimes, "hatch-share"),
    crosshair(f), lines, labels, hoverTargets(f, runs),
  ]));
}

export interface ScoreModel {
  points: Array<{ at: string; score: number; low: number | null; high: number | null }>;
  failed: string[];
}

export function scoreSvg(model: ScoreModel, width: number): string {
  const failedTimes = model.failed.map(timeOf).filter((time): time is number => time !== null);
  const rows = [
    ...model.points.map((point) => ({ ...point, time: timeOf(point.at), left: false })),
    ...failedTimes.map((time) => ({ at: "", score: 0, low: null, high: null, time, left: true })),
  ].filter((row): row is typeof row & { time: number } => row.time !== null).sort((a, b) => a.time - b.time);
  if (!rows.length) return "";
  const f = frame(width, width < 480 ? 160 : 200, { l: 36, r: 12, t: 10, b: 28 }, rows.map((row) => row.time));
  const top = Math.max(10, ...rows.map((row) => (row.left ? 0 : row.high ?? row.score)));
  const grid = yGrid(f, Math.min(100, niceMax(top, 20)), 20, "");

  // The range is drawn per unbroken stretch, so it never bridges a run left out.
  const bands: string[] = [];
  let stretch: typeof rows = [];
  const flush = () => {
    const ranged = stretch.filter((row) => row.low !== null && row.high !== null);
    if (ranged.length > 1) {
      const upper = ranged.map((row): [number, number] => [f.scale.x(row.time), grid.y(row.high as number)]);
      const lower = ranged.map((row): [number, number] => [f.scale.x(row.time), grid.y(row.low as number)]).reverse();
      bands.push(`<path class="ch-range" d="${gappedPath(upper)}${gappedPath(lower).replace("M", "L")}Z"></path>`);
    }
    stretch = [];
  };
  for (const row of rows) {
    if (row.left) flush();
    else stretch.push(row);
  }
  flush();

  const line = gappedPath(rows.map((row) => (row.left ? null : [f.scale.x(row.time), grid.y(row.score)])));
  const last = [...rows].reverse().find((row) => !row.left);
  const dot = last ? `<circle class="ch-end" cx="${f.scale.x(last.time).toFixed(1)}" cy="${grid.y(last.score).toFixed(1)}" r="4"></circle>` : "";
  const runs = rows.map((row) => ({
    time: row.time,
    when: `Run of ${dayLabel(row.time)}`,
    rows: row.left
      ? [{ you: false, swatch: "var(--failed)", name: "Mostly failed", value: "left out" }]
      : [{
        you: true,
        swatch: "var(--text)",
        name: "Score",
        value: row.low !== null && row.high !== null ? `${row.score} (${Math.round(row.low)} to ${Math.round(row.high)})` : String(row.score),
      }],
  }));
  return svg(f, `Visibility score across ${rows.length} runs, on a date axis`, join([
    grid.markup, timeAxis(f), failedBands(f, failedTimes, "hatch-score"), bands.join(""),
    crosshair(f), `<path class="ch-line s-you" d="${line}"></path>`, dot, hoverTargets(f, runs),
  ]));
}

export interface HealthModel { runs: Array<{ at: string; back: number; asked: number; left: boolean }> }

export function healthSvg(model: HealthModel, width: number): string {
  const runs = model.runs
    .map((run) => ({ ...run, time: timeOf(run.at) }))
    .filter((run): run is typeof run & { time: number } => run.time !== null);
  if (!runs.length) return "";
  const f = frame(width, 72, { l: 10, r: 10, t: 6, b: 26 }, runs.map((run) => run.time));
  const tall = f.bottom - f.top;
  const bars = runs.map((run) => {
    const x = f.scale.x(run.time) - 4;
    const high = run.asked ? (run.back / run.asked) * tall : 0;
    return `<rect class="ch-track${run.left ? " is-failed" : ""}" x="${x.toFixed(1)}" y="${f.top}" width="8" height="${tall}" rx="2"></rect>`
      + `<rect class="ch-bar${run.left ? " is-failed" : ""}" x="${x.toFixed(1)}" y="${(f.bottom - high).toFixed(1)}" width="8" height="${high.toFixed(1)}" rx="2"></rect>`;
  }).join("");
  const hover = runs.map((run) => ({
    time: run.time,
    when: `Run of ${dayLabel(run.time)}`,
    rows: [{
      you: false,
      swatch: run.left ? "var(--failed)" : "var(--line-strong)",
      name: run.left ? "Mostly failed" : "Came back",
      value: `${run.back} of ${run.asked}`,
    }],
  }));
  return svg(f, `Answers that came back in each of ${runs.length} runs`, join([timeAxis(f), bars, crosshair(f), hoverTargets(f, hover)]));
}

const DRAW = { share: shareSvg, score: scoreSvg, health: healthSvg } as const;
type ChartKind = keyof typeof DRAW;
type ModelOf<K extends ChartKind> = Parameters<(typeof DRAW)[K]>[0];

/** The chart at a first guess of its width, with its model kept beside it so
 * the page can redraw it once the real width is known. */
export function chartHost<K extends ChartKind>(kind: K, model: ModelOf<K>, width = DEFAULT_WIDTH): string {
  const draw = DRAW[kind] as (held: ModelOf<K>, at: number) => string;
  return `<div class="ch-wrap" data-chart="${kind}" data-drawn="${width}" data-model="${html(JSON.stringify(model))}">`
    + `${draw(model, width)}<div class="ch-tip" hidden></div></div>`;
}

function fitAll(): void {
  for (const host of Array.from(document.querySelectorAll<HTMLElement>(".ch-wrap[data-chart]"))) {
    const width = Math.floor(host.clientWidth);
    if (!width || String(width) === host.getAttribute("data-drawn")) continue;
    const kind = host.getAttribute("data-chart") as ChartKind;
    const draw = DRAW[kind] as ((model: unknown, at: number) => string) | undefined;
    const old = host.querySelector("svg");
    if (!draw || !old) continue;
    host.setAttribute("data-drawn", String(width));
    old.outerHTML = draw(JSON.parse(host.getAttribute("data-model") || "{}"), width);
  }
}

/** Redraws every chart at its container's width after a render or a resize.
 * Set up once: the page replaces its markup on every render. */
export function wireChartFit(): void {
  let queued = false;
  const soon = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; fitAll(); });
  };
  new MutationObserver(soon).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("resize", soon);
  soon();
}
