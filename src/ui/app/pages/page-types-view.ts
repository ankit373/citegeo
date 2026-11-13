import { html, join } from "../dom.js";
// Both cell helpers take markup, so every value is escaped before it goes in.
import { cell, nameCell, row, table } from "../components/primitives.js";
import { percent } from "../format.js";

/** Mirrors the server shapes. The types stay local so every import stays inside
 * the tree the app route serves. */
export interface PageTypeDefinitionView { type: string; label: string; decidedBy: string }
export interface TypeCountView { type: string; citations: number; share: number | null }
export interface RunSplitView { runId: string; startedAt: string; answers: number; citations: number; types: TypeCountView[] }
export interface TypeChangeView { type: string; previous: number | null; latest: number | null; change: number | null }
export interface TypedPageView {
  url: string; host: string; citations: number;
  reading: { type: string; rule: string; evidence: string };
}
export interface TopicPageTypesView {
  topicId: string; topicName: string; runs: RunSplitView[];
  changes: TypeChangeView[] | null; leaders: string[]; pages: TypedPageView[];
}
export interface PageTypeReportView {
  definitions: PageTypeDefinitionView[];
  topics: TopicPageTypesView[];
  answers: number;
  answersWithCitations: number;
  caveat: string;
}

const RULE_WORDS: Record<string, string> = {
  "known-host": "known host",
  subdomain: "subdomain",
  "path-word": "path has",
  "company-site": "a company's own site",
  "headline-slug": "slug reads as a headline",
  "no-signal": "no signal in the address",
  unreadable: "address could not be read",
};

function labelOf(report: PageTypeReportView, type: string): string {
  return report.definitions.find((row) => row.type === type)?.label || type;
}

function points(change: number | null): string {
  if (change === null) return "Not measurable";
  const value = Math.round(change * 100);
  return (value > 0 ? "+" : "") + value + " pts";
}

export function howDecided(reading: TypedPageView["reading"]): string {
  const words = RULE_WORDS[reading.rule] || reading.rule;
  return reading.evidence ? words + ": " + reading.evidence : words;
}

function splitTable(report: PageTypeReportView, topic: TopicPageTypesView): string {
  const latest = topic.runs[topic.runs.length - 1];
  if (!latest) return "";
  const changes = topic.changes;
  // Types nobody cited in either run add rows and say nothing.
  const rows = latest.types.flatMap((count, index) => {
    const change = changes ? changes[index] : null;
    if (!count.citations && !(change && change.previous)) return [];
    return [row("mcols-credit", [
      nameCell(html(labelOf(report, count.type))),
      cell(String(count.citations)),
      cell(html(percent(count.share))),
      cell(html(change ? points(change.change) : "One run")),
    ])];
  });
  return table({
    layout: "mcols-credit",
    columns: ["Page type", "Citations", "Share", "Since last run"],
    rows,
    empty: "The latest run cited nothing on this topic.",
  });
}

function pagesTable(report: PageTypeReportView, topic: TopicPageTypesView): string {
  return table({
    layout: "mcols-reach",
    columns: ["Cited page", "Type", "How it was decided"],
    rows: topic.pages.map((page) => row("mcols-reach", [
      nameCell(html(page.url), html(page.citations + (page.citations === 1 ? " citation" : " citations"))),
      cell(html(labelOf(report, page.reading.type))),
      cell(html(howDecided(page.reading))),
    ])),
    empty: "No page was cited on this topic.",
  });
}

function topicBlock(report: PageTypeReportView, topic: TopicPageTypesView): string {
  const runs = topic.runs.length;
  const latest = topic.runs[runs - 1];
  const lead = topic.leaders.length
    ? "Most cited in the latest run: " + topic.leaders.map((type) => labelOf(report, type)).join(", ") + "."
    : "No run has cited anything on this topic.";
  const over = latest ? " " + latest.citations + " citation(s) across " + latest.answers + " answer(s) in the latest run, " + runs + " run(s) in all." : "";
  return join([
    "<h3>", html(topic.topicName), "</h3>",
    '<p class="subtle">', html(lead + over), "</p>",
    splitTable(report, topic),
    "<details><summary>", html("Every cited page and the rule that typed it (" + topic.pages.length + ")"), "</summary>",
    pagesTable(report, topic),
    "</details>",
  ]);
}

export function pageTypesView(report: PageTypeReportView): string {
  if (!report.answers) return '<p class="subtle">No answers yet, so there is nothing to type.</p>';
  if (!report.answersWithCitations) {
    return '<p class="subtle">' + html("None of the " + report.answers + " answers cited a page, so which kind of page wins cannot be said. That is a property of the models that ran.") + "</p>";
  }
  const definitions = report.definitions.map((row) => "<li><strong>" + html(row.label) + "</strong>: " + html(row.decidedBy) + "</li>").join("");
  return join([
    report.topics.map((topic) => topicBlock(report, topic)).join(""),
    "<details><summary>How a page type is decided</summary><ul>", definitions, "</ul></details>",
    '<p class="mlegend">', html(report.caveat), "</p>",
  ]);
}
