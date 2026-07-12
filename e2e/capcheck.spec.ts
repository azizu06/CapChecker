import { expect, test, type Locator, type Page } from "@playwright/test";

const demoUrl = "https://www.youtube.com/shorts/capcheck-demo";

async function gotoReady(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator("html")).toHaveAttribute("data-capcheck-hydrated", "true");
}

function captureRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function submitUrl(page: Page, scenario = "mixed") {
  await gotoReady(page, `/analyze?fixture=${scenario}`);
  await page.getByLabel("Video URL").fill(demoUrl);
  await page.getByRole("button", { name: "Check it" }).click();
}

async function expectSafeExternalLink(link: Locator) {
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  expect(href).toMatch(/^https?:\/\//);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /\bnoopener\b/);
  await expect(link).toHaveAttribute("rel", /\bnoreferrer\b/);
}

async function openTab(page: Page, name: RegExp) {
  await page.getByRole("tab", { name }).click();
}

function contrastRatio(foreground: number[], background: number[]) {
  const luminance = ([red, green, blue]: number[]) => {
    const channels = [red, green, blue].map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function rgbChannels(value: string) {
  return (value.match(/\d+(?:\.\d+)?/g) ?? []).slice(0, 3).map(Number);
}

test("loads the fixture-ready CapCheck intake without runtime errors", async ({
  page,
}) => {
  const runtimeErrors = captureRuntimeErrors(page);
  await gotoReady(page, "/analyze");

  await expect(page).toHaveTitle(/CapCheck/);
  await expect(
    page.locator(".app-header").getByText("CapCheck", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Financial advice, fact-checked")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Is that stock tip cap? Check before you act.",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Video URL")).toBeVisible();
  await expect(page.getByRole("button", { name: "Check it" })).toBeVisible();
  await expect(page.getByText("or upload a video")).toBeVisible();
  await expect(page.getByText("Choose a video file")).toBeVisible();

  await page.getByLabel("Video URL").fill(demoUrl);
  await page.getByRole("button", { name: "Check it" }).click();
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

  await gotoReady(page, "/analyze?fixture=mixed");
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
  const analyze = page.getByRole("button", { name: "Check it" });
  await analyze.click();
  await expect(page.getByRole("button", { name: "Checking…" })).toBeDisabled();
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

test("progress kicker meets the compact metadata minimum", async ({ page }) => {
  await gotoReady(page, "/analyze?fixture=mixed");
  await page.getByLabel("Video URL").fill(demoUrl);
  await page.getByRole("button", { name: "Check it" }).click();

  const kicker = page.getByText("Research process", { exact: true });
  await expect(kicker).toBeVisible();
  const fontSize = await kicker.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
  expect(fontSize).toBeGreaterThanOrEqual(13);
});

test("checked-time metadata stays readable and contained at 375px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await submitUrl(page);

  const timestamp = page.locator(".source-details .when");
  await expect(timestamp).toHaveText("· just now");
  const metrics = await timestamp.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
      left: box.left,
      right: box.right,
    };
  });
  expect(metrics.fontSize).toBeGreaterThanOrEqual(13);
  expect(metrics.left).toBeGreaterThanOrEqual(0);
  expect(metrics.right).toBeLessThanOrEqual(375);
});

test("mixed result exposes every claim and safe evidence destination, then re-checks", async ({
  page,
}) => {
  let analysisRequests = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/api/analyze")) {
      analysisRequests += 1;
    }
  });
  await submitUrl(page);
  await expect(page.locator(".score-num")).toHaveText("52");
  await expect(page.getByRole("heading", { name: "Some cap" })).toBeVisible();
  await expect(
    page.getByText(
      "The video mixes a supported market fact with an unsupported forecast and a false guarantee.",
    ),
  ).toBeVisible();
  await expect(page.getByText(/Checked:/)).toBeVisible();
  await expect(page.getByText(/Verdict weights determine the score/)).toBeVisible();
  await expect(page.getByText(/hype is shown separately and does not add points/)).toBeVisible();
  await expect(page.getByText(/Evidence may be high, medium, or low trust—or unavailable/)).toBeVisible();
  await expect(page.locator(".app-footer a")).toHaveCount(0);
  await expectSafeExternalLink(
    page.getByRole("link", { name: /Open the checked video/ }),
  );

  // Claims tab is active by default.
  await expect(page.getByRole("tab", { name: /Claims reviewed/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  const checkedClaims = [
    { text: "The S&P 500 gained more than 20% in 2023.", timestamp: "0:07" },
    { text: "This semiconductor stock will double before December.", timestamp: "0:22" },
    { text: "You cannot lose money if you buy before earnings.", timestamp: "0:41" },
  ];
  for (const claim of checkedClaims) {
    const card = page.locator("details.claim").filter({ hasText: claim.text });
    await expect(card).toHaveCount(1);
    await expect(card.getByText(claim.timestamp, { exact: true })).toBeVisible();
    const summary = card.locator("summary");
    await expect(card).not.toHaveAttribute("open", /.*/);
    await summary.click();
    await expect(card).toHaveAttribute("open", "");
    await expect(card.getByText(/trust$|Primary source/).first()).toBeVisible();
    for (const link of await card.getByRole("link").all()) {
      await expectSafeExternalLink(link);
    }
    await summary.click();
    await expect(card).not.toHaveAttribute("open", /.*/);
  }

  const skippedOpinion = page.locator(".claim.opinion").filter({
    hasText: "I think this is the most exciting stock in the market.",
  });
  await expect(skippedOpinion).toBeVisible();
  await expect(skippedOpinion.getByText("Opinion", { exact: true })).toBeVisible();
  await expect(skippedOpinion.getByText("0:54", { exact: true })).toBeVisible();
  await expect(skippedOpinion.locator("summary")).toHaveCount(0);
  // Opinions are not fact-checked and expose no evidence links.
  await expect(skippedOpinion.getByRole("link")).toHaveCount(0);

  await expectSafeExternalLink(
    page.getByRole("link", { name: /Open strongest source/ }),
  );

  // Hype language lives in its own tab.
  await openTab(page, /Hype language/);
  const hypePanel = page.locator(".tabpanel:not([hidden])");
  await expect(hypePanel.locator("li")).toHaveCount(2);
  await expect(hypePanel.locator("li b").first()).toContainText(
    "You cannot lose money",
  );
  await expect(
    hypePanel.getByText(
      "Buy before earnings. You cannot lose money on this trade.",
    ),
  ).toHaveCount(2);

  // "Before you act" next steps tab.
  await openTab(page, /Before you act/);
  const stepsPanel = page.locator(".tabpanel:not([hidden])");
  await expect(stepsPanel.getByRole("listitem")).toHaveCount(2);
  const indexSource = stepsPanel.getByRole("link", {
    name: /Open evidence source: S&P 500 factsheet/,
  });
  const riskSource = stepsPanel.getByRole("link", {
    name: /Open evidence source: Understanding investment risk/,
  });
  await expectSafeExternalLink(indexSource);
  await expect(indexSource).toHaveAttribute(
    "href",
    "https://www.spglobal.com/spdji/en/indices/equity/sp-500/",
  );
  await expectSafeExternalLink(riskSource);
  await expect(riskSource).toHaveAttribute(
    "href",
    "https://www.finra.org/investors/investing/investing-basics/risk",
  );
  expect(analysisRequests).toBe(1);

  // The persistent mini-intake re-checks another video from the results view.
  await page.getByLabel("Check another video URL").fill(demoUrl);
  await page.getByRole("button", { name: "Check it" }).click();
  await expect(page.getByRole("heading", { name: "Some cap" })).toBeVisible();
  await expect(page.locator(".score-num")).toHaveText("52");
  expect(analysisRequests).toBe(2);

  await page.getByRole("button", { name: "Run again" }).click();
  await expect(page.getByRole("heading", { name: "Some cap" })).toBeVisible();
  expect(analysisRequests).toBe(3);
  await page.getByRole("button", { name: "Check another" }).click();
  await expect(page.getByLabel("Video URL")).toBeVisible();
  await expect(page.getByLabel(/Choose a video file/)).toBeVisible();
});

test("result tabs support the complete keyboard navigation pattern", async ({ page }) => {
  await submitUrl(page);
  const claims = page.getByRole("tab", { name: /Claims reviewed/ });
  const hype = page.getByRole("tab", { name: /Hype language/ });
  const actions = page.getByRole("tab", { name: /Before you act/ });
  await claims.focus();
  await claims.press("ArrowLeft");
  await expect(actions).toBeFocused();
  await expect(actions).toHaveAttribute("aria-selected", "true");
  await actions.press("ArrowRight");
  await expect(claims).toBeFocused();
  await claims.press("End");
  await expect(actions).toBeFocused();
  await actions.press("Home");
  await expect(claims).toBeFocused();
  await claims.press("ArrowRight");
  await expect(hype).toBeFocused();
  await expect(hype).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: /Hype language/ })).toBeVisible();
  await expect(page.locator('[role="tabpanel"][hidden]')).toHaveCount(2);
});

