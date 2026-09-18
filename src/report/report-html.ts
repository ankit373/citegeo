import type { AuditReportModel } from "./report-model.js";
import { htmlEscape } from "./format.js";
import { PRODUCT_NAME, renderCiteGeoMarkSvg } from "../ui/brand.js";
import { WORKBENCH_CSS } from "../ui/workbench-style.js";
import type { AnswerStory, EvidenceStatement, HumanReport, SourceStory } from "./human-report.js";
import { buildHumanReport } from "./human-report.js";

type Copy = {
  lang: string;
  nav: string[];
  sections: {
    summary: string;
    brand: string;
    competitors: string;
    competition: string;
    sources: string;
  };
  labels: {
    ai: string;
    judgment: string;
    why: string;
    threat: string;
    otherCompetitors: string;
    betterQuestion: string;
    targetBetterQuestion: string;
    occupiedQuestion: string;
    evidenceAnswers: string;
    evidenceSources: string;
    viewEvidence: string;
    viewSourceEvidence: string;
    openSource: string;
    targetSources: string;
    competitorSources: string;
    thirdPartySources: string;
    allSources: string;
    relatedSources: string;
    possibleSources: string;
    excludedSources: string;
    sourceStatus: string;
    allAnswers: string;
    noSources: string;
    question: string;
    aiSource: string;
    model: string;
    webSearch: string;
    mentionsBrand: string;
    competitorsMentioned: string;
    citedSources: string;
    actualAnswer: string;
    questionResult: string;
    userAskedFor: string;
    aiAnswered: string;
    aiMissed: string;
    uncertain: string;
    taskCompletion: string;
    entityRelationships: string;
    evidenceQuote: string;
    yes: string;
    no: string;
    none: string;
    mentionedCompetitors: string;
  };
};

const COPY: Record<HumanReport["locale"], Copy> = {
  en: {
    lang: "en",
    nav: ["Summary", "How AI Sees You", "Competitors", "Competition", "Sources"],
    sections: {
      summary: "Summary",
      brand: "How AI Sees You",
      competitors: "Who Competes With You",
      competition: "Competitive Differences",
      sources: "Sources",
    },
    labels: {
      ai: "AI",
      judgment: "Judgment",
      why: "Why it competes with you",
      threat: "Threat level",
      otherCompetitors: "Possibly related brands",
      betterQuestion: "Scenarios where competitors appear more easily",
      targetBetterQuestion: "Scenarios where your brand appears more easily",
      occupiedQuestion: "Important questions where your brand is absent",
      evidenceAnswers: "Relevant AI answers",
      evidenceSources: "Supporting sources",
      viewEvidence: "View the supporting AI answer",
      viewSourceEvidence: "View the AI answer behind this source",
      openSource: "Open source",
      targetSources: "Your main sources",
      competitorSources: "Competitor sources",
      thirdPartySources: "Third-party sources",
      allSources: "View all sources",
      relatedSources: "Related sources",
      possibleSources: "Possibly related sources",
      excludedSources: "Excluded sources",
      sourceStatus: "Status",
      allAnswers: "View actual AI answers",
      noSources: "This run did not return usable sources.",
      question: "User question",
      aiSource: "AI source",
      model: "Model",
      webSearch: "Web access",
      mentionsBrand: "Mentions your brand",
      competitorsMentioned: "Competitors mentioned",
      citedSources: "Cited sources",
      actualAnswer: "Actual AI answer",
      questionResult: "Question result",
      userAskedFor: "User asked for",
      aiAnswered: "What AI answered",
      aiMissed: "What AI missed",
      uncertain: "Uncertain",
      taskCompletion: "Task completion",
      entityRelationships: "Entity relationships",
      evidenceQuote: "Evidence quote",
      yes: "Yes",
      no: "No",
      none: "None",
      mentionedCompetitors: "Competitors mentioned",
    },
  },
};

function answerHref(index: number): string {
  return `#answer-${index}`;
}

function sourceHref(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href;
  } catch {
    return "#";
  }
  return "#";
}

