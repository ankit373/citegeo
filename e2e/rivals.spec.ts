import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

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
  temporaryRoot = await mkdtemp(join(tmpdir(), "citegeo-home-browser-"));
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

test.afterAll(async () => {
  server?.kill("SIGTERM");
  if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
});

test("Rivals shows the standing and the competitor figures counted from the archived answers", async ({ page }) => {
  await page.goto(`${baseUrl}/?projectId=${projectIds["Acme"]}`);
  await page.locator('.sidebar [data-page="brand-visibility"]').first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Rivals" })).toBeVisible();

  // Acme is named in 3 of the 4 answers and Rival One in all 4.
  await expect(page.locator(".view")).toContainText("75%#2 of 2");
  const leaderboard = page.locator("[data-panel=\"rival-leaderboard\"]");
  await expect(leaderboard.locator(".mrow", { hasText: "Rival One" })).toContainText("4 · 100%");
  await expect(leaderboard.locator(".mrow", { hasText: "Acme" })).toContainText("3 · 75%");

  const plan = page.locator("[data-panel=\"rival-plan\"]");
  await expect(plan).toContainText("You rank #2 of 2 named, from 4 archived answer(s).");
  await expect(plan).toContainText("Rival One was named in 4 answer(s) against your 3.");

  // No demand corpus was indexed, which is not the same as nobody asking.
  await expect(page.getByRole("heading", { name: "Prompt volume" })).toBeVisible();
  await expect(page.locator(".view")).toContainText("No corpus is indexed.");
});

test("Rivals offers the run button for a project with nothing archived yet", async ({ page }) => {
  await page.goto(`${baseUrl}/?projectId=${projectIds["Blank"]}`);
  await page.locator('.sidebar [data-page="brand-visibility"]').first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Rivals" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run prompts" })).toBeVisible();
  await expect(page.locator("[data-panel=\"rival-leaderboard\"]")).toHaveCount(0);
});
