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

describe("CapCheckApp", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState({}, "", "/");
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
    await user.type(
      screen.getByLabelText(/video url/i),
      "https://www.youtube.com/shorts/demo",
    );
    await user.click(screen.getByRole("button", { name: /analyze video/i }));

    expect(await screen.findByText("52")).toBeInTheDocument();
    expect(screen.getByText("Some cap")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Analysis complete" }))
      .toBeInTheDocument();
    const timeline = screen.getByRole("region", { name: "Analysis complete" });
    expect(within(timeline).getAllByRole("listitem").at(-1)).toHaveTextContent(
      "CompleteAnalysis complete",
    );
    expect(screen.getByRole("button", { name: /run again/i })).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analyze",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it.each(["", "not a url", "mailto:tips@example.com"])(
    "rejects invalid URL input without fetching: %s",
    async (value) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const user = userEvent.setup();
      render(<CapCheckApp />);
      if (value) await user.type(screen.getByLabelText(/video url/i), value);

      await user.click(screen.getByRole("button", { name: /analyze video/i }));

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
    await user.click(screen.getByRole("button", { name: /analyze video/i }));

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
    expect(screen.getByLabelText(/video url/i)).toBeEnabled();
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
    await user.click(screen.getByRole("button", { name: /analyze video/i }));

    expect(screen.queryByText("valid.mp4")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("associates upload errors only with the file input", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const user = userEvent.setup({ applyAccept: false });
    render(<CapCheckApp />);
    const fileInput = screen.getByLabelText(/choose a video file/i);
    const urlInput = screen.getByLabelText(/video url/i);

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
    await user.type(screen.getByLabelText(/video url/i), "https://example.com/video");
    await user.click(screen.getByRole("button", { name: /analyze video/i }));

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
    await user.type(screen.getByLabelText(/video url/i), "https://example.com/video");
    const button = screen.getByRole("button", { name: /analyze video/i });

    await user.click(button);
    fireEvent.submit(button.closest("form")!);

    expect(screen.getByRole("button", { name: /analyzing/i })).toBeDisabled();
    expect(screen.getByLabelText(/video url/i)).toBeDisabled();
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
    await user.type(screen.getByLabelText(/video url/i), "https://example.com/video");
    await user.click(screen.getByRole("button", { name: /analyze video/i }));

    expect(await screen.findByText("8")).toBeInTheDocument();
    expect(screen.getByText("No cap")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Analysis complete" }))
      .toBeInTheDocument();
  });

  it("keeps the input on a retryable fatal error and supports retry and reset", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(sseResponse(DEMO_FATAL_ERROR))
      .mockResolvedValueOnce(sseResponse(DEMO_FATAL_ERROR));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<CapCheckApp />);
    const input = screen.getByLabelText(/video url/i);
    await user.type(input, "https://example.com/video");
    await user.click(screen.getByRole("button", { name: /analyze video/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/safe to retry/i);
    expect(input).toHaveValue("https://example.com/video");
    await user.click(screen.getByRole("button", { name: /^retry$/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: /reset/i }));
    expect(input).toHaveValue("");
  });

  it("clears active progress when the stream ends in a fatal error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse(
      { type: "progress", stage: "fetching", message: "Fetching video" },
      { type: "progress", stage: "processing", message: "Preparing transcript" },
      DEMO_FATAL_ERROR,
    )));
    const user = userEvent.setup();
    render(<CapCheckApp />);
    await user.type(screen.getByLabelText(/video url/i), "https://example.com/video");
    await user.click(screen.getByRole("button", { name: /analyze video/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/safe to retry/i);
    expect(screen.queryByRole("region", { name: /checking the claims/i }))
      .not.toBeInTheDocument();
  });

  it("does not retry after the retained URL becomes malformed", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(sseResponse(DEMO_FATAL_ERROR));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<CapCheckApp />);
    const input = screen.getByLabelText(/video url/i);
    await user.type(input, "https://example.com/video");
    await user.click(screen.getByRole("button", { name: /analyze video/i }));
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
    await user.click(screen.getByRole("button", { name: /analyze video/i }));
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
    await user.type(screen.getByLabelText(/video url/i), "https://example.com/video");
    await user.click(screen.getByRole("button", { name: /analyze video/i }));
    const expanders = await screen.findAllByRole("button", { name: /view evidence/i });

    await user.click(expanders[0]);

    expect(expanders[0]).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/published annual return supports/i)).toBeInTheDocument();
    expect(screen.getByText(/high trust/i)).toBeInTheDocument();
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
    await user.type(
      screen.getByLabelText(/video url/i),
      "https://example.com/video",
    );
    await user.click(screen.getByRole("button", { name: /analyze video/i }));
    const claimText = await screen.findByText(
      "The S&P 500 gained more than 20% in 2023.",
    );
    const claim = claimText.closest("article");

    expect(claim).not.toBeNull();
    expect(within(claim!).getByText("1:24")).toBeInTheDocument();
  });

  it("renders skipped opinions as non-verified claim cards", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse({ type: "complete", scorecard: DEMO_SCORECARDS.mixed }),
      ),
    );
    const user = userEvent.setup();
    render(<CapCheckApp />);
    await user.type(
      screen.getByLabelText(/video url/i),
      "https://example.com/video",
    );
    await user.click(screen.getByRole("button", { name: /analyze video/i }));
    const opinionText = await screen.findByText(
      "I think this is the most exciting stock in the market.",
    );
    const opinion = opinionText.closest("article");

    expect(opinion).not.toBeNull();
    expect(
      within(opinion!).getByText("Opinion — not fact-checked"),
    ).toBeInTheDocument();
    expect(within(opinion!).getByText("0:54")).toBeInTheDocument();
    expect(within(opinion!).queryByRole("button")).not.toBeInTheDocument();
    expect(within(opinion!).queryByText(/confidence/i)).not.toBeInTheDocument();
  });

  it("renders hype findings with transcript context and timestamps", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse({ type: "complete", scorecard: DEMO_SCORECARDS.mixed }),
      ),
    );
    const user = userEvent.setup();
    render(<CapCheckApp />);
    await user.type(
      screen.getByLabelText(/video url/i),
      "https://example.com/video",
    );
    await user.click(screen.getByRole("button", { name: /analyze video/i }));
    const heading = await screen.findByRole("heading", { name: "Hype language" });
    const section = heading.closest("section");

    expect(section).not.toBeNull();
    expect(
      within(section!).getAllByText(
        "Buy before earnings. You cannot lose money on this trade.",
      ),
    ).toHaveLength(2);
    expect(within(section!).getAllByText("0:41")).toHaveLength(2);
  });

  it("links next actions to evidence sources from the scorecard", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse({ type: "complete", scorecard: DEMO_SCORECARDS.mixed }),
      ),
    );
    const user = userEvent.setup();
    render(<CapCheckApp />);
    await user.type(
      screen.getByLabelText(/video url/i),
      "https://example.com/video",
    );
    await user.click(screen.getByRole("button", { name: /analyze video/i }));
    const heading = await screen.findByRole("heading", { name: "Next steps" });
    const section = heading.closest("section");

    expect(section).not.toBeNull();
    expect(
      within(section!).getByRole("link", {
        name: /open evidence source: s&p 500 factsheet/i,
      }),
    ).toHaveAttribute(
      "href",
      "https://www.spglobal.com/spdji/en/indices/equity/sp-500/",
    );
    expect(
      within(section!).getByRole("link", {
        name: /open evidence source: understanding investment risk/i,
      }),
    ).toHaveAttribute(
      "href",
      "https://www.finra.org/investors/investing/investing-basics/risk",
    );
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
    await user.type(
      screen.getByLabelText(/video url/i),
      "https://example.com/video",
    );
    await user.click(screen.getByRole("button", { name: /analyze video/i }));

    expect(await screen.findByText(`“${finding.phrase}”`)).toBeInTheDocument();
    expect(screen.getByText(finding.explanation)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /open the filing search/i }),
    ).toHaveAttribute("href", "https://www.sec.gov/edgar/search/");
  });

  it("renders partial failure, hype findings, and next actions without losing results", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      sseResponse({ type: "complete", scorecard: DEMO_SCORECARDS.partialFailure }),
    ));
    const user = userEvent.setup();
    render(<CapCheckApp />);
    await user.type(screen.getByLabelText(/video url/i), "https://example.com/video");
    await user.click(screen.getByRole("button", { name: /analyze video/i }));
    const expanders = await screen.findAllByRole("button", { name: /view evidence/i });
    await user.click(expanders[1]);

    expect(screen.getByText("Source unavailable")).toBeInTheDocument();
    expect(screen.getAllByText(/everyone on wall street agrees/i)).toHaveLength(2);
    expect(screen.getByText("Require the missing report")).toBeInTheDocument();
    expect(screen.getByText("61")).toBeInTheDocument();
  });

  it("places the verdict scorecard before the completed timeline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      sseResponse({ type: "complete", scorecard: DEMO_SCORECARDS.mixed }),
    ));
    const user = userEvent.setup();
    render(<CapCheckApp />);
    await user.type(screen.getByLabelText(/video url/i), "https://example.com/video");
    await user.click(screen.getByRole("button", { name: /analyze video/i }));
    const scorecard = await screen.findByRole("region", { name: "Some cap" });
    const timeline = screen.getByRole("region", { name: "Analysis complete" });

    expect(scorecard.compareDocumentPosition(timeline) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });
});
