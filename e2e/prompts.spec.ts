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
  temporaryRoot = await mkdtemp(join(tmpdir(), "citegeo-prompts-browser-"));
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

async function openQuestions(page: Page, name: string): Promise<void> {
  await page.goto(`${baseUrl}/?projectId=${projectIds[name]}`);
  await page.locator('.sidebar [data-page="prompts"]').first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Questions" })).toBeVisible();
}

test("Questions counts the seeded set and reads each question's standing from its answers", async ({ page }) => {
  await openQuestions(page, "Acme");

  // Five questions were seeded: three tracked, one proposed, one retired with its topic.
  const tile = (label: string) => page.locator(".statgrid .stat").filter({ has: page.getByText(label, { exact: true }) });
  await expect(tile("Tracked")).toContainText("3");
  await expect(tile("Needs review")).toContainText("1");
  await expect(tile("Topics")).toContainText("1 more retired, and left out of every figure");
  await expect(tile("Measures visibility")).toContainText("2 of 3");
  await expect(tile("Has an answer")).toContainText("2 of 3");
  await expect(tile("Answers per run")).toContainText("no models are saved");

  // Each answered question carries the score and rank counted from its two answers.
  const firstRow = page.locator(".mrow", { hasText: "best invoicing tools for small teams" });
  await expect(firstRow).toContainText("2 answer(s)");
  await expect(firstRow).toContainText("50");
  await expect(firstRow).toContainText("#2");
  const secondRow = page.locator(".mrow", { hasText: "how to automate invoice reminders" });
  await expect(secondRow).toContainText("100");
  await expect(secondRow).toContainText("#1");
  await expect(page.locator(".mrow", { hasText: "is Acme any good for invoicing" })).toContainText("names you, so it cannot measure visibility");
  await expect(page.locator(".mrow", { hasText: "Acme vs Rival One for invoicing" })).toContainText("Not asked yet");
  await expect(page.locator(".prompt-result-summary")).toHaveText("Showing all 4 question(s)");

  // The coverage chips count tracked over live questions per intent.
  const coverage = page.locator("[data-panel=\"prompt-coverage\"]");
  await page.locator("[data-panel=\"prompt-coverage\"] summary").click();
  await expect(coverage.locator("[data-prompt-intent=\"discovery\"]")).toContainText("2 of 2 tracked");
  await expect(coverage.locator("[data-prompt-intent=\"comparison\"]")).toContainText("0 of 1 tracked");
  await expect(coverage.locator("[data-prompt-intent=\"brand\"]")).toContainText("1 of 1 tracked");
  await expect(coverage.locator("[data-prompt-intent=\"problem\"]")).toContainText("0 of 0 tracked");
});

test("Questions filters the rows in place and says how many are shown", async ({ page }) => {
  await openQuestions(page, "Acme");
  await page.selectOption("select[data-prompt-filter=\"status\"]", "proposed");
  await expect(page.locator(".prompt-result-summary")).toHaveText("Showing 1 of 4 question(s)");
  await expect(page.locator(".prompt-results .mrow")).toHaveCount(1);
  await expect(page.locator(".prompt-results")).toContainText("Acme vs Rival One for invoicing");

  await page.selectOption("select[data-prompt-filter=\"status\"]", "tracked");
  await expect(page.locator(".prompt-result-summary")).toHaveText("Showing 3 of 4 question(s)");

  await page.selectOption("select[data-prompt-filter=\"status\"]", "");
  await page.locator("#prompt-search").fill("reminders");
  await expect(page.locator(".prompt-result-summary")).toHaveText("Showing 1 of 4 question(s)");
  await expect(page.locator(".prompt-results")).toContainText("how to automate invoice reminders");
});

test("Questions for a project with nothing asked says so and offers a set", async ({ page }) => {
  await openQuestions(page, "Blank");
  await expect(page.getByRole("heading", { name: "Nothing is being asked" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Propose a set" })).toBeVisible();
});
