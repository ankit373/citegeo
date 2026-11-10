import { html } from "../dom.js";

// The two charts the application draws inline. Kept out of the shell so a
// chart can be read, and unit tested, without the whole application beside it.

export function trendChart(points: any[], label?: string) {
  const width = 640;
  const height = 170;
  const left = 34;
  const bottom = 26;
  if (!points.length) return '<p class="subtle">Nothing to plot in this range.</p>';
  const usable = points.filter((point) => point.value !== null);
  if (!usable.length) return '<p class="subtle">No measurable ' + html(label) + ' in this range.</p>';
  const max = points[0].axisMax || Math.max(1, ...usable.map((point) => point.value));
  const x = (index: any) => points.length === 1
    ? left + (width - left) / 2
    : left + index * (width - left - 8) / (points.length - 1);
  const y = (value: any) => 10 + (max - value) * (height - bottom - 10) / (max || 1);
  // The line joins readings. A point off a handful of answers is plotted
  // where it fell and the line is broken through it, because joining two of
  // them draws a move that the answer count invented.
  let path = "";
  let open = false;
  points.forEach((point, index) => {
    if (point.value === null || point.thin) { open = false; return; }
    path += (open ? " L " : " M ") + x(index).toFixed(1) + " " + y(point.value).toFixed(1);
    open = true;
  });
  const dots = points.map((point, index) => point.value === null
    ? ''
    : '<circle cx="' + x(index).toFixed(1) + '" cy="' + y(point.value).toFixed(1) + '" r="3.5"'
      + (point.thin ? ' class="chart-thin"' : '') + '><title>' + html(point.at.slice(0, 10)) + ': ' + html(point.display)
      + (point.thin && point.note ? ' (' + html(point.note) + ')' : '') + '</title></circle>').join("");
  const gridY = [0, max / 2, max];
  const grid = gridY.map((value) => '<line x1="' + left + '" x2="' + width + '" y1="' + y(value).toFixed(1) + '" y2="' + y(value).toFixed(1) + '" class="chart-grid"/><text x="0" y="' + (y(value) + 4).toFixed(1) + '" class="chart-axis">' + html(points[0].format(value)) + '</text>').join("");
  return '<svg class="trend" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + html(label) + ' over time">' + grid + '<path d="' + path + '" class="chart-line"/>' + dots + '</svg>';
}

export function sparkline(points: any[], width?: number, height?: number) {
  const usable = points.filter((point) => point.score.score !== null && !point.score.tooFewAnswers);
  if (usable.length < 2) return '<span class="subtle">Run again to see movement</span>';
  const values = usable.map((point) => point.score.score);
  const max = Math.max(100, ...values);
  const x = (index: any) => index * (width as any) / (usable.length - 1);
  const y = (value: any) => (height as any) - 2 - (value / max) * ((height as any) - 4);
  const path = usable.map((point, index) => (index ? "L " : "M ") + x(index).toFixed(1) + " " + y(point.score.score).toFixed(1)).join(" ");
  const last = usable[usable.length - 1];
  return '<svg viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="none" role="img" aria-label="score over time" style="width:100%;height:' + height + 'px;overflow:visible">'
    + '<path d="' + path + '" fill="none" stroke="var(--accent)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<circle cx="' + x(usable.length - 1).toFixed(1) + '" cy="' + y(last.score.score).toFixed(1) + '" r="2.75" fill="var(--accent)"/></svg>';
}
