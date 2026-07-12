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

  const siteHeader = page.locator(".site-header");
  await expect(siteHeader).toHaveCSS("border-bottom-style", "solid");
  await expect(siteHeader).toHaveCSS("border-bottom-width", "1px");
  await expect(siteHeader).toHaveCSS("border-bottom-color", "rgb(33, 31, 27)");

  const siteMark = siteHeader.locator(".brand-mark");
  await expect(siteMark).toHaveCSS("width", "24px");
  await expect(siteMark).toHaveCSS("height", "24px");
  await expect(siteMark.locator("img")).toHaveAttribute("src", "/logo-mark.png");
  await expect(siteMark.locator("img")).toHaveAttribute("alt", "");

  const activeNavLink = page.getByRole("link", { name: "Feed" });
  await expect(activeNavLink).toHaveCSS("text-transform", "uppercase");
  await expect(activeNavLink).toHaveCSS("color", "rgb(33, 31, 27)");
  await expect(activeNavLink).toHaveCSS("text-decoration-line", "underline");

  await expect(
    page.getByRole("heading", { name: /CapCheck-vetted finance videos/i }),
  ).toBeVisible();

  const cards = page.locator(".feed-card");
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThanOrEqual(1);

  const firstCard = cards.first();
  await expect(firstCard).toHaveCSS("border-style", "solid");
  await expect(firstCard).toHaveCSS("border-width", "1px");
  await expect(firstCard).toHaveCSS("border-radius", "0px");
  await expect(firstCard).toHaveCSS("box-shadow", "none");
  await expect(firstCard.locator(".feed-category")).toHaveCSS(
    "text-transform",
    "uppercase",
  );

  const capPill = firstCard.locator(".cap-pill");
  await expect(capPill).toHaveCSS("border-radius", "0px");
  await expect(capPill).toHaveCSS("background-color", "rgb(226, 243, 233)");
  await expect(capPill).toHaveCSS("color", "rgb(25, 120, 74)");

  // The grid renders static thumbnails, never an iframe.
  await expect(page.locator(".feed-page img").first()).toBeVisible();
  await expect(page.locator(".feed-page iframe")).toHaveCount(0);

  const cardTitle = (await cards.first().locator(".feed-card-title").innerText())
    .trim();

  await cards.first().click();
  await expect(page).toHaveURL(/\/feed\/[^/]+$/);
  await expect(page.locator(".site-header .brand-mark img")).toHaveAttribute(
    "src",
    "/logo-mark.png",
  );
  await expect(page.getByRole("heading", { level: 1 })).toContainText(cardTitle);

  // Attributed, privacy-preserving YouTube embed.
  const embed = page.locator("iframe[src*='youtube-nocookie.com/embed/']");
  await expect(embed).toBeVisible();
  await expect(embed).toHaveAttribute("title", /YouTube video:/);

  const embedFrame = page.locator(".feed-embed");
  await expect(embedFrame).toHaveCSS("border-style", "solid");
  await expect(embedFrame).toHaveCSS("border-width", "1px");
  await expect(embedFrame).toHaveCSS("border-color", "rgb(33, 31, 27)");
  await expect(embedFrame).toHaveCSS("border-radius", "0px");

  const backLink = page.getByRole("link", { name: /Back to feed/i });
  await expect(backLink).toHaveCSS("text-transform", "uppercase");

  const scoreHeader = page.locator(".panel.score-header");
  await expect(scoreHeader).toHaveCSS("border-width", "0px");
  await expect(scoreHeader).toHaveCSS("box-shadow", "none");
  await expect(scoreHeader).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

  // Cap Score + at least one claim with a safe citation link.
  await expect(page.locator(".score-num")).toBeVisible();
  const claim = page.locator("details.claim").first();
  await expect(claim).toBeVisible();
  await claim.locator("summary").click();
  await expect(claim).toHaveAttribute("open", "");
  await expectSafeExternalLink(claim.getByRole("link").first());

  // Back-to-feed navigation returns to the grid.
  await backLink.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".feed-card").first()).toBeVisible();
});
