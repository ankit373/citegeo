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
