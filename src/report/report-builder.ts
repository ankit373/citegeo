import type { AuditMetrics, AuditRun, Citation } from "../core/types.js";
import type { AuditReportModel } from "./report-model.js";
import { csvEscape, mdEscape } from "./format.js";
import { renderDashboardHtml } from "./report-html.js";
import type { AnswerStory, EvidenceStatement, HumanReport, SourceStory } from "./human-report.js";
import { buildHumanReport } from "./human-report.js";

function completedCitations(audit: AuditRun): Citation[] {
  return audit.runs
    .filter((run) => run.status === "completed")
    .flatMap((run) => run.analysis?.citations || run.result?.citations || []);
}

function answerLink(indexes: number[], locale: HumanReport["locale"]): string {
  if (indexes.length === 0) return "";
  const label = "View the supporting AI answer";
  return `[${label}](#answer-${indexes[0]})`;
}

function sourceLink(urls: string[], locale: HumanReport["locale"]): string {
  if (urls.length === 0) return "";
  const label = "View the supporting AI answer";
  return `[${label}](${urls[0]})`;
}

function renderEvidence(item: EvidenceStatement, locale: HumanReport["locale"]): string[] {
  const link = answerLink(item.answerIndexes, locale) || sourceLink(item.sourceUrls, locale);
  return link ? [`  - ${link}`] : [];
}

function renderStatementList(items: EvidenceStatement[], locale: HumanReport["locale"]): string[] {
  return items.flatMap((item) => [`- ${mdEscape(item.text)}`, ...renderEvidence(item, locale)]);
}

function renderTextList(items: string[]): string[] {
  return items.map((item) => `- ${mdEscape(item)}`);
}

function section(title: string, lines: string[]): string[] {
  return [`## ${title}`, "", ...lines, ""];
}

function renderCompetitors(report: HumanReport): string[] {
  if (report.sections.competitors.length === 0) {
    return ["Current answers are not enough to identify main competitors."];
  }
  const rows = report.sections.competitors.flatMap((competitor) => [
    `### ${mdEscape(competitor.name)}｜${mdEscape(competitor.threat)}`,
    "",
    `- ${"Why"}：${mdEscape(competitor.why)}`,
    ...renderEvidence({ text: competitor.name, answerIndexes: competitor.answerIndexes, sourceUrls: competitor.sourceUrls }, report.locale),
    "",
  ]);
  if (report.sections.otherCompetitors.length) {
    rows.push(
      `<details>`,
      `<summary>${"Possibly related brands"}</summary>`,
      "",
      "These appeared in answers, but current evidence is not enough to confirm each as a clear product entity or main competitor.",
      "",
      report.sections.otherCompetitors.map(mdEscape).join(", "),
      "",
      `</details>`,
      "",
    );
  }
  return rows;
}

function renderModelComparisons(report: HumanReport): string[] {
  if (report.sections.modelComparisons.length === 0) {
    return ["Current answers are not enough to compare different AIs."];
  }
  const header = "| AI | Judgment | Evidence |";
  return [
    header,
    "| --- | --- | --- |",
    ...report.sections.modelComparisons.map((item) => {
      const link = answerLink(item.answerIndexes, report.locale) || sourceLink(item.sourceUrls, report.locale);
      return `| ${mdEscape(item.displayName)} | ${mdEscape(item.summary)} | ${link} |`;
    }),
  ];
}

function sourceStatusLabel(source: SourceStory, report: HumanReport): string {
  if (source.relevance === "related") return "Related";
  if (source.relevance === "possible") return "Possibly related";
  return "Excluded";
}

function renderSources(title: string, sources: SourceStory[], report: HumanReport): string[] {
  if (sources.length === 0) return [`### ${title}`, "", "This run did not return usable sources.", ""];
  return [
    `### ${title}`,
    "",
    ...sources.slice(0, 3).flatMap((source) => [
      `- ${mdEscape(source.title)} (${mdEscape(source.domain)})`,
      `  - [${"Open source"}](${source.url})`,
    ]),
    "",
  ];
}

