import test from "node:test";
import assert from "node:assert/strict";
import { buildBrandInsights, buildCitationGap } from "../src/product/insights/brand-insights.js";
import type { InsightAnswer } from "../src/product/insights/brand-insights.js";

function answer(overrides: Partial<InsightAnswer> = {}): InsightAnswer {
  return {
    modelRunId: "run",
    modelId: "vendor/model",
    displayName: "Vendor Model",
    answered: true,
    recognized: false,
    brandNamed: false,
    productCategory: null,
    competitors: [],
    citedDomains: [],
    ...overrides,
  };
}

test("a run where nothing parsed has no visibility score rather than zero percent", () => {
  const insights = buildBrandInsights({ target: "example.com", answers: [answer({ answered: false })] });
  assert.equal(insights.visibility.score, null);
  assert.equal(insights.answered, 0);
});

test("visibility is reported per model as well as overall", () => {
  const insights = buildBrandInsights({
    target: "example.com",
    answers: [
      answer({ modelId: "a", recognized: true }),
      answer({ modelId: "a", recognized: false }),
      answer({ modelId: "b", recognized: true }),
    ],
  });
  assert.equal(insights.visibility.score, 2 / 3);
  const a = insights.visibility.byModel.find((row) => row.modelId === "a");
  assert.equal(a?.score, 0.5);
  assert.equal(insights.visibility.byModel[0]?.modelId, "b", "the strongest model sorts first");
});

test("share of voice counts a brand once per answer however often it is named", () => {
  const insights = buildBrandInsights({
    target: "example.com",
    answers: [
      answer({ brandNamed: true, competitors: [{ name: "Rival", domain: "rival.com" }, { name: "rival", domain: null }] }),
      answer({ competitors: [{ name: "Rival", domain: "rival.com" }] }),
    ],
  });
  const rival = insights.shareOfVoice.competitors.find((row) => row.name === "Rival");
  assert.equal(rival?.mentions, 2, "the duplicate name inside one answer counts once");
  assert.equal(insights.shareOfVoice.target.mentions, 1);
  assert.equal(insights.shareOfVoice.target.share, 1 / 3);
});

test("a competitor domain learned from one answer fills in where another omitted it", () => {
  const insights = buildBrandInsights({
    target: "example.com",
    answers: [
      answer({ competitors: [{ name: "Rival", domain: null }] }),
      answer({ competitors: [{ name: "Rival", domain: "rival.com" }] }),
    ],
  });
  assert.equal(insights.shareOfVoice.competitors[0]?.domain, "rival.com");
});

test("a domain cited twice in one answer counts as one answer", () => {
  const insights = buildBrandInsights({
    target: "example.com",
    answers: [answer({ citedDomains: ["https://news.example.org", "news.example.org", "www.news.example.org"] })],
  });
  const cited = insights.citations.domains.find((row) => row.domain === "news.example.org");
  assert.equal(cited?.answers, 1);
});

test("www and trailing slashes do not create separate cited domains", () => {
  const insights = buildBrandInsights({
    target: "www.example.com",
    answers: [answer({ citedDomains: ["example.com"] })],
  });
  assert.equal(insights.citations.targetCitedIn, 1);
  assert.equal(insights.citations.domains[0]?.isTarget, true);
});

test("categories are ranked by how often the models used them", () => {
  const insights = buildBrandInsights({
    target: "example.com",
    answers: [
      answer({ productCategory: "Stock screener" }),
      answer({ productCategory: "stock screener" }),
      answer({ productCategory: "Charting tool" }),
    ],
  });
  assert.equal(insights.categories[0]?.count, 2);
  assert.equal(insights.categories[0]?.value, "Stock screener");
});

test("the citation gap lists domains cited for competitors but never for the brand", () => {
  const gap = buildCitationGap({
    target: "example.com",
    answers: [
      answer({ competitors: [{ name: "Rival", domain: null }], citedDomains: ["review-site.com", "shared.com"] }),
      answer({ brandNamed: true, citedDomains: ["shared.com"] }),
    ],
  });
  assert.deepEqual(gap.map((row) => row.domain), ["review-site.com"]);
  assert.deepEqual(gap[0]?.competitors, ["Rival"]);
});

test("the brand's own domain is never reported as a gap", () => {
  const gap = buildCitationGap({
    target: "example.com",
    answers: [answer({ competitors: [{ name: "Rival", domain: null }], citedDomains: ["example.com"] })],
  });
  assert.deepEqual(gap, []);
});

test("a gap domain records every competitor and model it appeared for", () => {
  const gap = buildCitationGap({
    target: "example.com",
    answers: [
      answer({ modelId: "a", competitors: [{ name: "Rival", domain: null }], citedDomains: ["directory.com"] }),
      answer({ modelId: "b", competitors: [{ name: "Other", domain: null }], citedDomains: ["directory.com"] }),
    ],
  });
  assert.equal(gap[0]?.answers, 2);
  assert.deepEqual(gap[0]?.competitors, ["Other", "Rival"]);
  assert.deepEqual(gap[0]?.models, ["a", "b"]);
});

test("share of voice is null when no competitor was ever named", () => {
  const insights = buildBrandInsights({
    target: "example.com",
    answers: [answer({ brandNamed: true }), answer({})],
  });
  assert.equal(insights.shareOfVoice.target.share, null, "100% of a one-brand conversation is not a share");
  assert.equal(insights.shareOfVoice.target.mentions, 1, "the mention count is still reported");
  assert.deepEqual(insights.shareOfVoice.competitors, []);
});