test("reduced motion renders the score and meter at their final state", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await submitUrl(page);
  await expect(page.locator(".score-num")).toHaveText("52");
  await expect(page.locator(".meter .pin")).toHaveAttribute("style", /left: 52%/);
  await expect(page.locator(".meter .pin")).toHaveCSS("transition-duration", "0s");
});

test("score band labels stay readable, distinct, and contained at 375px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await submitUrl(page);

  const labels = page.locator(".meter-labels > span");
  await expect(labels).toHaveText([
    "No cap 0–29",
    "Some cap 30–69",
    "Full of cap 70–100",
  ]);

  const boxes = await labels.evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return {
        fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
        left: box.left,
        right: box.right,
      };
    }),
  );

  for (const [index, box] of boxes.entries()) {
    expect(box.fontSize, `band ${index + 1} meets the metadata minimum`).toBeGreaterThanOrEqual(13);
    expect(box.left, `band ${index + 1} stays inside the viewport`).toBeGreaterThanOrEqual(0);
    expect(box.right, `band ${index + 1} stays inside the viewport`).toBeLessThanOrEqual(375);
    if (index > 0) {
      expect(box.left, `band ${index + 1} does not overlap band ${index}`).toBeGreaterThanOrEqual(
        boxes[index - 1].right,
      );
    }
  }

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("verdict pills pair readable semantic ink with labels and status dots", async ({
  page,
}) => {
  await submitUrl(page);

  for (const { selector, label } of [
    { selector: ".v-true", label: "True" },
    { selector: ".v-unv", label: "Unverifiable" },
    { selector: ".v-false", label: "False" },
  ]) {
    const pill = page.locator(`.verdict-pill${selector}`).first();
    await expect(pill).toHaveText(label);
    const styles = await pill.evaluate((element) => {
      const pillStyle = getComputedStyle(element);
      const dotStyle = getComputedStyle(element, "::before");
      return {
        color: pillStyle.color,
        backgroundColor: pillStyle.backgroundColor,
        dotColor: dotStyle.backgroundColor,
        dotWidth: Number.parseFloat(dotStyle.width),
      };
    });
    const ratio = contrastRatio(
      rgbChannels(styles.color),
      rgbChannels(styles.backgroundColor),
    );
    expect.soft(ratio, `${label} pill text contrast`).toBeGreaterThanOrEqual(4.5);
    expect(styles.dotColor, `${label} dot uses the same semantic ink`).toBe(styles.color);
    expect(styles.dotWidth, `${label} status dot remains visible`).toBeGreaterThan(0);
  }
});

