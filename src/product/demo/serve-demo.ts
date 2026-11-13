import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PRODUCT_PROVIDER_IDS } from "../configuration/provider-id.js";
import { providerEnvKeys } from "../../config/env.js";
import { DEMO_PROJECT_ID, writeDemoProject } from "./demo-project.js";

// Writes a fresh copy of the made-up project to data/demo and serves it with
// every provider key removed, so nothing it shows came from a model.

const DEMO_DIR = resolve("data/demo");

export async function serveDemo(): Promise<void> {
  await rm(DEMO_DIR, { recursive: true, force: true });
  const productDir = join(DEMO_DIR, "product-v2");
  const written = await writeDemoProject(productDir);

  process.env.SKIP_DOTENV = "1";
  process.env.MONITORING_DATA_DIR = DEMO_DIR;
  process.env.PRODUCT_DATA_DIR = productDir;
  delete process.env.AUTH_PASSWORD;
  for (const provider of PRODUCT_PROVIDER_IDS) {
    for (const key of providerEnvKeys(provider)) delete process.env[key];
  }

  // Imported only now, because the server reads its environment as it loads.
  const { createProductServer } = await import("../product-server.js");
  const port = Number(process.env.PORT || 8787);
  const server = createProductServer();
  server.lifecycle.install();
  server.listen(port, "127.0.0.1", () => {
    console.log(`Demo project written to ${DEMO_DIR}: ${written.runs.length} runs, ${written.answers.length} answers.`);
    console.log(`Open http://127.0.0.1:${port}/?projectId=${DEMO_PROJECT_ID}`);
  });
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entrypoint) await serveDemo();
