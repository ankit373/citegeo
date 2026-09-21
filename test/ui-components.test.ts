import test from "node:test";
import assert from "node:assert/strict";
import { html, join } from "../src/ui/app/dom.js";
import { percent, rank, score, seconds } from "../src/ui/app/format.js";
import { cell, emptyState, nameCell, pill, row, section, table, tiles } from "../src/ui/app/components/primitives.js";
import { skeletonTable, skeletonTiles, loading } from "../src/ui/app/components/skeleton.js";
import { footer, header, panel, sidebar } from "../src/ui/app/components/layout.js";

test("every string a component writes is escaped, because one omission is a hole", () => {
  assert.equal(html('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  assert.ok(pill("<b>x</b>").includes("&lt;b&gt;"));
  assert.ok(section({ title: "<script>", body: "" }).includes("&lt;script&gt;"));
  assert.ok(emptyState("a & b").includes("a &amp; b"));
});

test("a null figure reads as not measurable, never as a zero", () => {
  assert.equal(percent(null), "Not measurable");
  assert.equal(percent(0), "0%");
  assert.equal(score(null), "Not measurable");
  assert.equal(score(0), "0");
  assert.equal(rank(null), "Not named");
  assert.equal(seconds(null), "no timing");
});

test("an empty table says so rather than drawing a head over nothing", () => {
  assert.equal(table({ layout: "x", columns: ["A"], rows: [], empty: "No rows yet." }), '<p class="subtle">No rows yet.</p>');
  const filled = table({ layout: "x", columns: ["A"], rows: [row("x", [cell("1")])] });
  assert.ok(filled.includes("mhead"));
  assert.ok(filled.includes("mrow"));
});

test("a loader is the shape of the thing arriving, with the same columns and rows", () => {
  const shadow = skeletonTable({ rows: 3, columns: "minmax(0,1fr) 90px" });
  assert.equal(shadow.split("sk-row").length - 1, 3);
  assert.ok(shadow.includes("grid-template-columns:minmax(0,1fr) 90px"));
  assert.equal(skeletonTiles(5).split('class="sk-tile"').length - 1, 5);
});

test("a shadow says nothing to a screen reader, so the state is stated too", () => {
  const wrap = loading("the leaderboard", skeletonTable());
  assert.ok(wrap.includes('role="status"'));
  assert.ok(wrap.includes("Loading the leaderboard"));
  assert.ok(skeletonTable().includes('aria-hidden="true"'));
});

test("the frame is one set of pieces, and the closed panel is still rendered", () => {
  assert.ok(panel({ open: false }).includes('aria-hidden="true"'));
  assert.ok(panel({ open: true, title: "Run" }).includes('role="dialog"'));
  assert.ok(header({ product: "citegeo", project: "P", actions: "" }).includes('data-page="dashboard"'));
  assert.ok(footer({ left: "a", right: "b" }).includes("appfoot"));
});

test("the brand and the crumb both go home, because both are tried", () => {
  const rail = sidebar({ brand: "<svg></svg>", projectOptions: "", groups: [], page: "prompts", footer: "" });
  assert.ok(rail.includes('class="brand" data-page="dashboard"'));
  assert.ok(header({ product: "citegeo", project: "P", actions: "" }).includes('class="crumb-home" data-page="dashboard"'));
});

test("the current page is marked for a screen reader, not only by colour", () => {
  const rail = sidebar({ brand: "", projectOptions: "", groups: [{ items: [{ page: "prompts", label: "Prompts" }] }], page: "prompts", footer: "" });
  assert.ok(rail.includes('aria-current="page"'));
  const other = sidebar({ brand: "", projectOptions: "", groups: [{ items: [{ page: "prompts", label: "Prompts" }] }], page: "dashboard", footer: "" });
  assert.equal(other.includes('aria-current'), false);
});

test("join drops the empty branches, so a conditional leaves no gap", () => {
  assert.equal(join(["a", false, null, undefined, "b"]), "ab");
  assert.ok(nameCell("Title").includes("<strong>Title</strong>"));
  assert.equal(nameCell("T", "", null).includes("<span class=\"subtle\">"), false);
});

test("switching project forgets everything read for the last one", async () => {
  const { emptyStore, forProject } = await import("../src/ui/app/state.js");
  const store = emptyStore("prompts", "a");
  store.projects.all = [{ id: "a", name: "A", normalizedDomain: "a.test", status: "active" }];
  store.scores.insights = { status: "ready", value: { answers: 7 } };
  store.home = { status: "ready", value: { score: 40 } };
  store.prompts.selection = ["q1"];
  store.scores.filters.modelId = "gpt";

  const next = forProject(store, "b");
  assert.equal(next.projects.selectedId, "b");
  assert.equal(next.scores.insights.status, "idle", "a figure from the last project must not survive the switch");
  assert.equal(next.home.status, "idle");
  assert.deepEqual(next.prompts.selection, []);
  assert.equal(next.scores.filters.modelId, "");
  assert.deepEqual(next.projects.all, store.projects.all, "the project list itself is not per project");
  assert.equal(next.page, "prompts", "the page you are on survives");
});

test("two long pulls are tracked apart, so one finishing does not unblock the other", async () => {
  const { emptyStore } = await import("../src/ui/app/state.js");
  const store = emptyStore("dashboard", "a");
  store.integrations.busy.add("search-demand");
  store.integrations.busy.add("source-pages");
  assert.equal(store.integrations.busy.has("search-demand"), true);
  store.integrations.busy.delete("search-demand");
  assert.equal(store.integrations.busy.has("source-pages"), true, "the other is still going");
});
