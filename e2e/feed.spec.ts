import { expect, test, type Locator } from "@playwright/test";

async function expectSafeExternalLink(link: Locator) {
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  expect(href).toMatch(/^https?:\/\//);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /\bnoopener\b/);
  await expect(link).toHaveAttribute("rel", /\bnoreferrer\b/);
}

test("verified feed lists vetted cards and opens the detail embed", async ({
  page,
}) => {
  await page.goto("/");

  // Shared header exposes the active Feed route.
  await expect(page.getByRole("link", { name: "Feed" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await expect(
    page.getByRole("heading", { name: /CapCheck-vetted finance videos/i }),
  ).toBeVisible();

  const cards = page.locator(".feed-card");
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThanOrEqual(1);

  // The grid renders static thumbnails, never an iframe.
  await expect(page.locator(".feed-page img").first()).toBeVisible();
  await expect(page.locator(".feed-page iframe")).toHaveCount(0);

  const cardTitle = (await cards.first().locator(".feed-card-title").innerText())
    .trim();

  await cards.first().click();
  await expect(page).toHaveURL(/\/feed\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(cardTitle);

  // Attributed, privacy-preserving YouTube embed.
  const embed = page.locator("iframe[src*='youtube-nocookie.com/embed/']");
  await expect(embed).toBeVisible();
  await expect(embed).toHaveAttribute("title", /YouTube video:/);

  // Cap Score + at least one claim with a safe citation link.
  await expect(page.locator(".score-num")).toBeVisible();
  const claim = page.locator("details.claim").first();
  await expect(claim).toBeVisible();
  await claim.locator("summary").click();
  await expect(claim).toHaveAttribute("open", "");
  await expectSafeExternalLink(claim.getByRole("link").first());

  // Back-to-feed navigation returns to the grid.
  await page.getByRole("link", { name: /Back to feed/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".feed-card").first()).toBeVisible();
});

test("refreshes twice with truthful counts, reloads the feed, and retries safely", async ({
  page,
}) => {
  let refreshRequests = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/api/feed/refresh")) {
      refreshRequests += 1;
    }
  });
  await page.goto("/");
  const button = page.locator(".refresh-feed button");
  let releaseRequest!: () => void;
  const requestGate = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  await page.route("**/api/feed/refresh", async (route) => {
    await requestGate;
    await route.continue();
  });

  await button.evaluate((element) => {
    const control = element as HTMLButtonElement;
    control.click();
    control.click();
  });
  await expect(button).toBeDisabled();
  expect(refreshRequests).toBe(1);
  releaseRequest();
  await expect(page.getByRole("status")).toContainText(/1 found.*(1 analyzed|1 duplicate)/, {
    timeout: 15_000,
  });
  await page.unroute("**/api/feed/refresh");
  await expect(
    page.getByRole("link", { name: /Index funds explained for beginners/i }),
  ).toBeVisible();

  await button.click();
  await expect(page.getByRole("status")).toContainText(
    "1 found · 0 analyzed · 0 kept · 0 rejected · 1 duplicate",
    { timeout: 15_000 },
  );
  expect(refreshRequests).toBe(2);

  let failNext = true;
  await page.route("**/api/feed/refresh", async (route) => {
    if (failNext) {
      failNext = false;
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  await button.click();
  const refreshAlert = page.locator(".refresh-feed [role='alert']");
  await expect(refreshAlert).toContainText(
    "CapCheck could not finish the feed refresh",
  );

  await button.click();
  await expect(refreshAlert).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText(
    "1 found · 0 analyzed · 0 kept · 0 rejected · 1 duplicate",
    { timeout: 15_000 },
  );
});
