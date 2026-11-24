import test from "node:test";
import assert from "node:assert/strict";
import {
  renderDecoys, renderExperiments, renderFraming, renderHumanCheck, renderPhrasing, renderSchedule, renderTier, renderVariance, renderVersions,
  type FoldCard,
} from "../src/ui/app/pages/trust-sections.js";
import type { PhrasingReport, QuestionPhrasing } from "../src/product/topics/phrasing-sensitivity.js";
import type { DecoyReport } from "../src/product/topics/decoy-check.js";
import type { FactorShare, VarianceReport } from "../src/product/topics/variance-share.js";
import type { QuestionFraming, SentimentVolatility } from "../src/product/topics/sentiment-volatility.js";
import type { TierComparison } from "../src/product/topics/visibility-tier.js";
import type { VersionReport, VersionShift, VersionSeen } from "../src/product/topics/model-version.js";
import type { FieldAgreement, ReviewItem } from "../src/product/topics/human-check.js";
import type { ExperimentReport } from "../src/product/experiments/experiment-service.js";
import type { PromptSchedule } from "../src/product/topics/prompt-schedule.js";
import type { ProportionInterval } from "../src/product/topics/proportion-interval.js";

function has(text: string, ...parts: string[]): void {
  for (const part of parts) assert.ok(text.includes(part), `${JSON.stringify(text)} lacks ${part}`);
}

const fold: FoldCard = (id, title, blurb, body, aside = "") => ["FOLD", id, title, blurb, body, aside].join("|");
const interval = (rate: number | null, low: number | null, high: number | null): ProportionInterval => ({ rate, low, high, trials: 5, caveat: "" });

const question = (naming: QuestionPhrasing["naming"]): QuestionPhrasing => ({
  rootId: "r", rootText: "Root<", modelId: "m", namedIn: 1, naming, agreed: naming !== "split", spread: 0.3,
  wordings: [{ promptId: "a", text: "first<", answers: 2, named: 1 }, { promptId: "b", text: "second", answers: 2, named: 0 }],
});
const phrasing = (over: Partial<PhrasingReport> = {}): PhrasingReport =>
  ({ measured: 2, namesTheBrand: 0, oneWording: 0, unstable: 0, neverNamed: 1, alwaysNamed: 1, spread: 0.25, questions: [question("split")], caveat: "cv", ...over });

test("every trust card folds under its own id and says when it has nothing to read", () => {
  assert.equal(renderPhrasing(null, fold), "");
  has(renderPhrasing(phrasing({ measured: 0 }), fold), "FOLD|trust-phrasing|How much the wording decides", "Every question here is written down one way", "Open questions");
  has(renderPhrasing(phrasing(), fold), "averages 25%", "Root&lt;", "first&lt;", "1 of 2", "Widest gap");
  has(renderPhrasing(phrasing({ unstable: 2, namesTheBrand: 1, spread: null }), fold), "named you under one wording and not another", "1 wording(s) name you", "No pair of wordings");
  has(renderPhrasing(phrasing({ alwaysNamed: 0 }), fold), "agree on an absence");
  has(renderPhrasing(phrasing({ neverNamed: 0 }), fold), "Every wording of every question named you.");
});

test("decoys state the noise floor and whether the score clears it", () => {
  const decoy = { name: "Fake<", namedIn: 1, inText: 1, absentFromText: 0, share: 0.1, high: null };
  const report: DecoyReport = { considered: 10, decoys: [decoy], noiseFloor: 0.05, matcherErrors: 0, presenceRate: 0.3, clearsFloor: true, caveat: "c" };
  assert.equal(renderDecoys(undefined, fold), "");
  has(renderDecoys({ ...report, decoys: [] }, fold), "A brand that should never appear", "Add a decoy");
  has(renderDecoys(report, fold), "Anything under 5% is not a finding.", "Your 30% clears it.", "Fake&lt;", "1 of 10", "—");
  has(renderDecoys({ ...report, clearsFloor: false, matcherErrors: 2 }, fold), "does not clear it", "2 reported mention(s)");
  has(renderDecoys({ ...report, clearsFloor: null }, fold), "Nothing answered yet");
});

