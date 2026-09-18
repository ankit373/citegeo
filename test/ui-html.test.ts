import test from "node:test";
import assert from "node:assert/strict";
import { renderAppHtml } from "../src/ui/app-html.js";

test("app shell is English-only and submits the plan", () => {
  const html = renderAppHtml();

  assert.ok(!html.includes("data-language-choice"));
  assert.ok(html.includes('<html lang="en">'));
  assert.ok(html.includes('id="confirm-plan"'));
  assert.ok(html.includes('id="confirm-run-button"'));
  assert.ok(html.includes('/audit-plan'));
  assert.ok(html.includes('confirmedPlan: planPayloadForRun()'));
  assert.ok(html.includes('id="keywords"'));
  assert.ok(html.includes('id="competitors"'));
  assert.ok(html.includes('id="githubRepo"'));
  assert.ok(html.includes('id="webSearchEnabled"'));
  assert.equal(html.includes('id="webSearchMode"'), false);
  assert.ok(html.includes('webSearchEnabled: $("webSearchEnabled").value === "true"'));
  assert.ok(html.includes('webSearchMode: "provider_native"'));
  assert.ok(html.includes('keywordMode: "Keyword mode"'));
  assert.ok(html.includes('languageSwitch: "Language"'));
  assert.ok(html.includes('const state = { providers: [], modelCatalogs: [], modelCatalogError: "", latestResult: null, latestRuns: null, auditPlan: null }'));
  assert.ok(html.includes('language: "en"'));
  assert.ok(html.includes('keywords: $("keywords").value'));
  assert.ok(html.includes('competitors: $("competitors").value'));
  assert.ok(html.includes('githubRepo: $("githubRepo").value'));
  assert.ok(!html.includes('<select id="language"'));
  assert.ok(!html.includes('id="language" name="language"'));
});

test("app shell renders the project monitoring workspace and restrained dark design", () => {
  const html = renderAppHtml();

  for (const view of ["overview", "prompts", "visibility", "competitors", "citations", "monitoring", "runs", "providers", "settings"]) {
    assert.equal(html.includes(`data-view="${view}"`), true, view);
    assert.equal(html.includes(`data-view-panel="${view}"`), true, view);
  }
  for (const endpoint of ["/projects", "/workbench?", "/baselines", "/tasks", "/observations"]) {
    assert.equal(html.includes(endpoint), true, endpoint);
  }
  for (const step of ["1", "2", "3", "4", "5"]) assert.equal(html.includes(`data-step="${step}"`), true, step);
  assert.equal(html.includes("--bg: #14120F"), true);
  assert.equal(html.includes("--sidebar: var(--bg-inset)"), true);
  assert.equal(html.includes("--panel: var(--bg-elevated)"), true);
  assert.equal(html.includes("--confirmed: #7FA06E"), true);
  assert.equal(html.includes("--series-1: #6B8CAE"), true);
  assert.equal(html.includes("#4c8dff"), false);
  assert.equal(html.includes("Inter,"), false);
  assert.equal(html.includes("linear-gradient"), false);
  assert.equal(html.includes("backdrop-filter"), false);
  assert.equal(html.includes("AI magic"), false);
  assert.equal(html.includes('brandDiscovery: "Discovered in unbranded questions"'), true);
  assert.equal(html.includes('candidateEntryBasis: "Only questions classified before the run as candidate decisions are included."'), true);
  assert.equal(html.includes('explicitRecommendationBasis: "Only questions classified before the run as recommendation decisions are included."'), true);
  assert.equal(html.includes('officialDomainCoverageTitle: "Official domain coverage"'), true);
  assert.equal(html.includes('function targetDomainBreakdown()'), true);
  assert.equal(html.includes('t("sourcePageBreakdown")'), true);
  assert.equal(html.includes('trendTitle: "Changes in AI answers about your brand"'), true);
  assert.equal(html.includes('discoveryProof: "Whether AI thinks of your brand when the user does not name it."'), true);
  assert.equal(html.includes('function trendDefinitionsMarkup(seriesRows)'), true);
  assert.equal(html.includes('function trendProofMarkup(seriesRows)'), true);
  assert.equal(html.includes('function seriesDrawable(series)'), true);
  assert.equal(html.includes('if (!seriesDrawable(series)) return'), true);
  assert.equal(html.includes('function openTrendPoint(metricId, runId)'), true);
  assert.equal(html.includes('data-trend-run-id'), true);
  assert.equal(html.includes('trendEvidenceSection(t("newlyMatched")'), true);
  assert.equal(html.includes('trendEvidenceSection(t("persistentlyMatched")'), true);
  assert.equal(html.includes('trendEvidenceSection(t("removedMatched")'), true);
  assert.equal(html.includes('cannotProveCause: "That an optimization caused the observed change"'), true);
  assert.equal(html.includes('id="audit-progress"'), true);
  assert.equal(html.includes('id="provider-model-search"'), true);
  assert.equal(html.includes('id="selected-model-capabilities"'), true);
  assert.equal(html.includes('requestJson("/provider-models")'), true);
  assert.equal(html.includes('data-native-web-search'), true);
  assert.equal(html.includes('nativeWebSearchSupported'), true);
  assert.equal(html.includes('id="detail-backdrop"'), true);
  assert.equal(html.includes('data-ui-state="loading"'), true);
  assert.equal(html.includes('data-ui-state="success"'), true);
  assert.equal(html.includes('data-ui-state="error"'), true);
});
