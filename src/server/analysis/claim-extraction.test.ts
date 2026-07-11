import { describe, expect, it, vi } from "vitest";

import { ClaimSchema } from "@/domain/analysis";

import {
  ClaimExtractionError,
  ExtractedClaimSchema,
  createClaimExtractionPipeline,
} from "./claim-extraction";

describe("claim extraction pipeline", () => {
  it("preserves the quantitative fields that are present in a claim", () => {
    expect(
      ExtractedClaimSchema.parse({
        id: "claim-1",
        text: "Revenue rose 5%.",
        timestampSeconds: 3,
        kind: "factual",
        checkable: true,
        quant: {
          metric: "revenue growth",
          value: "5%",
        },
      }),
    ).toMatchObject({
      quant: {
        metric: "revenue growth",
        value: "5%",
      },
    });
  });

  it("rejects an empty quantitative metadata object", () => {
    expect(
      ExtractedClaimSchema.safeParse({
        id: "claim-1",
        text: "Revenue rose.",
        timestampSeconds: 3,
        kind: "factual",
        checkable: true,
        quant: {},
      }).success,
    ).toBe(false);
  });

  it("extracts a timestamped transcript and frozen claims from an ACTIVE video", async () => {
    const activeFile = {
      name: "files/demo-short",
      uri: "https://generativelanguage.googleapis.com/v1beta/files/demo-short",
      mimeType: "video/mp4" as const,
    };
    const generate = vi.fn().mockResolvedValue({
      transcript: [
        {
          timestampSeconds: 3,
          text: "NVDA is up 40% year to date.",
        },
        {
          timestampSeconds: 9,
          text: "I think it is the best stock in the market.",
        },
      ],
      claims: [
        {
          id: "claim-1",
          text: "NVDA is up 40% year to date.",
          timestampSeconds: 3,
          kind: "factual",
          checkable: true,
          quant: {
            ticker: "NVDA",
            metric: "year-to-date return",
            value: "40%",
            period: "2026 YTD",
          },
        },
        {
          id: "claim-2",
          text: "NVDA is the best stock in the market.",
          timestampSeconds: 9,
          kind: "opinion",
          checkable: false,
        },
      ],
    });
    const withActiveFile = vi.fn(
      async (_source, _options, consume) => consume(activeFile),
    );
    const pipeline = createClaimExtractionPipeline({
      ingestor: { withActiveFile },
      gemini: { generate },
    });
    const progress: unknown[] = [];

    const result = await pipeline.extract(
      { kind: "url", url: "https://www.youtube.com/shorts/demo" },
      {
        signal: new AbortController().signal,
        onProgress: (event) => progress.push(event),
      },
    );

    expect(withActiveFile).toHaveBeenCalledOnce();
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({ file: activeFile }),
    );
    expect(progress).toEqual([
      {
        type: "progress",
        stage: "extracting",
        message: "Extracting transcript and financial claims",
      },
    ]);
    expect(result.transcript).toHaveLength(2);
    expect(result.claims).toHaveLength(2);
    expect(result.claims.every((claim) => ClaimSchema.safeParse(claim).success))
      .toBe(true);
    expect(result.claims[0]).toMatchObject({
      quant: {
        ticker: "NVDA",
        metric: "year-to-date return",
        value: "40%",
        period: "2026 YTD",
      },
    });
    expect(result.claims[1]).toMatchObject({
      kind: "opinion",
      checkable: false,
    });
  });

  it("fails clearly on malformed model output without advancing the pipeline", async () => {
    const progress: unknown[] = [];
    const pipeline = createClaimExtractionPipeline({
      ingestor: {
        withActiveFile: async (_source, _options, consume) =>
          consume({
            name: "files/demo-short",
            uri: "https://generativelanguage.googleapis.com/v1beta/files/demo-short",
            mimeType: "video/mp4",
          }),
      },
      gemini: {
        generate: vi.fn().mockResolvedValue({
          transcript: [{ timestampSeconds: 0, text: "Buy it now." }],
          claims: [
            {
              id: "claim-1",
              text: "Buy it now.",
              kind: "opinion",
              checkable: true,
            },
          ],
        }),
      },
    });

    await expect(
      pipeline.extract(
        { kind: "url", url: "https://www.youtube.com/shorts/demo" },
        {
          signal: new AbortController().signal,
          onProgress: (event) => progress.push(event),
        },
      ),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ClaimExtractionError>>({
        name: "ClaimExtractionError",
        code: "MALFORMED_CLAIM_EXTRACTION",
        message: "Gemini returned an invalid transcript or claim structure.",
        retryable: true,
      }),
    );
    expect(progress).toEqual([
      {
        type: "progress",
        stage: "extracting",
        message: "Extracting transcript and financial claims",
      },
    ]);
  });
});