function evidenceLinks(item: EvidenceStatement, copy: Copy): string {
  const answerIndex = item.answerIndexes[0];
  if (typeof answerIndex === "number") {
    return `<div class="evidence-row"><a class="evidence-link" href="${answerHref(answerIndex)}">${htmlEscape(copy.labels.viewEvidence)}</a></div>`;
  }
  const sourceUrl = item.sourceUrls[0];
  if (sourceUrl) {
    return `<div class="evidence-row"><a class="evidence-link" href="${htmlEscape(sourceHref(sourceUrl))}" rel="noreferrer">${htmlEscape(copy.labels.viewEvidence)}</a></div>`;
  }
  return "";
}

function renderStatementList(items: EvidenceStatement[], copy: Copy): string {
  return `<ul class="statement-list">${items
    .map(
      (item) => `<li>
        <p>${htmlEscape(item.text)}</p>
        ${evidenceLinks(item, copy)}
      </li>`,
    )
    .join("")}</ul>`;
}

function renderTextList(items: string[]): string {
  return `<ul class="statement-list">${items.map((item) => `<li><p>${htmlEscape(item)}</p></li>`).join("")}</ul>`;
}

function renderCompetitors(report: HumanReport, copy: Copy): string {
  const main = report.sections.competitors.length === 0
    ? `<p class="empty">${htmlEscape("Current answers are not enough to identify main competitors.")}</p>`
    : `<div class="competitor-grid">${report.sections.competitors
    .map(
      (competitor) => `<article class="competitor-card">
        <div class="card-head">
          <h3>${htmlEscape(competitor.name)}</h3>
          <span>${htmlEscape(competitor.threat)}</span>
        </div>
        <div class="why-block">
          <strong>${htmlEscape(copy.labels.why)}</strong>
          <p>${htmlEscape(competitor.why)}</p>
        </div>
        ${evidenceLinks({ text: competitor.name, answerIndexes: competitor.answerIndexes, sourceUrls: competitor.sourceUrls }, copy)}
      </article>`,
    )
    .join("")}</div>`;
  const other = report.sections.otherCompetitors.length
    ? `<details class="compact-details">
        <summary>${htmlEscape(copy.labels.otherCompetitors)}</summary>
        <p>${htmlEscape("These appeared in answers, but current evidence is not enough to confirm each as a clear product entity or main competitor.")}</p>
        <p>${htmlEscape(report.sections.otherCompetitors.join(", "))}</p>
      </details>`
    : "";
  return `${main}${other}`;
}

function renderModelTable(report: HumanReport, copy: Copy): string {
  if (report.sections.modelComparisons.length === 0) {
    return `<p class="empty">${htmlEscape("Current answers are not enough to compare different AIs.")}</p>`;
  }
  return `<div class="model-table-wrap"><table class="model-table">
    <thead><tr><th>${htmlEscape(copy.labels.ai)}</th><th>${htmlEscape(copy.labels.judgment)}</th><th></th></tr></thead>
    <tbody>${report.sections.modelComparisons
    .map(
      (item) => `<tr>
        <td><strong>${htmlEscape(item.displayName)}</strong></td>
        <td>${htmlEscape(item.summary)}</td>
        <td>${evidenceLinks({ text: item.sourceName, answerIndexes: item.answerIndexes, sourceUrls: item.sourceUrls }, copy)}</td>
      </tr>`,
    )
    .join("")}</tbody>
  </table></div>`;
}

function sourceStatusLabel(source: SourceStory, copy: Copy): string {
  if (source.relevance === "related") return copy.labels.relatedSources;
  if (source.relevance === "possible") return copy.labels.possibleSources;
  return copy.labels.excludedSources;
}

function renderSourceCard(source: SourceStory, copy: Copy, showStatus = false): string {
  const answerIndex = source.answerIndexes[0];
  const answerLink = typeof answerIndex === "number"
    ? `<a href="${answerHref(answerIndex)}">${htmlEscape(copy.labels.viewSourceEvidence)}</a>`
    : "";
  const status = showStatus
    ? `<span class="source-status ${htmlEscape(source.relevance)}">${htmlEscape(sourceStatusLabel(source, copy))}</span>`
    : "";
  return `<article class="source-card">
    <div class="source-title-line"><h4>${htmlEscape(source.title)}</h4>${status}</div>
    <p>${htmlEscape(source.domain)}</p>
    <p>${htmlEscape(source.supports)}</p>
    ${showStatus ? `<p>${htmlEscape(source.relevanceReason)}</p>` : ""}
    <div class="source-actions">
      <a href="${htmlEscape(sourceHref(source.url))}" rel="noreferrer">${htmlEscape(copy.labels.openSource)}</a>
      ${answerLink}
    </div>
  </article>`;
}

