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
