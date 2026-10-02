import test from "node:test";
import assert from "node:assert/strict";
import { sharedPhrases, summariseUptake, termOverlap, uptakeOf, UPTAKE_CAVEAT, PHRASE_WORDS, WEAK_SHARE } from "../src/product/citations/answer-uptake.js";

const PAGE = "Screener.in is a free stock screening tool for Indian markets with detailed financial statements and custom query support for long term investors.";

function page(over: Record<string, unknown> = {}) {
  return { url: "https://a.test/x", host: "a.test", text: PAGE, ...over };
}

test("a phrase has to be long enough that shared wording is not a match", () => {
  // Five words of ordinary prose appear everywhere. The run has to be longer
  // than a turn of phrase before it is evidence of anything.
  assert.ok(PHRASE_WORDS >= 6);
  assert.deepEqual(sharedPhrases("a free stock screening tool", PAGE), [], "five words is a coincidence");
});

test("a copied sentence is found, and reads as one phrase rather than many", () => {
  const found = sharedPhrases("You could try it. Screener.in is a free stock screening tool for Indian markets. It is fine.", PAGE);
  assert.equal(found.length, 1, "overlapping runs are one copied sentence");
  assert.ok(found[0]?.text.includes("free stock screening tool for indian markets"));
});

test("an answer sharing nothing with the page shares nothing", () => {
  assert.deepEqual(sharedPhrases("The weather in Lisbon is mild all year round and pleasant.", PAGE), []);
});

test("a page that could not be read is unknown, never nought uptake", () => {
  const row = uptakeOf({ answerText: "anything", page: page({ text: undefined, detail: "The page is gone (404)." }), citedAt: 1 });
  assert.equal(row.uptake, null, "an unread page is not a page the answer ignored");
  assert.equal(row.coverage, null);
  assert.ok(row.detail?.includes("404"));
});

test("a page the answer drew on scores above one it did not", () => {
  const used = uptakeOf({ answerText: PAGE, page: page(), citedAt: 1 });
  const unused = uptakeOf({ answerText: "Something else entirely about gardening in the spring.", page: page(), citedAt: 1 });
  assert.ok((used.uptake || 0) > (unused.uptake || 0));
  assert.equal(unused.phrases.length, 0);
});

test("being cited first counts for more than being cited eleventh", () => {
  const text = "Lisbon weather stays mild throughout the whole calendar year.";
  const first = uptakeOf({ answerText: text, page: page(), citedAt: 1 });
  const deep = uptakeOf({ answerText: text, page: page(), citedAt: 11 });
  assert.ok((first.uptake || 0) > (deep.uptake || 0));
});

test("coverage is over paragraphs that could have been about anything", () => {
  const answer = `${PAGE}\n\nok\n\nLisbon weather stays mild throughout the whole calendar year.`;
  const row = uptakeOf({ answerText: answer, page: page(), citedAt: 1 });
  assert.equal(row.coverage, 0.5, "the two word line is too short to be about anything, so it is not a miss");
});

test("models rewrite rather than copy, so vocabulary carries the measure", () => {
  // Said differently, with none of the page's wording kept. Exact phrase
  // matching reported this as nothing taken, which was the wrong answer.
  const reworded = "Screener dot in offers free screening of Indian equities, with full financial statements and custom queries for investors holding long term.";
  assert.deepEqual(sharedPhrases(reworded, PAGE), [], "nothing was copied");
  const overlap = termOverlap(reworded, PAGE) || 0;
  assert.ok(overlap > 0.4, `rewritten from the page still shares its vocabulary, got ${overlap}`);
  assert.ok((uptakeOf({ answerText: reworded, page: page(), citedAt: 1 }).uptake || 0) > 0.3);
});

test("an answer about something else shares little, however it is cited", () => {
  const overlap = termOverlap("Lisbon weather stays mild throughout the whole calendar year.", PAGE) || 0;
  assert.ok(overlap < WEAK_SHARE, `got ${overlap}`);
});

test("an empty answer or an empty page is unmeasurable, not nought", () => {
  assert.equal(termOverlap("", PAGE), null);
  assert.equal(termOverlap(PAGE, ""), null);
});

test("nothing comparable leaves the whole figure unknown, not a low score", () => {
  // The vocabulary carries half the weight. Reading it as nought would score
  // the page on position alone and present that as a measurement.
  const row = uptakeOf({ answerText: "a of to in on", page: page(), citedAt: 1 });
  assert.equal(row.uptake, null);
  assert.equal(row.shared, null);
  assert.ok(row.detail?.includes("enough words to compare"));
});

test("the summary never averages an unread page into the figure", () => {
  const rows = [
    uptakeOf({ answerText: PAGE, page: page(), citedAt: 1 }),
    uptakeOf({ answerText: PAGE, page: page({ url: "https://b.test/y", host: "b.test", text: undefined }), citedAt: 2 }),
  ];
  const summary = summariseUptake(rows);
  assert.equal(summary.measured, 1);
  assert.equal(summary.unread, 1);
  assert.equal(summary.mean, rows[0]?.uptake);
});

test("a page cited whose subject the answer barely touches is counted", () => {
  const summary = summariseUptake([
    uptakeOf({ answerText: "Lisbon weather stays mild throughout the whole calendar year.", page: page(), citedAt: 1 }),
    uptakeOf({ answerText: PAGE, page: page({ url: "https://b.test/y" }), citedAt: 2 }),
  ]);
  assert.equal(summary.citedNotUsed, 1);
});

test("least used comes first, because a page cited and not used is the surprise", () => {
  const summary = summariseUptake([
    uptakeOf({ answerText: PAGE, page: page(), citedAt: 1 }),
    uptakeOf({ answerText: "unrelated", page: page({ url: "https://b.test/y" }), citedAt: 2 }),
  ]);
  assert.equal(summary.pages[0]?.url, "https://b.test/y");
});

test("the caveat says how to read it and what undersells a page", () => {
  assert.ok(UPTAKE_CAVEAT.includes("ranking between the pages cited for one answer"));
  assert.ok(UPTAKE_CAVEAT.includes("undersold"));
  assert.equal(summariseUptake([]).caveat, UPTAKE_CAVEAT);
  assert.equal(summariseUptake([]).mean, null, "no pages is not nought uptake");
});