function renderSourceGroup(title: string, sources: SourceStory[], copy: Copy): string {
  if (sources.length === 0) {
    return `<section class="source-group"><h3>${htmlEscape(title)}</h3><p class="empty">${htmlEscape(copy.labels.noSources)}</p></section>`;
  }
  return `<section class="source-group">
    <h3>${htmlEscape(title)}</h3>
    <div class="source-grid">${sources.slice(0, 3).map((source) => renderSourceCard(source, copy)).join("")}</div>
  </section>`;
}

function renderAllSourceGroup(title: string, sources: SourceStory[], copy: Copy): string {
  if (sources.length === 0) return "";
  return `<section class="source-group"><h3>${htmlEscape(title)}</h3><div class="source-grid">${sources
    .map((source) => renderSourceCard(source, copy, true))
    .join("")}</div></section>`;
}

function renderSources(report: HumanReport, copy: Copy): string {
  const all = report.sections.allSources;
  const related = all.filter((source) => source.relevance === "related");
  const possible = all.filter((source) => source.relevance === "possible");
  const excluded = all.filter((source) => source.relevance === "excluded");
  return `<div class="source-stack">
    ${renderSourceGroup(copy.labels.targetSources, report.sections.targetSources, copy)}
    ${renderSourceGroup(copy.labels.competitorSources, report.sections.competitorSources, copy)}
    ${renderSourceGroup(copy.labels.thirdPartySources, report.sections.thirdPartySources, copy)}
    <details class="all-sources">
      <summary>${htmlEscape(copy.labels.allSources)}</summary>
      ${renderAllSourceGroup(copy.labels.relatedSources, related, copy)}
      ${renderAllSourceGroup(copy.labels.possibleSources, possible, copy)}
      ${renderAllSourceGroup(copy.labels.excludedSources, excluded, copy)}
    </details>
    <details class="all-sources">
      <summary>${htmlEscape(copy.labels.allAnswers)}</summary>
      ${renderAnswers(report, copy)}
    </details>
  </div>`;
}

function renderCompetitionSection(report: HumanReport, copy: Copy): string {
  return `<div class="competition-stack">
    <article>
      <h3>${htmlEscape(copy.labels.betterQuestion)}</h3>
      ${renderStatementList(report.sections.competitorAdvantages, copy)}
    </article>
    <article>
      <h3>${htmlEscape(copy.labels.targetBetterQuestion)}</h3>
      ${renderStatementList(report.sections.targetAdvantages, copy)}
    </article>
    <article>
      <h3>${htmlEscape(copy.labels.occupiedQuestion)}</h3>
      ${renderStatementList(report.sections.missingScenarios, copy)}
    </article>
  </div>`;
}

function renderMiniList(title: string, items: string[], copy: Copy): string {
  if (items.length === 0) return "";
  return `<div class="intent-block">
    <h4>${htmlEscape(title)}</h4>
    <ul>${items.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>
  </div>`;
}

function taskStatusLabel(status: string, copy: Copy): string {
  if (status === "completed") return "Completed";
  if (status === "partial") return "Partial";
  if (status === "missing") return "Missing";
  return "Unknown";
}