function renderAllSources(report: HumanReport): string[] {
  const titles =
    { root: "View all sources", related: "Related sources", possible: "Possibly related sources", excluded: "Excluded sources" };
  const groups = [
    { title: titles.related, items: report.sections.allSources.filter((source) => source.relevance === "related") },
    { title: titles.possible, items: report.sections.allSources.filter((source) => source.relevance === "possible") },
    { title: titles.excluded, items: report.sections.allSources.filter((source) => source.relevance === "excluded") },
  ];
  return [
    `<details>`,
    `<summary>${titles.root}</summary>`,
    "",
    ...groups.flatMap((group) =>
      group.items.length
        ? [
            `#### ${group.title}`,
            "",
            ...group.items.map(
              (source) =>
                `- ${mdEscape(source.title)} (${mdEscape(source.domain)})：${mdEscape(sourceStatusLabel(source, report))}。${mdEscape(source.relevanceReason)} [${"Open source"}](${source.url})`,
            ),
            "",
          ]
        : [],
    ),
    `</details>`,
    "",
  ];
}

function statusLabel(status: string, report: HumanReport): string {
  if (status === "completed") return "Completed";
  if (status === "partial") return "Partial";
  if (status === "missing") return "Missing";
  return "Unknown";
}

function renderIntentAnswerDetails(answer: AnswerStory, report: HumanReport): string[] {
  const intent = answer.intentAnalysis;
  if (!intent || intent.status !== "completed") {
    return [
      `- ${"Competitors mentioned"}：${mdEscape(answer.competitorsMentioned.join(", ") || ("None"))}`,
    ];
  }
  const labels =
    { asked: "User asked for", answered: "What AI answered", missed: "What AI missed", uncertain: "Uncertain", tasks: "Task completion", entities: "Entity relationships", quote: "Evidence quote" };
  const requested = intent.promptIntent.requestedOutputs.length ? intent.promptIntent.requestedOutputs : [answer.prompt];
  const taskLines = intent.tasks.flatMap((task) => {
    const assessment = intent.taskResults.find((item) => item.taskId === task.id);
    const lines = [`  - ${mdEscape(task.requirement)}：${mdEscape(statusLabel(assessment?.status || "unknown", report))}`];
    if (assessment?.explanation) lines.push(`    - ${mdEscape(assessment.explanation)}`);
    if (assessment?.evidenceQuote) lines.push(`    - ${labels.quote}：${mdEscape(assessment.evidenceQuote)}`);
    return lines;
  });
  return [
    `- ${"Question result"}：${mdEscape(intent.adaptedResult.oneSentence)}`,
    `- ${labels.asked}：${mdEscape(requested.join("; "))}`,
    ...(intent.adaptedResult.answered.length ? [`- ${labels.answered}：${mdEscape(intent.adaptedResult.answered.join("; "))}`] : []),
    ...(intent.adaptedResult.missing.length ? [`- ${labels.missed}：${mdEscape(intent.adaptedResult.missing.join("; "))}`] : []),
    ...(intent.adaptedResult.uncertain.length ? [`- ${labels.uncertain}：${mdEscape(intent.adaptedResult.uncertain.join("; "))}`] : []),
    ...(taskLines.length ? [`- ${labels.tasks}：`, ...taskLines] : []),
    ...(intent.entities.length
      ? [
          `- ${labels.entities}：${mdEscape(
            intent.entities
              .slice(0, 8)
              .map((entity) => `${entity.name}: ${entity.explanation || entity.relationshipToQuestion}`)
              .join("; "),
          )}`,
        ]
      : []),
  ];
}

function renderAnswers(report: HumanReport): string[] {
  if (report.sections.answers.length === 0) return ["No AI answers are available for this run."];
  return report.sections.answers.flatMap((answer) => [
    `<a id="answer-${answer.index}"></a>`,
    `### ${"AI Answer"}`,
    "",
    `- ${"User question"}：${mdEscape(answer.prompt)}`,
    `- ${"Result"}：${mdEscape(answer.summary)}`,
    `- ${"AI source"}：${mdEscape(answer.sourceName)}`,
    `- ${"Model"}：${mdEscape(answer.model)}`,
    `- ${"Web access"}：${mdEscape(answer.webSearch)}`,
    ...renderIntentAnswerDetails(answer, report),
    "",
    "Actual AI answer:",
    "",
    "```text",
    answer.answer,
    "```",
    "",
  ]);
}

