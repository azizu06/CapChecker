import { defineConfig, devices } from "@playwright/test";

const e2ePort = process.env.CAPCHECK_E2E_PORT ?? "3000";
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  workers: 2,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: e2eBaseUrl,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${e2ePort}`,
    url: e2eBaseUrl,
    env: {
      ...process.env,
      CAPCHECK_ANALYSIS_MODE: "fixture",
      CAPCHECK_FEED_MODE: "fixture",
    },
    reuseExistingServer: !process.env.CI,
  },
});
