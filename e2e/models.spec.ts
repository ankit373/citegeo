import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { expectNoOutbound, loopbackOnly, withoutProviderKeys } from "./loopback.js";

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
  temporaryRoot = await mkdtemp(join(tmpdir(), "citegeo-models-browser-"));
  server = spawn(process.execPath, [join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), "test/fixtures/models-product-server.ts"], {
    cwd: process.cwd(),
    env: { ...withoutProviderKeys(process.env), PORT: String(port), PRODUCT_DATA_DIR: temporaryRoot, RUNS_DIR: join(temporaryRoot, "runs"), MONITORING_DATA_DIR: join(temporaryRoot, "monitoring"), SKIP_DOTENV: "1" },
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

async function open(page: Page, project: string, destination: string): Promise<void> {
  await page.goto(`${baseUrl}/?projectId=${projectIds[project]}`);
  await page.locator(`.sidebar [data-page="${destination}"]`).first().click();
}

// Holds one project's read until released, and says when the page has asked for it.
async function holdRead(page: Page, project: string, route: string): Promise<{ asked: Promise<unknown>; release: () => void; answered: Promise<unknown> }> {
  let release!: () => void;
  const held = new Promise<void>((resolveHeld) => { release = resolveHeld; });
  const matches = (candidate: string) => candidate.includes(`/api/projects/${projectIds[project]}/${route}`);
  await page.route(`**/api/projects/${projectIds[project]}/${route}*`, async (request) => {
    await held;
    await request.continue();
  });
  return {
    asked: page.waitForRequest((request) => matches(request.url())),
    answered: page.waitForResponse((response) => matches(response.url())),
    release,
  };
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => new Promise((resolveFrame) => requestAnimationFrame(() => setTimeout(resolveFrame, 300))));
}

const rowNames = (page: Page) => page.locator("[data-testid=\"catalog-model\"] .mname strong").allTextContents();

test("Choose models lists the catalog from the provider and narrows it by search, vendor and web search", async ({ page }) => {
  await open(page, "Acme", "models");
  await expect(page.getByRole("heading", { level: 1, name: "Choose models" })).toBeVisible();
  await expect(page.locator(".catalog-result-summary")).toContainText("Show 6  models");
  await expect(page.locator("[data-testid=\"catalog-model\"]")).toHaveCount(6);
  await expect(page.locator("[data-testid=\"model-provider-filter\"] option")).toHaveText(["All vendors", "Alpha", "Beta", "Gamma"]);

  await page.getByTestId("model-search").fill("search");
  await expect.poll(() => rowNames(page)).toEqual(["Alpha: Search One", "Gamma: Search Three"]);
  await page.getByTestId("model-search").fill("");
  await page.getByTestId("model-provider-filter").selectOption("Beta");
  await expect.poll(() => rowNames(page)).toEqual(["Beta: Chat Two", "Beta: Old One"]);
  await page.getByTestId("model-provider-filter").selectOption("");
  await page.getByTestId("model-native-search-filter").selectOption("unsupported");
  await expect.poll(() => rowNames(page)).toEqual(["Alpha: Base One", "Beta: Chat Two", "Beta: Old One", "Gamma: Gone One"]);

  // The retired model cannot be chosen, and says why.
  const gone = page.locator("[data-testid=\"catalog-model\"]", { hasText: "Gamma: Gone One" });
  await expect(gone).toContainText("Retired by the provider");
  await expect(gone.locator("input[type=checkbox]")).toBeDisabled();
});

test("Choose models sorts by release date, newest first, with the undated ones last", async ({ page }) => {
  await open(page, "Acme", "models");
  await page.getByTestId("model-catalog-sort").selectOption("newest");
  await expect.poll(() => rowNames(page)).toEqual(["Gamma: Search Three", "Alpha: Search One", "Beta: Chat Two", "Alpha: Base One", "Beta: Old One", "Gamma: Gone One"]);
  await page.getByTestId("model-catalog-sort").selectOption("oldest");
  await expect.poll(() => rowNames(page)).toEqual(["Alpha: Base One", "Beta: Chat Two", "Alpha: Search One", "Gamma: Search Three", "Beta: Old One", "Gamma: Gone One"]);
});