const factor = (share: number | null, best = true): FactorShare => ({
  factor: "model", label: "Which model<", levels: 3, share, best: best ? { level: "a", rate: 0.5 } : null, worst: best ? { level: "b", rate: 0.1 } : null,
});
const variance = (over: Partial<VarianceReport> = {}): VarianceReport =>
  ({ answers: 20, rate: 0.3, flat: false, factors: [factor(0.5), { ...factor(null, false), label: "Which market" }], tooFew: false, wordingIsTheQuestion: false, events: 5, caveat: "c", ...over });

test("variance withholds a factor that never varied and warns when the outcome is rare", () => {
  assert.equal(renderVariance(variance({ answers: 0 }), fold), "");
  has(renderVariance(variance({ flat: true }), fold), "Every answer said the same thing about you");
  assert.equal(renderVariance(variance({ factors: [factor(null)] }), fold), "");
  const out = renderVariance(variance({ tooFew: true }), fold);
  has(out, "Which model&lt;", "50%", "Which market took one value", "5 of 20 answers are the outcome", "state-flag");
});

const framing = (steady: boolean): QuestionFraming => ({ promptId: "p", promptText: "Q<", modelId: "m", named: 3, framings: steady ? ["positive"] : ["positive", "negative"], steady });
const volatility = (over: Partial<SentimentVolatility> = {}): SentimentVolatility =>
  ({ measured: 2, flipped: 1, flipRate: 0.5, namingFlipped: 0, namingFlipRate: 0, ratio: 2.5, publishedRatio: 3, questions: [framing(true), framing(false)], caveat: "c", ...over });

test("framing compares flips with naming only when naming moved", () => {
  has(renderFraming(volatility({ measured: 0 }), fold), "Published work puts framing flipping about 3 times as often");
  has(renderFraming(volatility(), fold), "1 of 2 question(s) described you more than one way", "2.5 times as often", "Steady", "2 ways", "Q&lt;");
  has(renderFraming(volatility({ ratio: null, flipped: 0 }), fold), "never flipped here", "described you the same way each time");
});

const tier = (over: Partial<TierComparison> = {}): TierComparison => ({
  tier: "household", baseline: { tier: "household", label: "Household<", rate: 0.73, note: "n" }, presence: interval(0.3, 0.2, 0.4), typical: true, standing: "typical", caveat: "c", ...over,
});

test("the tier card offers the picker with the declared tier chosen", () => {
  assert.equal(renderTier(null, fold), "");
  has(renderTier(tier({ baseline: null }), fold), "Against brands like yours", "data-brand-tier", '<option value="household" selected>');
  has(renderTier(tier(), fold), "yours", "Household&lt;", "doing what your kind does", "30%");
  has(renderTier(tier({ standing: "above" }), fold), "clear of the", "state-ok");
  has(renderTier(tier({ standing: "below" }), fold), "falls short of the", "state-bad");
  has(renderTier(tier({ standing: null, presence: interval(null, null, null) }), fold), "—");
});

const seen = (version: string): VersionSeen => ({ version, answers: 3, firstAt: "a", lastAt: "b", presence: interval(0.5, 0.3, 0.7) });
const shift = (separated: boolean | null, change: number | null): VersionShift => ({ modelId: "m<", from: seen("v1"), to: seen("v2"), change, separated });
const versions = (over: Partial<VersionReport> = {}): VersionReport => ({
  models: [{ modelId: "m", reported: true, versions: [seen("v1"), seen("v2")], shifts: [shift(true, 0.2), shift(false, -0.1), shift(null, null)] }],
  unconfirmed: ["x<"], separatedShifts: 1, caveat: "c", ...over,
});