test("upload can be selected, removed, reselected, and analyzed through multipart", async ({
  page,
}) => {
  await gotoReady(page, "/analyze");
  const chooser = page.getByLabel(/Choose a video file/);
  const sample = "e2e/fixtures/sample-video.mp4";
  await page.getByLabel("Video URL").fill("not a url");
  await page.getByRole("button", { name: "Check it" }).click();
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
  await page.getByRole("button", { name: "Check it" }).click();
  await multipart;
  await expect(page.getByRole("heading", { name: "Some cap" })).toBeVisible();
});

for (const fixture of [
  {
    scenario: "scammy",
    score: "94",
    label: "Full of cap",
    distinguishing: "This token is guaranteed to return 10x this month.",
    claimCount: 2,
  },
  {
    scenario: "legitimate",
    score: "8",
    label: "No cap",
    distinguishing: "Treasury bills mature in one year or less.",
    claimCount: 2,
  },
  {
    scenario: "partialFailure",
    score: "61",
    label: "Some cap",
    distinguishing: "A private analyst report projects 40% revenue growth.",
    claimCount: 2,
  },
] as const) {
  test(`${fixture.scenario} renders its distinct fixture outcome`, async ({ page }) => {
    await submitUrl(page, fixture.scenario);
    await expect(page.locator(".score-num")).toHaveText(fixture.score);
    await expect(page.getByRole("heading", { name: fixture.label })).toBeVisible();
    const card = page
      .locator("details.claim")
      .filter({ hasText: fixture.distinguishing });
    await expect(card).toBeVisible();
    await card.locator("summary").click();
    await expect(card).toHaveAttribute("open", "");
    if (fixture.scenario === "partialFailure") {
      await expect(card.getByText("Source unavailable")).toBeVisible();
      await expect(page.locator("details.claim")).toHaveCount(fixture.claimCount);
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
  await expect(page.getByRole("button", { name: "Checking…" })).toBeDisabled();
  await expect(fatalMessage).toHaveCount(0);
  await expect(fatalMessage).toBeVisible();
  expect(requests).toBe(2);
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(input).toHaveValue("");
  await expect(fatalMessage).toHaveCount(0);
});

test("keyboard order, focus treatment, and loading state prevent duplicate submits", async ({
  page,
}) => {
  let analysisRequests = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/api/analyze")) {
      analysisRequests += 1;
    }
  });
  await gotoReady(page, "/analyze");
  const input = page.getByLabel("Video URL");
  const analyze = page.getByRole("button", { name: "Check it" });
  // The shared site header owns the first tab stops; tab from it into the app.
  await page.getByRole("link", { name: "Analyze" }).focus();
  await page.keyboard.press("Tab");
  await expect(input).toBeFocused();
  await expect(input).toHaveCSS("outline-style", "solid");
  await input.fill(demoUrl);
  await page.keyboard.press("Tab");
  await expect(analyze).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Checking…" })).toBeDisabled();
  await expect(page.locator('input[type="file"]')).toBeDisabled();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Some cap" })).toBeVisible();
  expect(analysisRequests).toBe(1);
});

