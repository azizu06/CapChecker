import { expect, test } from "@playwright/test";

import { resolveLiveSmokeSource } from "./live-source";

const source = resolveLiveSmokeSource(process.env);
const enabled =
  process.env.CAPCHECK_LIVE_BROWSER === "1" &&
  Boolean(process.env.GEMINI_API_KEY) &&
  Boolean(process.env.FINNHUB_KEY) &&
  Boolean(source);

test.describe("opt-in live browser analysis", () => {
  test.skip(
    !enabled,
    "Requires explicit opt-in, server credentials, and one prepared source",
  );

  test("streams the real pipeline through SSE into a cited scorecard", async ({
    page,
  }) => {
    test.setTimeout(10 * 60_000);
    const startedAt = performance.now();
    const timings: Array<{ stage: string; elapsedMs: number }> = [];
    const mark = (stage: string) =>
      timings.push({ stage, elapsedMs: Math.round(performance.now() - startedAt) });
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await page.goto("/analyze");
    if (source?.kind === "upload") {
      await page.locator('input[type="file"]').setInputFiles(source.path);
    } else if (source?.kind === "url") {
      await page.getByLabel("Video URL").fill(source.url);
    }
    await page.getByRole("button", { name: "Check it" }).click();
    mark("submitted");

    await expect(
      page.locator('[aria-roledescription="Cap Score"]'),
    ).toBeVisible({ timeout: 10 * 60_000 });
    mark("complete");
    await expect(page.getByRole("tab", { name: /Claims reviewed/ })).toBeVisible();

    const claimCards = page.locator("details.claim");
    const count = await claimCards.count();
    expect(count).toBeGreaterThan(0);
    for (let index = count - 1; index >= 0; index -= 1) {
      await claimCards.nth(index).locator("summary").click();
    }
    await expect(
      page.getByRole("link", { name: /Open source:.*opens in new tab/ }).first(),
    ).toBeVisible();
    expect(browserErrors).toEqual([]);
    await test.info().attach("live-stage-timings.json", {
      body: Buffer.from(JSON.stringify(timings, null, 2)),
      contentType: "application/json",
    });
  });
});