function renderIntentDetails(answer: AnswerStory, copy: Copy): string {
  const intent = answer.intentAnalysis;
  if (!intent || intent.status !== "completed") return "";
  const result = intent.adaptedResult;
  const requested = intent.promptIntent.requestedOutputs.length ? intent.promptIntent.requestedOutputs : [result.userQuestion];
  const taskItems = intent.tasks.map((task) => {
    const assessment = intent.taskResults.find((item) => item.taskId === task.id);
    const quote = assessment?.evidenceQuote
      ? `<blockquote><strong>${htmlEscape(copy.labels.evidenceQuote)}：</strong>${htmlEscape(assessment.evidenceQuote)}</blockquote>`
      : "";
    const explanation = assessment?.explanation ? `<p>${htmlEscape(assessment.explanation)}</p>` : "";
    return `<li>
      <strong>${htmlEscape(task.requirement)}</strong>
      <span>${htmlEscape(taskStatusLabel(assessment?.status || "unknown", copy))}</span>
      ${explanation}
      ${quote}
    </li>`;
  });
  const entityItems = intent.entities.slice(0, 8).map((entity) => {
    const detail = entity.explanation || `${entity.name}: ${entity.relationshipToQuestion}`;
    return `<li>
      <strong>${htmlEscape(entity.name)}</strong>
      <span>${htmlEscape(detail)}</span>
    </li>`;
  });
  return `<div class="intent-result">
    <h4>${htmlEscape(copy.labels.questionResult)}</h4>
    <p class="intent-one">${htmlEscape(result.oneSentence)}</p>
    ${renderMiniList(copy.labels.userAskedFor, requested, copy)}
    ${renderMiniList(copy.labels.aiAnswered, result.answered, copy)}
    ${renderMiniList(copy.labels.aiMissed, result.missing, copy)}
    ${renderMiniList(copy.labels.uncertain, result.uncertain, copy)}
    ${
      taskItems.length
        ? `<div class="intent-block task-block"><h4>${htmlEscape(copy.labels.taskCompletion)}</h4><ul>${taskItems.join("")}</ul></div>`
        : ""
    }
    ${
      entityItems.length
        ? `<div class="intent-block entity-block"><h4>${htmlEscape(copy.labels.entityRelationships)}</h4><ul>${entityItems.join("")}</ul></div>`
        : ""
    }
  </div>`;
}

function renderAnswers(report: HumanReport, copy: Copy): string {
  if (report.sections.answers.length === 0) {
    return `<p class="empty">${htmlEscape("No AI answers are available for this run.")}</p>`;
  }
  return `<div class="answer-list">${report.sections.answers
    .map(
      (answer) => `<details class="answer-card" id="answer-${answer.index}">
        <summary>
          <span>${htmlEscape(answer.prompt)}</span>
          <strong>${htmlEscape(answer.summary)}</strong>
        </summary>
        <div class="answer-body">
          <dl>
            <div><dt>${htmlEscape(copy.labels.question)}</dt><dd>${htmlEscape(answer.prompt)}</dd></div>
            <div><dt>${htmlEscape(copy.labels.aiSource)}</dt><dd>${htmlEscape(answer.sourceName)}</dd></div>
            <div><dt>${htmlEscape(copy.labels.model)}</dt><dd>${htmlEscape(answer.model)}</dd></div>
            <div><dt>${htmlEscape(copy.labels.webSearch)}</dt><dd>${htmlEscape(answer.webSearch)}</dd></div>
            ${
              answer.intentAnalysis?.status === "completed"
                ? ""
                : `<div><dt>${htmlEscape(copy.labels.mentionsBrand)}</dt><dd>${htmlEscape(answer.targetMentioned ? copy.labels.yes : copy.labels.no)}</dd></div>
            <div><dt>${htmlEscape(copy.labels.competitorsMentioned)}</dt><dd>${htmlEscape(answer.competitorsMentioned.join(", ") || copy.labels.none)}</dd></div>`
            }
          </dl>
          ${renderIntentDetails(answer, copy)}
          <div class="answer-sources">
            <h4>${htmlEscape(copy.labels.citedSources)}</h4>
            ${
              answer.citations.length
                ? `<ul>${answer.citations
                    .slice(0, 10)
                    .map((citation) => `<li><a href="${htmlEscape(sourceHref(citation.url))}" rel="noreferrer">${htmlEscape(citation.title || citation.url)}</a></li>`)
                    .join("")}</ul>`
                : `<p>${htmlEscape(copy.labels.none)}</p>`
            }
          </div>
          <div class="actual-answer">
            <h4>${htmlEscape(copy.labels.actualAnswer)}</h4>
            <p>${htmlEscape(answer.answer)}</p>
          </div>
        </div>
      </details>`,
    )
    .join("")}</div>`;
}

function renderSection(id: string, title: string, body: string): string {
  return `<section class="report-section" id="${id}">
    <div class="section-title"><h2>${htmlEscape(title)}</h2></div>
    ${body}
  </section>`;
}

