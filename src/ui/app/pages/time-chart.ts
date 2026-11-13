import { html, join } from "../dom.js";

// Charts drawn on a real date axis at the container's own pixel width, so a
// two week gap looks like one and a 12px label stays 12px on a phone.

const DAY = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Width a chart is drawn at before the page has measured its container. */
export const DEFAULT_WIDTH = 640;
const LABEL_SIZE = 12;

export function timeOf(at: string): number | null {
  const value = Date.parse(at);
  return Number.isNaN(value) ? null : value;
}

/** "3 Nov", in UTC, so a run reads the same date for every reader and in tests. */
export function dayLabel(at: string | number): string {
  const time = typeof at === "number" ? at : timeOf(at);
  if (time === null) return "";
  const when = new Date(time);
  return `${when.getUTCDate()} ${MONTHS[when.getUTCMonth()]}`;
}

export interface TimeScale {
  t0: number;
  t1: number;
  x: (time: number) => number;
}

/** A single run still gets an axis: three days either side of it. */
export function timeScale(times: number[], left: number, right: number): TimeScale {
  const lo = Math.min(...times);
  const hi = Math.max(...times);
  const pad = hi - lo < DAY ? 3 * DAY : (hi - lo) * 0.02;
  const t0 = lo - pad;
  const t1 = hi + pad;
  return { t0, t1, x: (time) => left + ((time - t0) / (t1 - t0)) * (right - left) };
}

export interface Tick { time: number; label: string }

/** Month starts over a long span, whole days over a short one, thinned until
 * the labels fit the width they have. */
export function timeTicks(t0: number, t1: number, width: number): Tick[] {
  const room = Math.max(1, Math.floor(width / 64));
  const span = (t1 - t0) / DAY;
  const ticks: Tick[] = [];
  if (span > 75) {
    const start = new Date(t0);
    let cursor = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1);
    while (cursor <= t1) {
      const month = new Date(cursor).getUTCMonth();
      ticks.push({ time: cursor, label: month === 0 ? `Jan ${new Date(cursor).getUTCFullYear()}` : `1 ${MONTHS[month]}` });
      cursor = Date.UTC(new Date(cursor).getUTCFullYear(), month + 1, 1);
    }
  } else {
    const step = [1, 2, 7, 14, 28].find((days) => span / days <= room) || 28;
    let cursor = Math.ceil(t0 / DAY) * DAY;
    while (cursor <= t1) {
      ticks.push({ time: cursor, label: dayLabel(cursor) });
      cursor += step * DAY;
    }
  }
  const every = Math.max(1, Math.ceil(ticks.length / room));
  return ticks.filter((unused, index) => index % every === 0);
}

/** A round top for the y axis, so gridlines land on numbers people say. */
export function niceMax(value: number, step: number): number {
  return Math.max(step, Math.ceil(value / step) * step);
}

/** Pushes labels apart so two lines ending at the same height do not print
 * on top of each other. */
