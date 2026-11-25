import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { expectNoOutbound, loopbackOnly } from "./loopback.js";

let temporaryRoot = "";
let server: ChildProcess | undefined;
let baseUrl = "";
const projectIds: Record<string, string> = {};

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

async function unusedPort(): Promise<number> {
  const reservation = createServer();
  await new Promise<void>((resolveListen, rejectListen) => {
    reservation.once("error", rejectListen);
    reservation.listen(0, "127.0.0.1", () => resolveListen());
  });
  const address = reservation.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve a local port.");
  await new Promise<void>((resolveClose, rejectClose) => reservation.close((error) => error ? rejectClose(error) : resolveClose()));
  return address.port;
}

async function startSeededServer(): Promise<void> {
  const port = await unusedPort();
  temporaryRoot = await mkdtemp(join(tmpdir(), "citegeo-answers-browser-"));
  server = spawn(process.execPath, [join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), "test/fixtures/answers-product-server.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), PRODUCT_DATA_DIR: temporaryRoot, RUNS_DIR: join(temporaryRoot, "runs"), MONITORING_DATA_DIR: join(temporaryRoot, "monitoring"), SKIP_DOTENV: "1" },
    stdio: "ignore",
  });
  baseUrl = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 400; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/projects`);
      if (response.status === 200) {
        const body = await response.json() as { projects: Array<{ id: string; name: string }> };
        for (const project of body.projects) projectIds[project.name] = project.id;
        return;
      }
    } catch {
      // The seeded server is still starting.
    }
    await wait(50);
  }
  throw new Error("The seeded product server did not start for browser acceptance.");
}

test.beforeAll(startSeededServer);

let outbound: () => string[] = () => [];
test.beforeEach(async ({ page }) => { outbound = await loopbackOnly(page); });
test.afterEach(() => { expectNoOutbound(outbound); });

test.afterAll(async () => {
  server?.kill("SIGTERM");
  if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
});

async function open(page: Page, project: string, nav: "answer-engine" | "trust"): Promise<void> {
  await page.goto(`${baseUrl}/?projectId=${projectIds[project]}`);
  await page.locator(`.sidebar [data-page="${nav}"]`).first().click();
}

// Holds one project's read until released, and says when the page has asked for it.
async function holdRead(page: Page, project: string, route: string): Promise<{ asked: Promise<unknown>; release: () => void; answered: Promise<unknown> }> {
  const url = `**/api/projects/${projectIds[project]}/${route}*`;
  let release!: () => void;
  const held = new Promise<void>((resolveHeld) => { release = resolveHeld; });
  await page.route(url, async (route) => {
    await held;
    await route.continue();
  });
  const matches = (candidate: string) => candidate.includes(`/api/projects/${projectIds[project]}/${route}`);
  return {
    asked: page.waitForRequest((request) => matches(request.url())),
    answered: page.waitForResponse((response) => matches(response.url())),
    release,
  };
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => new Promise((resolveFrame) => requestAnimationFrame(() => setTimeout(resolveFrame, 300))));
}

test("Sources counts the cited pages and domains from the archived answers", async ({ page }) => {
  await open(page, "Acme", "answer-engine");
  await expect(page.getByRole("heading", { level: 1, name: "Sources" })).toBeVisible();

  // Six answers were asked, one failed, and all five that completed carried a source.
  await expect(page.locator(".view")).toContainText("5 of 5 answers carried a source.");
  await expect(page.locator(".view")).toContainText("1 answer(s) failed and are excluded.");

  await page.locator("[data-fold=\"sources-own\"] summary").click();
  const pages = page.locator("[data-fold=\"sources-own\"]");
  await expect(pages.locator(".mrow", { hasText: "/pricing" }).locator(".mcell").nth(0)).toHaveText("2");
  await expect(pages.locator(".mrow", { hasText: "/guide" }).locator(".mcell").nth(0)).toHaveText("1");

  await page.locator("[data-fold=\"sources-domains\"] summary").click();
  const domains = page.locator("[data-fold=\"sources-domains\"]");
  const rival = domains.locator(".mrow", { hasText: "rival.com" }).locator(".mcell");
  await expect(rival.nth(0)).toHaveText("3");
  await expect(rival.nth(1)).toHaveText("1");
  await expect(rival.nth(2)).toHaveText("2");
  const own = domains.locator(".mrow", { hasText: "acme.com" }).locator(".mcell");
  await expect(own.nth(0)).toHaveText("3");
  await expect(own.nth(1)).toHaveText("2");
  await expect(own.nth(2)).toHaveText("0");
  await expect(domains.locator(".mrow", { hasText: "acme.com" })).toContainText("You");
  await expect(domains.locator(".mrow", { hasText: "rival.com" })).not.toContainText("You");
  await expect(domains.locator(".mrow", { hasText: "news.org" }).locator(".mcell").nth(0)).toHaveText("1");
  await expect(domains.locator(".mrow", { hasText: "news.org" }).locator(".mcell").nth(1)).toHaveText("1");

  // Three citations sat on answers that did not name Acme, on a domain that is not Acme's.
  await page.locator("[data-fold=\"sources-openings\"] summary").click();
  await expect(page.locator("[data-fold=\"sources-openings\"] li")).toHaveCount(3);
});

test("Sources lists the pages that were cited once and not again, with the date they last were", async ({ page }) => {
  await open(page, "Acme", "answer-engine");
  await page.locator("[data-fold=\"sources-history\"] summary").click();
  const history = page.locator("[data-fold=\"sources-history\"]");
  await expect(history).toContainText("Across 2 run(s) that cited something.");
  const pricing = history.locator(".mrow", { hasText: "acme.com/pricing" });
  await expect(pricing).toContainText("2026-11-10");
  await expect(pricing).toContainText("cited once, never again");
  // Cited in both runs, so it has not stopped.
  await expect(history).not.toContainText("rival.com/best");
});

test("Trust scores the five completed answers and shows the presence rate", async ({ page }) => {
  await open(page, "Acme", "trust");
  await expect(page.getByRole("heading", { level: 1, name: "Trust" })).toBeVisible();
  const score = page.locator("[data-panel=\"trust-score\"]");
  await expect(score).toContainText("How the score is built");
  await expect(score.locator(".stat", { hasText: "Presence" })).toContainText("60%");
  await expect(score.locator(".stat", { hasText: "Presence" })).toContainText("3 of 5");
  await expect(page.locator(".view")).toContainText("1 answer(s) failed and are excluded.");
});

test("a project with no answers is told so on Sources and on Trust", async ({ page }) => {
  await open(page, "Blank", "answer-engine");
  await expect(page.getByRole("heading", { name: "No answers yet" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Set up prompts" })).toBeVisible();
  await page.locator('.sidebar [data-page="trust"]').first().click();
  await expect(page.getByRole("heading", { name: "No answers yet" })).toBeVisible();
});

test("a slow list of cited pages for the first project does not land on the second", async ({ page }) => {
  const read = await holdRead(page, "Acme", "cited-pages");
  await open(page, "Acme", "answer-engine");
  await read.asked;

  await page.selectOption("[data-testid=project-select]", projectIds["Other"]);
  await expect(page.getByTestId("project-select")).toHaveValue(projectIds["Other"] || "");
  await expect(page.locator(".view")).toContainText("3 of 3 answers carried a source.");

  read.release();
  await read.answered;
  await settle(page);
  await expect(page.locator(".view")).toContainText("3 of 3 answers carried a source.");
  await expect(page.locator(".view")).not.toContainText("5 of 5 answers carried a source.");
});

test("a slow citation history for the first project does not land on the second", async ({ page }) => {
  const read = await holdRead(page, "Acme", "source-history");
  await open(page, "Acme", "answer-engine");
  await read.asked;

  await page.selectOption("[data-testid=project-select]", projectIds["Other"]);
  await expect(page.getByTestId("project-select")).toHaveValue(projectIds["Other"] || "");
  await page.locator("[data-fold=\"sources-history\"] summary").click();
  await expect(page.locator("[data-fold=\"sources-history\"]")).toContainText("1 run(s) carried a citation. Two are needed");

  read.release();
  await read.answered;
  await settle(page);
  await expect(page.locator("[data-fold=\"sources-history\"]")).toContainText("1 run(s) carried a citation. Two are needed");
  await expect(page.locator("[data-fold=\"sources-history\"]")).not.toContainText("Across 2 run(s)");
});

// Holds a POST for one project until released, then answers it with what the page needs to carry on.
async function holdPost(page: Page, project: string, route: string, reply: () => Promise<unknown>): Promise<{ asked: Promise<unknown>; release: () => void; answered: Promise<unknown> }> {
  let release!: () => void;
  const held = new Promise<void>((resolveHeld) => { release = resolveHeld; });
  const matches = (candidate: string) => candidate.includes(`/api/projects/${projectIds[project]}/${route}`);
  await page.route(`**/api/projects/${projectIds[project]}/${route}`, async (request) => {
    if (request.request().method() !== "POST") { await request.fallback(); return; }
    await held;
    await request.fulfill({ json: await reply() });
  });
  return {
    asked: page.waitForRequest((request) => request.method() === "POST" && matches(request.url())),
    answered: page.waitForResponse((response) => response.request().method() === "POST" && matches(response.url())),
    release,
  };
}

async function openCard(page: Page, id: string): Promise<void> {
  const fold = page.locator(`[data-fold="${id}"]`);
  if (await fold.getAttribute("open") === null) await fold.locator("summary").first().click();
}

test("reading the cited pages on one project does not show as busy on another, or stop the other's own", async ({ page }) => {
  const plan = async (project: string) => (await page.request.get(`${baseUrl}/api/projects/${projectIds[project]}/source-pages`)).json();
  const first = await holdPost(page, "Acme", "source-pages", async () => ({ plan: await plan("Acme"), read: 0, skipped: 0, failed: 0 }));
  const second = await holdPost(page, "Other", "source-pages", async () => ({ plan: await plan("Other"), read: 0, skipped: 0, failed: 0 }));
  await open(page, "Acme", "answer-engine");
  await openCard(page, "source-outreach");
  const card = page.locator("[data-panel=\"source-outreach\"], [data-fold=\"source-outreach\"]");
  await card.getByRole("button", { name: "Read the cited pages" }).click();
  await first.asked;
  await expect(card.getByRole("button", { name: "Reading…" })).toBeVisible();

  await page.selectOption("[data-testid=project-select]", projectIds["Other"]);
  await expect(page.getByTestId("project-select")).toHaveValue(projectIds["Other"] || "");
  await openCard(page, "source-outreach");
  await expect(card.getByRole("button", { name: "Read the cited pages" })).toBeEnabled();

  // The other project reads on its own account, not blocked by the first one's.
  await card.getByRole("button", { name: "Read the cited pages" }).click();
  await second.asked;
  await expect(card.getByRole("button", { name: "Reading…" })).toBeVisible();

  first.release();
  await first.answered;
  await settle(page);
  await expect(card.getByRole("button", { name: "Reading…" })).toBeVisible();

  second.release();
  await second.answered;
  await expect(card.getByRole("button", { name: "Read the cited pages" })).toBeVisible();
});

test("pulling Search Console on one project does not show as busy on another, and is busy again on return", async ({ page }) => {
  const status = { configured: true, siteUrl: "https://acme.com/", detail: "Connected.", report: null };
  for (const project of ["Acme", "Other"]) {
    await page.route(`**/api/projects/${projectIds[project]}/search-demand`, async (route) => {
      if (route.request().method() === "GET") await route.fulfill({ json: status });
      else await route.fallback();
    });
  }
  const report = { queries: 0, totalImpressions: 0, window: { from: "2026-08-01", to: "2026-10-30" }, prompts: [] };
  const first = await holdPost(page, "Acme", "search-demand", async () => ({ report }));
  await open(page, "Acme", "answer-engine");
  await openCard(page, "source-demand");
  const card = page.locator("[data-fold=\"source-demand\"]");
  await card.getByRole("button", { name: "Pull the last 90 days" }).click();
  await first.asked;
  await expect(card.getByRole("button", { name: "Reading…" })).toBeVisible();

  await page.selectOption("[data-testid=project-select]", projectIds["Other"]);
  await expect(page.getByTestId("project-select")).toHaveValue(projectIds["Other"] || "");
  await openCard(page, "source-demand");
  await expect(card.getByRole("button", { name: "Pull the last 90 days" })).toBeEnabled();

  await page.selectOption("[data-testid=project-select]", projectIds["Acme"]);
  await expect(page.getByTestId("project-select")).toHaveValue(projectIds["Acme"] || "");
  await openCard(page, "source-demand");
  await expect(card.getByRole("button", { name: "Reading…" })).toBeVisible();

  first.release();
  await first.answered;
  await expect(card.getByRole("button", { name: "Pull the last 90 days" })).toBeVisible();
});

test("pulling Analytics referrals on one project does not show as busy on another, and is busy again on return", async ({ page }) => {
  const status = { configured: true, propertyId: "123", detail: "Connected.", report: null };
  for (const project of ["Acme", "Other"]) {
    await page.route(`**/api/projects/${projectIds[project]}/assistant-referrals`, async (route) => {
      if (route.request().method() === "GET") await route.fulfill({ json: status });
      else await route.fallback();
    });
  }
  const report = { empty: false, totalSessions: 0, assistants: [] };
  const first = await holdPost(page, "Acme", "assistant-referrals", async () => ({ report }));
  await open(page, "Acme", "answer-engine");
  await openCard(page, "source-referrals");
  const card = page.locator("[data-fold=\"source-referrals\"]");
  await card.getByRole("button", { name: "Pull the last 90 days" }).click();
  await first.asked;
  await expect(card.getByRole("button", { name: "Reading…" })).toBeVisible();

  await page.selectOption("[data-testid=project-select]", projectIds["Other"]);
  await expect(page.getByTestId("project-select")).toHaveValue(projectIds["Other"] || "");
  await openCard(page, "source-referrals");
  await expect(card.getByRole("button", { name: "Pull the last 90 days" })).toBeEnabled();

  await page.selectOption("[data-testid=project-select]", projectIds["Acme"]);
  await expect(page.getByTestId("project-select")).toHaveValue(projectIds["Acme"] || "");
  await openCard(page, "source-referrals");
  await expect(card.getByRole("button", { name: "Reading…" })).toBeVisible();

  first.release();
  await first.answered;
  await expect(card.getByRole("button", { name: "Pull the last 90 days" })).toBeVisible();
});