test("saving two models, then one fewer, writes configuration v1 and offers v2 with the removal named", async ({ page }) => {
  await open(page, "Acme", "models");
  await page.locator("input[data-model-checkbox=\"alpha/search-1\"]").check();
  await page.locator("input[data-model-checkbox=\"beta/chat-2\"]").check();
  await expect(page.locator(".section-card", { hasText: "Selected models" }).first().locator(".tag")).toContainText("2  selected");
  await expect(page.locator("#models-status")).toContainText("Configuration not saved yet");
  await page.getByTestId("save-models").click();
  await expect(page.locator("#models-status")).toContainText("Model configuration saved");
  await expect(page.getByTestId("save-monitoring-configuration")).toHaveText("Save config v1");

  await page.getByTestId("save-monitoring-configuration").click();
  await expect(page.getByTestId("save-monitoring-configuration")).toContainText("Saved as v1");
  await page.locator(".sidebar [data-page=\"models\"]").first().click();
  await page.locator("[data-page=\"configuration\"]").first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Configuration" })).toBeVisible();
  const versions = page.getByTestId("configuration-version-row");
  await expect(versions).toHaveCount(1);
  await expect(versions.first()).toContainText("config v1 · Current version");
  await expect(versions.first()).toContainText("2  models");
  await expect(page.getByTestId("monitoring-configuration-summary")).toContainText("The current models and web search modes are saved.");

  await page.locator("[data-page=\"models\"]").first().click();
  await page.locator("input[data-model-checkbox=\"beta/chat-2\"]").uncheck();
  await page.getByTestId("save-models").click();
  await expect(page.locator("#models-status")).toContainText("Model configuration saved");
  await page.locator("[data-page=\"configuration\"]").first().click();
  await expect(page.getByTestId("save-monitoring-configuration")).toHaveText("Save as config v2");
  await expect(page.getByTestId("configuration-diff")).toContainText("Models removed: Beta: Chat Two");
});

test("a project with nothing saved says so on Configuration", async ({ page }) => {
  await open(page, "Blank", "models");
  await page.locator("[data-page=\"configuration\"]").first().click();
  await expect(page.getByTestId("monitoring-configuration-summary")).toContainText("Select at least one available model before saving the configuration.");
  await expect(page.locator(".tag", { hasText: "Not saved yet" })).toBeVisible();
  await expect(page.getByText("No past configurations yet.")).toBeVisible();
});

test("saving a configuration on one project does not show as saving on another, and is saving again on return", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolveHeld) => { release = resolveHeld; });
  await page.route(`**/api/projects/${projectIds["Saved switch"]}/baselines`, async (route) => {
    if (route.request().method() !== "POST") { await route.fallback(); return; }
    await held;
    await route.continue();
  });
  await open(page, "Saved switch", "models");
  await page.locator("[data-page=\"configuration\"]").first().click();
  await page.getByTestId("save-monitoring-configuration").click();
  await expect(page.getByTestId("save-monitoring-configuration")).toHaveText("Saving…");

  await page.selectOption("[data-testid=project-select]", projectIds["Blank"]);
  await expect(page.getByTestId("project-select")).toHaveValue(projectIds["Blank"] || "");
  await expect(page.getByTestId("save-monitoring-configuration")).toHaveText("Save config v1");

  await page.selectOption("[data-testid=project-select]", projectIds["Saved switch"]);
  await expect(page.getByTestId("project-select")).toHaveValue(projectIds["Saved switch"] || "");
  await expect(page.getByTestId("save-monitoring-configuration")).toHaveText("Saving…");

  const saved = page.waitForResponse((response) => response.url().endsWith(`/api/projects/${projectIds["Saved switch"]}/baselines`) && response.request().method() === "POST");
  release();
  await saved;
  await expect(page.getByTestId("save-monitoring-configuration")).toContainText("Saved as v2");
});

test("a second click while a configuration save is in flight sends no second request", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolveHeld) => { release = resolveHeld; });
  let posts = 0;
  await page.route(`**/api/projects/${projectIds["Saved twice"]}/baselines`, async (route) => {
    if (route.request().method() !== "POST") { await route.fallback(); return; }
    posts += 1;
    await held;
    await route.continue();
  });
  await open(page, "Saved twice", "models");
  await page.locator("[data-page=\"configuration\"]").first().click();
  const button = page.getByTestId("save-monitoring-configuration");
  await button.click();
  await expect(button).toHaveText("Saving…");
  await button.evaluate((element) => element.removeAttribute("disabled"));
  await button.click({ force: true });
  await settle(page);
  expect(posts).toBe(1);
  release();
  await expect(button).toContainText("Saved as v2");
  expect(posts).toBe(1);
});

test("a slow configuration read after a save does not mark the project it was switched to as saved", async ({ page }) => {
  await open(page, "Saved slow read", "models");
  await page.locator("[data-page=\"configuration\"]").first().click();
  await expect(page.getByTestId("save-monitoring-configuration")).toHaveText("Save as config v2");
  const read = await holdRead(page, "Saved slow read", "monitoring-configuration");
  await page.getByTestId("save-monitoring-configuration").click();
  await read.asked;

  await page.selectOption("[data-testid=project-select]", projectIds["Blank"]);
  await expect(page.getByTestId("project-select")).toHaveValue(projectIds["Blank"] || "");
  read.release();
  await read.answered;
  await settle(page);
  await expect(page.getByTestId("save-monitoring-configuration")).toHaveText("Save config v1");
  await expect(page.locator(".view")).not.toContainText("Saved as");
});

