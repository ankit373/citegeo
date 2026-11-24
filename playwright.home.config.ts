import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "home.spec.ts",
  outputDir: "validation/home-browser/playwright-results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "validation/home-browser/playwright-report", open: "never" }],
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