export function spread(values: number[], gap: number): number[] {
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

/** A path that lifts the pen at every null, so an absence is a gap. */
export function gappedPath(points: Array<[number, number] | null>): string {
  let pen = false;
  let out = "";
  for (const point of points) {
    if (!point) { pen = false; continue; }
    out += `${pen ? "L" : "M"}${point[0].toFixed(1)},${point[1].toFixed(1)}`;
    pen = true;
  }
  return out;
}

function text(x: number, y: number, label: string, klass = "ch-tick", anchor = "start"): string {
  return `<text class="${klass}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}">${html(label)}</text>`;
}

export interface Frame {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  scale: TimeScale;
}

export function frame(width: number, height: number, pad: { l: number; r: number; t: number; b: number }, times: number[]): Frame {
  const right = Math.max(pad.l + 40, width - pad.r);
  return { width, height, left: pad.l, right, top: pad.t, bottom: height - pad.b, scale: timeScale(times, pad.l, right) };
}

export function timeAxis(f: Frame): string {
  return join([
    `<line class="ch-axis" x1="${f.left}" x2="${f.right.toFixed(1)}" y1="${f.bottom}" y2="${f.bottom}"></line>`,
    timeTicks(f.scale.t0, f.scale.t1, f.right - f.left).map((tick) => {
      const x = f.scale.x(tick.time);
      // A label at either edge is anchored inward, so it is never cut off.
      const half = labelWidth(tick.label) / 2;
      const anchor = x - half < 0 ? "start" : x + half > f.width ? "end" : "middle";
      return `<line class="ch-axis" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${f.bottom}" y2="${f.bottom + 4}"></line>`
        + text(anchor === "start" ? Math.max(0, x - 4) : anchor === "end" ? Math.min(f.width, x + 4) : x, f.bottom + 17, tick.label, "ch-tick", anchor);
    }).join(""),
  ]);
}

export function yGrid(f: Frame, max: number, step: number, suffix: string): { y: (value: number) => number; markup: string } {
  const y = (value: number) => f.bottom - (Math.max(0, Math.min(max, value)) / max) * (f.bottom - f.top);
  const lines: string[] = [];
  for (let value = 0; value <= max + 1e-9; value += step) {
    if (value > 0) lines.push(`<line class="ch-grid" x1="${f.left}" x2="${f.right.toFixed(1)}" y1="${y(value).toFixed(1)}" y2="${y(value).toFixed(1)}"></line>`);
    lines.push(text(f.left - 8, y(value) + 4, `${Math.round(value)}${suffix}`, "ch-tick", "end"));
  }
  return { y, markup: lines.join("") };
}

/** A hatched band across the plot at each run left out, never a drop to zero. */
export function failedBands(f: Frame, times: number[], id: string): string {
  if (!times.length) return "";
  const pattern = `<defs><pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">`
    + `<line class="ch-hatch" x1="0" y1="0" x2="0" y2="6"></line></pattern></defs>`;
  return pattern + times.map((time) => {
    const x = f.scale.x(time);
    return `<rect class="ch-failed" x="${(x - 6).toFixed(1)}" y="${f.top}" width="12" height="${(f.bottom - f.top).toFixed(1)}" fill="url(#${id})"></rect>`;
  }).join("");
}

export interface HoverRow { you: boolean; swatch: string; name: string; value: string }

/** One full-height target per run, so the pointer does not hunt for a dot. */
export function hoverTargets(f: Frame, runs: Array<{ time: number; when: string; rows: HoverRow[] }>): string {
  const xs = runs.map((run) => f.scale.x(run.time));
  return runs.map((run, index) => {
    const x = xs[index] as number;
    const from = index === 0 ? f.left : (x + (xs[index - 1] as number)) / 2;
    const to = index === runs.length - 1 ? f.right : (x + (xs[index + 1] as number)) / 2;
    const rows = run.rows.map((row) => `${row.you ? "1" : "0"}|${row.swatch}|${row.name}|${row.value}`).join(";");
    return `<rect class="ch-hit" data-x="${x.toFixed(1)}" data-when="${html(run.when)}" data-rows="${html(rows)}"`
      + ` x="${from.toFixed(1)}" y="${f.top}" width="${Math.max(1, to - from).toFixed(1)}" height="${(f.bottom - f.top).toFixed(1)}"></rect>`;
  }).join("");
}

export function crosshair(f: Frame): string {
  return `<line class="ch-cross" x1="0" x2="0" y1="${f.top}" y2="${f.bottom.toFixed(1)}" opacity="0"></line>`;
}

export function svg(f: Frame, label: string, body: string): string {
  return `<svg class="ch" width="${f.width}" height="${f.height}" viewBox="0 0 ${f.width} ${f.height}" role="img" aria-label="${html(label)}">${body}</svg>`;
}

/** Text width at the label size, near enough to place a label and its mark. */
export function labelWidth(label: string): number {
  return Math.ceil(label.length * LABEL_SIZE * 0.56);
}
