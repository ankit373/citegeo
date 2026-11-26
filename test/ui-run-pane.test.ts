import test from "node:test";
import assert from "node:assert/strict";
import { crawlerUpload, languagePicker, pasteCountPicker, repetitionPicker } from "../src/ui/app/components/pickers.js";
import {
  blockedSelection, catalogHead, catalogReleasedAt, catalogResultSummary, catalogVendor, modelIsBlocked,
  openRouterOutOfCredit, providerShortLabel, runsNowCell, selectedRows,
} from "../src/ui/app/components/catalog-rows.js";
import { mentionChips, paneRun, renderLiveRun, runIsLive, runPaneProgress } from "../src/ui/app/pages/run-pane.js";
import type { AnswerRow, CatalogModel, RunRow, SelectionRow } from "../src/ui/app/types.js";
import type { ProviderRow } from "../src/ui/app/pages/setup-view.js";

function has(text: string, ...parts: string[]): void {
  for (const part of parts) assert.ok(text.includes(part), `${JSON.stringify(text)} lacks ${part}`);
}

const run: RunRow = {
  id: "r&", status: "running", answersRequested: 10, answersCompleted: 0, answersFailed: 0, startedAt: "2026-11-24T09:58:00Z", completedAt: null,
};

test("a live run says it is working out the time until one answer lands", (t) => {
  t.mock.method(Date, "now", () => Date.parse("2026-11-24T10:00:00Z"));
  assert.equal(renderLiveRun(null), "");
  has(renderLiveRun(run), 'data-open-run="r&amp;"', "0 of 10 answers", "working out how long this takes", "Starting up", "data-stop-run");
  has(renderLiveRun({ ...run, answersCompleted: 5, currentPromptText: "Q<", currentModelId: "m" }), "5 of 10 answers", "width:50%", "Asking m: ", "Q&lt;");
  has(renderLiveRun({ ...run, status: "cancelling" }), "Stopping", "Finishing the answer in flight.");
});

test("the pane shows the run it was opened on, live first, and says so when it has none", (t) => {
  t.mock.method(Date, "now", () => Date.parse("2026-11-24T10:00:00Z"));
  const last: RunRow = { ...run, id: "old", status: "completed", answersCompleted: 8, answersFailed: 2 };
  const panel = { kind: "run", promptId: "p", title: "t", runId: "old" };
  assert.equal(paneRun(null, run, last), null);
  assert.equal(paneRun({ ...panel, kind: "answers" }, run, last), null);
  assert.equal(paneRun(panel, run, last), last);
  assert.equal(paneRun({ ...panel, runId: "r&" }, run, last), run);
  assert.equal(paneRun({ ...panel, runId: "none" }, run, last), null);
  assert.equal(runIsLive(run), true);
  assert.equal(runIsLive(last), false);
  assert.equal(runIsLive(null), false);
  has(runPaneProgress(null), "Every answer below is archived.");
  has(runPaneProgress(last), "completed", "8 answered, 2 failed, of 10 asked");
  has(runPaneProgress({ ...run, answersCompleted: 2, answersFailed: 1 }), "3 of 10 answers", "1 failed", "width:30%");
});

test("pickers mark what is chosen, and a single language needs no picker", () => {
  has(repetitionPicker(3), '<option value="3" selected>Ask 3 times</option>', "Ask once");
  assert.equal(languagePicker([{ id: "en", label: "English" }], "en"), "");
  assert.equal(languagePicker(null, "en"), "");
  has(languagePicker([{ id: "en", label: "English" }, { id: "fr", label: "Fran<" }], "fr"), "Answer in English", '<option value="fr" selected>Answer in Fran&lt;');
  has(pasteCountPicker(5), '<option value="5" selected>5 a day</option>');
  has(crawlerUpload(true, { text: "", kind: "" }), "Reading the log");
  assert.ok(!crawlerUpload(false, { text: "", kind: "" }).includes("<input"), "the file input is mounted once outside the re-rendered tree");
  has(crawlerUpload(false, { text: "bad<", kind: "bad" }), "Upload an access log", "warning-box", "bad&lt;");
});