test("version changes are called beyond the noise, within it, or unreadable", () => {
  assert.equal(renderVersions(versions({ models: [], unconfirmed: [] }), fold), "");
  const out = renderVersions(versions(), fold);
  has(out, "1 model version change(s) moved your presence", "+20 points", "-10 points", "Too thin", "beyond the noise", "within the noise", "not readable", "x&lt; never named a version");
  has(renderVersions(versions({ models: [{ modelId: "m", reported: false, versions: [], shifts: [] }], unconfirmed: [] }), fold), "No provider here names the version it ran");
});

const calls: string[] = [];
const actions = { loadCheck: () => { calls.push("check"); }, loadExperiments: () => { calls.push("experiments"); }, loadSchedule: () => { calls.push("schedule"); } };

test("the review queue loads while idle, then shows the agreement and the next mention", () => {
  calls.length = 0;
  has(renderHumanCheck("idle", null, actions), "Drawing a sample to review.");
  assert.deepEqual(calls, ["check"]);
  has(renderHumanCheck("error", null, actions), "Could not read the review queue.");
  const field: FieldAgreement = { field: "isTarget", checked: 4, agreed: 3, interval: interval(0.75, 0.5, 0.9), corrections: [{ value: "no<", count: 2 }] };
  const item: ReviewItem = { id: "i&", answerId: "a", promptText: "Q<", modelId: "m", name: "Acme", recommendation: "positive", isTarget: true, excerpt: "around<", excerptHasName: false };
  const data = { items: [item], remaining: 3, agreement: { population: 20, byField: [field], caveat: "cv<" } };
  has(renderHumanCheck("ready", data, actions), "Is it you", "75%", "50 to 90%", "should have been no&lt; ×2", "does not contain this name anywhere", "around&lt;", "3 left in this sample, drawn from 20", 'data-verdict-id="i&amp;"');
  has(renderHumanCheck("ready", { ...data, items: [] }, actions), "Nothing left in this sample");
  assert.equal(calls.length, 1);
});

test("experiments offer a start and say when nothing is being tested", () => {
  calls.length = 0;
  has(renderExperiments("idle", null, actions), "Start one against the selected questions");
  assert.deepEqual(calls, ["experiments"]);
  has(renderExperiments("error", null, actions), "Could not read the experiments.");
  has(renderExperiments("ready", { experiments: [] }, actions), "Nothing is being tested.");
  const arm = { before: interval(0.5, 0.3, 0.7), after: interval(0.6, 0.4, 0.8), lift: 0.1 };
  const report: ExperimentReport = {
    id: "e", projectId: "p", name: "Exp<", hypothesis: "h", changed: "c", status: "running", createdAt: "x", stoppedAt: null, draftId: null,
    changedAt: "2026-11-01T00:00:00Z", treatedPromptIds: ["a"], controlPromptIds: ["b"],
    result: { verdict: "moved", difference: 0.2, low: 0.1, high: 0.3, detail: "d", caveat: "cv<", versionsChanged: [], treated: arm, control: arm },
  };
  has(renderExperiments("ready", { experiments: [report] }, actions), "Exp&lt;", "cv&lt;", "Start one against");
});

test("the schedule card shows the rule, the next run and the markets", () => {
  calls.length = 0;
  has(renderSchedule("idle", null, [], actions), "the schedule");
  assert.deepEqual(calls, ["schedule"]);
  const schedule: PromptSchedule = {
    projectId: "p", enabled: true, rule: { frequency: "weekly", timezone: "UTC" }, regionIds: ["in"], nextRunAt: "2026-11-30T09:00:00Z",
    lastRunAt: null, lastRunId: null, lastError: "boom<", updatedAt: "x",
  };
  const out = renderSchedule("ready", schedule, [{ id: "in", label: "India<" }, { id: "us", label: "US" }], actions);
  has(out, '<option value="weekly" selected>Weekly', "Next run 2026-11-30 09:00 UTC.", "India&lt;", "value=\"in\" checked", "boom&lt;", "Run automatically");
  has(renderSchedule("ready", { ...schedule, enabled: false, nextRunAt: null, lastError: null }, undefined, actions), "Not scheduled.");
});
