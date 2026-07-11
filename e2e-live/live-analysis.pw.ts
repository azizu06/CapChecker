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
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    await page.goto("/");
    if (source?.kind === "upload") {
      await page.locator('input[type="file"]').setInputFiles(source.path);
    } else if (source?.kind === "url") {
      await page.getByLabel("Video URL").fill(source.url);
    }
    await page.getByRole("button", { name: "Check it" }).click();

    await expect(
      page.getByText(/Downloading the source video|Staging the uploaded video/),
    ).toBeVisible({ timeout: 2 * 60_000 });
    await expect(page.getByText("Preparing the video with Gemini")).toBeVisible({
      timeout: 3 * 60_000,
    });
    await expect(
      page.getByText("Extracting transcript and financial claims"),
    ).toBeVisible({ timeout: 3 * 60_000 });
    await expect(page.getByText(/Verifying \d+ checkable claims?/)).toBeVisible({
      timeout: 5 * 60_000,
    });
    await expect(page.getByText("Building the CapCheck scorecard")).toBeVisible({
      timeout: 5 * 60_000,
    });

    await expect(page.getByRole("img", { name: /Cap Score \d+ out of 100/ })).toBeVisible({
      timeout: 10 * 60_000,
    });
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
  });
});
