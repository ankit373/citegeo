import test from "node:test";
import assert from "node:assert/strict";
import { canonicalKey, canonicalUrl } from "../src/product/citations/canonical-url.js";
import { buildOutreachPlan } from "../src/product/citations/outreach.js";
import type { PromptAnswer } from "../src/product/topics/prompt-run-schema.js";

function answer(citationUrls: string[]): PromptAnswer {
  return {
    id: String(Math.random()), projectId: "p", runId: "r", promptId: "q", topicId: "t",
    promptText: "best screener", intent: "discovery", providerId: "browser", modelId: "m",
    modelDisplayName: "M", regionId: "global", languageId: "en", status: "completed", text: "",
    mentions: [], citationUrls, errorCode: null, errorMessage: null, latencyMs: 1, createdAt: "",
  };
}

const key = (value: string) => canonicalKey(value);

test("an assistant's own tracking parameter does not make a second page", () => {
  assert.equal(
    key("https://screener.in/features/?utm_source=chatgpt.com"),
    key("https://screener.in/features/"),
    "this is the parameter assistants actually append, so it split every count",
  );
});

test("www, the scheme and a trailing slash are the same page", () => {
  const same = [
    "https://www.screener.in/features/",
    "http://screener.in/features",
    "https://SCREENER.in/features/",
  ].map(key);
  assert.equal(new Set(same).size, 1, same.join(" | "));
});

test("a fragment never reaches the server, so it is not part of the page", () => {
  assert.equal(key("https://a.test/guide#pricing"), key("https://a.test/guide"));
});

test("parameters in another order are the same page", () => {
  assert.equal(key("https://a.test/s?b=2&a=1"), key("https://a.test/s?a=1&b=2"));
});

test("a parameter that selects content is kept, because it picks the page", () => {
  assert.notEqual(key("https://a.test/s?page=2"), key("https://a.test/s"));
  assert.equal(key("https://a.test/s?page=2"), "https://a.test/s?page=2");
});

test("the root keeps its slash, because it is the only path there is", () => {
  assert.equal(key("https://a.test/"), "https://a.test/");
  assert.equal(key("https://a.test"), "https://a.test/");
});

test("the raw URL is kept, so a wrong reading here stays traceable", () => {
  const row = canonicalUrl("https://www.a.test/x/?utm_medium=ai");
  assert.equal(row?.raw, "https://www.a.test/x/?utm_medium=ai");
  assert.equal(row?.key, "https://a.test/x");
  assert.equal(row?.host, "a.test");
  assert.equal(row?.path, "/x");
});

test("something that is not an http page is not a page at all", () => {
  assert.equal(canonicalUrl("mailto:a@b.test"), null);
  assert.equal(canonicalUrl("not a url"), null);
  assert.equal(canonicalUrl(""), null);
  assert.equal(canonicalUrl("   "), null);
});

test("one page cited with and without a tracking parameter is one target", () => {
  const plan = buildOutreachPlan({
    answers: [
      answer(["https://a.test/x?utm_source=chatgpt.com"]),
      answer(["https://www.a.test/x/"]),
    ],
    pages: [],
  });
  assert.equal(plan.targets.length, 1, "counted raw, this was two pages and two outreach targets");
  assert.equal(plan.targets[0]?.citedBy, 2);
  assert.equal(plan.cited, 1);
});

test("a page already read is found again however the citation spelled it", () => {
  const plan = buildOutreachPlan({
    answers: [answer(["https://a.test/x?utm_source=chatgpt.com"])],
    pages: [{
      url: "https://www.a.test/x/", host: "a.test", fetchedAt: "", title: "X", description: "",
      headings: [], words: 400, namesYou: true, named: [], detail: null,
    }],
  });
  assert.equal(plan.targets[0]?.namesYou, true, "read under one spelling, cited under another");
  assert.equal(plan.targets[0]?.words, 400);
});

test("the same page twice in one answer is one citation, not two", () => {
  const plan = buildOutreachPlan({
    answers: [answer(["https://a.test/x", "https://a.test/x/?utm_campaign=z"])],
    pages: [],
  });
  assert.equal(plan.targets.length, 1);
  assert.equal(plan.targets[0]?.citedBy, 1);
});

test("a referral tag is dropped but a content parameter is not", () => {
  assert.equal(key("https://a.test/p?ref=newsletter"), key("https://a.test/p"));
  assert.notEqual(key("https://a.test/p?id=7"), key("https://a.test/p"));
});
