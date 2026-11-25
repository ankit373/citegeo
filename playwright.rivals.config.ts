import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "rivals.spec.ts",
  outputDir: "validation/rivals-browser/playwright-results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "validation/rivals-browser/playwright-report", open: "never" }],
  ],
  workers: 1,
  use: {
    browserName: "chromium",
    launchOptions: {
      executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    },
    trace: "on",
    screenshot: "off",
    video: "off",
  },
});
