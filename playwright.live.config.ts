import { defineConfig, devices } from "@playwright/test";

const liveEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  ),
);
// Prevent a local dotenv file from silently turning this live smoke into the
// deterministic fixture path.
liveEnvironment.CAPCHECK_ANALYSIS_MODE = "live";

export default defineConfig({
  testDir: "./e2e-live",
  testMatch: "**/*.pw.ts",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "live-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    env: liveEnvironment,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