function renderBrandSection(report: HumanReport, copy: Copy): string {
  const fallbackItem = {
    text: "Current answers are not enough to judge how AI understands your brand.",
    answerIndexes: [],
    sourceUrls: [],
  };
  return renderStatementList(report.sections.brandDescriptions.length ? report.sections.brandDescriptions : [fallbackItem], copy);
}

function renderStyle(): string {
  return `<style>
    /* Light mode is a real second mode per DESIGN.md: same rules, same
       density, swapped tokens. It is applied after the dark base below. */
    ${WORKBENCH_CSS}
    :root {
      color-scheme: dark;
      --ink: var(--text);
      --strong: var(--accent);
      --soft: #1C1914;
    }
    body { background: var(--bg); color: var(--text); line-height: 1.6; }
    a { color: var(--text); text-decoration: underline; text-underline-offset: 2px; }
    .layout { grid-template-columns: 248px minmax(0, 1fr); }
    .sidebar {
      position: sticky;
      height: 100vh;
      padding: 18px 14px;
      border-right: 1px solid var(--line);
      border-bottom: 0;
      background: var(--sidebar);
    }
    .brand {
      min-height: 48px;
      margin: 0 0 16px;
      padding: 0 8px 14px;
      border-bottom: 1px solid var(--line);
      color: var(--text);
      font-size: 14px;
    }
    .brand svg { width: 30px; height: 30px; }
    nav { display: grid; gap: 3px; }
    nav a {
      min-height: 38px;
      padding: 9px 10px;
      border: 1px solid transparent;
      border-radius: 6px;
      color: var(--secondary);
      font-size: 12px;
      font-weight: 650;
    }
    nav a:hover { border-color: var(--border); background: var(--panel-hover); color: var(--text); text-decoration: none; }
    main { width: 100%; max-width: none; padding: 30px 32px 72px; }
    .hero { margin-bottom: 26px; padding-bottom: 22px; border-bottom: 1px solid var(--line); }
    .hero h1 { margin: 0 0 8px; max-width: 960px; font-size: 30px; line-height: 1.2; }
    .hero p { max-width: 920px; color: var(--secondary); font-size: 13px; }
    .source-note {
      margin-top: 14px;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--panel);
      color: var(--secondary);
      font-size: 11px;
    }
    .report-section { margin-top: 34px; padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
    .section-title { margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--line); }
    .section-title h2 { margin: 0; color: var(--text); font-size: 18px; }
    .conclusion { max-width: 940px; color: var(--text); font-size: 22px; line-height: 1.4; }
    .model-table-wrap, .data-table-wrap { border-color: var(--border); background: var(--panel); }
    .model-table { border-color: var(--border); border-radius: 8px; background: var(--panel); }
    .model-table th, .model-table td { border-color: var(--line); color: var(--secondary); }
    .model-table th { background: #0E0C0A; color: var(--muted); }
    .model-table td strong, .model-table td:first-child { color: var(--text); }
    .brand-read article, .competitor-card, .model-card, .source-card,
    .competition-stack article, .compact-details, .all-sources, .answer-card, .intent-result {
      border-color: var(--border);
      border-radius: 8px;
      background: var(--panel);
      box-shadow: none;
    }
    .brand-read article:first-child { background: var(--panel); }
    .statement-list li { border-left: 2px solid var(--border-strong); color: var(--secondary); }
    .statement-list li strong, h3, h4 { color: var(--text); }
    .evidence-link, .source-actions a {
      min-height: 28px;
      border-color: var(--border);
      border-radius: 6px;
      background: #0E0C0A;
      color: #A89C87;
      font-size: 11px;
    }
    .card-head span, .source-status { border: 1px solid var(--border); border-radius: 5px; background: #0E0C0A; color: var(--secondary); }
    .source-status.related { border-color: #3F4B35; background: #21231A; color: var(--green); }
    .source-status.possible { border-color: #5C4722; background: #2A2215; color: var(--amber); }
    .source-status.excluded { background: #0E0C0A; color: var(--muted); }
    .source-card p, .compact-details p, .answer-card summary strong, dt, .task-block span, .entity-block span { color: var(--secondary); }
    .answer-card summary { padding: 14px 16px; }
    .answer-card[open] { border-color: #4A4030; }
    .answer-body { border-color: var(--line); }
    .intent-result { background: #0E0C0A; }
    .task-block li, .entity-block li { border-color: var(--line); }
    .task-block p, .actual-answer p { color: var(--secondary); }
    blockquote { border-left: 2px solid var(--border-strong); background: #0E0C0A; color: var(--secondary); }
    .empty { border-color: var(--border); background: #0E0C0A; color: var(--muted); }
    @media (max-width: 840px) {
      .layout { display: block; }
      .sidebar { position: relative; height: auto; padding: 12px; border-right: 0; border-bottom: 1px solid var(--line); }
      .brand { margin-bottom: 10px; }
      nav { display: flex; overflow-x: auto; }
      nav a { flex: 0 0 auto; }
      main { padding: 24px 14px 56px; }
      .hero h1 { font-size: 24px; }
      .conclusion { font-size: 18px; }
    }
    @media (prefers-color-scheme: light) {
      :root {
        color-scheme: light;
        --bg: #F5F1E8;
        --bg-elevated: #FFFFFF;
        --bg-hover: #ECE6D9;
        --bg-inset: #ECE6D9;
        --border: #DDD4C2;
        --border-strong: #C4B79E;
        --text: #1C1914;
        --text-muted: #6E6455;
        --text-weak: #8A7F6C;
        --confirmed-text: #4A6B39;
        --unknown-text: #8A6413;
        --failed-text: #9A3D28;
        --ink: var(--text);
        --strong: var(--text);
        --soft: #ECE6D9;
      }
      .source-status.related { border-color: #A8C199; background: #E7EFE1; color: var(--confirmed-text); }
      .source-status.possible { border-color: #D8BE82; background: #F6EEDC; color: var(--unknown-text); }
      blockquote, .model-table th, .card-head span, .source-status, .intent-result, .empty { background: var(--bg-inset); }
    }
  </style>`;
}