test("a failed save on one project does not leave \"Save again\" on the next", async ({ page }) => {
  await page.route(`**/api/projects/${projectIds["Saved failing"]}/baselines`, async (route) => {
    if (route.request().method() !== "POST") { await route.fallback(); return; }
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "boom", message: "The save failed." } }) });
  });
  await open(page, "Saved failing", "models");
  await page.locator("[data-page=\"configuration\"]").first().click();
  await page.getByTestId("save-monitoring-configuration").click();
  await expect(page.getByTestId("save-monitoring-configuration")).toContainText("Save again");

  await page.selectOption("[data-testid=project-select]", projectIds["Blank"]);
  await expect(page.getByTestId("project-select")).toHaveValue(projectIds["Blank"] || "");
  await expect(page.getByTestId("save-monitoring-configuration")).toHaveText("Save config v1");
});

test("switching within a moment of a successful save does not show the saved version on the next project", async ({ page }) => {
  // The page clears "saved" after 850 ms. Stretching that timer keeps the switch inside the window.
  await page.addInitScript(() => {
    const original = window.setTimeout.bind(window);
    window.setTimeout = ((handler: TimerHandler, delay?: number, ...rest: unknown[]) => original(handler, delay === 850 ? 60_000 : delay, ...rest)) as typeof window.setTimeout;
  });
  await open(page, "Saved quick", "models");
  await page.locator("[data-page=\"configuration\"]").first().click();
  await page.getByTestId("save-monitoring-configuration").click();
  await expect(page.getByTestId("save-monitoring-configuration")).toContainText("Saved as v2");

  await page.selectOption("[data-testid=project-select]", projectIds["Blank"]);
  await expect(page.getByTestId("project-select")).toHaveValue(projectIds["Blank"] || "");
  await expect(page.getByTestId("save-monitoring-configuration")).toHaveText("Save config v1");
});

test("a configuration that cannot be read says so, and offers no save", async ({ page }) => {
  await page.route(`**/api/projects/${projectIds["Acme"]}/monitoring-configuration*`, async (route) => {
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "boom", message: "The configuration read failed." } }) });
  });
  await open(page, "Acme", "models");
  await page.locator("[data-page=\"configuration\"]").first().click();
  await expect(page.getByTestId("configuration-read-error")).toBeVisible();
  await expect(page.locator(".view")).toContainText("could not be read");
  await expect(page.getByTestId("save-monitoring-configuration")).toHaveCount(0);
  await expect(page.locator(".view")).not.toContainText("No configuration saved yet");
});

test("Setup lists every provider this server knows, and says nothing can run when none is configured", async ({ page }) => {
  const known = await (await page.request.get(`${baseUrl}/api/providers`)).json() as { providers: Array<{ label: string }> };
  await open(page, "Acme", "setup");
  await expect(page.getByRole("heading", { level: 1, name: "Workspace setup" })).toBeVisible();
  await expect(page.locator(".mrow[data-state]")).toHaveCount(known.providers.length);
  await expect(page.locator(".view")).toContainText("Nothing can run right now.");
});

test("a slow configuration read for the first project does not land on the second", async ({ page }) => {
  await page.goto(`${baseUrl}/?projectId=${projectIds["Saved read"]}`);
  await expect(page.getByTestId("project-select")).toHaveValue(projectIds["Saved read"] || "");
  const read = await holdRead(page, "Saved read", "monitoring-configuration");
  await page.locator('.sidebar [data-page="models"]').first().click();
  await read.asked;

  await page.selectOption("[data-testid=project-select]", projectIds["Blank"]);
  await expect(page.getByTestId("project-select")).toHaveValue(projectIds["Blank"] || "");
  await expect(page.locator(".view")).toContainText("Currently not saved.");

  read.release();
  await read.answered;
  await settle(page);
  await expect(page.locator(".view")).toContainText("Currently not saved.");
  await expect(page.locator(".view")).not.toContainText("saved as v");
});

test("a slow answer-surfaces read for the first project does not land on the second", async ({ page }) => {
  const ids = (await (await page.request.get(`${baseUrl}/api/projects/${projectIds["Acme"]}/engines`)).json() as { engines: Array<{ id: string }> }).engines.map((engine) => engine.id);
  const saved = await page.request.put(`${baseUrl}/api/projects/${projectIds["Acme"]}/engines`, { data: { engineIds: [ids[0]] } });
  expect(saved.ok()).toBe(true);
  await page.addInitScript(() => window.localStorage.setItem("citegeo.page", "models"));
  const read = await holdRead(page, "Acme", "engines");
  await page.goto(`${baseUrl}/?projectId=${projectIds["Acme"]}`);
  await read.asked;

  await page.selectOption("[data-testid=project-select]", projectIds["Blank"]);
  await expect(page.getByTestId("project-select")).toHaveValue(projectIds["Blank"] || "");
  await expect(page.locator(".mcols-engine .mcell", { hasText: "Not asked" }).first()).toBeVisible();
  await expect(page.locator(".mcols-engine .mcell", { hasText: "Asked on every run" })).toHaveCount(0);

  read.release();
  await read.answered;
  await settle(page);
  await expect(page.locator(".mcols-engine .mcell", { hasText: "Asked on every run" })).toHaveCount(0);
});
