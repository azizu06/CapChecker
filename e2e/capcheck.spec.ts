import { expect, test, type Locator, type Page } from "@playwright/test";

const demoUrl = "https://www.youtube.com/shorts/capcheck-demo";

function captureRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function submitUrl(page: Page, scenario = "mixed") {
  await page.goto(`/?fixture=${scenario}`);
  await page.getByLabel("Video URL").fill(demoUrl);
  await page.getByRole("button", { name: "Analyze video" }).click();
}

async function expectSafeExternalLink(link: Locator) {
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  expect(href).toMatch(/^https?:\/\//);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /\bnoopener\b/);
  await expect(link).toHaveAttribute("rel", /\bnoreferrer\b/);
}

test("loads the fixture-ready CapCheck intake without runtime errors", async ({
  page,
}) => {
  const runtimeErrors = captureRuntimeErrors(page);
  await page.goto("/");

  await expect(page).toHaveTitle("CapCheck — AI financial claim verifier");
  await expect(page.getByText("CapCheck", { exact: true })).toBeVisible();
  await expect(page.getByText("AI financial claim verifier")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Is that money advice fact or cap?" }),
  ).toBeVisible();
  await expect(page.getByLabel("Video URL")).toBeVisible();
  await expect(page.getByRole("button", { name: "Analyze video" })).toBeVisible();
  await expect(page.getByText("or upload a video")).toBeVisible();
  await expect(page.getByText("Choose a video file")).toBeVisible();

  await page.getByLabel("Video URL").fill(demoUrl);
  await page.getByRole("button", { name: "Analyze video" }).click();
  await expect(page.getByRole("heading", { name: "Some cap" })).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("validates URL input, prevents duplicate work, and exposes truthful progress", async ({
  page,
}) => {
  const analysisRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/api/analyze")) {
      analysisRequests.push(request.url());
    }
  });

  await page.goto("/?fixture=mixed");
  const input = page.getByLabel("Video URL");
  await input.fill("definitely not a URL");
  await input.press("Enter");
  await expect(page.getByText("Enter a valid HTTP or HTTPS video URL.")).toHaveText(
    "Enter a valid HTTP or HTTPS video URL.",
  );
  await expect(input).toBeFocused();
  expect(analysisRequests).toHaveLength(0);

  await input.fill(demoUrl);
  const progressMessages = [
    "Loading the source video",
    "Preparing the video for analysis",
    "Extracting financial claims",
    "Checking claims against evidence",
    "Building the CapCheck scorecard",
  ];
  await page.evaluate((messages) => {
    const state = window as typeof window & {
      __capcheckObservedProgress?: string[];
    };
    state.__capcheckObservedProgress = [];
    const observer = new MutationObserver(() => {
      for (const message of messages) {
        if (
          document.body.innerText.includes(message) &&
          !state.__capcheckObservedProgress?.includes(message)
        ) {
          state.__capcheckObservedProgress?.push(message);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }, progressMessages);
  const analyze = page.getByRole("button", { name: "Analyze video" });
  await analyze.click();
  await expect(page.getByRole("button", { name: "Analyzing…" })).toBeDisabled();
  await expect(input).toBeDisabled();
  await expect(page.getByText("Loading the source video")).toBeVisible();

  const expectedStages = [
    "Fetching",
    "Processing",
    "Extracting",
    "Verifying",
    "Synthesizing",
    "Complete",
  ];
  const renderedStages = await page
    .getByRole("list")
    .getByRole("listitem")
    .locator("strong")
    .allTextContents();
  expect(renderedStages).toEqual(expectedStages);
  await expect(page.getByRole("heading", { name: "Some cap" })).toBeVisible();
  const observedProgress = await page.evaluate(
    () =>
      (
        window as typeof window & { __capcheckObservedProgress?: string[] }
      ).__capcheckObservedProgress,
  );
  expect(observedProgress).toEqual(progressMessages);
  expect(analysisRequests).toHaveLength(1);
});

test("mixed result exposes every claim and safe evidence destination, then resets", async ({
  page,
}) => {
  await submitUrl(page);
  await expect(page.getByText("52", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Some cap" })).toBeVisible();
  await expect(
    page.getByText(
      "Some claims are misleading, unsupported, or need more context.",
    ),
  ).toBeVisible();

  const disclosureNames = [
    "The S&P 500 gained more than 20% in 2023.",
    "This semiconductor stock will double before December.",
    "You cannot lose money if you buy before earnings.",
  ];
  for (const claim of disclosureNames) {
    const card = page.getByRole("article").filter({ hasText: claim });
    const disclosure = card.getByRole("button", { name: "View evidence" });
    await expect(disclosure).toHaveAttribute("aria-expanded", "false");
    await disclosure.click();
    await expect(card.getByRole("button", { name: "Hide evidence" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(card.getByText(/trust$/).first()).toBeVisible();
    for (const link of await card.getByRole("link").all()) {
      await expectSafeExternalLink(link);
    }
    await card.getByRole("button", { name: "Hide evidence" }).click();
    await expect(card.getByRole("button", { name: "View evidence" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  }

  await expectSafeExternalLink(
    page.getByRole("link", { name: /Open strongest source/ }),
  );
  await expectSafeExternalLink(
    page.getByRole("link", { name: /Review the latest filing/ }),
  );
  await page.getByRole("button", { name: "Run again" }).click();
  await expect(page.getByRole("heading", { name: "Some cap" })).toBeVisible();
  await page.getByRole("button", { name: "Check another" }).click();
  await expect(page.getByLabel("Video URL")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Analyze video" })).toBeEnabled();
});

test("upload can be selected, removed, reselected, and analyzed through multipart", async ({
  page,
}) => {
  await page.goto("/");
  const chooser = page.getByLabel(/Choose a video file/);
  const sample = "e2e/fixtures/sample-video.mp4";
  await page.getByLabel("Video URL").fill("not a url");
  await page.getByRole("button", { name: "Analyze video" }).click();
  await expect(page.getByText("Enter a valid HTTP or HTTPS video URL.")).toBeVisible();
  await chooser.setInputFiles(sample);
  await expect(page.getByText("Enter a valid HTTP or HTTPS video URL.")).toHaveCount(0);
  await expect(page.getByText("sample-video.mp4", { exact: true })).toBeVisible();
  await expect(page.getByText(/KB · ready/)).toBeVisible();
  await expect(page.getByLabel("Video URL")).toBeDisabled();

  await page.getByRole("button", { name: "Remove sample-video.mp4" }).click();
  await expect(page.getByText("sample-video.mp4", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Video URL")).toBeEnabled();

  await chooser.setInputFiles(sample);
  const multipart = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/analyze") &&
      request.headers()["content-type"]?.startsWith("multipart/form-data"),
  );
  await page.getByRole("button", { name: "Analyze video" }).click();
  await multipart;
  await expect(page.getByRole("heading", { name: "Some cap" })).toBeVisible();
});

for (const fixture of [
  {
    scenario: "scammy",
    score: "94",
    label: "Full of cap",
    distinguishing: "This token is guaranteed to return 10x this month.",
  },
  {
    scenario: "legitimate",
    score: "8",
    label: "No cap",
    distinguishing: "Treasury bills mature in one year or less.",
  },
  {
    scenario: "partialFailure",
    score: "61",
    label: "Some cap",
    distinguishing: "A private analyst report projects 40% revenue growth.",
  },
] as const) {
  test(`${fixture.scenario} renders its distinct fixture outcome`, async ({ page }) => {
    await submitUrl(page, fixture.scenario);
    await expect(page.getByText(fixture.score, { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: fixture.label })).toBeVisible();
    const card = page
      .getByRole("article")
      .filter({ hasText: fixture.distinguishing });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "View evidence" }).click();
    if (fixture.scenario === "partialFailure") {
      await expect(card.getByText("Source unavailable")).toBeVisible();
      await expect(page.getByRole("article")).toHaveCount(2);
    }
  });
}

test("fatal analysis retains input and retry remains recoverable", async ({ page }) => {
  let requests = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/api/analyze")) {
      requests += 1;
    }
  });
  await submitUrl(page, "fatal");
  const input = page.getByLabel("Video URL");
  await expect(input).toHaveValue(demoUrl);
  const fatalMessage = page.getByText(/Your input is safe to retry/);
  await expect(fatalMessage).toBeVisible();
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(fatalMessage).toBeVisible();
  expect(requests).toBe(2);
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(input).toHaveValue("");
  await expect(fatalMessage).toHaveCount(0);
});

test("keyboard order, focus treatment, and loading state prevent duplicate submits", async ({
  page,
}) => {
  await page.goto("/");
  const input = page.getByLabel("Video URL");
  const analyze = page.getByRole("button", { name: "Analyze video" });
  await page.keyboard.press("Tab");
  await expect(input).toBeFocused();
  await expect(input).toHaveCSS("outline-style", "solid");
  await input.fill(demoUrl);
  await page.keyboard.press("Tab");
  await expect(analyze).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Analyzing…" })).toBeDisabled();
  await expect(page.locator('input[type="file"]')).toBeDisabled();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Some cap" })).toBeVisible();
});

test("mobile layout contains long content and keeps controls usable", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "mobile-only QA");
  await submitUrl(page);
  const longClaim = page.getByText(
    "This semiconductor stock will double before December.",
  );
  await expect(longClaim).toBeVisible();
  await page
    .getByRole("article")
    .filter({ has: longClaim })
    .getByRole("button", { name: "View evidence" })
    .click();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  const controls = page.locator("main").getByRole("button");
  for (let index = 0; index < (await controls.count()); index += 1) {
    const control = controls.nth(index);
    if (!(await control.isVisible())) continue;
    const box = await control.boundingBox();
    expect(box, `button ${await control.innerText()} has a box`).not.toBeNull();
    expect(box!.height, `button ${await control.innerText()} is at least 44px`).toBeGreaterThanOrEqual(44);
  }
});