test("a mention list orders by where each name first appears", () => {
  const mention = (name: string, offset: number | null, isTarget = false, recommendation = "unknown") =>
    ({ name, domain: null, isTarget, recommendation, mentionQuote: null, firstMentionOffset: offset, firstMentionState: "x" });
  const answer = { mentions: [mention("Late", null), mention("Early", 1, true, "positive")] } as unknown as AnswerRow;
  const chips = mentionChips(answer);
  assert.ok(chips.indexOf("Early") < chips.indexOf("Late"));
  has(chips, "is-you", "<i>positive</i>");
  has(mentionChips({ ...answer, mentions: [] }), "No organisation was named.");
});

const providers = (runnable: boolean | null): ProviderRow[] => [{
  providerId: "openrouter", label: "OR", endpoint: null, detail: "", modelCount: 0, freeModels: 0, nativeWebSearchModels: 0,
  citationCapable: false, configured: true, reachable: true, runnableNow: true, envKeys: [], balance: runnable === null ? null : { paidModelsRunnable: runnable },
}];

test("a paid model behind an empty account says no credit, a free one does not", () => {
  assert.equal(openRouterOutOfCredit(providers(false)), true);
  assert.equal(openRouterOutOfCredit(providers(true)), false);
  assert.equal(openRouterOutOfCredit(providers(null)), false);
  const model = { providerId: "openrouter", available: true };
  assert.equal(modelIsBlocked(model, "a/b", providers(false)), true);
  assert.equal(modelIsBlocked(model, "a/b:free", providers(false)), false);
  has(runsNowCell(model, "a/b", providers(false)), "No credit");
  has(runsNowCell(model, "a/b", providers(true)), "Yes");
  has(runsNowCell({ available: false, unavailableReason: "r<" }, "a/b", []), "Never", "r&lt;");
  assert.equal(providerShortLabel(providers(true), "openrouter"), "OR");
  assert.equal(providerShortLabel([], "zz"), "zz");
});

test("catalog helpers read a vendor, a release date and a blocked row", () => {
  assert.equal(catalogVendor({ vendor: " V " }), "V");
  assert.equal(catalogVendor({ displayName: "Acme: Big" }), "Acme");
  assert.equal(catalogVendor({ modelId: "ns/model" }), "ns");
  assert.equal(catalogVendor({ modelId: "plain" }), "plain");
  assert.equal(catalogReleasedAt({ releasedAt: "2026-01-01" }), Date.parse("2026-01-01"));
  assert.equal(catalogReleasedAt({ releasedAt: 5 }), null);
  assert.equal(catalogReleasedAt({ releasedAt: "nonsense" }), null);
  assert.equal(blockedSelection({ inCatalog: false }), true);
  assert.equal(blockedSelection({ inCatalog: true, model: { available: false } }), true);
  assert.equal(blockedSelection({ inCatalog: true, model: null }), false);
  has(catalogResultSummary(3), "Show 3  models.");
  has(catalogHead(), "mcols-catalog", "Runs now");
});

test("selected rows keep a model the catalog dropped and flag it", () => {
  const catalog: CatalogModel[] = [{ modelId: "a", displayName: "A", available: true, nativeWebSearchSupported: false }];
  const selections: SelectionRow[] = [{ id: "1", providerId: "p", modelId: "gone", displayName: "G", webSearchMode: "off", nativeWebSearchSupported: false, available: true, enabled: true }];
  const drafts = new Map([["a", "off"], ["gone", "on"], ["nope", "off"]]);
  const rows = selectedRows(catalog, selections, drafts, "ready");
  assert.deepEqual(rows.map((row) => [row.modelId, row.inCatalog]), [["a", true], ["gone", false]]);
  assert.equal(selectedRows(catalog, selections, drafts, "loading")[1]?.inCatalog, true);
});