export function renderDashboardHtml(model: AuditReportModel): string {
  const report = buildHumanReport(model.audit);
  const copy = COPY[report.locale];
  const navIds = ["summary", "brand", "competitors", "competition", "sources"];
  return `<!doctype html>
<html lang="${htmlEscape(copy.lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${htmlEscape(report.title)} - ${htmlEscape(PRODUCT_NAME)}</title>
  <link rel="preconnect" href="https://api.fontshare.com">
  <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f%5B%5D=cabinet-grotesk@800,700&f%5B%5D=general-sans@400,500,600&display=swap">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap">
  ${renderStyle()}
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <div class="brand">${renderCiteGeoMarkSvg()}<span>${htmlEscape(PRODUCT_NAME)}</span></div>
      <nav>
        ${copy.nav.map((label, index) => `<a href="#${navIds[index]}">${htmlEscape(label)}</a>`).join("")}
      </nav>
    </aside>
    <main>
      <header class="hero">
        <h1>${htmlEscape(report.title)}</h1>
        <p>${htmlEscape(report.subtitle)}</p>
        <div class="source-note">${htmlEscape(report.caveat)}</div>
      </header>
      ${renderSection("summary", copy.sections.summary, `<p class="conclusion">${htmlEscape(report.sections.headline)}</p>${renderModelTable(report, copy)}`)}
      ${renderSection("brand", copy.sections.brand, renderBrandSection(report, copy))}
      ${renderSection("competitors", copy.sections.competitors, renderCompetitors(report, copy))}
      ${renderSection("competition", copy.sections.competition, renderCompetitionSection(report, copy))}
      ${renderSection("sources", copy.sections.sources, renderSources(report, copy))}
    </main>
  </div>
  <script>
    function openHashTarget() {
      var id = window.location.hash ? window.location.hash.slice(1) : "";
      if (!id) return;
      var target = document.getElementById(id);
      if (target && target.tagName && target.tagName.toLowerCase() === "details") target.open = true;
      var parent = target ? target.parentElement : null;
      while (parent) {
        if (parent.tagName && parent.tagName.toLowerCase() === "details") parent.open = true;
        parent = parent.parentElement;
      }
    }
    window.addEventListener("hashchange", openHashTarget);
    openHashTarget();
  </script>
</body>
</html>`;
}
