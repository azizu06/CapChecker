import { describe, expect, it, vi } from "vitest";

import { AnalysisEventSchema } from "@/domain/analysis";
import { IngestionError } from "@/server/ingestion/video-ingestion";

import { createLiveAnalysisOrchestrator } from "./live-analysis";

describe("live analysis orchestration", () => {
  it("composes extraction, verification, and synthesis into contract-valid events", async () => {
    const extraction = {
      transcript: [{ timestampSeconds: 0, text: "Apple revenue increased." }],
      claims: [
        {
          id: "claim-1",
          text: "Apple revenue increased.",
          timestampSeconds: 0,
          kind: "factual" as const,
          checkable: true as const,
        },
      ],
    };
    const verifications = [
      {
        claim: extraction.claims[0],
        verdict: "true" as const,
        confidence: 0.9,
        explanation: "Supported by the filing.",
        evidence: [],
      },
    ];
    const scorecard = {
      id: "analysis-fixed",
      source: { kind: "url" as const, url: "https://youtu.be/example" },
      capScore: 0,
      capLabel: "no-cap" as const,
      summary: "The checkable claim is supported.",
      verifications,
      hypeFindings: [],
      nextActions: [],
      generatedAt: "2026-07-11T12:00:00.000Z",
    };
    const extract = vi.fn(async (_source, options) => {
      options.onProgress({
        type: "progress",
        stage: "fetching",
        message: "Downloading the source video",
      });
      options.onProgress({
        type: "progress",
        stage: "extracting",
        message: "Extracting transcript and financial claims",
      });
      return extraction;
    });
    const verify = vi.fn(async (_claims, options) => {
      options.onProgress({
        type: "progress",
        stage: "verifying",
        message: "Verifying 1 checkable claim",
      });
      return verifications;
    });
    const synthesize = vi.fn(async (_input, options) => {
      options.onProgress({
        type: "progress",
        stage: "synthesizing",
        message: "Building the CapCheck scorecard",
      });
      return scorecard;
    });
    const stream = createLiveAnalysisOrchestrator({
      extraction: { extract },
      verification: { verify },
      synthesis: { synthesize },
      createAnalysisId: () => "analysis-fixed",
    });

    const events = [];
    for await (const event of stream(
      { kind: "url", url: "https://youtu.be/example" },
      new AbortController().signal,
    )) {
      events.push(AnalysisEventSchema.parse(event));
    }

    expect(events.map((event) => event.type)).toEqual([
      "progress",
      "progress",
      "progress",
      "progress",
      "complete",
    ]);
    expect(events.at(-1)).toEqual({ type: "complete", scorecard });
    expect(verify).toHaveBeenCalledWith(
      extraction.claims,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(synthesize).toHaveBeenCalledWith(
      {
        id: "analysis-fixed",
        source: { kind: "url", url: "https://youtu.be/example" },
        extraction,
        verifications,
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("maps a URL ingestion failure to the frozen recoverable error event", async () => {
    const stream = createLiveAnalysisOrchestrator({
      extraction: {
        extract: vi.fn(async () => {
          throw new IngestionError({
            code: "SOURCE_VIDEO_UNAVAILABLE",
            message:
              "We could not download that public video. Upload the video file instead.",
            retryable: false,
            offerUploadFallback: true,
          });
        }),
      },
      verification: { verify: vi.fn() },
      synthesis: { synthesize: vi.fn() },
      createAnalysisId: () => "unused",
    });

    const events = [];
    for await (const event of stream(
      { kind: "url", url: "https://youtu.be/unavailable" },
      new AbortController().signal,
    )) {
      events.push(AnalysisEventSchema.parse(event));
    }

    expect(events).toEqual([
      {
        type: "error",
        error: {
          code: "SOURCE_VIDEO_UNAVAILABLE",
          message:
            "We could not download that public video. Upload the video file instead.",
          retryable: false,
        },
      },
    ]);
  });

  it("emits no terminal event after caller cancellation", async () => {
    const controller = new AbortController();
    const stream = createLiveAnalysisOrchestrator({
      extraction: {
        extract: vi.fn(async (_source, options) => {
          options.onProgress({
            type: "progress",
            stage: "fetching",
            message: "Downloading the source video",
          });
          controller.abort();
          throw new DOMException("Cancelled", "AbortError");
        }),
      },
      verification: { verify: vi.fn() },
      synthesis: { synthesize: vi.fn() },
      createAnalysisId: () => "unused",
    });

    const events = [];
    for await (const event of stream(
      { kind: "url", url: "https://youtu.be/example" },
      controller.signal,
    )) {
      events.push(event);
    }

    expect(events).toEqual([
      {
        type: "progress",
        stage: "fetching",
        message: "Downloading the source video",
      },
    ]);
  });
});
