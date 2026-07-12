import { defineConfig, devices } from "@playwright/test";

const liveEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  ),
);
// Prevent a local dotenv file from silently turning this live smoke into the
// deterministic fixture path.
liveEnvironment.CAPCHECK_ANALYSIS_MODE = "live";
const livePort = process.env.CAPCHECK_LIVE_PORT ?? "3317";
const liveBaseUrl = `http://127.0.0.1:${livePort}`;

export default defineConfig({
  testDir: "./e2e-live",
  testMatch: "**/*.pw.ts",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: liveBaseUrl,
    screenshot: "only-on-failure",
    trace:
      process.env.CAPCHECK_LIVE_TRACE === "1" ? "on" : "retain-on-failure",
    video: process.env.CAPCHECK_LIVE_VIDEO === "1" ? "on" : "off",
  },
  projects: [
    {
      name: "live-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${livePort}`,
    url: `${liveBaseUrl}/analyze`,
    env: liveEnvironment,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
