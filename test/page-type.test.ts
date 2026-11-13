import test from "node:test";
import assert from "node:assert/strict";
import { classifyPageType, PAGE_TYPE_DEFINITIONS, PAGE_TYPES, type PageType, type PageTypeRule } from "../src/product/citations/page-type.js";
import { COMMUNITY_HOSTS, REFERENCE_HOSTS, SOCIAL_HOSTS, VIDEO_HOSTS } from "../src/product/citations/page-kind.js";

const companies = { companyDomains: ["you.test", "www.rival.test"] };

const CASES: Array<{ url: string; type: PageType; rule: PageTypeRule; evidence: string; why: string }> = [
  { url: `https://www.${VIDEO_HOSTS[0]}/watch?v=1`, type: "video", rule: "known-host", evidence: VIDEO_HOSTS[0] as string, why: "a video host" },
  { url: `https://old.${COMMUNITY_HOSTS[0]}/r/x/comments/1/best_tool`, type: "forum", rule: "known-host", evidence: `old.${COMMUNITY_HOSTS[0]}`, why: "host beats a ranking word in the slug" },
  { url: `https://${SOCIAL_HOSTS[0]}/posts/someone`, type: "social", rule: "known-host", evidence: SOCIAL_HOSTS[0] as string, why: "a social host" },
  { url: `https://en.${REFERENCE_HOSTS[0]}/wiki/Thing`, type: "reference", rule: "known-host", evidence: `en.${REFERENCE_HOSTS[0]}`, why: "a reference host" },
  { url: "https://pub.test/a-vs-b", type: "comparison", rule: "path-word", evidence: "vs", why: "head to head" },
  { url: "https://pub.test/blog/best-tools-2026", type: "comparison", rule: "path-word", evidence: "best", why: "a ranking word outranks the blog section" },
  { url: "https://docs.pub.test/compare/plans", type: "comparison", rule: "path-word", evidence: "compare", why: "purpose outranks a docs subdomain" },
  { url: "https://pub.test/tool/reviews", type: "comparison", rule: "path-word", evidence: "reviews", why: "a review page" },
  { url: "https://pub.test/blog/best-practices-for-filters", type: "article", rule: "path-word", evidence: "blog", why: "best practices is advice, not a ranking" },
  { url: "https://docs.pub.test/getting-started", type: "docs", rule: "subdomain", evidence: "docs", why: "docs subdomain" },
  { url: "https://pub.test/help-center/billing", type: "docs", rule: "path-word", evidence: "help center", why: "a two word section" },
  { url: "https://you.test/docs/api/filters", type: "docs", rule: "path-word", evidence: "docs", why: "your own docs are still docs" },
  { url: "https://pub.test/blog/how-to-get-help-with-filters", type: "article", rule: "path-word", evidence: "blog", why: "help inside a headline is not a help page" },
  { url: "https://community.pub.test/thread/42", type: "forum", rule: "subdomain", evidence: "community", why: "community subdomain" },
  { url: "https://pub.test/forum/some-thread", type: "forum", rule: "path-word", evidence: "forum", why: "forum section" },
  { url: "https://news.pub.test/markets/today", type: "news", rule: "subdomain", evidence: "news", why: "news subdomain" },
  { url: "https://pub.test/press-releases/launch", type: "news", rule: "path-word", evidence: "press releases", why: "press section" },
  { url: "https://pub.test/pricing", type: "vendor", rule: "path-word", evidence: "pricing", why: "a pricing page on any site" },
  { url: "https://rival.test/", type: "vendor", rule: "company-site", evidence: "rival.test", why: "a tracked rival's homepage" },
  { url: "https://app.you.test/app", type: "vendor", rule: "company-site", evidence: "you.test", why: "your own subdomain" },
  { url: "https://pub.test/blog/x", type: "article", rule: "path-word", evidence: "blog", why: "blog section" },
  { url: "https://blog.pub.test/x", type: "article", rule: "subdomain", evidence: "blog", why: "blog subdomain" },
  { url: "https://pub.test/2026/10/how-quarterly-results-moved-the-index", type: "article", rule: "headline-slug", evidence: "how quarterly results moved the index", why: "a slug that reads as a headline" },
  { url: "https://pub.test/", type: "unknown", rule: "no-signal", evidence: "", why: "a publisher homepage says nothing" },
  { url: "https://pub.test/p/12345", type: "unknown", rule: "no-signal", evidence: "", why: "an opaque id" },
  { url: "not a url", type: "unknown", rule: "unreadable", evidence: "not a url", why: "unparseable" },
  { url: "ftp://pub.test/file", type: "unknown", rule: "unreadable", evidence: "ftp://pub.test/file", why: "not http" },
];

for (const row of CASES) {
  test(`page type: ${row.why}`, () => {
    assert.deepEqual(classifyPageType(row.url, companies), { type: row.type, rule: row.rule, evidence: row.evidence });
  });
}

test("without company domains a rival's bare page is unknown rather than guessed", () => {
  assert.equal(classifyPageType("https://rival.test/").type, "unknown");
});

test("every type is documented exactly once, unknown included", () => {
  assert.deepEqual(PAGE_TYPE_DEFINITIONS.map((row) => row.type), [...PAGE_TYPES]);
  for (const row of PAGE_TYPE_DEFINITIONS) assert.ok(row.label && row.decidedBy, row.type);
});