test("mobile layout contains long content and keeps controls usable", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "mobile-only QA");
  await gotoReady(page, "/analyze");
  const urlInput = page.getByLabel("Video URL");
  const uploadTarget = page.locator("label.drop-zone");
  for (const [name, control] of [
    ["URL input", urlInput],
    ["upload target", uploadTarget],
  ] as const) {
    const box = await control.boundingBox();
    expect(box, `${name} has a box`).not.toBeNull();
    expect(box!.height, `${name} is at least 44px`).toBeGreaterThanOrEqual(44);
  }
  await urlInput.fill(demoUrl);
  await page.getByRole("button", { name: "Check it" }).click();
  await expect(page.getByRole("heading", { name: "Some cap" })).toBeVisible();
  const longClaimText = "This semiconductor stock will double before December.";
  const longClaim = page.locator("details.claim").filter({ hasText: longClaimText });
  await expect(longClaim).toBeVisible();
  await longClaim.locator("summary").click();
  await expect(longClaim).toHaveAttribute("open", "");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  const controls = page.locator('main button, main [role="tab"]');
  for (let index = 0; index < (await controls.count()); index += 1) {
    const control = controls.nth(index);
    if (!(await control.isVisible())) continue;
    const box = await control.boundingBox();
    expect(box, `button ${await control.innerText()} has a box`).not.toBeNull();
    expect(box!.height, `button ${await control.innerText()} is at least 44px`).toBeGreaterThanOrEqual(44);
  }
});