function renderCompetition(report: HumanReport): string[] {
  const titles =
    {
          better: "Scenarios where competitors appear more easily",
          targetBetter: "Scenarios where your brand appears more easily",
          occupied: "Important questions where your brand is absent",
        };
  return [
    `### ${titles.better}`,
    "",
    ...renderStatementList(report.sections.competitorAdvantages, report.locale),
    "",
    `### ${titles.targetBetter}`,
    "",
    ...renderStatementList(report.sections.targetAdvantages, report.locale),
    "",
    `### ${titles.occupied}`,
    "",
    ...renderStatementList(report.sections.missingScenarios, report.locale),
  ];
}

export class ReportBuilder {
  renderMarkdown(model: AuditReportModel): string {
    const report = buildHumanReport(model.audit);
    const titles =
      {
            summary: "Summary",
            brand: "How AI Sees You",
            competitors: "Who Competes With You",
            competition: "Competitive Differences",
            sources: "Sources",
            targetSources: "Your Main Sources",
            competitorSources: "Competitor Sources",
            thirdPartySources: "Third-party Sources",
            answers: "View Actual AI Answers",
          };

    return [
      `# ${report.title}`,
      "",
      report.subtitle,
      "",
      report.caveat,
      "",
      ...section(titles.summary, [report.sections.headline, "", ...renderModelComparisons(report)]),
      ...section(titles.brand, renderStatementList(report.sections.brandDescriptions, report.locale)),
      ...section(titles.competitors, renderCompetitors(report)),
      ...section(titles.competition, renderCompetition(report)),
      ...section(titles.sources, [
        ...renderSources(titles.targetSources, report.sections.targetSources, report),
        ...renderSources(titles.competitorSources, report.sections.competitorSources, report),
        ...renderSources(titles.thirdPartySources, report.sections.thirdPartySources, report),
        ...renderAllSources(report),
        `<details>`,
        `<summary>${titles.answers}</summary>`,
        "",
        ...renderAnswers(report),
        `</details>`,
      ]),
    ].join("\n");
  }

  renderHtml(model: AuditReportModel, markdown: string): string {
    void markdown;
    return renderDashboardHtml(model);
  }

  renderPromptCsv(metrics: AuditMetrics): string {
    const header = [
      "question",
      "question_kind",
      "ai_source",
      "model",
      "status",
      "target_mentioned",
      "competitors_mentioned",
      "official_citation_count",
    ];
    const rows = metrics.promptOutcomes.map((row) =>
      [
        row.promptId,
        row.promptAuditCategory,
        row.sourceLabel,
        row.model,
        row.status,
        row.targetMentioned,
        row.competitorMentions.join(";"),
        row.officialCitationCount,
      ]
        .map(csvEscape)
        .join(","),
    );
    return [header.join(","), ...rows].join("\n");
  }

  renderCitationCsv(audit: AuditRun): string {
    const header = ["question", "domain", "title", "url"];
    const rows = completedCitations(audit).map((citation) =>
      [citation.promptId || "", citation.domain, citation.title || "", citation.url].map(csvEscape).join(","),
    );
    return [header.join(","), ...rows].join("\n");
  }

  renderKeywordCsv(metrics: AuditMetrics): string {
    const header = ["keyword", "source", "user_defined", "owned_relevance", "prompts", "top_competitors", "gap"];
    const rows = metrics.keywordMetrics.map((row) =>
      [
        row.phrase,
        row.source,
        row.userDefined,
        row.ownedRelevance,
        row.promptCount,
        row.topCompetitors.map((competitor) => competitor.name).join(";"),
        row.gapLabel,
      ]
        .map(csvEscape)
        .join(","),
    );
    return [header.join(","), ...rows].join("\n");
  }
}
