import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEMO_FATAL_ERROR, DEMO_SCORECARDS } from "@/fixtures/scorecards";

import { CapCheckApp } from "./capcheck-app";

const sseResponse = (...events: unknown[]) =>
  new Response(
    events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );

const landingUrlInput = () => screen.getByLabelText("Video URL");
const checkItButton = () => screen.getByRole("button", { name: /^check it$/i });

const submitUrl = async (
  user: ReturnType<typeof userEvent.setup>,
  value = "https://www.youtube.com/shorts/demo",
) => {
  await user.type(landingUrlInput(), value);
  await user.click(checkItButton());
};

const expandClaim = async (
  user: ReturnType<typeof userEvent.setup>,
  claimText: string,
) => {
  const details = screen.getByText(claimText).closest("details") as HTMLDetailsElement;
  await user.click(details.querySelector("summary")!);
  return details;
};

describe("CapCheckApp", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState({}, "", "/");
  });

  it("renders the landing hero and full intake by default", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<CapCheckApp />);

    expect(
      screen.getByRole("heading", { name: /is that stock tip/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Financial advice, fact-checked")).toBeInTheDocument();
    expect(landingUrlInput()).toBeInTheDocument();
    expect(checkItButton()).toBeInTheDocument();
    expect(screen.getByText(/choose a video file/i)).toBeInTheDocument();
  });

  it("submits a valid URL through the public stream and renders the scorecard", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse(
        { type: "progress", stage: "fetching", message: "Fetching video" },
        { type: "complete", scorecard: DEMO_SCORECARDS.mixed },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<CapCheckApp />);
    await submitUrl(user, "https://www.youtube.com/shorts/demo");

    expect(await screen.findByText("52")).toBeInTheDocument();
    expect(screen.getByText("Financial advice, fact-checked")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Some cap" })).toBeInTheDocument();
    expect(
      screen.getByText(/The video mixes a supported market fact/),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analyze",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows the complete accessible Cap Score bands", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      sseResponse({ type: "complete", scorecard: DEMO_SCORECARDS.mixed }),
    ));
    const user = userEvent.setup();
    render(<CapCheckApp />);
    await submitUrl(user);

    expect(await screen.findByText("No cap 0–29")).toBeVisible();
    expect(screen.getByText("Some cap 30–69")).toBeVisible();
    expect(screen.getByText("Full of cap 70–100")).toBeVisible();
  });

  it("explains the deterministic score and evidence trust truthfully", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      sseResponse({ type: "complete", scorecard: DEMO_SCORECARDS.mixed }),
    ));
    const user = userEvent.setup();
    render(<CapCheckApp />);
    await submitUrl(user);

    expect(await screen.findByText(/verdict weights/i)).toBeVisible();
    expect(screen.getByText(/prediction-heavy videos have a minimum score of 30/i)).toBeVisible();
    expect(screen.getByText(/evidence may be high, medium, or low trust—or unavailable/i)).toBeVisible();
    expect(screen.queryByText(/hype language raises it further/i)).not.toBeInTheDocument();
  });

  it("does not expose dead footer fragment links", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      sseResponse({ type: "complete", scorecard: DEMO_SCORECARDS.mixed }),
    ));
    const user = userEvent.setup();
    const { container } = render(<CapCheckApp />);
    await submitUrl(user);
    await screen.findByText("How the Cap Score works");

    expect(container.querySelectorAll('.app-footer a[href^="#"]')).toHaveLength(0);
  });

  it.each(["", "not a url", "mailto:tips@example.com"])(
    "rejects invalid URL input without fetching: %s",
    async (value) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const user = userEvent.setup();
      render(<CapCheckApp />);
      if (value) await user.type(landingUrlInput(), value);

      await user.click(checkItButton());

      expect(screen.getByRole("alert")).toHaveTextContent(/valid http or https/i);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("selects, removes, and submits an upload as multipart form data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse({ type: "complete", scorecard: DEMO_SCORECARDS.partialFailure }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<CapCheckApp />);
    const file = new File(["video"], "earnings-demo.mp4", { type: "video/mp4" });

    await user.upload(screen.getByLabelText(/choose a video file/i), file);
    expect(screen.getByText("earnings-demo.mp4")).toBeInTheDocument();
    expect(screen.getByText(/1 KB · ready/i)).toBeInTheDocument();
    await user.click(checkItButton());

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(request.body).toBeInstanceOf(FormData);
    expect((request.body as FormData).get("file")).toEqual(file);
  });

  it("allows a selected upload to be removed", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const user = userEvent.setup();
    render(<CapCheckApp />);
    const file = new File(["video"], "remove-me.mp4", { type: "video/mp4" });
    await user.upload(screen.getByLabelText(/choose a video file/i), file);

    await user.click(screen.getByRole("button", { name: /remove remove-me.mp4/i }));

    expect(screen.queryByText("remove-me.mp4")).not.toBeInTheDocument();
    expect(landingUrlInput()).toBeEnabled();
  });

  it.each([
    [new File([], "empty.mp4", { type: "video/mp4" }), /cannot be empty/i],
    [new File(["video"], "clip.exe", { type: "application/octet-stream" }), /mp4, mov, or webm/i],
    [new File(["video"], "clip.mp4", { type: "text/plain" }), /mp4, mov, or webm/i],
    [new File([new Uint8Array(50 * 1024 * 1024 + 1)], "large.mp4", { type: "video/mp4" }), /50 mb or smaller/i],
  ])("rejects an invalid upload before it is ready or submitted", async (file, message) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup({ applyAccept: false });
    render(<CapCheckApp />);

    await user.upload(screen.getByLabelText(/choose a video file/i), file);

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByText(`${file.name}`)).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears a previously valid file when a later selection is invalid", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup({ applyAccept: false });
    render(<CapCheckApp />);
    const input = screen.getByLabelText(/choose a video file/i);
    await user.upload(input, new File(["video"], "valid.mp4", { type: "video/mp4" }));
    expect(screen.getByText("valid.mp4")).toBeInTheDocument();

    await user.upload(input, new File(["bad"], "bad.exe", { type: "application/octet-stream" }));
    await user.click(checkItButton());

    expect(screen.queryByText("valid.mp4")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("associates upload errors only with the file input", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const user = userEvent.setup({ applyAccept: false });
    render(<CapCheckApp />);
    const fileInput = screen.getByLabelText(/choose a video file/i);
    const urlInput = landingUrlInput();

    await user.upload(fileInput, new File(["bad"], "bad.exe", { type: "application/octet-stream" }));

    expect(fileInput).toHaveAttribute("aria-invalid", "true");
    const uploadError = screen.getByRole("alert");
    expect(fileInput.getAttribute("aria-describedby")).toContain(uploadError.id);
    expect(urlInput).toHaveAttribute("aria-invalid", "false");
  });

  it("can select the same valid file immediately after removing it", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const user = userEvent.setup();
    render(<CapCheckApp />);
    const input = screen.getByLabelText(/choose a video file/i);
    const file = new File(["video"], "same.mp4", { type: "video/mp4" });
    await user.upload(input, file);
    await user.click(screen.getByRole("button", { name: /remove same.mp4/i }));

    await user.upload(input, file);

    expect(screen.getByText("same.mp4")).toBeInTheDocument();
  });

  it("resets an invalid native selection so the same filename can be corrected", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const user = userEvent.setup({ applyAccept: false });
    render(<CapCheckApp />);
    const input = screen.getByLabelText(/choose a video file/i);
    await user.upload(input, new File(["bad"], "clip.mp4", { type: "text/plain" }));

    await user.upload(input, new File(["video"], "clip.mp4", { type: "video/mp4" }));

    expect(screen.getByText("clip.mp4")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "false");
  });

  it("passes only an allowlisted fixture query scenario to the public route", async () => {
    window.history.replaceState({}, "", "/?fixture=scammy");
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse({ type: "complete", scorecard: DEMO_SCORECARDS.scammy }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<CapCheckApp />);
    await submitUrl(user, "https://example.com/video");

    await screen.findByText("94");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      url: "https://example.com/video",
      scenario: "scammy",
    });
  });

  it("omits an unknown fixture query and prevents duplicate submissions while loading", async () => {
    window.history.replaceState({}, "", "/?fixture=private-debug-mode");
    let resolveResponse!: (response: Response) => void;
    const fetchMock = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => { resolveResponse = resolve; }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<CapCheckApp />);
    await user.type(landingUrlInput(), "https://example.com/video");
    const button = checkItButton();

    await user.click(button);
    fireEvent.submit(button.closest("form")!);

    expect(screen.getByRole("button", { name: /checking/i })).toBeDisabled();
    expect(landingUrlInput()).toBeDisabled();
    expect(screen.getByLabelText(/choose a video file/i).closest("label"))
      .toHaveAttribute("aria-disabled", "true");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      url: "https://example.com/video",
    });
    resolveResponse(sseResponse({ type: "complete", scorecard: DEMO_SCORECARDS.mixed }));
    await screen.findByText("52");
  });

  it("renders the legitimate fixture as a low, no-cap result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      sseResponse({ type: "complete", scorecard: DEMO_SCORECARDS.legitimate }),
    ));
    const user = userEvent.setup();
    render(<CapCheckApp />);
    await submitUrl(user, "https://example.com/video");

    expect(await screen.findByText("8")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No cap" })).toBeInTheDocument();
    const mostlyTrue = screen.getByText("Mostly true");
    expect(mostlyTrue).toHaveClass("v-mostly");
    expect(mostlyTrue).not.toHaveClass("v-true");
  });

  it("keeps the input on a retryable fatal error and supports retry and reset", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(sseResponse(DEMO_FATAL_ERROR))
      .mockResolvedValueOnce(sseResponse(DEMO_FATAL_ERROR));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<CapCheckApp />);
    const input = landingUrlInput();
    await user.type(input, "https://example.com/video");
    await user.click(checkItButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(/safe to retry/i);
    expect(input).toHaveValue("https://example.com/video");
    await user.click(screen.getByRole("button", { name: /^retry$/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: /reset/i }));
    expect(landingUrlInput()).toHaveValue("");
  });

  it("clears active progress when the stream ends in a fatal error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse(
      { type: "progress", stage: "fetching", message: "Fetching video" },
      { type: "progress", stage: "processing", message: "Preparing transcript" },
      DEMO_FATAL_ERROR,
    )));
    const user = userEvent.setup();
    render(<CapCheckApp />);
    await user.type(landingUrlInput(), "https://example.com/video");
    await user.click(checkItButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(/safe to retry/i);
    expect(screen.queryByRole("region", { name: /checking the claims/i }))
      .not.toBeInTheDocument();
  });

  it("does not retry after the retained URL becomes malformed", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(sseResponse(DEMO_FATAL_ERROR));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<CapCheckApp />);
    const input = landingUrlInput();
    await user.type(input, "https://example.com/video");
    await user.click(checkItButton());
    await screen.findByRole("alert");
    await user.clear(input);
    await user.type(input, "not a url");

    await user.click(screen.getByRole("button", { name: /^retry$/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/valid http or https/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry after the failed upload is removed", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(sseResponse(DEMO_FATAL_ERROR));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<CapCheckApp />);
    const file = new File(["video"], "failed.mp4", { type: "video/mp4" });
    await user.upload(screen.getByLabelText(/choose a video file/i), file);
    await user.click(checkItButton());
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: /remove failed.mp4/i }));

    await user.click(screen.getByRole("button", { name: /^retry$/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/valid http or https/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("expands a claim to show evidence and a safe external source", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      sseResponse({ type: "complete", scorecard: DEMO_SCORECARDS.mixed }),
    ));
    const user = userEvent.setup();
    render(<CapCheckApp />);
    await submitUrl(user, "https://example.com/video");
    await screen.findByText("52");

    const details = await expandClaim(
      user,
      "The S&P 500 gained more than 20% in 2023.",
    );

    expect(details.open).toBe(true);
    expect(screen.getByText(/published annual return supports/i)).toBeInTheDocument();
    expect(screen.getByText("High trust")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /open source: s&p 500 factsheet/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows each available claim timestamp in minutes and seconds", async () => {
    const timestampedScorecard = {
      ...DEMO_SCORECARDS.mixed,
      verifications: DEMO_SCORECARDS.mixed.verifications.map(
        (verification, index) =>
          index === 0
            ? {
                ...verification,
                claim: { ...verification.claim, timestampSeconds: 84 },
              }
            : verification,
      ),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse({ type: "complete", scorecard: timestampedScorecard }),
      ),
    );
    const user = userEvent.setup();
    render(<CapCheckApp />);
    await submitUrl(user, "https://example.com/video");
    const claimText = await screen.findByText(
      "The S&P 500 gained more than 20% in 2023.",
    );
    const claim = claimText.closest("details");

    expect(claim).not.toBeNull();
    expect(within(claim!).getByText("1:24")).toBeInTheDocument();
  });

  it("renders skipped opinions as a non-verdict claim card", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse({ type: "complete", scorecard: DEMO_SCORECARDS.mixed }),
      ),
    );
    const user = userEvent.setup();
    render(<CapCheckApp />);
    await submitUrl(user, "https://example.com/video");
    const opinionText = await screen.findByText(
      "I think this is the most exciting stock in the market.",
    );
    const opinion = opinionText.closest(".claim") as HTMLElement | null;

    expect(opinion).not.toBeNull();
    expect(within(opinion!).getByText("Opinion")).toBeInTheDocument();
    expect(within(opinion!).getByText("0:54")).toBeInTheDocument();
    expect(within(opinion!).queryByText(/confidence/i)).not.toBeInTheDocument();
    expect(opinion).not.toBeInstanceOf(HTMLDetailsElement);
    expect(within(opinion!).queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders hype findings with transcript context and timestamps on its tab", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse({ type: "complete", scorecard: DEMO_SCORECARDS.mixed }),
      ),
    );
    const user = userEvent.setup();
    render(<CapCheckApp />);
    await submitUrl(user, "https://example.com/video");
    await screen.findByText("52");
    await user.click(screen.getByRole("tab", { name: /hype language/i }));

    const panel = screen.getByRole("tabpanel");
    expect(
      within(panel).getAllByText(
        "Buy before earnings. You cannot lose money on this trade.",
      ),
    ).toHaveLength(2);
    expect(within(panel).getAllByText("0:41")).toHaveLength(2);
  });

  it("moves tab focus, selection, and panels with arrows, Home, End, and wraparound", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      sseResponse({ type: "complete", scorecard: DEMO_SCORECARDS.mixed }),
    ));
    const user = userEvent.setup();
    render(<CapCheckApp />);
    await submitUrl(user);
    const claims = await screen.findByRole("tab", { name: /claims reviewed/i });
    const hype = screen.getByRole("tab", { name: /hype language/i });
    const actions = screen.getByRole("tab", { name: /before you act/i });

    claims.focus();
    await user.keyboard("{ArrowLeft}");
    expect(actions).toHaveFocus();
    expect(actions).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: /before you act/i })).toBeVisible();
    await user.keyboard("{ArrowRight}");
    expect(claims).toHaveFocus();
    await user.keyboard("{End}");
    expect(actions).toHaveFocus();
    await user.keyboard("{Home}");
    expect(claims).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(hype).toHaveFocus();
    expect(hype).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: /hype language/i })).toBeVisible();
    expect(document.getElementById(claims.getAttribute("aria-controls")!)).not.toBeVisible();
  });

  it("links next actions to evidence sources on the before-you-act tab", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse({ type: "complete", scorecard: DEMO_SCORECARDS.mixed }),
      ),
    );
    const user = userEvent.setup();
    render(<CapCheckApp />);
    await submitUrl(user, "https://example.com/video");
    await screen.findByText("52");
    await user.click(screen.getByRole("tab", { name: /before you act/i }));

    const panel = screen.getByRole("tabpanel");
    expect(
      within(panel).getByRole("link", {
        name: /open evidence source: s&p 500 factsheet/i,
      }),
    ).toHaveAttribute(
      "href",
      "https://www.spglobal.com/spdji/en/indices/equity/sp-500/",
    );
    expect(
      within(panel).getByRole("link", {
        name: /open evidence source: understanding investment risk/i,
      }),
    ).toHaveAttribute(
      "href",
      "https://www.finra.org/investors/investing/investing-basics/risk",
    );
  });

  it("renders an action without a link when its evidence ID is unresolved and no URL exists", async () => {
    const scorecard = {
      ...DEMO_SCORECARDS.mixed,
      nextActions: [
        {
          id: "unresolved-action",
          label: "Review the unsupported claim",
          description: "Wait for evidence that directly supports the claim.",
          evidenceId: "missing-evidence",
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(sseResponse({ type: "complete", scorecard })),
    );
    const user = userEvent.setup();
    render(<CapCheckApp />);
    await submitUrl(user, "https://example.com/video");
    await screen.findByText("52");
    await user.click(screen.getByRole("tab", { name: /before you act/i }));

    const action = screen.getByText("Review the unsupported claim").closest("li");
    expect(action).not.toBeNull();
    expect(
      within(action!).getByText(
        "Wait for evidence that directly supports the claim.",
      ),
    ).toBeInTheDocument();
    expect(within(action!).queryByRole("link")).not.toBeInTheDocument();
  });

  it("keeps legacy hype findings and action URLs usable without new anchors", async () => {
    const finding = DEMO_SCORECARDS.mixed.hypeFindings[0];
    const legacyScorecard = {
      ...DEMO_SCORECARDS.mixed,
      hypeFindings: [
        {
          id: finding.id,
          phrase: finding.phrase,
          category: finding.category,
          severity: finding.severity,
          explanation: finding.explanation,
        },
      ],
      nextActions: [
        {
          id: "legacy-action",
          label: "Open the filing search",
          description: "Compare the claim with a primary filing.",
          url: "https://www.sec.gov/edgar/search/",
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse({ type: "complete", scorecard: legacyScorecard }),
      ),
    );
    const user = userEvent.setup();
    render(<CapCheckApp />);
    await submitUrl(user, "https://example.com/video");
    await screen.findByText("52");
    await user.click(screen.getByRole("tab", { name: /hype language/i }));
    expect(screen.getByText(`“${finding.phrase}”`)).toBeInTheDocument();
    expect(screen.getByText(finding.explanation)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /before you act/i }));
    expect(
      screen.getByRole("link", { name: /open the filing search/i }),
    ).toHaveAttribute("href", "https://www.sec.gov/edgar/search/");
  });

  it("renders partial failure without losing results", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      sseResponse({ type: "complete", scorecard: DEMO_SCORECARDS.partialFailure }),
    ));
    const user = userEvent.setup();
    render(<CapCheckApp />);
    await submitUrl(user, "https://example.com/video");
    await screen.findByText("61");

    await expandClaim(user, "A private analyst report projects 40% revenue growth.");
    expect(screen.getByText("Source unavailable")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /before you act/i }));
    expect(screen.getByText("Require the missing report")).toBeInTheDocument();
  });

  it("shows explicit empty states for zero reviewed claims and zero next actions", async () => {
    const emptyScorecard = {
      ...DEMO_SCORECARDS.mixed,
      verifications: [],
      skippedClaims: [],
      nextActions: [],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      sseResponse({ type: "complete", scorecard: emptyScorecard }),
    ));
    const user = userEvent.setup();
    render(<CapCheckApp />);
    await submitUrl(user);

    expect(await screen.findByText("No claims were reviewed.")).toBeVisible();
    await user.click(screen.getByRole("tab", { name: /before you act/i }));
    expect(screen.getByText("No next actions were generated.")).toBeVisible();
  });

  it("starts a fresh analysis from the persistent mini-intake", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        sseResponse({ type: "complete", scorecard: DEMO_SCORECARDS.mixed }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<CapCheckApp />);
    await submitUrl(user, "https://example.com/first");
    await screen.findByText("52");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const miniInput = screen.getByLabelText(/check another video/i);
    await user.type(miniInput, "https://example.com/second");
    await user.click(screen.getByRole("button", { name: /^check it$/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).toEqual({
      url: "https://example.com/second",
    });
    expect(await screen.findByText("52")).toBeInTheDocument();
  });

  it("offers completed-result rerun and full-intake reset actions", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(
      sseResponse({ type: "complete", scorecard: DEMO_SCORECARDS.mixed }),
    ));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<CapCheckApp />);
    await submitUrl(user, "https://example.com/original");
    await screen.findByText("52");

    await user.click(screen.getByRole("button", { name: "Run again" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string).url).toBe(
      "https://example.com/original",
    );
    await screen.findByText("52");

    await user.click(screen.getByRole("button", { name: "Check another" }));
    expect(landingUrlInput()).toBeVisible();
    expect(screen.getByLabelText(/choose a video file/i)).toBeVisible();
  });

  it("rejects an invalid mini-intake URL without fetching again", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse({ type: "complete", scorecard: DEMO_SCORECARDS.mixed }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<CapCheckApp />);
    await submitUrl(user, "https://example.com/first");
    await screen.findByText("52");

    const miniInput = screen.getByLabelText(/check another video/i);
    await user.type(miniInput, "not a url");
    await user.click(screen.getByRole("button", { name: /^check it$/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/valid http or https/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
