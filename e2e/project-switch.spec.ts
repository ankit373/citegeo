import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
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
  temporaryRoot = await mkdtemp(join(tmpdir(), "citegeo-switch-browser-"));
  server = spawn(process.execPath, [join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), "test/fixtures/home-product-server.ts"], {
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

test("Rivals drops the first project's competitors when another project is opened", async ({ page }) => {
  await page.goto(`${baseUrl}/?projectId=${projectIds["Acme"]}`);
  await page.locator('.sidebar [data-page="brand-visibility"]').first().click();
  await expect(page.locator("[data-panel=\"rival-leaderboard\"]")).toContainText("Rival One");

  await page.selectOption("[data-testid=project-select]", projectIds["Blank"]);
  await expect(page.getByTestId("project-select")).toHaveValue(projectIds["Blank"] || "");
  await expect(page.locator("[data-panel=\"rival-leaderboard\"]")).toHaveCount(0);
  await expect(page.locator(".view")).not.toContainText("Rival One");
});

test("Home drops the first project's board when another project is opened", async ({ page }) => {
  await page.goto(`${baseUrl}/?projectId=${projectIds["Acme"]}`);
  await expect(page.locator(".hero .scorebig")).toHaveText("75");

  await page.selectOption("[data-testid=project-select]", projectIds["Blank"]);
  await expect(page.getByRole("heading", { level: 1, name: "Blank" })).toBeVisible();
  await expect(page.locator(".hero")).toHaveCount(0);
  await expect(page.locator(".mrow.mcols-step")).toHaveCount(3);
});

test("an open answers panel closes when another project is opened", async ({ page }) => {
  await page.goto(`${baseUrl}/?projectId=${projectIds["Acme"]}`);
  await page.locator('.sidebar [data-page="brand-visibility"]').first().click();
  await page.locator("[data-panel=\"rival-topics\"] summary").click();
  await page.locator("[data-panel=\"rival-topics\"] [data-evidence]").first().click();
  await expect(page.locator("aside.panel .panel-body")).toBeVisible();
  expect(await page.evaluate(() => document.body.classList.contains("panel-open"))).toBe(true);

  await page.selectOption("[data-testid=project-select]", projectIds["Blank"]);
  await expect(page.getByTestId("project-select")).toHaveValue(projectIds["Blank"] || "");
  await expect(page.locator("aside.panel")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("aside.panel .panel-body")).toHaveCount(0);
  expect(await page.evaluate(() => document.body.classList.contains("panel-open"))).toBe(false);
});

test("a slow answer for the first project does not land on the second", async ({ page }) => {
  const insights = `**/api/projects/${projectIds["Acme"]}/prompt-insights*`;
  let release!: () => void;
  const held = new Promise<void>((resolveHeld) => { release = resolveHeld; });
  await page.route(insights, async (route) => {
    await held;
    await route.continue();
  });

  const requested = page.waitForRequest((request) => request.url().includes(`/api/projects/${projectIds["Acme"]}/prompt-insights`));
  await page.goto(`${baseUrl}/?projectId=${projectIds["Acme"]}`);
  await page.locator('.sidebar [data-page="brand-visibility"]').first().click();
  await requested;

  await page.selectOption("[data-testid=project-select]", projectIds["Blank"]);
  await expect(page.getByTestId("project-select")).toHaveValue(projectIds["Blank"] || "");

  const answered = page.waitForResponse((response) => response.url().includes(`/api/projects/${projectIds["Acme"]}/prompt-insights`));
  release();
  await answered;
  // The late answer has been delivered to the page. It must not draw.
  await page.evaluate(() => new Promise((resolveFrame) => requestAnimationFrame(() => setTimeout(resolveFrame, 300))));
  await expect(page.locator("[data-panel=\"rival-leaderboard\"]")).toHaveCount(0);
  await expect(page.locator(".view")).not.toContainText("Rival One");
});

test("Results does not ask the second project for the first project's run", async ({ page }) => {
  const first = projectIds["Acme"] || "";
  const second = projectIds["Blank"] || "";
  const run = { id: "run-a", status: "completed", plannedModelRunCount: 1, successfulModelRunCount: 1, failedModelRunCount: 0, baselineVersion: 1, createdAt: "2026-11-20T10:00:00.000Z" };
  await page.route(`**/api/projects/${first}/recognition-runs`, (route) => route.fulfill({ json: { runs: [run] } }));
  await page.route(`**/api/projects/${first}/recognition-runs/run-a`, (route) => route.fulfill({ json: { run, modelRuns: [] } }));
  const asked: string[] = [];
  page.on("request", (request) => { if (request.url().includes(`/api/projects/${second}/recognition-runs/`)) asked.push(request.url()); });

  await page.goto(`${baseUrl}/?projectId=${first}`);
  await page.locator('.sidebar [data-page="models"]').first().click();
  await page.getByRole("button", { name: "Results", exact: true }).click();
  await expect(page.locator(".view")).toContainText("Recognition test");

  await page.locator('.sidebar [data-page="overview"]').first().click();
  await page.locator(`button[data-project-action="select"][data-project-id="${second}"]`).click();
  await page.locator('.sidebar [data-page="models"]').first().click();
  const listed = page.waitForResponse((response) => response.url().endsWith(`/api/projects/${second}/recognition-runs`));
  await page.getByRole("button", { name: "Results", exact: true }).click();
  await listed;
  await expect(page.locator(".view")).toContainText("No recognition test records yet");
  await page.waitForTimeout(500);
  expect(asked).toEqual([]);
});

test("a slow question set for the first project does not land on the second's Questions page", async ({ page }) => {
  const first = projectIds["Acme"] || "";
  const second = projectIds["Blank"] || "";
  const topics = `**/api/projects/${first}/topics`;
  let release!: () => void;
  const held = new Promise<void>((resolveHeld) => { release = resolveHeld; });
  await page.route(topics, async (route) => {
    await held;
    await route.continue();
  });

  const requested = page.waitForRequest((request) => request.url().endsWith(`/api/projects/${first}/topics`));
  await page.goto(`${baseUrl}/?projectId=${first}`);
  await page.locator('.sidebar [data-page="prompts"]').first().click();
  await requested;

  await page.selectOption("[data-testid=project-select]", second);
  await expect(page.getByTestId("project-select")).toHaveValue(second);
  await expect(page.getByRole("heading", { name: "Nothing is being asked" })).toBeVisible();

  const answered = page.waitForResponse((response) => response.url().endsWith(`/api/projects/${first}/topics`));
  release();
  await answered;
  await page.evaluate(() => new Promise((resolveFrame) => requestAnimationFrame(() => setTimeout(resolveFrame, 300))));
  await expect(page.getByRole("heading", { name: "Nothing is being asked" })).toBeVisible();
  await expect(page.locator(".view")).not.toContainText("best invoicing tools for small teams");
});

test("proposing a set on one project does not show as busy on another, or clear the other's own", async ({ page }) => {
  const first = projectIds["Acme"] || "";
  const second = projectIds["Blank"] || "";
  const holds = new Map<string, () => void>();
  for (const id of [first, second]) {
    let release!: () => void;
    const held = new Promise<void>((resolveHeld) => { release = resolveHeld; });
    holds.set(id, release);
    await page.route(`**/api/projects/${id}/topics/generate`, async (route) => {
      await held;
      await route.fulfill({ json: {} });
    });
  }
  const finish = async (id: string) => {
    const done = page.waitForResponse((response) => response.url().endsWith(`/api/projects/${id}/topics/generate`));
    holds.get(id)?.();
    await done;
  };

  await page.goto(`${baseUrl}/?projectId=${first}`);
  await page.locator('.sidebar [data-page="prompts"]').first().click();
  await page.getByRole("button", { name: "Propose a set" }).click();
  await expect(page.getByRole("button", { name: "Proposing…" })).toBeVisible();

  await page.selectOption("[data-testid=project-select]", second);
  await expect(page.getByRole("heading", { name: "Nothing is being asked" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Propose a set" })).toBeVisible();

  await page.getByRole("button", { name: "Propose a set" }).click();
  await expect(page.getByRole("button", { name: "Proposing…" })).toBeVisible();

  await finish(first);
  await page.evaluate(() => new Promise((resolveFrame) => requestAnimationFrame(() => setTimeout(resolveFrame, 300))));
  await expect(page.getByRole("button", { name: "Proposing…" })).toBeVisible();

  await finish(second);
  await expect(page.getByRole("button", { name: "Propose a set" })).toBeVisible();
});

test("switching away from a project that is proposing and back still shows it proposing", async ({ page }) => {
  const first = projectIds["Acme"] || "";
  const second = projectIds["Blank"] || "";
  let release!: () => void;
  const held = new Promise<void>((resolveHeld) => { release = resolveHeld; });
  await page.route(`**/api/projects/${first}/topics/generate`, async (route) => {
    await held;
    await route.fulfill({ json: {} });
  });

  await page.goto(`${baseUrl}/?projectId=${first}`);
  await page.locator('.sidebar [data-page="prompts"]').first().click();
  await page.getByRole("button", { name: "Propose a set" }).click();
  await expect(page.getByRole("button", { name: "Proposing…" })).toBeVisible();

  await page.selectOption("[data-testid=project-select]", second);
  await expect(page.getByRole("button", { name: "Propose a set" })).toBeVisible();
  await page.selectOption("[data-testid=project-select]", first);
  await expect(page.getByTestId("project-select")).toHaveValue(first);

  // A second click here would start a second paid generation.
  await expect(page.getByRole("button", { name: "Proposing…" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Propose a set" })).toHaveCount(0);

  const done = page.waitForResponse((response) => response.url().endsWith(`/api/projects/${first}/topics/generate`));
  release();
  await done;
  await expect(page.getByRole("button", { name: "Propose a set" })).toBeVisible();
});
