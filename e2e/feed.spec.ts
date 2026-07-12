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

test("searches, filters, resets, and recovers across every feed state", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "mobile-chromium") {
    await page.setViewportSize({ width: 375, height: 812 });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  const runtimeErrors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().startsWith("Failed to load resource:")
    ) {
      runtimeErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  await page.goto("/");
  const initialCardCount = await page.locator(".feed-card").count();
  expect(initialCardCount).toBeGreaterThanOrEqual(8);
  expect(initialCardCount).toBeLessThanOrEqual(9);
  const search = page.getByRole("searchbox", { name: /search verified videos/i });
  await search.fill("tax brackets");
  await expect(page.locator(".feed-card")).toHaveCount(1);
  await expect(page.getByText("Source: YouTube")).toBeVisible();
  await page.getByRole("button", { name: /clear search/i }).click();

  for (const category of [
    "Investing",
    "Credit",
    "Taxes",
    "Budgeting",
    "Retirement",
  ]) {
    const control = page.getByRole("button", { name: category, exact: true });
    await control.click();
    await expect(control).toHaveAttribute("aria-pressed", "true");
    expect(await page.locator(".feed-card").count()).toBeGreaterThan(0);
  }
  await page.getByRole("button", { name: /reset filters/i }).click();
  await expect(page.getByRole("button", { name: "All", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await search.fill("definitely-no-video");
  await expect(page.getByRole("status")).toContainText("No videos match");
  await page.getByRole("button", { name: /show all videos/i }).click();
  await expect(page.locator(".feed-card")).toHaveCount(initialCardCount);

  await search.focus();
  await expect(search).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "All", exact: true })).toBeFocused();

  await page.goto("/?feedState=empty");
  await expect(page.getByText("No vetted videos yet.")).toBeVisible();
  await page.goto("/?feedState=error");
  await expect(page.locator(".feed-state[role='alert']")).toContainText(
    "temporarily unavailable",
  );
  await page.getByRole("link", { name: /try feed again/i }).click();
  await expect(page.locator(".feed-card")).toHaveCount(initialCardCount);

  await page.goto("/?feedState=unavailable");
  await expect(page.getByText("Video unavailable")).toBeVisible();
  await page.goto("/feed/does-not-exist");
  await expect(page.getByText(/couldn't find that video/i)).toBeVisible();
  await page.getByRole("link", { name: /back to feed/i }).click();

  await page.goto("/?feedState=long");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(runtimeErrors).toEqual([]);
});

test("refreshes twice with truthful counts, reloads the feed, and retries safely", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "mobile-chromium") {
    await page.setViewportSize({ width: 375, height: 812 });
  }
  const runtimeErrors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().startsWith("Failed to load resource:")
    ) {
      runtimeErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  let refreshRequests = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/api/feed/refresh")) {
      refreshRequests += 1;
    }
  });
  await page.goto("/");
  await expect(page.locator(".feed-explorer")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const button = page.locator(".refresh-feed button");
  await button.focus();
  await expect(button).toBeFocused();
  await expect(button).toHaveCSS("outline-style", "solid");
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
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(runtimeErrors).toEqual([]);
});
